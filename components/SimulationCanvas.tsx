import { Canvas, Fill, PaintStyle, Picture, Skia } from '@shopify/react-native-skia';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
    runOnJS,
    useDerivedValue,
    useFrameCallback,
    useSharedValue
} from 'react-native-reanimated';
import { CONSTRAINTS, THEME } from '../constants/defaults';
import { FlockState, createFlockState, spawnBoids, updateFlock } from '../lib/simulation/WorkletFlock';
import { useSimulationStore } from '../lib/store/simulationStore';

const { width, height } = Dimensions.get('window');

// Color helper: HSV to 32-bit Integer (AARRGGBB)
function hsv2int(h: number, s: number, v: number): number {
    'worklet';
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;

    let r = 0, g = 0, b = 0;
    if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
    else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
    else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
    else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
    else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }

    const ir = Math.round((r + m) * 255);
    const ig = Math.round((g + m) * 255);
    const ib = Math.round((b + m) * 255);

    // Alpha 255
    return ((255 << 24) | (ir << 16) | (ig << 8) | ib) >>> 0;
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
        showDebug,
        particleMode,
        isPlaying,
        stepTrigger,
    } = useSimulationStore();

    const [currentFps, setCurrentFps] = useState(60);

    // Shared Values for Simulation Params
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

    // We bind these for logic, even if visualization is separate
    const svShowVision = useSharedValue(showVision);
    const svShowDirection = useSharedValue(showDirection);
    const svParticleMode = useSharedValue(particleMode);
    const svIsPlaying = useSharedValue(isPlaying);
    const svStepTrigger = useSharedValue(stepTrigger);
    const svLastStepProcessed = useSharedValue(stepTrigger);

    const tick = useSharedValue(0);
    const svFlockState = useSharedValue<FlockState | null>(null);

    // Explosion state
    const expX = useSharedValue(-1);
    const expY = useSharedValue(-1);
    const expRadius = useSharedValue(0);
    const expStrength = useSharedValue(0);

    // Attractor State
    const attractorX = useSharedValue(-1);
    const attractorY = useSharedValue(-1);
    const isAttracting = useSharedValue(false);
    const attractorStrength = useSharedValue(0);

    // Pre-create generic path for Triangle
    // Centered at 0,0 for easy rotation
    // Pointing RIGHT (East) which corresponds to angle 0?
    // Math.atan2(vy, vx) 0 is Right.
    // Triangle: Tip at (7, 0), Back at (-5, -4) and (-5, 4)
    const trianglePath = useMemo(() => {
        const p = Skia.Path.Make();
        p.moveTo(7, 0);
        p.lineTo(-5, 4);
        p.lineTo(-5, -4);
        p.close();
        return p;
    }, []);

    // Sync store changes
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
        svParticleMode.value = particleMode;
        svIsPlaying.value = isPlaying;
        svStepTrigger.value = stepTrigger;
    }, [
        perceptionRadius, maxSpeed, maxForce, separationWeight, alignmentWeight, cohesionWeight,
        drag, noise, alignmentBias, bounce, colorMode,
        showVision, showDirection, particleMode, isPlaying, stepTrigger
    ]);

    useEffect(() => {
        if (!CONSTRAINTS) return;
        const state = createFlockState(CONSTRAINTS.MAX_BOID_COUNT, width, height);
        spawnBoids(state, boidCount);
        svFlockState.value = state;
    }, [boidCount]);

    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onStart((e) => {
            expX.value = e.x;
            expY.value = e.y;
            expRadius.value = 150;
            expStrength.value = 5.0;
        });

    const dragGesture = Gesture.Pan()
        .averageTouches(false)
        .activateAfterLongPress(200)
        .onStart((e) => {
            isAttracting.value = true;
            attractorX.value = e.x;
            attractorY.value = e.y;
            attractorStrength.value = 2.0;
        })
        .onUpdate((e) => {
            attractorX.value = e.x;
            attractorY.value = e.y;
        })
        .onEnd(() => isAttracting.value = false)
        .onFinalize(() => isAttracting.value = false);

    const gestures = Gesture.Simultaneous(doubleTap, dragGesture);

    useFrameCallback((frameInfo) => {
        const state = svFlockState.value;
        if (!state) return;

        // Calculate FPS
        const dtMs = frameInfo.timeSincePreviousFrame || 16.666;
        const dt = Math.min(dtMs / 16.666, 4.0);

        // Update FPS UI every ~30 frames (approx 500ms)
        if (tick.value % 30 === 0) {
            const fps = Math.round(1000 / (dtMs || 16.666));
            runOnJS(setCurrentFps)(fps);
        }

        let explosion = undefined;
        if (expRadius.value > 0.1) {
            explosion = { x: expX.value, y: expY.value, radius: expRadius.value, strength: expStrength.value };
            expRadius.value *= 0.9;
        } else {
            expRadius.value = 0;
        }

        if (svIsPlaying.value || svStepTrigger.value > svLastStepProcessed.value) {
            updateFlock(state, dt, {
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
                explosion,
                attractor: isAttracting.value ? {
                    x: attractorX.value,
                    y: attractorY.value,
                    strength: attractorStrength.value,
                    radius: 200
                } : undefined
            });

            svLastStepProcessed.value = svStepTrigger.value;
        }

        tick.value += 1;
    });

    // Vector Graphics Renderer via SkPicture
    // This runs on Worklet/UI Thread and creates a recording of the frame
    const picture = useDerivedValue(() => {
        const _ = tick.value; // Subscribe to frame updates
        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording({ x: 0, y: 0, width, height });

        try {
            const state = svFlockState.value;
            if (!state || state.count === 0) {
                return recorder.finishRecordingAsPicture();
            }

            const count = state.count;
            const mode = svColorMode.value;
            const pMode = svParticleMode.value;
            const ms = svMaxSpeed.value || 5;

            // Debug flags
            const showDis = svShowVision.value;
            const showDir = svShowDirection.value;
            const perception = svPerception.value;

            const paint = Skia.Paint();
            paint.setAntiAlias(true);

            const debugPaint = Skia.Paint();
            debugPaint.setStyle(PaintStyle.Stroke);
            debugPaint.setStrokeWidth(1);
            debugPaint.setAntiAlias(true);
            debugPaint.setColor(Skia.Color(0x28ffffff));

            // Re-usable color calculation defaults
            const defaultColorInt = 0xFF2dd4bf;

            for (let i = 0; i < count; i++) {
                const x = state.x[i];
                const y = state.y[i];
                const vx = state.vx[i];
                const vy = state.vy[i];

                canvas.save();
                canvas.translate(x, y);

                // Rotation (only needed for triangle mainly, or velocity color)
                const angle = Math.atan2(vy, vx);
                if (pMode !== 'circle') {
                    // Rotate canvas for triangle
                    // angle is in radians. Skia uses rotate(radians) or degrees?
                    // Skia canvas.rotate uses DEGREES usually in some APIs, but JSI might be radians?
                    // Checked: canvas.rotate(degrees, px, py).
                    // Wait, standard canvas is radians?
                    // Skia C++ is degrees.
                    // RN Skia doc: "rotate(degrees)"
                    canvas.rotate(angle * (180 / Math.PI), 0, 0);
                }

                if (showDis) {
                    canvas.drawCircle(0, 0, perception, debugPaint);
                }
                if (showDir) {
                    canvas.drawLine(0, 0, 20, 0, debugPaint);
                }

                // Color
                let color = defaultColorInt;
                if (mode === 'velocity') {
                    const speed = Math.sqrt(vx * vx + vy * vy);
                    let t = speed / ms;
                    if (t > 1) t = 1;
                    const h = 240 * (1.0 - t);
                    color = hsv2int(h, 0.8, 1.0);
                } else if (mode === 'rainbow') {
                    const h = (i * 15) % 360;
                    color = hsv2int(h, 0.75, 1.0);
                }

                paint.setColor(Skia.Color(color));

                // Draw Shape
                if (pMode === 'circle') {
                    canvas.drawCircle(0, 0, 3.5, paint);
                } else {
                    canvas.drawPath(trianglePath, paint);
                }

                canvas.restore();
            }

        } catch (e) {
            // handle error
        }

        return recorder.finishRecordingAsPicture();
    });

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <GestureDetector gesture={gestures}>
                <Canvas style={{ width, height, backgroundColor: THEME.background }}>
                    <Fill color={THEME.background} />
                    <Picture picture={picture} />
                </Canvas>
            </GestureDetector>

            {showDebug && (
                <View style={{ position: 'absolute', top: 60, left: 20, pointerEvents: 'none' }}>
                    <Text style={{ color: '#2dd4bf', fontWeight: 'bold' }}>FPS: {currentFps}</Text>
                    <Text style={{ color: '#2dd4bf', fontWeight: 'bold' }}>Boids: {boidCount}</Text>
                    <Text style={{ color: '#2dd4bf', fontWeight: 'bold' }}>Renderer: Vector (SkPicture)</Text>
                </View>
            )}
        </GestureHandlerRootView>
    );
}
