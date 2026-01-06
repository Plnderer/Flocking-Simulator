import { Boid } from './Boid';

export class SpatialGrid {
    private cellSize: number;
    private width: number;
    private height: number;
    private grid: Map<string, Boid[]>;

    constructor(width: number, height: number, cellSize: number) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.grid = new Map();
    }

    clear() {
        this.grid.clear();
    }

    private getKey(x: number, y: number): string {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        return `${col},${row}`;
    }

    add(boid: Boid) {
        const key = this.getKey(boid.x, boid.y);
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        this.grid.get(key)!.push(boid);
    }

    query(boid: Boid, radius: number): Boid[] {
        const neighbors: Boid[] = [];
        const col = Math.floor(boid.x / this.cellSize);
        const row = Math.floor(boid.y / this.cellSize);

        // Check 3x3 surrounding cells
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const key = `${col + i},${row + j}`;
                const cellBoids = this.grid.get(key);
                if (cellBoids) {
                    for (const other of cellBoids) {
                        if (other.id !== boid.id) {
                            const dx = other.x - boid.x;
                            const dy = other.y - boid.y;
                            if (dx * dx + dy * dy < radius * radius) {
                                neighbors.push(other);
                            }
                        }
                    }
                }
            }
        }
        return neighbors;
    }
}
