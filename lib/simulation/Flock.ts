import { DEFAULTS } from '../../constants/defaults';
import { Boid } from './Boid';
import { SpatialGrid, type NeighborAccumulation } from './SpatialGrid';
import { Vector2D } from './Vector2D';

export class Flock {
    boids: Boid[] = [];
    grid: SpatialGrid;
    width: number = 0;
    height: number = 0;

    // Reuse vectors to avoid allocation
    private _sep = new Vector2D();
    private _ali = new Vector2D();
    private _coh = new Vector2D();
    private _attr = new Vector2D();
    private _accum: NeighborAccumulation = {
        count: 0,
        sepX: 0,
        sepY: 0,
        alignX: 0,
        alignY: 0,
        cohX: 0,
        cohY: 0,
    };

    constructor(count: number = DEFAULTS.BOID_COUNT) {
        // Initial dummy size, will be resized on first update
        this.grid = new SpatialGrid(100, 100, DEFAULTS.PERCEPTION_RADIUS);
        this.initBoids(count);
    }

    initBoids(count: number) {
        this.boids = [];
        for (let i = 0; i < count; i++) {
            this.boids.push({
                id: i,
                x: Math.random() * (this.width || 100),
                y: Math.random() * (this.height || 100),
                vx: (Math.random() - 0.5) * DEFAULTS.MAX_SPEED * 2,
                vy: (Math.random() - 0.5) * DEFAULTS.MAX_SPEED * 2,
            });
        }
    }

    resize(width: number, height: number, perceptionRadius: number) {
        this.width = width;
        this.height = height;
        // Recreate grid with new dimensions
        this.grid = new SpatialGrid(width, height, perceptionRadius);

        // Ensure boids are within bounds
        this.boids.forEach(b => {
            if (b.x > width) b.x = width;
            if (b.y > height) b.y = height;
        });
    }

    update(
        dt: number, // Delta time (seconds) - used for smoother movement integration if needed, usually 1.0 for simple Euler steps
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
            attractor?: { x: number, y: number, strength: number }; // For touch interaction
        }
    ) {
        // 1. Rebuild Grid
        if (this.grid.getCellSize() !== params.perceptionRadius) {
            this.grid = new SpatialGrid(this.width, this.height, params.perceptionRadius);
        } else {
            this.grid.clear();
        }

        for (const boid of this.boids) {
            this.grid.add(boid);
        }

        const { perceptionRadius, maxSpeed, maxForce, separationWeight, alignmentWeight, cohesionWeight, drag, noise, alignmentBias, attractor } = params;
        const perceptionRadiusSq = perceptionRadius * perceptionRadius;
        const maxSpeedSq = maxSpeed * maxSpeed;

        // 2. Update Boids
        for (const boid of this.boids) {
            // Pass alignmentBias to accumulator for weighted alignment
            const accum = this.grid.accumulate(boid, perceptionRadiusSq, alignmentBias, this._accum);

            if (accum.count > 0) {
                const invCount = 1 / accum.count;

                const sep = this._sep.set(accum.sepX * invCount, accum.sepY * invCount);
                if (sep.magSq() > 0) {
                    sep.normalize();
                    sep.mult(maxSpeed);
                    sep.x -= boid.vx;
                    sep.y -= boid.vy;
                    sep.limit(maxForce);
                } else {
                    sep.set(0, 0);
                }

                const ali = this._ali.set(accum.alignX * invCount, accum.alignY * invCount);
                if (ali.magSq() > 0) {
                    ali.normalize();
                    ali.mult(maxSpeed);
                    ali.x -= boid.vx;
                    ali.y -= boid.vy;
                    ali.limit(maxForce);
                } else {
                    ali.set(0, 0);
                }

                const coh = this._coh.set(
                    (accum.cohX * invCount) - boid.x,
                    (accum.cohY * invCount) - boid.y
                );
                if (coh.magSq() > 0) {
                    coh.normalize();
                    coh.mult(maxSpeed);
                    coh.x -= boid.vx;
                    coh.y -= boid.vy;
                    coh.limit(maxForce);
                } else {
                    coh.set(0, 0);
                }
            } else {
                this._sep.set(0, 0);
                this._ali.set(0, 0);
                this._coh.set(0, 0);
            }

            this._sep.mult(separationWeight);
            this._ali.mult(alignmentWeight);
            this._coh.mult(cohesionWeight);

            // Apply forces
            boid.vx += this._sep.x + this._ali.x + this._coh.x;
            boid.vy += this._sep.y + this._ali.y + this._coh.y;

            // Apply Drag (Friction)
            if (drag > 0) {
                boid.vx *= (1 - drag);
                boid.vy *= (1 - drag);
            }

            // Apply Noise (Rotation)
            if (noise > 0) {
                const angle = (Math.random() - 0.5) * noise * 2; // -noise to +noise
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const nvx = boid.vx * cos - boid.vy * sin;
                const nvy = boid.vx * sin + boid.vy * cos;
                boid.vx = nvx;
                boid.vy = nvy;
            }

            // Attractor (Touch)
            if (attractor) {
                const attrForce = this._attr.set(attractor.x - boid.x, attractor.y - boid.y);
                const distSq = attrForce.magSq();
                if (distSq > 0 && distSq < 300 * 300) { // Limit attraction range
                    const invDist = 1 / Math.sqrt(distSq);
                    attrForce.x *= invDist;
                    attrForce.y *= invDist;
                    attrForce.mult(maxForce * attractor.strength); // Stronger than normal forces
                    boid.vx += attrForce.x;
                    boid.vy += attrForce.y;
                }
            }

            // Limit speed (Max)
            const speedSq = boid.vx * boid.vx + boid.vy * boid.vy;
            if (speedSq > maxSpeedSq) {
                const invSpeed = 1 / Math.sqrt(speedSq);
                boid.vx = boid.vx * invSpeed * maxSpeed;
                boid.vy = boid.vy * invSpeed * maxSpeed;
            } else {
                // Minimum Speed (Propulsion)
                // If they slow down too much (due to drag), boost them back up.
                // This ensures "scattered" boids keep moving directly forward.
                const minSpeed = maxSpeed * 0.5; // Cruising speed
                const minSpeedSq = minSpeed * minSpeed;
                if (speedSq < minSpeedSq) {
                    if (speedSq > 0.0001) {
                        const invSpeed = 1 / Math.sqrt(speedSq);
                        boid.vx = boid.vx * invSpeed * minSpeed;
                        boid.vy = boid.vy * invSpeed * minSpeed;
                    } else {
                        // Dead stop? Kick them in a random direction
                        const angle = Math.random() * Math.PI * 2;
                        boid.vx = Math.cos(angle) * minSpeed;
                        boid.vy = Math.sin(angle) * minSpeed;
                    }
                }
            }

            // Update Position
            boid.x += boid.vx; // We assume dt=1 for step, since we run per frame. Scale if needed.
            boid.y += boid.vy;

            // Wrap Edges
            if (boid.x < 0) boid.x = this.width;
            if (boid.x > this.width) boid.x = 0;
            if (boid.y < 0) boid.y = this.height;
            if (boid.y > this.height) boid.y = 0;
        }
    }

    setBoidCount(count: number) {
        if (count === this.boids.length) return;

        if (count > this.boids.length) {
            // Add boids
            for (let i = this.boids.length; i < count; i++) {
                this.boids.push({
                    id: i,
                    x: Math.random() * this.width,
                    y: Math.random() * this.height,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4,
                });
            }
        } else {
            // Remove boids
            this.boids.splice(count);
        }
    }
}
