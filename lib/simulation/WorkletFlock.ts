
import type { SharedValue } from 'react-native-reanimated';

export type FlockState = {
    x: Float32Array;
    y: Float32Array;
    vx: Float32Array;
    vy: Float32Array;
    count: number;
    width: number;
    height: number;
    gridCells: Int32Array;
    gridNext: Int32Array;
    cellSize: number;
    gridW: number;
    gridH: number;
};

// Removed global FLOCK_STORE to prevent crashes. State is now passed via SharedValue.

export function initUIFlock(
    sv: SharedValue<FlockState | null>, // Pass SharedValue container
    capacity: number,
    width: number,
    height: number,
    initialCount: number
) {
    'worklet';
    try {
        if (!sv.value) {
            console.log('[Worklet] Init: Start', capacity, width, height);
            const state = createFlockState(capacity, width, height);
            console.log('[Worklet] Init: State Created', state ? 'OK' : 'NULL');
            spawnBoids(state, initialCount);
            console.log('[Worklet] Init: Boids Spawned');
            sv.value = state;
            console.log('[Worklet] Init: Assigned to SV');
        }
    } catch (e) {
        console.error('[Worklet] Init Error:', e);
    }
}

export function resetUIFlock(sv: SharedValue<FlockState | null>) {
    'worklet';
    console.log('[Worklet] Resetting Flock State');
    sv.value = null;
}
// ...
export function createFlockState(capacity: number, width: number, height: number): FlockState {
    'worklet';
    const cellSize = 32; // "Movement Accuracy"
    const gridW = Math.ceil(width / cellSize);
    const gridH = Math.ceil(height / cellSize);
    const gridSize = gridW * gridH;

    return {
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        vx: new Float32Array(capacity),
        vy: new Float32Array(capacity),
        count: 0,
        width,
        height,
        gridCells: new Int32Array(gridSize),
        gridNext: new Int32Array(capacity),
        cellSize,
        gridW,
        gridH
    };
};

// Helper to spawn boids
export function spawnBoids(state: FlockState, count: number) {
    'worklet';
    const start = state.count;
    const end = Math.min(count, state.x.length);
    if (end <= start) return;

    for (let i = start; i < end; i++) {
        state.x[i] = Math.random() * state.width;
        state.y[i] = Math.random() * state.height;
        state.vx[i] = (Math.random() - 0.5) * 4;
        state.vy[i] = (Math.random() - 0.5) * 4;
    }
    state.count = end;
}




// Grid Update Helper - Optimized
function updateGrid(state: FlockState) {
    'worklet';
    const { gridCells, gridNext, x, y, count, cellSize, gridW, gridH } = state;
    // Fast fill is better than loop if available, but TypedArray.fill is fast
    gridCells.fill(-1);

    // Using local vars for slightly faster access
    const invCellSize = 1 / cellSize;

    for (let i = 0; i < count; i++) {
        // Fast floor using bitwise OR 0 (only works for positive integers, coords are positive)
        const cx = (x[i] * invCellSize) | 0;
        const cy = (y[i] * invCellSize) | 0;

        // Boundary check - simplified
        // We know standard simulation bounds, but keeping check is safe
        if (cx >= 0 && cx < gridW && cy >= 0 && cy < gridH) {
            const idx = cy * gridW + cx;
            gridNext[i] = gridCells[idx];
            gridCells[idx] = i;
        } else {
            gridNext[i] = -1;
        }
    }
}

export function updateFlock(
    state: FlockState,
    dt: number,
    params: {
        perception: number;
        maxSpeed: number;
        maxForce: number;
        sepMult: number;
        aliMult: number;
        cohMult: number;
        drag: number;
        noise: number;
        alignBias: number;
        bounce: boolean;
        explosion?: { x: number, y: number, radius: number, strength: number };
        attractor?: { x: number, y: number, radius: number, strength: number };
    }
) {
    'worklet';
    const {
        perception, maxSpeed, maxForce,
        sepMult, aliMult, cohMult,
        drag, noise, alignBias, bounce, explosion, attractor
    } = params;

    const maxSpeedSq = maxSpeed * maxSpeed;
    const maxForceSq = maxForce * maxForce;
    const minSpeedSq = 1.0; // 1.0 * 1.0
    const radSq = perception * perception;
    const { gridW, gridH, gridCells, gridNext } = state;
    const { x, y, vx, vy, count, cellSize } = state;
    const invCellSize = 1 / cellSize;

    // Update Spatial Grid
    updateGrid(state);

    // Bias optimization
    const effBias = Math.max(0.01, alignBias);
    const useBias = Math.abs(effBias - 1.0) > 0.01;
    const width = state.width;
    const height = state.height;

    // Cache math functions
    const sqrt = Math.sqrt;
    const random = Math.random;

    for (let i = 0; i < count; i++) {
        let sepX = 0, sepY = 0;
        let aliX = 0, aliY = 0;
        let cohX = 0, cohY = 0;
        let nNeighbors = 0;

        const px = x[i];
        const py = y[i];
        const pvx = vx[i];
        const pvy = vy[i];

        const cx = (px * invCellSize) | 0;
        const cy = (py * invCellSize) | 0;

        // Pre-calc mag for bias
        let myMag = 0;
        if (useBias) {
            myMag = sqrt(pvx * pvx + pvy * pvy) || 0.001;
        }

        // Neighbors - Spatial Grid Search
        // Unroll loops? Maybe overkill, but let's keep it tight.
        const startY = (cy - 1) < 0 ? 0 : cy - 1;
        const endY = (cy + 1) >= gridH ? gridH - 1 : cy + 1;
        const startX = (cx - 1) < 0 ? 0 : cx - 1;
        const endX = (cx + 1) >= gridW ? gridW - 1 : cx + 1;

        for (let ny = startY; ny <= endY; ny++) {
            const rowOffset = ny * gridW;
            for (let nx = startX; nx <= endX; nx++) {
                let j = gridCells[rowOffset + nx];
                while (j !== -1) {
                    if (i !== j) {
                        // FPS Optimization: Limit neighbors
                        if (nNeighbors >= 25) break;

                        const ox = x[j];
                        const oy = y[j];
                        const diffX = px - ox;
                        const diffY = py - oy;

                        // Fast bounding box check before square dist
                        if (diffX > -perception && diffX < perception &&
                            diffY > -perception && diffY < perception) {

                            const distSq = diffX * diffX + diffY * diffY;

                            if (distSq < radSq && distSq > 0) {
                                nNeighbors++;
                                const invDistSq = 1.0 / distSq;

                                sepX += diffX * invDistSq;
                                sepY += diffY * invDistSq;
                                cohX += ox;
                                cohY += oy;

                                const ovx = vx[j];
                                const ovy = vy[j];

                                if (useBias) {
                                    const oMag = sqrt(ovx * ovx + ovy * ovy) || 0.001;
                                    const dot = (pvx * ovx + pvy * ovy) / (myMag * oMag);
                                    // Math.pow is expensive, maybe simple bias?
                                    // Keep for now as quality
                                    var weight = Math.pow(effBias, dot);
                                    aliX += ovx * weight;
                                    aliY += ovy * weight;
                                } else {
                                    aliX += ovx;
                                    aliY += ovy;
                                }
                            }
                        }
                    }
                    j = gridNext[j];
                }
                if (nNeighbors >= 25) break; // Break out of grid loop too
            }
        }

        let fx = 0;
        let fy = 0;

        if (nNeighbors > 0) {
            const invCount = 1.0 / nNeighbors;

            // Separation
            const sepLenSq = sepX * sepX + sepY * sepY;
            if (sepLenSq > 0) {
                // Inline normalize & limit
                const invLen = maxSpeed / sqrt(sepLenSq);
                sepX = (sepX * invLen) - pvx;
                sepY = (sepY * invLen) - pvy;

                const fSq = sepX * sepX + sepY * sepY;
                if (fSq > maxForceSq) {
                    const s = maxForce / sqrt(fSq);
                    sepX *= s; sepY *= s;
                }
                fx += sepX * sepMult;
                fy += sepY * sepMult;
            }

            // Cohesion
            cohX *= invCount;
            cohY *= invCount;
            let cDx = cohX - px;
            let cDy = cohY - py;
            const cDistSq = cDx * cDx + cDy * cDy;
            if (cDistSq > 0) {
                const invLen = maxSpeed / sqrt(cDistSq);
                cDx = (cDx * invLen) - pvx;
                cDy = (cDy * invLen) - pvy;

                const fSq = cDx * cDx + cDy * cDy;
                if (fSq > maxForceSq) {
                    const s = maxForce / sqrt(fSq);
                    cDx *= s; cDy *= s;
                }
                fx += cDx * cohMult;
                fy += cDy * cohMult;
            }

            // Alignment
            aliX *= invCount;
            aliY *= invCount;
            const aLenSq = aliX * aliX + aliY * aliY;
            if (aLenSq > 0) {
                const invLen = maxSpeed / sqrt(aLenSq);
                aliX = (aliX * invLen) - pvx;
                aliY = (aliY * invLen) - pvy;

                const fSq = aliX * aliX + aliY * aliY;
                if (fSq > maxForceSq) {
                    const s = maxForce / sqrt(fSq);
                    aliX *= s; aliY *= s;
                }
                fx += aliX * aliMult;
                fy += aliY * aliMult;
            }
        }

        let nvx = pvx + fx;
        let nvy = pvy + fy;

        if (drag > 0) {
            // Pre-calculate 1-drag outside? No, drag is dynamic prop
            const dragFactor = 1 - drag;
            nvx *= dragFactor;
            nvy *= dragFactor;
        }

        if (noise > 0) {
            // Approximation of rotation for speed? 
            // Keep full cos/sin for quality
            const angle = (random() - 0.5) * noise * 2;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            const _nvx = nvx * c - nvy * s;
            const _nvy = nvx * s + nvy * c;
            nvx = _nvx;
            nvy = _nvy;
        }

        if (explosion) {
            const ex = explosion.x - px;
            const ey = explosion.y - py;
            const distSq = ex * ex + ey * ey;
            const rSq = explosion.radius * explosion.radius;
            if (distSq < rSq) {
                const dist = sqrt(distSq) || 0.001;
                const force = (1.0 - dist / explosion.radius) * explosion.strength;
                // dir is -ex/dist
                nvx += (-ex / dist) * force;
                nvy += (-ey / dist) * force;
            }
        }

        if (attractor) {
            const ax = attractor.x - px;
            const ay = attractor.y - py;
            const distSq = ax * ax + ay * ay;
            const dist = sqrt(distSq) || 0.001;
            // Normalize direction
            const dirX = ax / dist;
            const dirY = ay / dist;
            nvx += dirX * attractor.strength;
            nvy += dirY * attractor.strength;
        }

        const speedSq = nvx * nvx + nvy * nvy;
        if (speedSq > maxSpeedSq) {
            const s = maxSpeed / sqrt(speedSq);
            nvx *= s;
            nvy *= s;
        } else if (speedSq < minSpeedSq && speedSq > 0.000001) {
            // Keep min speed to prevent stopping completely
            const s = 1.0 / sqrt(speedSq); // minSpeed is 1
            nvx *= s;
            nvy *= s;
        }

        let nx = px + nvx * dt;
        let ny = py + nvy * dt;

        if (bounce) {
            if (nx < 0) { nx = 0; nvx *= -1; }
            else if (nx > width) { nx = width; nvx *= -1; }
            if (ny < 0) { ny = 0; nvy *= -1; }
            else if (ny > height) { ny = height; nvy *= -1; }
        } else {
            if (nx < 0) nx = width;
            else if (nx > width) nx = 0;
            if (ny < 0) ny = height;
            else if (ny > height) ny = 0;
        }

        x[i] = nx;
        y[i] = ny;
        vx[i] = nvx;
        vy[i] = nvy;
    }
}

