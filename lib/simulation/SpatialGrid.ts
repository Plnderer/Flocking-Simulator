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
    // Store indices instead of Boid objects
    // We'll flatten the grid: cells[cellIndex] = [boidIndex, boidIndex...]
    // Using a simple array of number arrays for flexibility, although a linked list in TypedArrays would be faster,
    // let's stick to Array<number[]> for now as it's already a huge improvement over Array<Boid[]>.
    // To truly optimize GC, we could use a fixed size TypedArray linked list, but that's complex to resize.
    // Let's optimize the inner loops first.
    private cells: number[][];

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
        // Clearing arrays is cheaper than reallocating
        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i].length = 0;
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

    add(index: number, x: number, y: number) {
        // Guard against NaN/Infinity
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const col = this.getCol(x);
        const row = this.getRow(y);
        const cellIndex = this.getIndex(col, row);

        // Safety check for bounds
        if (this.cells[cellIndex]) {
            this.cells[cellIndex].push(index);
        }
    }

    accumulate(
        subjectIndex: number,
        sx: number, sy: number, svx: number, svy: number,
        xArray: Float32Array, yArray: Float32Array, vxArray: Float32Array, vyArray: Float32Array,
        radiusSq: number, alignmentBias: number, out: NeighborAccumulation
    ): NeighborAccumulation {
        out.count = 0;
        out.sepX = 0;
        out.sepY = 0;
        out.alignX = 0;
        out.alignY = 0;
        out.cohX = 0;
        out.cohY = 0;

        // Guard against invalid inputs
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) return out;

        const col = this.getCol(sx);
        const row = this.getRow(sy);

        // Pre-calculate bias check
        // Prevent 0^negative which is Infinity.
        const effectiveBias = Math.max(0.01, alignmentBias);
        const useBias = effectiveBias !== 1.0;

        let myMag = 0;
        if (useBias) {
            myMag = Math.sqrt(svx * svx + svy * svy);
            if (myMag < 0.001) myMag = 0.001; // Avoid div by zero
        }

        // Check 3x3 surrounding cells
        for (let i = -1; i <= 1; i++) {
            const ncol = col + i;
            if (ncol < 0 || ncol >= this.cols) continue;
            for (let j = -1; j <= 1; j++) {
                const nrow = row + j;
                if (nrow < 0 || nrow >= this.rows) continue;

                const cellIndices = this.cells[this.getIndex(ncol, nrow)];
                // Guard against undefined cell
                if (!cellIndices) continue;

                const len = cellIndices.length;
                if (len === 0) continue;

                for (let k = 0; k < len; k++) {
                    const otherIdx = cellIndices[k];
                    if (otherIdx !== subjectIndex) {
                        const ox = xArray[otherIdx];
                        const oy = yArray[otherIdx];
                        const dx = sx - ox;
                        const dy = sy - oy;
                        const distSq = dx * dx + dy * dy;

                        if (distSq > 0 && distSq < radiusSq) {
                            out.count++;
                            const invDistSq = 1 / distSq;
                            out.sepX += dx * invDistSq;
                            out.sepY += dy * invDistSq;

                            const ovx = vxArray[otherIdx];
                            const ovy = vyArray[otherIdx];

                            let weight = 1.0;
                            if (useBias) {
                                let otherMag = Math.sqrt(ovx * ovx + ovy * ovy);
                                if (otherMag < 0.001) otherMag = 0.001;

                                const dot = (svx * ovx + svy * ovy) / (myMag * otherMag);
                                // dot is -1 to 1. 0.01 ^ -1 = 100. maxBias usually 4.
                                // If bias is < 1, like 0, we clamped to 0.01.
                                weight = Math.pow(effectiveBias, dot);
                            }

                            out.alignX += ovx * weight;
                            out.alignY += ovy * weight;

                            out.cohX += ox;
                            out.cohY += oy;
                        }
                    }
                }
            }
        }

        return out;
    }
}
