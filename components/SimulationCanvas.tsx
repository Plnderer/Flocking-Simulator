import { Canvas, Fill, Vertices } from '@shopify/react-native-skia';
import React, { useEffect, useRef } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import { SharedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { DEFAULTS } from '../constants/defaults';
import { Flock } from '../lib/simulation/Flock';
import { useSimulationStore } from '../lib/store/simulationStore';
import { TouchState } from './TouchHandler';

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
        palette[i] = `hsl(${i}, 100%, 50%)`;
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

    // Shared Values for rendering (MUST use useSharedValue for frame callback synchronization)
    const vertices = useSharedValue<{ x: number, y: number }[]>(INITIAL_VERTICES);
    const vertexColors = useSharedValue<string[]>(INITIAL_COLORS);
    const isAppActive = useSharedValue(1); // 1 = active, 0 = background
    const isInitialized = useSharedValue(0); // 0 = not ready, 1 = ready
    const isPlayingShared = useSharedValue(isPlaying ? 1 : 0); // Mirror isPlaying to SharedValue

    // Sync isPlaying to SharedValue whenever it changes
    useEffect(() => {
        isPlayingShared.value = isPlaying ? 1 : 0;
    }, [isPlaying]);


    // Initialize/Resize Flock
    useEffect(() => {
        flock.resize(width, height, perceptionRadius);
    }, [width, height, perceptionRadius]);

    // Update Boid Count
    useEffect(() => {
        // Mark as NOT ready while re-initializing buffers
        isInitialized.value = 0;

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

        // CRITICAL: Mark ready AFTER all buffers are initialized
        // Use a small timeout to let the UI thread catch up with the SharedValue update
        setTimeout(() => {
            isInitialized.value = 1;
        }, 16);
    }, [boidCount]);

    // Monitor AppState (Tab visibility/Background)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            isAppActive.value = nextAppState === 'active' ? 1 : 0;
        });
        return () => subscription.remove();
    }, []);


    // Frame Loop
    useFrameCallback((frameInfo) => {
        // CRITICAL: All checks must use SharedValues for UI thread synchronization
        if (!isInitialized.value || !isPlayingShared.value || !isAppActive.value) return;

        try {
            // Read touch state
            const touch = touchState.value;
            const strength = touch.mode === 3 ? -50 : (touch.mode === 2 ? -5 : 5); // Mode 3: Explode (-50), Mode 2: Repel (-5), Mode 1: Attract (5)
            const attractor = touch.active ? { x: touch.x, y: touch.y, strength } : undefined;

            // Run simulation
            flock.update(1.0, {
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

            // Update Vertices
            const numBoids = flock.boids.length;
            if (numBoids === 0) return;

            const numVertices = numBoids * 3;
            const size = 6;
            const halfSize = size * 0.5;
            const useColor = colorMode !== 'solid';
            const useVelocityColor = colorMode === 'velocity';
            const invMaxSpeed = maxSpeed > 0 ? 1 / maxSpeed : 0;
            const colorStride = useColor ? getColorStride(numBoids) : 1;

            const buffers = verticesBuffers.current;
            const colorBuffers = colorsBuffers.current;
            if (!buffers || buffers.length < 2 || !colorBuffers || colorBuffers.length < 2) {
                return;
            }

            const nextVertexIndex = vertexBufferIndex.current ^ 1;
            const verts = buffers[nextVertexIndex];
            if (!verts || verts.length !== numVertices) {
                return;
            }

            const shouldUpdateColors = useColor && (
                lastColorMode.current !== colorMode ||
                frameInfo.timestamp - lastColorUpdate.current >= COLOR_UPDATE_INTERVAL_MS
            );
            const timeHue = shouldUpdateColors && !useVelocityColor
                ? Math.floor(frameInfo.timestamp / 20) % 360
                : 0;

            const nextColorIndex = shouldUpdateColors ? (colorBufferIndex.current ^ 1) : colorBufferIndex.current;
            const colors = colorBuffers[nextColorIndex];
            if (!colors || colors.length !== numVertices) {
                return;
            }
            const colorsAlt = colorBuffers[nextColorIndex ^ 1];

            for (let i = 0; i < numBoids; i++) {
                const b = flock.boids[i];
                if (!b) continue;

                const vx = b.vx;
                const vy = b.vy;
                const speedSq = vx * vx + vy * vy;

                let dx = 1;
                let dy = 0;
                let speed = 0;

                if (speedSq > 0) {
                    speed = Math.sqrt(speedSq);
                    const invSpeed = 1 / speed;
                    dx = vx * invSpeed;
                    dy = vy * invSpeed;
                }

                const px = -dy;
                const py = dx;
                const baseX = b.x - (dx * size);
                const baseY = b.y - (dy * size);

                const idx = i * 3;
                const v0 = verts[idx] || (verts[idx] = { x: 0, y: 0 });
                const v1 = verts[idx + 1] || (verts[idx + 1] = { x: 0, y: 0 });
                const v2 = verts[idx + 2] || (verts[idx + 2] = { x: 0, y: 0 });

                v0.x = b.x + (dx * size);
                v0.y = b.y + (dy * size);
                v1.x = baseX + (px * halfSize);
                v1.y = baseY + (py * halfSize);
                v2.x = baseX - (px * halfSize);
                v2.y = baseY - (py * halfSize);

                if (shouldUpdateColors && (i + colorPhase.current) % colorStride === 0) {
                    let color = '#00ffff';

                    if (useVelocityColor) {
                        let paletteIndex = (speed * invMaxSpeed * 255) | 0;
                        if (paletteIndex < 0) paletteIndex = 0;
                        if (paletteIndex > 255) paletteIndex = 255;
                        color = VELOCITY_PALETTE[paletteIndex];
                    } else {
                        const hueIndex = (timeHue + (b.id * 5)) % 360;
                        color = RAINBOW_PALETTE[hueIndex];
                    }

                    colors[idx] = color;
                    colors[idx + 1] = color;
                    colors[idx + 2] = color;
                    if (colorsAlt) {
                        colorsAlt[idx] = color;
                        colorsAlt[idx + 1] = color;
                        colorsAlt[idx + 2] = color;
                    }
                }
            }

            vertices.value = verts;
            vertexBufferIndex.current = nextVertexIndex;
            if (shouldUpdateColors) {
                vertexColors.value = colors;
                colorBufferIndex.current = nextColorIndex;
                lastColorUpdate.current = frameInfo.timestamp;
                colorPhase.current = (colorPhase.current + 1) % colorStride;
            }
            lastColorMode.current = colorMode;

        } catch (e) {
            console.warn('Frame callback error:', e);
        }
    });

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
