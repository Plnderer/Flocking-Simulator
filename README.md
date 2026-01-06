# Boids Flocking Simulator

A high-performance Boids flocking simulation built with React Native, Expo, and Skia. Cross-platform support for iOS, Android, and Web.

## Features
- **Accurate Simulation**: Implementation of Reynolds' Boids algorithm (Separation, Alignment, Cohesion).
- **High Performance**: Optimized with spatial hashing and typed arrays to support 2000+ boids at 60fps.
- **Skia Rendering**: Uses `@shopify/react-native-skia` for batched hardware-accelerated rendering.
- **Interactions**:
  - **Tap/Drag**: Attract boids.
  - **Long Press**: Repel predators.
  - **Double Tap**: Explosion effect.
- **Customizable**: Settings panel to tweak weights, speed, count, and radius in real-time.

## Tech Stack
- **Framework**: React Native + Expo (SDK 52+)
- **Rendering**: React Native Skia
- **State**: Zustand + Reanimated
- **Language**: TypeScript

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
