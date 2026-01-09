import { Canvas, Fill, Vertices, vec } from '@shopify/react-native-skia';
import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
    runOnUI,
    useDerivedValue,
    useFrameCallback,
    useSharedValue,
} from 'react-native-reanimated';
import { THEME } from '../constants/defaults';
import { getUIFlockState, initUIFlock, resetUIFlock, updateFlock } from '../lib/simulation/WorkletFlock';
import { useSimulationStore } from '../lib/store/simulationStore';

const { width, height } = Dimensions.get('window');

// Inner component to unwrap derived values for Skia
function BoidRenderer({ renderData }: { renderData: any }) {
    const verts = useDerivedValue(() => renderData.value.verts);
    const colors = useDerivedValue(() => renderData.value.colors);
    // Path rendering is temporarily disabled/commented out to ensure stability
    // const visionPath = useDerivedValue(() => renderData.value.visionPath);
    // const dirPath = useDerivedValue(() => renderData.value.dirPath);

    return (
        <>
            {/* <Path path={visionPath} style="stroke" strokeWidth={1} color="#ffffff20" /> */}
            {/* <Path path={dirPath} style="stroke" strokeWidth={1} color="#ff000080" /> */}
            <Vertices
                vertices={verts}
                colors={colors}
                mode="triangles"
            />
        </>
    );
}

export default function SimulationCanvas() {
    const {
        boidCount,
        perceptionRadius,
        maxSpeed,
        maxForce,
        separationWeight,
        alignmentWeight,
        cohesionWeight,
        drag,
        noise,
        alignmentBias,
        colorMode,
        bounce,
        showVision,
        showDirection,
        theme,
    } = useSimulationStore();

    // Individual SharedValues to prevent monolithic object allocation overhead causing crashes
    const svPerception = useSharedValue(perceptionRadius);
    const svMaxSpeed = useSharedValue(maxSpeed);
    const svMaxForce = useSharedValue(maxForce);
    const svSepWeight = useSharedValue(separationWeight);
    const svAliWeight = useSharedValue(alignmentWeight);
    const svCohWeight = useSharedValue(cohesionWeight);
    const svDrag = useSharedValue(drag);
    const svNoise = useSharedValue(noise);
    const svAlignBias = useSharedValue(alignmentBias);
    const svBounce = useSharedValue(bounce);
    const svColorMode = useSharedValue(colorMode);
    const svShowVision = useSharedValue(showVision);
    const svShowDirection = useSharedValue(showDirection);

    // Explosion state
    const expX = useSharedValue(-1);
    const expY = useSharedValue(-1);
    const expRadius = useSharedValue(0);
    const expStrength = useSharedValue(0);

    // Sync store changes to UI thread
    useEffect(() => {
        svPerception.value = perceptionRadius;
        svMaxSpeed.value = maxSpeed;
        svMaxForce.value = maxForce;
        svSepWeight.value = separationWeight;
        svAliWeight.value = alignmentWeight;
        svCohWeight.value = cohesionWeight;
        svDrag.value = drag;
        svNoise.value = noise;
        svAlignBias.value = alignmentBias;
        svBounce.value = bounce;
        svColorMode.value = colorMode;
        svShowVision.value = showVision;
        svShowDirection.value = showDirection;
    }, [
        perceptionRadius, maxSpeed, maxForce, separationWeight,
        alignmentWeight, cohesionWeight, drag, noise, alignmentBias,
        bounce, colorMode, showVision, showDirection
    ]);

    // Handle Boid Count changes (Re-init)
    useEffect(() => {
        runOnUI(() => {
            const state = getUIFlockState();
            if (state && state.count !== boidCount) {
                resetUIFlock();
                initUIFlock(5000, width, height, boidCount);
            }
        })();
    }, [boidCount]);

    // Initial Setup
    useEffect(() => {
        runOnUI(initUIFlock)(5000, width, height, boidCount);
        return () => {
            runOnUI(resetUIFlock)();
        };
    }, []);

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onStart((e) => {
            expX.value = e.x;
            expY.value = e.y;
            expRadius.value = 150;
            expStrength.value = 5.0;
        });

    useFrameCallback((frameInfo) => {
        const dt = (frameInfo.timeSincePreviousFrame || 16) / 1000;
        const state = getUIFlockState();
        if (!state) return;

        // Construct lightweight params object on the fly, reading from primitives
        const params = {
            perception: svPerception.value,
            maxSpeed: svMaxSpeed.value,
            maxForce: svMaxForce.value,
            sepMult: svSepWeight.value,
            aliMult: svAliWeight.value,
            cohMult: svCohWeight.value,
            drag: svDrag.value,
            noise: svNoise.value,
            alignBias: svAlignBias.value,
            bounce: svBounce.value,
            colorMode: svColorMode.value,
            showVision: svShowVision.value,
            showDirection: svShowDirection.value,
            explosion: expStrength.value > 0 ? {
                x: expX.value,
                y: expY.value,
                radius: expRadius.value,
                strength: expStrength.value
            } : undefined
        };

        updateFlock(state, dt, params);

        // Reset explosion after one frame
        if (expStrength.value > 0) {
            expStrength.value = 0;
        }
    });

    const renderData = useDerivedValue(() => {
        const state = getUIFlockState();
        // Return minimal safe defaults
        if (!state) return { verts: [], colors: [] }; // paths removed

        const count = state.count;
        const verts: any[] = [];
        const colors: string[] = [];

        // Disabled Path generation
        // const visionPath = Skia.Path.Make();
        // const dirPath = Skia.Path.Make();

        const mode = svColorMode.value;
        const p1x = 6; const p1y = 0;
        const p2x = -4; const p2y = 4;
        const p3x = -4; const p3y = -4;

        for (let i = 0; i < count; i++) {
            const x = state.x[i];
            const y = state.y[i];
            const vx = state.vx[i];
            const vy = state.vy[i];

            const angle = Math.atan2(vy, vx);
            const c = Math.cos(angle);
            const s = Math.sin(angle);

            verts.push(vec(x + (p1x * c - p1y * s), y + (p1x * s + p1y * c)));
            verts.push(vec(x + (p2x * c - p2y * s), y + (p2x * s + p2y * c)));
            verts.push(vec(x + (p3x * c - p3y * s), y + (p3x * s + p3y * c)));

            if (mode === 'velocity') {
                const speed = Math.sqrt(vx * vx + vy * vy);
                const t = Math.min(speed / 8.0, 1.0);
                const col = `hsl(${240 - t * 240}, 100%, 50%)`;
                colors.push(col); colors.push(col); colors.push(col);
            } else if (mode === 'rainbow') {
                const hue = (i * 3) % 360;
                const col = `hsl(${hue}, 80%, 60%)`;
                colors.push(col); colors.push(col); colors.push(col);
            } else {
                const col = '#2dd4bf';
                colors.push(col); colors.push(col); colors.push(col);
            }
        }

        return { verts, colors };
    });

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={doubleTap}>
                <Canvas style={{ width, height, backgroundColor: THEME.background }}>
                    <Fill color={THEME.background} />
                    <BoidRenderer renderData={renderData} />
                </Canvas>
            </GestureDetector>
        </GestureHandlerRootView>
    );
}
