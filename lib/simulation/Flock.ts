import { DEFAULTS } from '../../constants/defaults';
import { SpatialGrid, type NeighborAccumulation } from './SpatialGrid';

export class Flock {
    count: number = 0;

    // Structure of Arrays (SoA)
    // Pre-allocate for max capacity to avoid re-allocation during runtime
    x: Float32Array;
    y: Float32Array;
    vx: Float32Array;
    vy: Float32Array;

    grid: SpatialGrid;
    width: number = 0;
    height: number = 0;

    // Reusable accumulation object
    private _accum: NeighborAccumulation = {
        count: 0,
        sepX: 0, sepY: 0,
        alignX: 0, alignY: 0,
        cohX: 0, cohY: 0,
    };

    constructor(initialCount: number = DEFAULTS.BOID_COUNT) {
        const capacity = 5000; // Hard cap buffer size
        this.x = new Float32Array(capacity);
        this.y = new Float32Array(capacity);
        this.vx = new Float32Array(capacity);
        this.vy = new Float32Array(capacity);

        // Initial dummy size
        this.grid = new SpatialGrid(100, 100, DEFAULTS.PERCEPTION_RADIUS);
        this.setBoidCount(initialCount);
    }

    resize(width: number, height: number, perceptionRadius: number) {
        this.width = width;
        this.height = height;
        this.grid = new SpatialGrid(width, height, perceptionRadius);

        // Clamp positions
        for (let i = 0; i < this.count; i++) {
            if (this.x[i] > width) this.x[i] = width;
            if (this.y[i] > height) this.y[i] = height;
        }
    }

    setBoidCount(targetCount: number) {
        if (targetCount === this.count) return;

        // If increasing, initialize new boids
        if (targetCount > this.count) {
            for (let i = this.count; i < targetCount; i++) {
                this.x[i] = Math.random() * (this.width || 100);
                this.y[i] = Math.random() * (this.height || 100);
                this.vx[i] = (Math.random() - 0.5) * 4;
                this.vy[i] = (Math.random() - 0.5) * 4;
            }
        }

        this.count = targetCount;
    }

    update(
        dt: number,
        params: {
            perceptionRadius: number;
            maxSpeed: number;
            maxForce: number;
            separationWeight: number;
            alignmentWeight: number;
            cohesionWeight: number;
            drag: number;
            noise: number;
            alignmentBias: number;
            attractor?: { x: number, y: number, strength: number };
        }
    ) {
        // 1. Rebuild Grid
        const { perceptionRadius, maxSpeed, maxForce, separationWeight, alignmentWeight, cohesionWeight, drag, noise, alignmentBias, attractor } = params;

        if (this.grid.getCellSize() !== perceptionRadius) {
            this.grid = new SpatialGrid(this.width, this.height, perceptionRadius);
        } else {
            this.grid.clear();
        }

        // Add indices to grid
        for (let i = 0; i < this.count; i++) {
            this.grid.add(i, this.x[i], this.y[i]);
        }

        const perceptionRadiusSq = perceptionRadius * perceptionRadius;
        const maxSpeedSq = maxSpeed * maxSpeed;

        // 2. Physics Loop
        for (let i = 0; i < this.count; i++) {
            const accum = this.grid.accumulate(
                i,
                this.x[i], this.y[i], this.vx[i], this.vy[i],
                this.x, this.y, this.vx, this.vy,
                perceptionRadiusSq, alignmentBias, this._accum
            );

            let forceX = 0;
            let forceY = 0;

            if (accum.count > 0) {
                const invCount = 1 / accum.count;

                // Separation
                let sepX = accum.sepX * invCount;
                let sepY = accum.sepY * invCount;
                const sepMagSq = sepX * sepX + sepY * sepY;
                if (sepMagSq > 0) {
                    const invMag = 1 / Math.sqrt(sepMagSq);
                    sepX = (sepX * invMag * maxSpeed) - this.vx[i];
                    sepY = (sepY * invMag * maxSpeed) - this.vy[i];
                    // Limit force
                    const forceSq = sepX * sepX + sepY * sepY;
                    if (forceSq > maxForce * maxForce) {
                        const invF = maxForce / Math.sqrt(forceSq);
                        sepX *= invF;
                        sepY *= invF;
                    }
                }

                // Alignment
                let aliX = accum.alignX * invCount;
                let aliY = accum.alignY * invCount;
                const aliMagSq = aliX * aliX + aliY * aliY;
                if (aliMagSq > 0) {
                    const invMag = 1 / Math.sqrt(aliMagSq);
                    aliX = (aliX * invMag * maxSpeed) - this.vx[i];
                    aliY = (aliY * invMag * maxSpeed) - this.vy[i];
                    const forceSq = aliX * aliX + aliY * aliY;
                    if (forceSq > maxForce * maxForce) {
                        const invF = maxForce / Math.sqrt(forceSq);
                        aliX *= invF;
                        aliY *= invF;
                    }
                }

                // Cohesion
                let cohX = (accum.cohX * invCount) - this.x[i];
                let cohY = (accum.cohY * invCount) - this.y[i];
                const cohMagSq = cohX * cohX + cohY * cohY;
                if (cohMagSq > 0) {
                    const invMag = 1 / Math.sqrt(cohMagSq);
                    cohX = (cohX * invMag * maxSpeed) - this.vx[i];
                    cohY = (cohY * invMag * maxSpeed) - this.vy[i];
                    const forceSq = cohX * cohX + cohY * cohY;
                    if (forceSq > maxForce * maxForce) {
                        const invF = maxForce / Math.sqrt(forceSq);
                        cohX *= invF;
                        cohY *= invF;
                    }
                }

                forceX += sepX * separationWeight + aliX * alignmentWeight + cohX * cohesionWeight;
                forceY += sepX * separationWeight + aliY * alignmentWeight + cohY * cohesionWeight;
            }

            // Apply Forces
            this.vx[i] += forceX;
            this.vy[i] += forceY;

            // Drag
            if (drag > 0) {
                this.vx[i] *= (1 - drag);
                this.vy[i] *= (1 - drag);
            }

            // Noise
            if (noise > 0) {
                const angle = (Math.random() - 0.5) * noise * 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const nvx = this.vx[i] * cos - this.vy[i] * sin;
                const nvy = this.vx[i] * sin + this.vy[i] * cos;
                this.vx[i] = nvx;
                this.vy[i] = nvy;
            }

            // Attractor
            if (attractor) {
                let attrX = attractor.x - this.x[i];
                let attrY = attractor.y - this.y[i];
                const distSq = attrX * attrX + attrY * attrY;
                if (distSq > 0 && distSq < 300 * 300) {
                    const invDist = 1 / Math.sqrt(distSq);
                    attrX *= invDist;
                    attrY *= invDist;
                    // Strength multiplier
                    const s = maxForce * attractor.strength;
                    this.vx[i] += attrX * s;
                    this.vy[i] += attrY * s;
                }
            }

            // Limit Speed
            const currentSpeedSq = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
            if (currentSpeedSq > maxSpeedSq) {
                const invSpeed = 1 / Math.sqrt(currentSpeedSq);
                this.vx[i] = this.vx[i] * invSpeed * maxSpeed;
                this.vy[i] = this.vy[i] * invSpeed * maxSpeed;
            } else {
                // Min Speed Boost
                const minSpeed = maxSpeed * 0.5;
                if (currentSpeedSq < minSpeed * minSpeed && currentSpeedSq > 0.0001) {
                    const invSpeed = 1 / Math.sqrt(currentSpeedSq);
                    this.vx[i] = this.vx[i] * invSpeed * minSpeed;
                    this.vy[i] = this.vy[i] * invSpeed * minSpeed;
                }
            }

            // Integate
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;

            // Wrap
            if (this.x[i] < 0) this.x[i] = this.width;
            if (this.x[i] > this.width) this.x[i] = 0;
            if (this.y[i] < 0) this.y[i] = this.height;
            if (this.y[i] > this.height) this.y[i] = 0;
        }
    }
}
