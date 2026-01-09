// Physics defaults (Matched to boids.dan.onl)
export const DEFAULTS = {
    BOID_COUNT: 1500, // Reference default
    PERCEPTION_RADIUS: 25,
    MAX_SPEED: 4.0,
    MAX_FORCE: 0.2, // "Steering Force"
    SEPARATION_WEIGHT: 1.1, // "Separation Force"
    ALIGNMENT_WEIGHT: 1.1, // "Alignment Force"
    COHESION_WEIGHT: 1.0, // "Cohesion Force"
    TRAIL_LENGTH: 0,
    FRAME_RATE: 60,
    DRAG: 0.005,
    NOISE: 1.0, // "Movement Randomness"
    ALIGNMENT_BIAS: 1.5,
};

export const CONSTRAINTS = {
    MIN_BOID_COUNT: 1,
    MAX_BOID_COUNT: 5000,
    MIN_SPEED: 0,
    MAX_SPEED: 30, // Relaxed cap for sliders
    MIN_FORCE: 0,
    MAX_FORCE: 5,
    MIN_PERCEPTION: 10,
    MAX_PERCEPTION: 200,
};

export const THEME = {
    background: '#09090b', // zinc-950
    tint: '#2dd4bf',      // teal-400
};
