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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
    createFlatWorld,
    createComponentPool,
    createTouchBuffer,
    createTouchState,
    createBeginInputFrame,
    createEndInputFrame,
    writeTouchDown,
    writeTouchMove,
    writeTouchUp,
    writeTouchCancel,
    findInBuffer,
    MAX_TOUCHES,
    SpriteAtlasLookup,
    TouchEventBuffer,
} from '@engine/kernel';
import {createSpriteAtlasLookup, FRAME_SIZE} from './sprites';

// ─── Configuration ─────────────────────────────────────────────────────────
const ENGINE_ID = '__engine_v0';
const MAX_NODES = 2048;
const MAX_SPRITES = 1024;
const INITIAL_SPRITE_COUNT = 100;
const NUM_SPRITE_TYPES = 4;
const PERF_SAMPLE_INTERVAL = 60; // frames between stat reports

// Rendered sprite size must match the physics collision diameter —
// frames are 256px in the atlas, scaled down to SPRITE_SIZE on screen.
const SPRITE_SIZE = 24;
const SPRITE_SCALE = SPRITE_SIZE / FRAME_SIZE;
const FINGER_RADIUS = 40; // finger acts as a kinematic circle collider

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
            const world = createFlatWorld(MAX_NODES);

            const spriteType = new Int32Array(MAX_SPRITES);
            const vx = new Float32Array(MAX_SPRITES);
            const vy = new Float32Array(MAX_SPRITES);

            // ── Scratch arrays for positions (avoid getLocalTransform alloc per sprite) ──
            const px = new Float32Array(MAX_SPRITES);
            const py = new Float32Array(MAX_SPRITES);

            // Swap-and-pop callback: every array indexed by component index
            // must be swapped here, or non-tail removals desync the columns.
            const spritePool = createComponentPool(world, MAX_SPRITES, (a: number, b: number) => {
                'worklet';
                const tmpType = spriteType[a]; spriteType[a] = spriteType[b]; spriteType[b] = tmpType;
                let tmp = vx[a]; vx[a] = vx[b]; vx[b] = tmp;
                tmp = vy[a]; vy[a] = vy[b]; vy[b] = tmp;
                tmp = px[a]; px[a] = px[b]; px[b] = tmp;
                tmp = py[a]; py[a] = py[b]; py[b] = tmp;
            });
            world.registerPool(spritePool);

            // ── Touch input: raw event buffer (gesture-written) → cooked state ──
            const touchBuffer = createTouchBuffer();
            const touchState = createTouchState();

            const GRAVITY = 980;       // px/s²
            const RESTITUTION = 0.8;   // bounce damping
            const RADIUS = SPRITE_SIZE / 2;  // collision radius = visual radius
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

            // ── Finger collider: each visible touch is a kinematic circle ──
            const fingerSystem = (_w: any, dt: number) => {
                'worklet';
                const count = spritePool.count;
                const minDist = FINGER_RADIUS + RADIUS;
                const minDistSq = minDist * minDist;

                for (let t = 0; t < MAX_TOUCHES; t++) {
                    if (touchState.touchVisible[t] === 0) continue;

                    const fx = touchState.touchX[t];
                    const fy = touchState.touchY[t];
                    // Finger velocity from the per-frame delta contract (prev = last engine frame)
                    const fvx = dt > 0 ? (fx - touchState.prevX[t]) / dt : 0;
                    const fvy = dt > 0 ? (fy - touchState.prevY[t]) / dt : 0;

                    for (let i = 0; i < count; i++) {
                        const dx = px[i] - fx;
                        const dy = py[i] - fy;
                        const distSq = dx * dx + dy * dy;
                        if (distSq >= minDistSq) continue;

                        const dist = Math.sqrt(distSq);
                        const nx = dist > 0.0001 ? dx / dist : 0;
                        const ny = dist > 0.0001 ? dy / dist : -1;

                        // Finger has infinite mass: push the sprite fully out…
                        px[i] = fx + nx * minDist;
                        py[i] = fy + ny * minDist;

                        // …and reflect relative velocity along the normal
                        const relDotN = (vx[i] - fvx) * nx + (vy[i] - fvy) * ny;
                        if (relDotN < 0) {
                            vx[i] -= (1 + RESTITUTION) * relDotN * nx;
                            vy[i] -= (1 + RESTITUTION) * relDotN * ny;
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

            // TouchSpec contract: beginInputFrame FIRST, endInputFrame LAST
            world.addSystem(createBeginInputFrame(touchBuffer, touchState));
            world.addSystem(gravitySystem);
            world.addSystem(collisionSystem);
            world.addSystem(fingerSystem);
            world.addSystem(writeBackSystem);
            world.addSystem(world.createTransformPropagationSystem());

            const atlas: SpriteAtlasLookup = createSpriteAtlasLookup();
            const { system: renderSystem, buffer } =
                world.createRenderCollectionSystem(spritePool, spriteType, atlas);
            world.addSystem(renderSystem);
            world.addSystem(createEndInputFrame(touchBuffer, touchState));

            // Spawn initial sprites
            const root = world.root;
            const handles: any[] = [];
            for (let i = 0; i < INITIAL_SPRITE_COUNT; i++) {
                const node = world.createNode();
                world.attach(node, root);
                const compIdx = spritePool.add(node);
                spriteType[compIdx] = i % NUM_SPRITE_TYPES;
                world.setLocalTransform(node, SPRITE_SCALE, 0, Math.random() * SCREEN_W, Math.random() * SCREEN_H);
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
                handles, perf, root, touchBuffer, touchState,
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
                engine.world.setLocalTransform(node, SPRITE_SCALE, 0, Math.random() * SCREEN_W, Math.random() * SCREEN_H);
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

    // ─── Touch producer: gesture events → TouchEventBuffer ────────────────
    // Runs on the UI runtime, same as the frame loop. Guards: events before
    // engine bootstrap are dropped; move/up/cancel for unknown ids are dropped
    // (writeTouch* throw on unknown ids by contract); a down with no free slot
    // is dropped rather than tripping the kernel's MAX_TOUCHES throw.
    const touchGesture = Gesture.Manual()
        .onTouchesDown((e, mgr) => {
            'worklet';
            const engine = (globalThis as any)[ENGINE_ID];
            if (engine) {
                const buf: TouchEventBuffer = engine.touchBuffer;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (findInBuffer(buf, t.id) === -1 && findInBuffer(buf, -1) !== -1) {
                        writeTouchDown(buf, t.id, t.x, t.y);
                    }
                }
            }
            mgr.activate();
        })
        .onTouchesMove((e) => {
            'worklet';
            const engine = (globalThis as any)[ENGINE_ID];
            if (!engine) return;
            const buf: TouchEventBuffer = engine.touchBuffer;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (findInBuffer(buf, t.id) !== -1) {
                    writeTouchMove(buf, t.id, t.x, t.y);
                }
            }
        })
        .onTouchesUp((e, mgr) => {
            'worklet';
            const engine = (globalThis as any)[ENGINE_ID];
            if (engine) {
                const buf: TouchEventBuffer = engine.touchBuffer;
                for (let i = 0; i < e.changedTouches.length; i++) {
                    const t = e.changedTouches[i];
                    if (findInBuffer(buf, t.id) !== -1) {
                        writeTouchUp(buf, t.id, t.x, t.y);
                    }
                }
            }
            if (e.numberOfTouches === 0) {
                mgr.end();
            }
        })
        .onTouchesCancelled((e) => {
            'worklet';
            const engine = (globalThis as any)[ENGINE_ID];
            if (!engine) return;
            const buf: TouchEventBuffer = engine.touchBuffer;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const t = e.changedTouches[i];
                if (findInBuffer(buf, t.id) !== -1) {
                    writeTouchCancel(buf, t.id);
                }
            }
        });

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
            <GestureDetector gesture={touchGesture}>
                <Canvas style={styles.canvas}>
                    <Atlas
                        image={image}
                        sprites={sprites}
                        transforms={transforms}
                    />
                </Canvas>
            </GestureDetector>

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
