/**
 * @engine/react-native — React Native plumbing for the game engine kernel.
 *
 * This package bridges @engine/kernel with React Native:
 * - Rendering: Skia Atlas consumption of the kernel's RenderBuffer
 * - Input: Gesture.Manual() → InputBuffer writes (planned)
 * - Lifecycle: Engine bootstrap, frame loop, system registration
 *
 * Currently a skeleton. Reusable abstractions will be extracted from
 * apps/demo as patterns stabilize.
 */

// Re-export kernel for convenience — consumers can depend on just @engine/react-native
export * from '@engine/kernel';

// ─── Plumbing exports (TODO: extract from demo as patterns stabilize) ──────
//
// Planned exports:
//
// Engine lifecycle:
//   useEngine(config)        — bootstrap hook: creates world, registers systems
//   <EngineCanvas>           — Canvas + Atlas + buffer management component
//
// Input bridge:
//   useInputBridge(buffer)   — Gesture.Manual() → InputBuffer wiring
//   createInputBuffer()      — factory for the world-level input singleton
//
// Debug:
//   <PerfOverlay>            — the perf stats overlay component
//
