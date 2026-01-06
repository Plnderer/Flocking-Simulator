import { Canvas, Fill, Vertices } from '@shopify/react-native-skia';
import React, { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import { SharedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { DEFAULTS } from '../constants/defaults';
import { Flock } from '../lib/simulation/Flock';
import { useSimulationStore } from '../lib/store/simulationStore';
import { TouchState } from './TouchHandler';

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

    // Shared Values for rendering
    // Vertices expects SkPoint[] ({x,y})
    // We use "any" to bypass strict typing if needed explicitly, but best to match {x,y}
    const vertices = useSharedValue<{ x: number, y: number }[]>([]);
    const colors = useSharedValue(new Float32Array(0));

    // Initialize/Resize Flock
    useEffect(() => {
        flock.resize(width, height, perceptionRadius);
    }, [width, height, perceptionRadius]);

    // Update Boid Count
    useEffect(() => {
        flock.setBoidCount(boidCount);
        // Initial resize if needed
        const numVertices = boidCount * 3;
        // vertices.value = new Array(numVertices).fill({x:0, y:0}); // Init

        // Pre-calculate colors if static
        const colorArray = new Float32Array(numVertices * 4); // r,g,b,a per vertex
        // Actually Skia Vertices colors prop: Color[] | Float32Array?
        // If Float32Array, it's usually unnormalized 4 floats per color?
        // Easier to use Color array ["#fff", ...] string array? No, too slow.
        // Int32Array of colors?
        // Let's rely on standard color prop if possible or single paint color for all boids for now (optimization).
        // Prompt says "Color Mode: Solid / Velocity / Rainbow".
        // For "Solid", we can just set paint on Vertices.
        // For "Rainbow", we need per-vertex colors.

        // Let's allow dynamic colors later. For now, solid.
    }, [boidCount]);


    // Frame Loop
    useFrameCallback((frameInfo) => {
        if (!isPlaying) return;

        // Read touch state
        const touch = touchState.value;
        const strength = touch.mode === 3 ? -20 : (touch.mode === 2 ? -5 : 5); // Mode 3: Explode, Mode 2: Repel, Mode 1: Attract
        const attractor = touch.active ? { x: touch.x, y: touch.y, strength } : undefined;
        // mode 1 = attract, mode 2 = repel (negative strength), mode 3 = explode (handled elsewhere usually or high neg strength)

        // Run simulation
        flock.update(1.0, {
            perceptionRadius,
            maxSpeed,
            maxForce,
            separationWeight,
            alignmentWeight,
            cohesionWeight,
            attractor
        });

        // Update Vertices
        const numBoids = flock.boids.length;
        const newVertices: { x: number, y: number }[] = [];
        const size = 6;

        for (let i = 0; i < numBoids; i++) {
            const b = flock.boids[i];
            const angle = Math.atan2(b.vy, b.vx);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // Tip
            newVertices.push({
                x: (size * cos) - (0 * sin) + b.x,
                y: (size * sin) + (0 * cos) + b.y
            });

            // Back Left
            newVertices.push({
                x: (-size * cos) - (-size / 2 * sin) + b.x,
                y: (-size * sin) + (-size / 2 * cos) + b.y
            });

            // Back Right
            newVertices.push({
                x: (-size * cos) - (size / 2 * sin) + b.x,
                y: (-size * sin) + (size / 2 * cos) + b.y
            });
        }

        vertices.value = newVertices;
    });

    const paintColor = theme === 'dark' ? "cyan" : "blue";
    const bg = theme === 'dark' ? "#111" : "#fff";

    return (
        <Canvas style={{ flex: 1 }}>
            <Fill color={bg} />
            {/* We use Vertices 'triangles' mode. indices? if not provided, it assumes non-indexed triangles (0,1,2), (3,4,5)... which is what we generated */}
            <Vertices
                vertices={vertices}
                color={paintColor}
            />
        </Canvas>
    );
};
