import { Canvas, Fill, Vertices } from '@shopify/react-native-skia';
import React, { useEffect, useRef } from 'react';
import { AppState, useWindowDimensions } from 'react-native';
import { SharedValue, useSharedValue } from 'react-native-reanimated';
import { DEFAULTS } from '../constants/defaults';
import { Flock } from '../lib/simulation/Flock';
import { useSimulationStore } from '../lib/store/simulationStore';
import { TouchState } from './TouchHandler';

// CRITICAL: Initial vertices for Skia (crashes on empty array)
const DUMMY_VERTEX = { x: -100, y: -100 };
const INITIAL_VERTICES = [DUMMY_VERTEX, DUMMY_VERTEX, DUMMY_VERTEX];

interface SimulationCanvasProps {
    touchState: SharedValue<TouchState>;
}

export const SimulationCanvas = ({ touchState }: SimulationCanvasProps) => {
    const { width, height } = useWindowDimensions();
    const flock = useRef(new Flock(DEFAULTS.BOID_COUNT)).current; // Stable instance

    // Store settings
    const boidCount = useSimulationStore(s => s.boidCount);
    const perceptionRadius = useSimulationStore(s => s.perceptionRadius);
    const maxSpeed = useSimulationStore(s => s.maxSpeed);
    const maxForce = useSimulationStore(s => s.maxForce);
    const separationWeight = useSimulationStore(s => s.separationWeight);
    const alignmentWeight = useSimulationStore(s => s.alignmentWeight);
    const cohesionWeight = useSimulationStore(s => s.cohesionWeight);
    const isPlaying = useSimulationStore(s => s.isPlaying);
    const theme = useSimulationStore(s => s.theme);
    const drag = useSimulationStore(s => s.drag);
    const noise = useSimulationStore(s => s.noise);
    const alignmentBias = useSimulationStore(s => s.alignmentBias);

    // Reanimated SharedValue to drive Skia
    const vertices = useSharedValue<{ x: number, y: number }[]>(INITIAL_VERTICES);

    // Loop State
    const rafId = useRef<number | null>(null);
    const lastTs = useRef<number>(0);
    const isPlayingRef = useRef(isPlaying);
    const isAppActiveRef = useRef(true);

    // Sync isPlaying ref
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // Handle Resize
    useEffect(() => {
        if (width > 0 && height > 0) {
            flock.resize(width, height, perceptionRadius);
        }
    }, [width, height, perceptionRadius]);

    // Handle Boid Count
    useEffect(() => {
        flock.setBoidCount(boidCount);
        // Reset vertices to dummy on count change to clean slate
        vertices.value = INITIAL_VERTICES;
    }, [boidCount]);

    // Monitor AppState
    useEffect(() => {
        const sub = AppState.addEventListener('change', (s) => {
            isAppActiveRef.current = s === 'active';
        });
        return () => sub.remove();
    }, []);

    const stopLoop = () => {
        if (rafId.current !== null) {
            cancelAnimationFrame(rafId.current);
            rafId.current = null;
        }
        lastTs.current = 0;
    };

    const step = (timestamp: number) => {
        if (!isPlayingRef.current || !isAppActiveRef.current) {
            stopLoop();
            return;
        }

        // 1. Calculate Delta Time
        // Use 1.0 (frame-based) if physics expects it, or clamp dt.
        // Prompt requested 1.0 previously, but let's be safe.
        // If flock.update expects 'seconds', use dt. If 'per frame', use 1.0.
        // Assuming 'per frame' based on previous context.
        const dt = 1.0;

        // 2. Touch Logic
        const touch = touchState.value;
        const strength = touch.mode === 3 ? -50 : (touch.mode === 2 ? -5 : 5);
        const attractor = touch.active ? { x: touch.x, y: touch.y, strength } : undefined;

        // 3. Update Simulation
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

        // 4. Build Vertices (DEEP DIVE FIX C: Allocate NEW array per frame)
        // This avoids any race condition where UI thread reads stale/mutating buffer.
        const numBoids = flock.boids.length;
        if (numBoids > 0) {
            const numVertices = numBoids * 3;
            // Native array allocation is fast in modern JS engines
            const newVerts = new Array<{ x: number, y: number }>(numVertices);

            const size = 6;
            const halfSize = 3;

            for (let i = 0; i < numBoids; i++) {
                const b = flock.boids[i];
                if (!b) continue;

                const vx = b.vx;
                const vy = b.vy;
                let dx = 1, dy = 0;

                // Fast Normalize
                const speedSq = vx * vx + vy * vy;
                if (speedSq > 0.001) {
                    const invS = 1 / Math.sqrt(speedSq);
                    dx = vx * invS;
                    dy = vy * invS;
                }

                const px = -dy;
                const py = dx;

                // Tip
                const tipX = b.x + (dx * size);
                const tipY = b.y + (dy * size);

                // Base Center
                const baseX = b.x - (dx * size);
                const baseY = b.y - (dy * size);

                // Base Left/Right
                const v1x = baseX + (px * halfSize);
                const v1y = baseY + (py * halfSize);
                const v2x = baseX - (px * halfSize);
                const v2y = baseY - (py * halfSize);

                // Assign to new array (creating plain objects)
                // Skia JSI might prefer flat arrays but {x,y} is safer for type compat
                const idx = i * 3;
                newVerts[idx] = { x: tipX, y: tipY };
                newVerts[idx + 1] = { x: v1x, y: v1y };
                newVerts[idx + 2] = { x: v2x, y: v2y };
            }

            // 5. Update Shared Value
            // Passing a fresh immutable reference triggers the update guaranteed.
            vertices.value = newVerts;
        }

        rafId.current = requestAnimationFrame(step);
    };

    // Auto-start loop
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
        // Restart loop if params change to capture new closure values?
        // Actually, store values are const in scope, so yes, we need to restart
        // if we want 'step' to see new 'maxSpeed' etc.
        perceptionRadius, maxSpeed, maxForce, separationWeight,
        alignmentWeight, cohesionWeight, drag, noise, alignmentBias,
    ]);

    const paintColor = theme === 'dark' ? "cyan" : "blue";
    const bg = theme === 'dark' ? "#111" : "#fff";

    return (
        <Canvas style={{ flex: 1 }}>
            <Fill color={bg} />
            {/* Force solid color to rule out palette crashes */}
            <Vertices
                vertices={vertices}
                color={paintColor}
            />
        </Canvas>
    );
};
