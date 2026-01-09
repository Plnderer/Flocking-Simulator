

export type FlockState = {
    x: Float32Array;
    y: Float32Array;
    vx: Float32Array;
    vy: Float32Array;
    count: number;
    width: number;
    height: number;
    // Grid memory
    gridCells: Int32Array;
    gridNext: Int32Array;
    // Tmp arrays for colors etc if needed?
};

// Global state on UI thread (Reanimated shareable)
let uiFlockState: FlockState | null = null;

export function getUIFlockState() {
    'worklet';
    return uiFlockState;
}

export function initUIFlock(capacity: number, width: number, height: number, initialCount: number) {
    'worklet';
    if (!uiFlockState) {
        uiFlockState = createFlockState(capacity, width, height);
        spawnBoids(uiFlockState, initialCount);
    }
}

export function resetUIFlock() {
    'worklet';
    uiFlockState = null; // Forces re-creation
}


// Pure function to initialize state
export function createFlockState(capacity: number, width: number, height: number): FlockState {
    'worklet';
    return {
        x: new Float32Array(capacity),
        y: new Float32Array(capacity),
        vx: new Float32Array(capacity),
        vy: new Float32Array(capacity),
        count: 0,
        width,
        height,
        // Grid: assume max 100x100 grid = 10000 cells? 
        // Let's make it dynamic or big enough.
        // Actually, for worklets, standard TypedArrays are fine.
        gridCells: new Int32Array(100 * 100).fill(-1),
        gridNext: new Int32Array(capacity).fill(-1),
    };
}

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

// Logic for grid
function updateGrid(state: FlockState, cellSize: number) {
    'worklet';
    const cols = Math.ceil(state.width / cellSize);
    const rows = Math.ceil(state.height / cellSize);
    const totalCells = cols * rows;

    // Resize grid cells if needed
    if (state.gridCells.length < totalCells) {
        state.gridCells = new Int32Array(totalCells);
    }

    // Reset grid
    // For Int32Array, fill is fast
    state.gridCells.fill(-1, 0, totalCells);

    // Add boids
    for (let i = 0; i < state.count; i++) {
        let cx = Math.floor(state.x[i] / cellSize);
        let cy = Math.floor(state.y[i] / cellSize);

        // Clamp to valid cell
        if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
        if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;

        const cellIdx = cy * cols + cx;

        // Linked list insertion
        state.gridNext[i] = state.gridCells[cellIdx];
        state.gridCells[cellIdx] = i;
    }

    return { cols, rows };
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
    }
) {
    'worklet';
    const {
        perception, maxSpeed, maxForce,
        sepMult, aliMult, cohMult,
        drag, noise, alignBias, bounce, explosion
    } = params;

    const cellSize = Math.max(perception, 10);
    const { cols, rows } = updateGrid(state, cellSize);
    const radSq = perception * perception;
    const maxSpeedSq = maxSpeed * maxSpeed;
    const maxForceSq = maxForce * maxForce;

    // Bias optimization
    const effBias = Math.max(0.01, alignBias);
    const useBias = Math.abs(effBias - 1.0) > 0.01;

    for (let i = 0; i < state.count; i++) {
        let sepX = 0, sepY = 0;
        let aliX = 0, aliY = 0;
        let cohX = 0, cohY = 0;
        let count = 0;

        const px = state.x[i];
        const py = state.y[i];
        const pvx = state.vx[i];
        const pvy = state.vy[i];

        const cx = Math.floor(px / cellSize);
        const cy = Math.floor(py / cellSize);

        // Pre-calc mag for bias
        let myMag = 0;
        if (useBias) {
            myMag = Math.sqrt(pvx * pvx + pvy * pvy) || 0.001;
        }

        // Neighbors
        for (let dy = -1; dy <= 1; dy++) {
            const ny = cy + dy;
            if (ny < 0 || ny >= rows) continue;
            for (let dx = -1; dx <= 1; dx++) {
                const nx = cx + dx;
                if (nx < 0 || nx >= cols) continue;

                const cellIdx = ny * cols + nx;
                let otherIdx = state.gridCells[cellIdx];

                while (otherIdx !== -1) {
                    if (otherIdx !== i) {
                        const ox = state.x[otherIdx];
                        const oy = state.y[otherIdx];
                        const diffX = px - ox;
                        const diffY = py - oy;
                        const distSq = diffX * diffX + diffY * diffY;

                        if (distSq > 0 && distSq < radSq) {
                            count++;
                            const invDistSq = 1.0 / distSq;

                            // Sep
                            sepX += diffX * invDistSq;
                            sepY += diffY * invDistSq;

                            // Cohesion - Accumulate position
                            cohX += ox;
                            cohY += oy;

                            // Align
                            const ovx = state.vx[otherIdx];
                            const ovy = state.vy[otherIdx];

                            let weight = 1.0;
                            if (useBias) {
                                // Dot product alignment
                                const oMag = Math.sqrt(ovx * ovx + ovy * ovy) || 0.001;
                                const dot = (pvx * ovx + pvy * ovy) / (myMag * oMag);
                                weight = Math.pow(effBias, dot); // Safe pow needed? Typescript `Math.pow` is fine, logic handled.
                                // Note: dot is -1..1. effBias^dot handle carefully. 
                                // Handled in previous step logic, repeating here.
                            }
                            aliX += ovx * weight;
                            aliY += ovy * weight;
                        }
                    }
                    otherIdx = state.gridNext[otherIdx];
                }
            }
        }

        let fx = 0;
        let fy = 0;

        if (count > 0) {
            const invCount = 1.0 / count;

            // Separation
            const sepLenSq = sepX * sepX + sepY * sepY;
            if (sepLenSq > 0) {
                const invLen = 1.0 / Math.sqrt(sepLenSq);
                sepX = (sepX * invLen * maxSpeed) - pvx;
                sepY = (sepY * invLen * maxSpeed) - pvy;

                // Limit
                const fSq = sepX * sepX + sepY * sepY;
                if (fSq > maxForceSq) {
                    const s = maxForce / Math.sqrt(fSq);
                    sepX *= s; sepY *= s;
                }
                fx += sepX * sepMult;
                fy += sepY * sepMult;
            }

            // Cohesion
            cohX *= invCount;
            cohY *= invCount;
            // Steer towards
            let cDx = cohX - px;
            let cDy = cohY - py;
            const cDistSq = cDx * cDx + cDy * cDy;
            if (cDistSq > 0) {
                const invLen = 1.0 / Math.sqrt(cDistSq);
                cDx = (cDx * invLen * maxSpeed) - pvx;
                cDy = (cDy * invLen * maxSpeed) - pvy;

                const fSq = cDx * cDx + cDy * cDy;
                if (fSq > maxForceSq) {
                    const s = maxForce / Math.sqrt(fSq);
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
                const invLen = 1.0 / Math.sqrt(aLenSq);
                aliX = (aliX * invLen * maxSpeed) - pvx;
                aliY = (aliY * invLen * maxSpeed) - pvy;

                const fSq = aliX * aliX + aliY * aliY;
                if (fSq > maxForceSq) {
                    const s = maxForce / Math.sqrt(fSq);
                    aliX *= s; aliY *= s;
                }
                fx += aliX * aliMult;
                fy += aliY * aliMult;
            }
        }

        // Apply
        let nvx = pvx + fx;
        let nvy = pvy + fy;

        // Drag
        if (drag > 0) {
            nvx *= (1 - drag);
            nvy *= (1 - drag);
        }

        // Noise
        if (noise > 0) {
            const angle = (Math.random() - 0.5) * noise * 2;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            const _nvx = nvx * c - nvy * s;
            const _nvy = nvx * s + nvy * c;
            nvx = _nvx;
            nvy = _nvy;
        }

        // Explosion interaction
        if (explosion) {
            const ex = explosion.x - px;
            const ey = explosion.y - py;
            const distSq = ex * ex + ey * ey;
            // Blast radius
            if (distSq < explosion.radius * explosion.radius) {
                const dist = Math.sqrt(distSq) || 0.001;
                // Force falls off with distance
                const force = (1.0 - dist / explosion.radius) * explosion.strength;
                // Push away
                const dirX = -ex / dist;
                const dirY = -ey / dist;
                nvx += dirX * force;
                nvy += dirY * force;
            }
        }

        // Speed Limit
        const speedSq = nvx * nvx + nvy * nvy;
        if (speedSq > maxSpeedSq) {
            const s = maxSpeed / Math.sqrt(speedSq);
            nvx *= s;
            nvy *= s;
        } else {
            const minSpeed = maxSpeed * 0.1; // Default min speed
            if (speedSq < minSpeed * minSpeed && speedSq > 0.000001) {
                const s = minSpeed / Math.sqrt(speedSq);
                nvx *= s;
                nvy *= s;
            }
        }

        // Integrate
        let nx = px + nvx * dt;
        let ny = py + nvy * dt;

        // Bounce or Wrap
        if (bounce) {
            if (nx < 0) { nx = 0; nvx *= -1; }
            if (nx > state.width) { nx = state.width; nvx *= -1; }
            if (ny < 0) { ny = 0; nvy *= -1; }
            if (ny > state.height) { ny = state.height; nvy *= -1; }
        } else {
            if (nx < 0) nx = state.width;
            if (nx > state.width) nx = 0;
            if (ny < 0) ny = state.height;
            if (ny > state.height) ny = 0;
        }

        state.x[i] = nx;
        state.y[i] = ny;
        state.vx[i] = nvx;
        state.vy[i] = nvy;
    }
}
