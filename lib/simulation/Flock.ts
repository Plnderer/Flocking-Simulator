import { DEFAULTS } from '../../constants/defaults';
import { Boid } from './Boid';
import { FlockingRules } from './FlockingRules';
import { SpatialGrid } from './SpatialGrid';
import { Vector2D } from './Vector2D';

export class Flock {
    boids: Boid[] = [];
    grid: SpatialGrid;
    width: number = 0;
    height: number = 0;

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
            attractor?: { x: number, y: number, strength: number }; // For touch interaction
        }
    ) {
        // 1. Rebuild Grid
        this.grid = new SpatialGrid(this.width, this.height, params.perceptionRadius); // Optim: Reuse grid or clear?
        // Clearing is better than new allocation if structure allows
        // My SpatialGrid.clear() is available.
        // However, if cell size changes, we need new grid.
        // Let's assume cell size changes rarely.
        // Actually, creating new Map is fast enough for <2000 items usually, but clearing is better.
        // But currently I don't check if perceptionRadius changed.
        // Just simple: clear and re-add.
        this.grid.clear();
        for (const boid of this.boids) {
            this.grid.add(boid);
        }

        const { perceptionRadius, maxSpeed, maxForce, separationWeight, alignmentWeight, cohesionWeight, attractor } = params;

        // 2. Update Boids
        for (const boid of this.boids) {
            const neighbors = this.grid.query(boid, perceptionRadius);

            const sep = FlockingRules.separation(boid, neighbors, perceptionRadius, maxForce, maxSpeed);
            const ali = FlockingRules.alignment(boid, neighbors, maxForce, maxSpeed);
            const coh = FlockingRules.cohesion(boid, neighbors, maxForce, maxSpeed);

            sep.mult(separationWeight);
            ali.mult(alignmentWeight);
            coh.mult(cohesionWeight);

            // Apply forces
            boid.vx += sep.x + ali.x + coh.x;
            boid.vy += sep.y + ali.y + coh.y;

            // Attractor (Touch)
            if (attractor) {
                const attrForce = new Vector2D(attractor.x - boid.x, attractor.y - boid.y);
                const dist = attrForce.mag();
                if (dist > 0 && dist < 300) { // Limit attraction range
                    attrForce.normalize();
                    attrForce.mult(maxForce * attractor.strength); // Stronger than normal forces
                    boid.vx += attrForce.x;
                    boid.vy += attrForce.y;
                }
            }

            // Limit speed
            const speedSq = boid.vx * boid.vx + boid.vy * boid.vy;
            if (speedSq > maxSpeed * maxSpeed) {
                const speed = Math.sqrt(speedSq);
                boid.vx = (boid.vx / speed) * maxSpeed;
                boid.vy = (boid.vy / speed) * maxSpeed;
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
                    id: i, // ID might conflict if we reduced then increased. Best to use unique ID counter? 
                    // For now index is fine if we just pop/push.
                    // But if we want consistent ID, use a counter.
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
