import { Canvas, Fill, Vertices } from '@shopify/react-native-skia';
import React, { useEffect, useRef } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import { SharedValue, useSharedValue } from 'react-native-reanimated';
import { DEFAULTS } from '../constants/defaults';
import { Flock } from '../lib/simulation/Flock';
import { useSimulationStore } from '../lib/store/simulationStore';
import { TouchState } from './TouchHandler';

// Use RGB strings to avoid iOS HSL parsing issues in Skia
const VELOCITY_PALETTE = (() => {
    const palette = new Array<string>(256);
    for (let i = 0; i < 256; i++) {
        const r = i;
        const b = 255 - i;
        palette[i] = `rgb(${r}, 0, ${b})`;
    }
    return palette;
})();

const RAINBOW_PALETTE = (() => {
    const palette = new Array<string>(360);
    for (let i = 0; i < 360; i++) {
        // hsl(h, 100%, 50%) conversion to rgb could be done here, 
        // but for safety let's use a simpler set or just keep using rgb 
        // derived from hsl if skia supports it? The user requested rgb/hex.
        // Let's generate a simple rainbow in RGB.
        // Hue to RGB:
        const h = i / 360;
        const s = 1;
        const l = 0.5;
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p: number, q: number, t: number) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        palette[i] = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
    return palette;
})();

const COLOR_UPDATE_INTERVAL_MS = 100;
const getColorStride = (boidCount: number) => {
    if (boidCount > 2400) return 6;
    if (boidCount > 1600) return 5;
    if (boidCount > 1200) return 4;
    if (boidCount > 800) return 3;
    if (boidCount > 500) return 2;
    return 1;
};

// CRITICAL: Initial vertices for Skia (crashes on empty array)
const DUMMY_VERTEX = { x: -100, y: -100 }; // Off-screen
const INITIAL_VERTICES = [DUMMY_VERTEX, DUMMY_VERTEX, DUMMY_VERTEX];
const INITIAL_COLORS = ['#000000', '#000000', '#000000'];

interface SimulationCanvasProps {
    touchState: SharedValue<TouchState>;
}

export const SimulationCanvas = ({ touchState }: SimulationCanvasProps) => {
    const { width, height } = useWindowDimensions();
    const flock = useRef(new Flock(DEFAULTS.BOID_COUNT)).current;

    // Store subscriptions
    const boidCount = useSimulationStore(s => s.boidCount);
    const perceptionRadius = useSimulationStore(s => s.perceptionRadius);
    const maxSpeed = useSimulationStore(s => s.maxSpeed);
    const maxForce = useSimulationStore(s => s.maxForce);
    const separationWeight = useSimulationStore(s => s.separationWeight);
    const alignmentWeight = useSimulationStore(s => s.alignmentWeight);
    const cohesionWeight = useSimulationStore(s => s.cohesionWeight);
    const isPlaying = useSimulationStore(s => s.isPlaying);
    const theme = useSimulationStore(s => s.theme);
    const colorMode = useSimulationStore(s => s.colorMode);
    const drag = useSimulationStore(s => s.drag);
    const noise = useSimulationStore(s => s.noise);
    const alignmentBias = useSimulationStore(s => s.alignmentBias);

    const verticesBuffers = useRef<{ x: number, y: number }[][]>([[], []]);
    const colorsBuffers = useRef<string[][]>([[], []]);
    const vertexBufferIndex = useRef(0);
    const colorBufferIndex = useRef(0);
    const lastColorUpdate = useRef(0);
    const lastColorMode = useRef<'solid' | 'velocity' | 'rainbow'>('solid');
    const colorPhase = useRef(0);

    // Reverting to Reanimated SharedValues as 'useValue' is not available in this Skia version.
    // Driving SharedValues from JS thread is safe and standard.
    const vertices = useSharedValue<{ x: number, y: number }[]>(INITIAL_VERTICES);
    const vertexColors = useSharedValue<string[]>(INITIAL_COLORS);

    // JS-Thread RAF Loop State
    const rafId = useRef<number | null>(null);
    const lastTs = useRef<number>(0);
    const isPlayingRef = useRef(isPlaying);
    const isAppActiveRef = useRef(true);

    // Sync refs
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Initialize/Resize Flock
    useEffect(() => {
        flock.resize(width, height, perceptionRadius);
    }, [width, height, perceptionRadius]);

    // Update Boid Count
    useEffect(() => {
        flock.setBoidCount(boidCount);
        const numVertices = boidCount * 3;
        const newVerticesA = new Array<{ x: number, y: number }>(numVertices);
        const newVerticesB = new Array<{ x: number, y: number }>(numVertices);
        const newColorsA = new Array<string>(numVertices).fill('#000000');
        const newColorsB = new Array<string>(numVertices).fill('#000000');

        for (let i = 0; i < numVertices; i++) {
            newVerticesA[i] = { x: 0, y: 0 };
            newVerticesB[i] = { x: 0, y: 0 };
        }

        verticesBuffers.current = [newVerticesA, newVerticesB];
        colorsBuffers.current = [newColorsA, newColorsB];
        vertexBufferIndex.current = 0;
        colorBufferIndex.current = 0;
        lastColorUpdate.current = 0;
        lastColorMode.current = 'solid';
        colorPhase.current = 0;
        vertices.value = newVerticesA;
        vertexColors.value = newColorsA;
    }, [boidCount]);

    // Monitor AppState
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            isAppActiveRef.current = nextAppState === 'active';
        });
        return () => subscription.remove();
    }, []);

    // Stop Loop Helper
    const stopLoop = () => {
        if (rafId.current !== null) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }
        lastTs.current = 0;
    };

    // JS-Thread Simulation Loop Step Function
    const step = (timestamp: number) => {
        if (!isPlayingRef.current || !isAppActiveRef.current) {
            stopLoop();
            return;
        }

        // Use constant time step as requested (1.0) or computed dt.
        const dt = 1.0;

        // Touch Interaction
        const touch = touchState.value; // Safe on JS Thread
        const strength = touch.mode === 3 ? -50 : (touch.mode === 2 ? -5 : 5);
        const attractor = touch.active ? { x: touch.x, y: touch.y, strength } : undefined;

        // Run Simulation Update
        flock.update(dt, {
            perceptionRadius,
            maxSpeed,
            maxForce,
            separationWeight,
            alignmentWeight,
            cohesionWeight,
            drag,
            noise,
            alignmentBias,
            attractor
        });

        // --- Render Preparation ---
        const numBoids = flock.boids.length;
        if (numBoids > 0) {
            const numVertices = numBoids * 3;
            // Check buffers exist
            const buffers = verticesBuffers.current;
            const colorBuffers = colorsBuffers.current;

            if (buffers && buffers.length >= 2 && colorBuffers && colorBuffers.length >= 2) {
                const nextVertexIndex = vertexBufferIndex.current ^ 1;
                // Guard: Ensure buffer is allocated and sized
                let verts = buffers[nextVertexIndex];
                if (verts && verts.length === numVertices) {
                    const size = 6;
                    const halfSize = size * 0.5;

                    const useColor = colorMode !== 'solid';
                    const useVelocityColor = colorMode === 'velocity';
                    const colorStride = useColor ? getColorStride(numBoids) : 1;
                    const shouldUpdateColors = useColor && (
                        lastColorMode.current !== colorMode ||
                        timestamp - lastColorUpdate.current >= COLOR_UPDATE_INTERVAL_MS
                    );

                    const nextColorIndex = shouldUpdateColors ? (colorBufferIndex.current ^ 1) : colorBufferIndex.current;
                    const colors = colorBuffers[nextColorIndex];
                    const colorsAlt = colorBuffers[nextColorIndex ^ 1];
                    const timeHue = shouldUpdateColors && !useVelocityColor ? Math.floor(timestamp / 20) % 360 : 0;
                    const invMaxSpeed = maxSpeed > 0 ? 1 / maxSpeed : 0;

                    for (let i = 0; i < numBoids; i++) {
                        const b = flock.boids[i];
                        if (!b) continue;

                        // Calc Boid Shape
                        const vx = b.vx;
                        const vy = b.vy;
                        let dx = 1, dy = 0, speed = 0;
                        const speedSq = vx * vx + vy * vy;

                        if (speedSq > 0) {
                            speed = Math.sqrt(speedSq);
                            const invS = 1 / speed;
                            dx = vx * invS;
                            dy = vy * invS;
                        }

                        const px = -dy;
                        const py = dx;
                        const baseX = b.x - (dx * size);
                        const baseY = b.y - (dy * size);

                        const idx = i * 3;
                        const v0 = verts[idx];
                        const v1 = verts[idx + 1];
                        const v2 = verts[idx + 2];

                        if (v0) {
                            v0.x = b.x + (dx * size);
                            v0.y = b.y + (dy * size);
                            v1.x = baseX + (px * halfSize);
                            v1.y = baseY + (py * halfSize);
                            v2.x = baseX - (px * halfSize);
                            v2.y = baseY - (py * halfSize);
                        }

                        if (shouldUpdateColors && (i + colorPhase.current) % colorStride === 0) {
                            let c = '#00ffff';
                            if (useVelocityColor) {
                                let pIdx = (speed * invMaxSpeed * 255) | 0;
                                if (pIdx < 0) pIdx = 0; else if (pIdx > 255) pIdx = 255;
                                c = VELOCITY_PALETTE[pIdx];
                            } else {
                                const hIdx = (timeHue + (b.id * 5)) % 360;
                                c = RAINBOW_PALETTE[hIdx];
                            }
                            if (colors) { colors[idx] = c; colors[idx + 1] = c; colors[idx + 2] = c; }
                            if (colorsAlt) { colorsAlt[idx] = c; colorsAlt[idx + 1] = c; colorsAlt[idx + 2] = c; }
                        }
                    }

                    // Push Updates to Reanimated SharedValue (Triggers Skia Redraw from JS Thread)
                    vertices.value = verts;
                    vertexBufferIndex.current = nextVertexIndex;

                    if (shouldUpdateColors) {
                        vertexColors.value = colors;
                        colorBufferIndex.current = nextColorIndex;
                        lastColorUpdate.current = timestamp;
                        colorPhase.current = (colorPhase.current + 1) % colorStride;
                    }
                    lastColorMode.current = colorMode;
                }
            }
        }

        // Schedule next frame
        rafId.current = requestAnimationFrame(step);
    };

    // Main Loop Control Effect
    useEffect(() => {
        if (isPlaying) {
            if (rafId.current === null) {
                lastTs.current = 0;
                rafId.current = requestAnimationFrame(step);
            }
        } else {
            stopLoop();
        }
        return stopLoop;
    }, [isPlaying,
        perceptionRadius, maxSpeed, maxForce, separationWeight,
        alignmentWeight, cohesionWeight, drag, noise, alignmentBias,
        theme, colorMode
    ]);

    const paintColor = theme === 'dark' ? "cyan" : "blue";
    const bg = theme === 'dark' ? "#111" : "#fff";

    return (
        <Canvas style={{ flex: 1 }}>
            <Fill color={bg} />
            <Vertices
                vertices={vertices}
                colors={colorMode !== 'solid' ? vertexColors : undefined}
                color={colorMode === 'solid' ? paintColor : undefined}
            />
        </Canvas>
    );
};
