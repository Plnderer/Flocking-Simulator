// Physics defaults (Matched to boids.dan.onl)
export const DEFAULTS = {
    BOID_COUNT: 1000,
    PERCEPTION_RADIUS: 30,
    MAX_SPEED: 3.0,
    MIN_SPEED: 1.0,
    MAX_FORCE: 0.26, // "Steering Force"
    SEPARATION_WEIGHT: 1.3, // "Separation Force"
    ALIGNMENT_WEIGHT: 1.0, // "Alignment Force"
    COHESION_WEIGHT: 1.0, // "Cohesion Force"
    TRAIL_LENGTH: 0,
    FRAME_RATE: 60,
    DRAG: 0.005,
    NOISE: 0.2, // "Movement Randomness"
    ALIGNMENT_BIAS: 1.5,
    FIELD_OF_VIEW: 270, // Degrees
};

export const CONSTRAINTS = {
    MIN_BOID_COUNT: 1,
    MAX_BOID_COUNT: 1000,
    MIN_SPEED: 0,
    MAX_SPEED: 30, // Relaxed cap for sliders
    MIN_FORCE: 0,
    MAX_FORCE: 5,
    MIN_PERCEPTION: 10,
    MAX_PERCEPTION: 200,
    MIN_FOV: 90,
    MAX_FOV: 360,
};

export const THEME = {
    background: '#09090b', // zinc-950
    tint: '#2dd4bf',      // teal-400
};
