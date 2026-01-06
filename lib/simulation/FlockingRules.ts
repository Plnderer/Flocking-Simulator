import { Boid } from './Boid';
import { Vector2D } from './Vector2D';

const steer = new Vector2D();
const diff = new Vector2D();
const sum = new Vector2D();

export const FlockingRules = {
    separation: (boid: Boid, neighbors: Boid[], perception: number, maxForce: number, maxSpeed: number): Vector2D => {
        steer.set(0, 0);
        let count = 0;

        for (const other of neighbors) {
            const d = Math.sqrt((boid.x - other.x) ** 2 + (boid.y - other.y) ** 2);
            // We can optimize strict separation distance if needed, but using perception is standard for basic boids
            // Usually separation radius is smaller, but prompts says "Cell size equals perception radius", implies unified radius or tuned weights.
            // Standard boids: weight distance.
            if (d < perception && d > 0) {
                diff.set(boid.x - other.x, boid.y - other.y);
                diff.normalize();
                diff.div(d); // Weight by distance
                steer.add(diff);
                count++;
            }
        }

        if (count > 0) {
            steer.div(count);
            if (steer.magSq() > 0) {
                steer.normalize();
                steer.mult(maxSpeed);
                const currentVel = new Vector2D(boid.vx, boid.vy);
                steer.sub(currentVel);
                steer.limit(maxForce);
                return steer; // Returns a mutable reference but caller usually copies or uses immediately.
                // Warning: 'steer' is global reused. Caller must use result immediately!
                // To be safe, return a copy or values. For performance, we might return values. 
                // Let's return a new Vector2D strictly to avoid side effects if caller stores it, 
                // OR caller must be aware. 
                // Given "Render 500-2000 boids at 60fps", let's return a new Vector2D or reuse a pool.
                // For now, return a new Vector2D to be safe.
                return steer.copy();
            }
        }
        return new Vector2D(0, 0);
    },

    alignment: (boid: Boid, neighbors: Boid[], maxForce: number, maxSpeed: number): Vector2D => {
        sum.set(0, 0);
        let count = 0;
        for (const other of neighbors) {
            sum.x += other.vx;
            sum.y += other.vy;
            count++;
        }

        if (count > 0) {
            sum.div(count);
            sum.normalize();
            sum.mult(maxSpeed);
            const currentVel = new Vector2D(boid.vx, boid.vy);
            sum.sub(currentVel);
            sum.limit(maxForce);
            return sum.copy();
        }
        return new Vector2D(0, 0);
    },

    cohesion: (boid: Boid, neighbors: Boid[], maxForce: number, maxSpeed: number): Vector2D => {
        sum.set(0, 0);
        let count = 0;
        for (const other of neighbors) {
            sum.x += other.x;
            sum.y += other.y;
            count++;
        }

        if (count > 0) {
            sum.div(count);
            // Steer towards target (sum)
            const target = sum;
            target.x -= boid.x;
            target.y -= boid.y; // Vector pointing from boid to target

            target.normalize();
            target.mult(maxSpeed);

            const currentVel = new Vector2D(boid.vx, boid.vy);
            target.sub(currentVel);
            target.limit(maxForce);
            return target.copy();
        }
        return new Vector2D(0, 0);
    }
};
