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

    // Actions
    setBoidCount: (n: number) => void;
    setPerceptionRadius: (n: number) => void;
    setMaxSpeed: (n: number) => void;
    setMaxForce: (n: number) => void;
    setSeparationWeight: (n: number) => void;
    setAlignmentWeight: (n: number) => void;
    setCohesionWeight: (n: number) => void;
    togglePlay: () => void;
    toggleDebug: () => void;
    toggleTheme: () => void;
    setColorMode: (mode: 'solid' | 'velocity' | 'rainbow') => void;
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

            setBoidCount: (n) => set({ boidCount: Math.min(Math.max(n, CONSTRAINTS.MIN_BOID_COUNT), CONSTRAINTS.MAX_BOID_COUNT) }),
            setPerceptionRadius: (n) => set({ perceptionRadius: Math.min(Math.max(n, CONSTRAINTS.MIN_PERCEPTION), CONSTRAINTS.MAX_PERCEPTION) }),
            setMaxSpeed: (n) => set({ maxSpeed: Math.min(Math.max(n, CONSTRAINTS.MIN_SPEED), CONSTRAINTS.MAX_SPEED) }),
            setMaxForce: (n) => set({ maxForce: n }),
            setSeparationWeight: (n) => set({ separationWeight: n }),
            setAlignmentWeight: (n) => set({ alignmentWeight: n }),
            setCohesionWeight: (n) => set({ cohesionWeight: n }),
            togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
            toggleDebug: () => set((state) => ({ showDebug: !state.showDebug })),
            toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
            setColorMode: (mode) => set({ colorMode: mode }),
            resetDefaults: () => set({
                boidCount: DEFAULTS.BOID_COUNT,
                perceptionRadius: DEFAULTS.PERCEPTION_RADIUS,
                maxSpeed: DEFAULTS.MAX_SPEED,
                maxForce: DEFAULTS.MAX_FORCE,
                separationWeight: DEFAULTS.SEPARATION_WEIGHT,
                alignmentWeight: DEFAULTS.ALIGNMENT_WEIGHT,
                cohesionWeight: DEFAULTS.COHESION_WEIGHT,
            }),
        }),
        {
            name: 'simulation-settings',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
