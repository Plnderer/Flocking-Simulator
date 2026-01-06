import { Boid } from './Boid';

export type NeighborAccumulation = {
    count: number;
    sepX: number;
    sepY: number;
    alignX: number;
    alignY: number;
    cohX: number;
    cohY: number;
};

export class SpatialGrid {
    private cellSize: number;
    private width: number;
    private height: number;
    private cols: number;
    private rows: number;
    private cells: Boid[][];

    constructor(width: number, height: number, cellSize: number) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.cols = Math.max(1, Math.ceil(width / cellSize));
        this.rows = Math.max(1, Math.ceil(height / cellSize));
        this.cells = new Array(this.cols * this.rows);
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = [];
        }
    }

    getCellSize(): number {
        return this.cellSize;
    }

    clear() {
        for (const cell of this.cells) {
            cell.length = 0;
        }
    }

    private getCol(x: number): number {
        let col = Math.floor(x / this.cellSize);
        if (col < 0) return 0;
        if (col >= this.cols) return this.cols - 1;
        return col;
    }

    private getRow(y: number): number {
        let row = Math.floor(y / this.cellSize);
        if (row < 0) return 0;
        if (row >= this.rows) return this.rows - 1;
        return row;
    }

    private getIndex(col: number, row: number): number {
        return row * this.cols + col;
    }

    add(boid: Boid) {
        const col = this.getCol(boid.x);
        const row = this.getRow(boid.y);
        const index = this.getIndex(col, row);
        if (this.cells[index]) {
            this.cells[index].push(boid);
        }
    }

    accumulate(boid: Boid, radiusSq: number, alignmentBias: number, out: NeighborAccumulation): NeighborAccumulation {
        out.count = 0;
        out.sepX = 0;
        out.sepY = 0;
        out.alignX = 0;
        out.alignY = 0;
        out.cohX = 0;
        out.cohY = 0;

        const col = this.getCol(boid.x);
        const row = this.getRow(boid.y);

        // Check 3x3 surrounding cells
        for (let i = -1; i <= 1; i++) {
            const ncol = col + i;
            if (ncol < 0 || ncol >= this.cols) continue;
            for (let j = -1; j <= 1; j++) {
                const nrow = row + j;
                if (nrow < 0 || nrow >= this.rows) continue;
                const cellBoids = this.cells[this.getIndex(ncol, nrow)];
                if (!cellBoids) continue;
                for (const other of cellBoids) {
                    if (other.id !== boid.id) {
                        const dx = boid.x - other.x;
                        const dy = boid.y - other.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq > 0 && distSq < radiusSq) {
                            out.count++;
                            const invDistSq = 1 / distSq;
                            out.sepX += dx * invDistSq;
                            out.sepY += dy * invDistSq;

                            // Alignment Bias: Weight neighbors by similarity in direction
                            // dot product of normalized velocities? 
                            // Simplification: dot product of unnormalized is fast, but bias is usually based on -1 to 1 range.
                            // Assuming velocities are relatively similar magnitude.
                            // Original repo: `opt.bias ** other.vel.dot(this.vel)` (presumably normalized if using dot for angle)
                            // Actually, let's normalize just for the dot product to be safe standard behavior

                            // Fast dot product approx (unnormalized)
                            // dot = vx*ox + vy*oy
                            // bias ^ dot
                            // If bias is 1, weight is 1.

                            let weight = 1.0;
                            if (alignmentBias !== 1.0) {
                                // Normalized Dot Product (Cosine Similarity)
                                const myMag = Math.sqrt(boid.vx * boid.vx + boid.vy * boid.vy) || 1;
                                const otherMag = Math.sqrt(other.vx * other.vx + other.vy * other.vy) || 1;
                                const dot = (boid.vx * other.vx + boid.vy * other.vy) / (myMag * otherMag);
                                // dot is -1 to 1
                                weight = Math.pow(alignmentBias, dot);
                            }

                            out.alignX += other.vx * weight;
                            out.alignY += other.vy * weight;

                            out.cohX += other.x;
                            out.cohY += other.y;
                        }
                    }
                }
            }
        }

        return out;
    }
}
