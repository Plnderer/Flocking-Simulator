
// Simple Uncompressed PNG Generator
// Bypasses complex compression to avoid dependencies

const CRC_TABLE = new Int32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c;
}

function crc32(buf: Uint8Array): number {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
}

function adler32(buf: Uint8Array): number {
    let a = 1, b = 0;
    const MOD = 65521;
    for (let i = 0; i < buf.length; i++) {
        a = (a + buf[i]) % MOD;
        b = (b + a) % MOD;
    }
    return ((b << 16) | a) >>> 0;
}

function writeUInt32BE(buf: Uint8Array, value: number, offset: number) {
    buf[offset] = (value >>> 24) & 0xFF;
    buf[offset + 1] = (value >>> 16) & 0xFF;
    buf[offset + 2] = (value >>> 8) & 0xFF;
    buf[offset + 3] = (value & 0xFF);
}

export function generateBoidPNG(width: number, height: number): Uint8Array {
    // 1. IHDR
    // Length (4), ChunkType (4), Data (13), CRC (4) = 25 bytes
    const ihdrLen = 13;
    const ihdrTotal = 4 + 4 + ihdrLen + 4;

    // 2. IDAT
    // Raw Data: (width * 4 + 1) * height
    // + Deflate Wrapper overhead approx 10-20 bytes for uncompressed block
    const rowSize = width * 4 + 1; // +1 for filter type
    const rawDataSize = rowSize * height;

    // Construct Raw Data (Scanlines)
    const rawData = new Uint8Array(rawDataSize);
    let ptr = 0;

    // Drawing Logic (Hardcoded for Boids)
    for (let y = 0; y < height; y++) {
        rawData[ptr++] = 0; // Filter: None
        for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, a = 0;

            // Left: Triangle (0-31)
            // Center (16,16), Tip(28,16), Back(4,8)-(4,24)
            if (x < 32) {
                if (x >= 4 && x <= 28) {
                    // Top: y = 8 + (x-4)/3. If y > yMin...
                    const yMin = 8 + (x - 4) / 3;
                    const yMax = 24 - (x - 4) / 3;
                    if (y >= yMin && y <= yMax) {
                        r = 255; g = 255; b = 255; a = 255;
                    }
                }
            } else {
                // Right: Circle (32-63)
                // Center (48,16), Rad 12
                const dx = x - 48;
                const dy = y - 16;
                // Simple anti-aliasing logic? Nope, binary for now.
                if (dx * dx + dy * dy <= 12 * 12) {
                    r = 255; g = 255; b = 255; a = 255;
                }
            }

            rawData[ptr++] = r;
            rawData[ptr++] = g;
            rawData[ptr++] = b;
            rawData[ptr++] = a;
        }
    }

    // Deflate (Store Mode)
    // Header (2), Block Header (5), Data (rawDataSize), Adler (4)
    // Supports up to 65535 bytes per block. 
    // Data size = 64*32*4+32 = 8224. Fits in one block.

    const zlibHeader = new Uint8Array([0x78, 0x01]); // Default compression, no window? Or 0x9C? 0x78 0x01 is standard.
    // Uncompressed Block: BFINAL=1, BTYPE=00
    // Byte: 0x01. Then LEN (2 bytes LE), NLEN (2 bytes LE).
    const blockHeader = new Uint8Array(5);
    blockHeader[0] = 0x01;
    const len = rawDataSize;
    // Little Endian for LEN/NLEN in Deflate
    blockHeader[1] = len & 0xFF;
    blockHeader[2] = (len >>> 8) & 0xFF;
    blockHeader[3] = (~len) & 0xFF;
    blockHeader[4] = ((~len) >>> 8) & 0xFF;

    const adler = adler32(rawData);
    const adlerBuf = new Uint8Array(4);
    writeUInt32BE(adlerBuf, adler, 0);

    const idatData = new Uint8Array(zlibHeader.length + blockHeader.length + rawData.length + adlerBuf.length);
    idatData.set(zlibHeader, 0);
    idatData.set(blockHeader, zlibHeader.length);
    idatData.set(rawData, zlibHeader.length + blockHeader.length);
    idatData.set(adlerBuf, zlibHeader.length + blockHeader.length + rawData.length);

    const idatLen = idatData.length;
    const idatTotal = 4 + 4 + idatLen + 4;

    // IEND
    const iendTotal = 12;

    // Total File
    const file = new Uint8Array(8 + ihdrTotal + idatTotal + iendTotal);
    let p = 0;

    // Signature
    file.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], p); p += 8;

    // IHDR
    writeUInt32BE(file, ihdrLen, p); p += 4;
    file.set([0x49, 0x48, 0x44, 0x52], p); // 'IHDR'

    const ihdrBody = new Uint8Array(13);
    writeUInt32BE(ihdrBody, width, 0);
    writeUInt32BE(ihdrBody, height, 4);
    ihdrBody[8] = 8; // Depth
    ihdrBody[9] = 6; // ColorType 6 (TRUECOLOR_ALPHA)
    ihdrBody[10] = 0; // Compression
    ihdrBody[11] = 0; // Filter
    ihdrBody[12] = 0; // Interlace

    file.set(ihdrBody, p + 4);

    // CRC of Type + Body
    const ihdrCrcBuf = new Uint8Array(4 + 13);
    ihdrCrcBuf.set([0x49, 0x48, 0x44, 0x52], 0);
    ihdrCrcBuf.set(ihdrBody, 4);
    writeUInt32BE(file, crc32(ihdrCrcBuf), p + 4 + 13);
    p += 4 + 13 + 4;

    // IDAT
    writeUInt32BE(file, idatLen, p); p += 4;
    file.set([0x49, 0x44, 0x41, 0x54], p); // 'IDAT'
    file.set(idatData, p + 4);

    // CRC
    const idatCrcBuf = new Uint8Array(4 + idatLen);
    idatCrcBuf.set([0x49, 0x44, 0x41, 0x54], 0);
    idatCrcBuf.set(idatData, 4);
    writeUInt32BE(file, crc32(idatCrcBuf), p + 4 + idatLen);
    p += 4 + idatLen + 4;

    // IEND
    writeUInt32BE(file, 0, p); p += 4;
    file.set([0x49, 0x45, 0x4E, 0x44], p); // 'IEND'
    writeUInt32BE(file, crc32(new Uint8Array([0x49, 0x45, 0x4E, 0x44])), p + 4);
    p += 8;

    return file;
}
