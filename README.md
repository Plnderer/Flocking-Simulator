# Flocking Simulator

A high-performance Boids simulation built with **React Native**, **Expo**, **Skia**, and **Reanimated**.
Designed for web and mobile, utilizing spatial hashing and instance rendering for 2000+ boids at 60fps.

## Features

- **Optimized Physics**: Zero-allocation simulation loop with `SpatialGrid` partitioning.
- **Skia Rendering**: GPU-accelerated graphics with shared memory buffers.
- **Customizable Logic**: Tweak Separation, Alignment, Cohesion, Drag, Noise, and more.
- **Behavioral Matching**: Includes advanced physics like Alignment Bias and Rotation Noise.
- **Cross-Platform**: Runs on Web (CanvasKit), iOS, and Android.

## Tech Stack

- React Native + Expo
- React Native Skia
- React Native Reanimated
- Zustand (State Management)

## Getting Started

1. **Install Dependencies**

   ```bash
   npm install
   ```

2. **Run Development Server**

   ```bash
   npx expo start
   ```

3. **Run on Web**
   Press `w` in the terminal.

4. **Run on iOS/Android**
   Press `i` or `a`, or scan the QR code with Expo Go.

## Architecture

- `lib/simulation/`: Core boids logic (Flock, Boid, SpatialGrid).
- `components/SimulationCanvas.tsx`: Main rendering loop using Skia and Reanimated.
- `lib/store/simulationStore.ts`: Zustand store for settings.

## Optimization Notes

- **Spatial Grid**: Uses a spatial hash grid to reduce neighbor lookup from O(N^2) to O(N).
- **Typed Arrays**: Vertex buffers are allocated as `Float32Array` or efficient structures.
- **Batched Drawing**: All boids are drawn in a single Skia `Vertices` call (or batched).

## License

MIT
