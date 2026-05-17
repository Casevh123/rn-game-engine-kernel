import React, { useEffect, useState } from 'react';
import { Dimensions, View, Text, StyleSheet, Pressable } from 'react-native';
import {
    Canvas,
    Atlas,
    useImage,
    useRSXformBuffer,
    useRectBuffer,
} from '@shopify/react-native-skia';
import {
    useSharedValue,
    useFrameCallback,
    runOnJS,
} from 'react-native-reanimated';
import { createFlatWorld } from './engine/flat_tree/FlatWorld';
import { createSpritePool } from './engine/flat_tree/SpritePool';
import { FRAME_SIZE } from './sprites';
import {scheduleOnRN} from "react-native-worklets";

// ─── Configuration ─────────────────────────────────────────────────────────
const ENGINE_ID = '__engine_v0';
const MAX_NODES = 2048;
const MAX_SPRITES = 1024;
const INITIAL_SPRITE_COUNT = 100;
const NUM_SPRITE_TYPES = 4;
const PERF_SAMPLE_INTERVAL = 60; // frames between stat reports

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Boundary Probe: TypedArray across worklet boundary ────────────────────
// Plain arrays captured from JS scope → reconstructed as TypedArrays in worklet
const _probeDataF32 = [1.5, 2.5, 3.5, 4.5];        // plain array (serializable)
const _probeDataI32 = [10, 20, 30, 40];              // plain array (serializable)
const _float32 = new Float32Array(_probeDataF32);

// ─── Performance stats type ────────────────────────────────────────────────
interface PerfStats {
    spriteCount: number;
    // Frame loop
    loopFps: number;
    avgFrameInterval: number;
    droppedFrames: number;
    // Kernel step
    stepAvg: number;
    stepMax: number;
    stepMin: number;
    // Step as % of 16.6ms budget
    budgetPct: number;
}

const EMPTY_STATS: PerfStats = {
    spriteCount: 0,
    loopFps: 0,
    avgFrameInterval: 0,
    droppedFrames: 0,
    stepAvg: 0,
    stepMax: 0,
    stepMin: 0,
    budgetPct: 0,
};

// ─── Component ─────────────────────────────────────────────────────────────
export function GameScreen() {
    const image = useImage(require('./assets/spritesheet.png'));
    const frameVersion = useSharedValue(0);
    const initialized = useSharedValue(false);
    const [stats, setStats] = useState<PerfStats>(EMPTY_STATS);
    const [showOverlay, setShowOverlay] = useState(true);

    // Sprite count control — shared so worklet can read it
    const targetSpriteCount = useSharedValue(INITIAL_SPRITE_COUNT);
    const [displayCount, setDisplayCount] = useState(INITIAL_SPRITE_COUNT);

    useEffect(() => {
        initialized.value = true;
    }, []);

    // ─── Frame loop ────────────────────────────────────────────────────────
    useFrameCallback((frame) => {
        'worklet';

        const g = globalThis as any;

        // ── Bootstrap engine (runs once) ──
        if (!g[ENGINE_ID] && initialized.value) {
            // // ── Probe: test TypedArray reconstruction from captured plain arrays ──
            const reconstructedF32 = new Float32Array(_probeDataF32);
            const reconstructedI32 = new Int32Array(_probeDataI32);
            const probeResult = {
                // Did reconstruction work?
                f32_isFloat32Array: reconstructedF32 instanceof Float32Array,
                f32_length: reconstructedF32.length,
                f32_values: [reconstructedF32[0], reconstructedF32[1], reconstructedF32[2], reconstructedF32[3]],
                i32_isInt32Array: reconstructedI32 instanceof Int32Array,
                i32_length: reconstructedI32.length,
                i32_values: [reconstructedI32[0], reconstructedI32[1], reconstructedI32[2], reconstructedI32[3]],
                // What did the captured plain arrays look like?
                source_f32_isArray: Array.isArray(_probeDataF32),
                source_i32_isArray: Array.isArray(_probeDataI32),
            };
            console.log('🔬 TypedArray Boundary Probe:', JSON.stringify(probeResult, null, 2));
            console.log(_float32 instanceof Float32Array)

            const world = createFlatWorld(MAX_NODES);
            const { pool: spritePool, spriteType } = createSpritePool(world, MAX_SPRITES);
            world.registerPool(spritePool);

            const vx = new Float32Array(MAX_SPRITES);
            const vy = new Float32Array(MAX_SPRITES);

            // ── Scratch arrays for positions (avoid getLocalTransform alloc per sprite) ──
            const px = new Float32Array(MAX_SPRITES);
            const py = new Float32Array(MAX_SPRITES);

            const GRAVITY = 980;       // px/s²
            const RESTITUTION = 0.8;   // bounce damping
            const RADIUS = 12;         // collision radius per sprite
            const DIAMETER = RADIUS * 2;
            const DIAMETER_SQ = DIAMETER * DIAMETER;

            // ── Gravity + velocity integration system ──
            const gravitySystem = (_w: any, dt: number) => {
                'worklet';
                const count = spritePool.count;
                for (let i = 0; i < count; i++) {
                    // Apply gravity
                    vy[i] += GRAVITY * dt;

                    // Integrate position
                    const handle = spritePool.getNodeHandle(i);
                    const t = _w.getLocalTransform(handle);
                    px[i] = t.tx + vx[i] * dt;
                    py[i] = t.ty + vy[i] * dt;

                    // Wall bounce
                    if (px[i] < RADIUS) {
                        px[i] = RADIUS;
                        vx[i] = Math.abs(vx[i]) * RESTITUTION;
                    } else if (px[i] > SCREEN_W - RADIUS) {
                        px[i] = SCREEN_W - RADIUS;
                        vx[i] = -Math.abs(vx[i]) * RESTITUTION;
                    }

                    // Floor/ceiling bounce
                    if (py[i] > SCREEN_H - RADIUS) {
                        py[i] = SCREEN_H - RADIUS;
                        vy[i] = -Math.abs(vy[i]) * RESTITUTION;
                    } else if (py[i] < RADIUS) {
                        py[i] = RADIUS;
                        vy[i] = Math.abs(vy[i]) * RESTITUTION;
                    }
                }
            };

            // ── Naive O(n²) collision system ──
            const collisionSystem = (_w: any, _dt: number) => {
                'worklet';
                const count = spritePool.count;
                for (let i = 0; i < count; i++) {
                    for (let j = i + 1; j < count; j++) {
                        const dx = px[j] - px[i];
                        const dy = py[j] - py[i];
                        const distSq = dx * dx + dy * dy;

                        if (distSq < DIAMETER_SQ && distSq > 0.0001) {
                            const dist = Math.sqrt(distSq);
                            const overlap = DIAMETER - dist;
                            const nx = dx / dist;
                            const ny = dy / dist;

                            // Push apart (half each)
                            const half = overlap * 0.5;
                            px[i] -= nx * half;
                            py[i] -= ny * half;
                            px[j] += nx * half;
                            py[j] += ny * half;

                            // Reflect velocities along collision normal
                            const relVx = vx[i] - vx[j];
                            const relVy = vy[i] - vy[j];
                            const relDotN = relVx * nx + relVy * ny;

                            if (relDotN > 0) {
                                const impulse = relDotN * RESTITUTION;
                                vx[i] -= impulse * nx;
                                vy[i] -= impulse * ny;
                                vx[j] += impulse * nx;
                                vy[j] += impulse * ny;
                            }
                        }
                    }
                }
            };

            // ── Write-back system: commit px/py to engine positions ──
            const writeBackSystem = (_w: any, _dt: number) => {
                'worklet';
                const count = spritePool.count;
                for (let i = 0; i < count; i++) {
                    const handle = spritePool.getNodeHandle(i);
                    _w.setLocalPosition(handle, px[i], py[i]);
                }
            };

            world.addSystem(gravitySystem);
            world.addSystem(collisionSystem);
            world.addSystem(writeBackSystem);
            world.addSystem(world.createTransformPropagationSystem());

            const { system: renderSystem, buffer } =
                world.createRenderCollectionSystem(spritePool, spriteType);
            world.addSystem(renderSystem);

            // Spawn initial sprites
            const root = world.root;
            const handles: any[] = [];
            for (let i = 0; i < INITIAL_SPRITE_COUNT; i++) {
                const node = world.createNode();
                world.attach(node, root);
                const compIdx = spritePool.add(node);
                spriteType[compIdx] = i % NUM_SPRITE_TYPES;
                world.setLocalPosition(node, Math.random() * SCREEN_W, Math.random() * SCREEN_H);
                vx[compIdx] = (Math.random() - 0.5) * 300;
                vy[compIdx] = (Math.random() - 0.5) * 300;
                handles.push(node);
            }

            // ── Perf accumulators ──
            const perf = {
                frameCount: 0,
                stepTimeSum: 0,
                stepTimeMax: 0,
                stepTimeMin: Infinity,
                frameIntervalSum: 0,
                droppedFrames: 0,
                lastSpriteCount: INITIAL_SPRITE_COUNT,
            };

            g[ENGINE_ID] = {
                world, spritePool, spriteType, buffer, vx, vy,
                handles, perf, root,
            };
        }

        const engine = g[ENGINE_ID];
        if (!engine) return;

        // ── Dynamic sprite count adjustment ──
        const target = targetSpriteCount.value;
        const current = engine.spritePool.count;

        if (target > current) {
            // Spawn more
            const toAdd = Math.min(target - current, 50); // batch max 50 per frame
            for (let i = 0; i < toAdd; i++) {
                const node = engine.world.createNode();
                engine.world.attach(node, engine.root);
                const compIdx = engine.spritePool.add(node);
                engine.spriteType[compIdx] = (current + i) % NUM_SPRITE_TYPES;
                engine.world.setLocalPosition(node, Math.random() * SCREEN_W, Math.random() * SCREEN_H);
                engine.vx[compIdx] = (Math.random() - 0.5) * 300;
                engine.vy[compIdx] = (Math.random() - 0.5) * 300;
                engine.handles.push(node);
            }
        } else if (target < current) {
            // Remove sprites
            const toRemove = Math.min(current - target, 50);
            for (let i = 0; i < toRemove; i++) {
                const handle = engine.handles.pop();
                if (handle) {
                    engine.world.destroy(handle);
                }
            }
        }

        // ── Tick the engine (MEASURED) ──
        const dt =
            frame.timeSincePreviousFrame == null
                ? 0
                : frame.timeSincePreviousFrame / 1000;

        const frameIntervalMs = frame.timeSincePreviousFrame ?? 0;

        const t0 = performance.now();
        engine.world.step(dt);
        const stepMs = performance.now() - t0;

        // ── Accumulate perf stats ──
        const p = engine.perf;
        p.frameCount++;
        p.stepTimeSum += stepMs;
        if (stepMs > p.stepTimeMax) p.stepTimeMax = stepMs;
        if (stepMs < p.stepTimeMin) p.stepTimeMin = stepMs;
        p.frameIntervalSum += frameIntervalMs;
        if (frameIntervalMs > 18) p.droppedFrames++;

        // ── Report stats every N frames ──
        if (p.frameCount >= PERF_SAMPLE_INTERVAL) {
            const avgStep = p.stepTimeSum / p.frameCount;
            const avgInterval = p.frameIntervalSum / p.frameCount;
            const loopFps = avgInterval > 0 ? 1000 / avgInterval : 0;

            const report: PerfStats = {
                spriteCount: engine.spritePool.count,
                loopFps: Math.round(loopFps * 10) / 10,
                avgFrameInterval: Math.round(avgInterval * 100) / 100,
                droppedFrames: p.droppedFrames,
                stepAvg: Math.round(avgStep * 1000) / 1000,
                stepMax: Math.round(p.stepTimeMax * 1000) / 1000,
                stepMin: Math.round(p.stepTimeMin * 1000) / 1000,
                budgetPct: Math.round((avgStep / 16.667) * 1000) / 10,
            };

            runOnJS(setStats)(report);

            // Reset accumulators
            p.frameCount = 0;
            p.stepTimeSum = 0;
            p.stepTimeMax = 0;
            p.stepTimeMin = Infinity;
            p.frameIntervalSum = 0;
            p.droppedFrames = 0;
        }

        frameVersion.value += 1;
    });

    // ─── Sprite count controls ─────────────────────────────────────────────
    const adjustCount = (delta: number) => {
        const newCount = Math.max(0, Math.min(MAX_SPRITES, displayCount + delta));
        setDisplayCount(newCount);
        targetSpriteCount.value = newCount;
    };

    // ─── Skia Atlas buffers ────────────────────────────────────────────────
    const transforms = useRSXformBuffer(MAX_SPRITES, (val, i) => {
        'worklet';
        frameVersion.value;
        const g = globalThis as any;
        const engine = g[ENGINE_ID];
        if (!engine || i >= engine.buffer.count) {
            val.set(0, 0, -9999, -9999);
            return;
        }
        const base = i * 4;
        val.set(
            engine.buffer.transforms[base],
            engine.buffer.transforms[base + 1],
            engine.buffer.transforms[base + 2],
            engine.buffer.transforms[base + 3],
        );
    });

    const sprites = useRectBuffer(MAX_SPRITES, (val, i) => {
        'worklet';
        frameVersion.value;
        const g = globalThis as any;
        const engine = g[ENGINE_ID];
        if (!engine || i >= engine.buffer.count) {
            val.setXYWH(0, 0, 0, 0);
            return;
        }
        const type = engine.buffer.spriteTypes[i];
        const col = type % 4;
        const row = Math.floor(type / 4);
        val.setXYWH(col * FRAME_SIZE, row * FRAME_SIZE, FRAME_SIZE, FRAME_SIZE);
    });

    // ─── Render ────────────────────────────────────────────────────────────
    if (!image) {
        return (
            <View style={styles.loading}>
                <Text style={styles.loadingText}>Loading spritesheet…</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Canvas style={styles.canvas}>
                <Atlas
                    image={image}
                    sprites={sprites}
                    transforms={transforms}
                />
            </Canvas>

            {/* ── Perf overlay ── */}
            {showOverlay && (
                <View style={styles.overlay}>
                    <Text style={styles.overlayTitle}>Engine Perf</Text>

                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Sprites</Text>
                        <Text style={styles.statValue}>{stats.spriteCount}</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Loop FPS</Text>
                        <Text style={[
                            styles.statValue,
                            stats.loopFps < 55 ? styles.warn : styles.good,
                        ]}>{stats.loopFps}</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Step avg</Text>
                        <Text style={styles.statValue}>{stats.stepAvg} ms</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Step max</Text>
                        <Text style={[
                            styles.statValue,
                            stats.stepMax > 8 ? styles.warn : styles.good,
                        ]}>{stats.stepMax} ms</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Step min</Text>
                        <Text style={styles.statValue}>{stats.stepMin} ms</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Budget</Text>
                        <Text style={[
                            styles.statValue,
                            stats.budgetPct > 50 ? styles.warn : styles.good,
                        ]}>{stats.budgetPct}%</Text>
                    </View>
                    <View style={styles.statRow}>
                        <Text style={styles.statLabel}>Drops</Text>
                        <Text style={[
                            styles.statValue,
                            stats.droppedFrames > 0 ? styles.warn : styles.good,
                        ]}>{stats.droppedFrames} / {PERF_SAMPLE_INTERVAL}</Text>
                    </View>

                    {/* ── Sprite count controls ── */}
                    <View style={styles.controls}>
                        <Pressable style={styles.btn} onPress={() => adjustCount(-50)}>
                            <Text style={styles.btnText}>−50</Text>
                        </Pressable>
                        <Pressable style={styles.btn} onPress={() => adjustCount(-10)}>
                            <Text style={styles.btnText}>−10</Text>
                        </Pressable>
                        <Text style={styles.countDisplay}>{displayCount}</Text>
                        <Pressable style={styles.btn} onPress={() => adjustCount(10)}>
                            <Text style={styles.btnText}>+10</Text>
                        </Pressable>
                        <Pressable style={styles.btn} onPress={() => adjustCount(50)}>
                            <Text style={styles.btnText}>+50</Text>
                        </Pressable>
                    </View>
                    <View style={styles.controls}>
                        <Pressable style={styles.btn} onPress={() => adjustCount(100)}>
                            <Text style={styles.btnText}>+100</Text>
                        </Pressable>
                        <Pressable style={styles.btn} onPress={() => adjustCount(500)}>
                            <Text style={styles.btnText}>+500</Text>
                        </Pressable>
                    </View>
                </View>
            )}

            {/* ── Toggle overlay ── */}
            <Pressable
                style={styles.toggleBtn}
                onPress={() => setShowOverlay(v => !v)}
            >
                <Text style={styles.toggleText}>{showOverlay ? '✕' : '⚡'}</Text>
            </Pressable>
        </View>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    canvas: {
        flex: 1,
        backgroundColor: '#1a1a2e',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1a1a2e',
    },
    loadingText: {
        color: '#ffffff',
        fontSize: 18,
    },
    overlay: {
        position: 'absolute',
        top: 60,
        left: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        borderRadius: 12,
        padding: 14,
        minWidth: 200,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    overlayTitle: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 8,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 2,
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        fontFamily: 'Menlo',
    },
    statValue: {
        color: '#ffffff',
        fontSize: 13,
        fontFamily: 'Menlo',
        fontWeight: '600',
    },
    good: {
        color: '#4ade80',
    },
    warn: {
        color: '#fb923c',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    btn: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    btnText: {
        color: '#ffffff',
        fontSize: 13,
        fontFamily: 'Menlo',
        fontWeight: '600',
    },
    countDisplay: {
        color: '#ffffff',
        fontSize: 16,
        fontFamily: 'Menlo',
        fontWeight: '700',
        minWidth: 40,
        textAlign: 'center',
    },
    toggleBtn: {
        position: 'absolute',
        top: 60,
        right: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toggleText: {
        color: '#ffffff',
        fontSize: 18,
    },
});
