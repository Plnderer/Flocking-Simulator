import { Boid } from './Boid';
import { Vector2D } from './Vector2D';

const steer = new Vector2D();
const diff = new Vector2D();
const sum = new Vector2D();

export const FlockingRules = {
    separation: (boid: Boid, neighbors: Boid[], perception: number, maxForce: number, maxSpeed: number, out?: Vector2D): Vector2D => {
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
                // Optimized to reuse internal vector for math
                steer.sub(diff.set(boid.vx, boid.vy)); // reuse diff for current velocity
                steer.limit(maxForce);

                if (out) return out.set(steer.x, steer.y);
                return steer.copy();
            }
        }
        if (out) return out.set(0, 0);
        return new Vector2D(0, 0);
    },

    alignment: (boid: Boid, neighbors: Boid[], maxForce: number, maxSpeed: number, out?: Vector2D): Vector2D => {
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
            // reuse diff for current velocity
            sum.sub(diff.set(boid.vx, boid.vy));
            sum.limit(maxForce);
            if (out) return out.set(sum.x, sum.y);
            return sum.copy();
        }
        if (out) return out.set(0, 0);
        return new Vector2D(0, 0);
    },

    cohesion: (boid: Boid, neighbors: Boid[], maxForce: number, maxSpeed: number, out?: Vector2D): Vector2D => {
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

            // reuse diff for current velocity
            target.sub(diff.set(boid.vx, boid.vy));
            target.limit(maxForce);
            if (out) return out.set(target.x, target.y);
            return target.copy();
        }
        if (out) return out.set(0, 0);
        return new Vector2D(0, 0);
    }
};
