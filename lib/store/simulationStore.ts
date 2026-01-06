import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { CONSTRAINTS, DEFAULTS } from '../../constants/defaults';

interface SimulationState {
    boidCount: number;
    perceptionRadius: number;
    maxSpeed: number;
    maxForce: number;
    separationWeight: number;
    alignmentWeight: number;
    cohesionWeight: number;
    trailLength: number;
    isPlaying: boolean;

    // Visuals
    showDebug: boolean;
    theme: 'dark' | 'light';
    colorMode: 'solid' | 'velocity' | 'rainbow';
    drag: number;
    noise: number;
    alignmentBias: number;

    // Actions
    setBoidCount: (count: number) => void;
    setPerceptionRadius: (n: number) => void;
    setMaxSpeed: (n: number) => void;
    setMaxForce: (n: number) => void;
    setSeparationWeight: (w: number) => void;
    setAlignmentWeight: (w: number) => void;
    setCohesionWeight: (w: number) => void;
    togglePlay: () => void;
    toggleDebug: () => void;
    toggleTheme: () => void;
    setColorMode: (mode: 'solid' | 'velocity' | 'rainbow') => void;
    setDrag: (d: number) => void;
    setNoise: (n: number) => void;
    setAlignmentBias: (b: number) => void;
    resetDefaults: () => void;
}

export const useSimulationStore = create<SimulationState>()(
    persist(
        (set) => ({
            boidCount: DEFAULTS.BOID_COUNT,
            perceptionRadius: DEFAULTS.PERCEPTION_RADIUS,
            maxSpeed: DEFAULTS.MAX_SPEED,
            maxForce: DEFAULTS.MAX_FORCE,
            separationWeight: DEFAULTS.SEPARATION_WEIGHT,
            alignmentWeight: DEFAULTS.ALIGNMENT_WEIGHT,
            cohesionWeight: DEFAULTS.COHESION_WEIGHT,
            trailLength: DEFAULTS.TRAIL_LENGTH,
            isPlaying: true,
            showDebug: false,
            theme: 'dark',
            colorMode: 'solid',
            drag: DEFAULTS.DRAG,
            noise: DEFAULTS.NOISE,
            alignmentBias: DEFAULTS.ALIGNMENT_BIAS,

            setBoidCount: (count) => set({ boidCount: Math.min(Math.max(count, CONSTRAINTS.MIN_BOID_COUNT), CONSTRAINTS.MAX_BOID_COUNT) }),
            setPerceptionRadius: (n) => set({ perceptionRadius: Math.min(Math.max(n, CONSTRAINTS.MIN_PERCEPTION), CONSTRAINTS.MAX_PERCEPTION) }),
            setMaxSpeed: (n) => set({ maxSpeed: Math.min(Math.max(n, CONSTRAINTS.MIN_SPEED), CONSTRAINTS.MAX_SPEED) }),
            setMaxForce: (n) => set({ maxForce: n }),
            setSeparationWeight: (w) => set({ separationWeight: w }),
            setAlignmentWeight: (w) => set({ alignmentWeight: w }),
            setCohesionWeight: (w) => set({ cohesionWeight: w }),
            togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
            toggleDebug: () => set((state) => ({ showDebug: !state.showDebug })),
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
            setColorMode: (mode) => set({ colorMode: mode }),
            setDrag: (d) => set({ drag: d }),
            setNoise: (n) => set({ noise: n }),
            setAlignmentBias: (b) => set({ alignmentBias: b }),
            resetDefaults: () => set({
                boidCount: DEFAULTS.BOID_COUNT,
                perceptionRadius: DEFAULTS.PERCEPTION_RADIUS,
                maxSpeed: DEFAULTS.MAX_SPEED,
                maxForce: DEFAULTS.MAX_FORCE,
                separationWeight: DEFAULTS.SEPARATION_WEIGHT,
                alignmentWeight: DEFAULTS.ALIGNMENT_WEIGHT,
                cohesionWeight: DEFAULTS.COHESION_WEIGHT,
                drag: DEFAULTS.DRAG,
                noise: DEFAULTS.NOISE,
                alignmentBias: DEFAULTS.ALIGNMENT_BIAS,
            }),
        }),
        {
            name: 'simulation-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
