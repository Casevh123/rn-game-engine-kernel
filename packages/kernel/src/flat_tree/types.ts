/**
 * A lightweight, identity-only handle to a node in the world.
 * Carries no world reference and no methods — just the slot ID
 * and the generation counter needed for stale-ref detection.
 */
export type NodeHandle = { readonly id: number; readonly version: number };

/**
 * Value-equality check for two NodeHandles.
 */
export function refEquals(a: NodeHandle, b: NodeHandle): boolean {
    'worklet';
    return a.id === b.id && a.version === b.version;
}

// ─── Interface contracts ───────────────────────────────────────────────

export interface FlatTreeStorage {
    readonly capacity: number;
    readonly parent: Int32Array;
    readonly firstChild: Int32Array;
    readonly nextSibling: Int32Array;
    readonly prevSibling: Int32Array;
    readonly alive: Int32Array;
    readonly enabled: Int32Array;
    readonly worldEnabled: Int32Array;
    readonly version: Int32Array;
    readonly localA: Float32Array;
    readonly localB: Float32Array;
    readonly localTx: Float32Array;
    readonly localTy: Float32Array;
    readonly worldA: Float32Array;
    readonly worldB: Float32Array;
    readonly worldTx: Float32Array;
    readonly worldTy: Float32Array;
    allocate(): { id: number; version: number };
    free(id: number): void;
    assertInBounds(id: number): void;
    assertAlive(id: number): void;
    assertValidRef(id: number, version: number): void;
}

export interface CommandBuffer {
    destroy(ref: NodeHandle): void;
    attach(child: NodeHandle, parent: NodeHandle): void;
    detach(child: NodeHandle): void;
    reparent(node: NodeHandle, newParent: NodeHandle): void;
    flush(): void;
    clear(): void;
    readonly size: number;
}

export interface ComponentPool {
    readonly count: number;
    readonly capacity: number;
    add(ref: NodeHandle): number;
    remove(ref: NodeHandle): void;
    has(ref: NodeHandle): boolean;
    get(ref: NodeHandle): number;
    getByNodeId(nodeId: number): number;
    getNodeHandle(index: number): NodeHandle;
    nodeIdAt(index: number): number;
    belongsTo(world: FlatWorld): boolean;
    /** @internal */
    _removeByNodeId(nodeId: number): void;
}

export type System = (world: FlatWorld, dt: number) => void;

export interface FlatWorld {
    readonly root: NodeHandle;
    readonly capacity: number;
    readonly commandBuffer: CommandBuffer;
    createNode(): NodeHandle;
    assertValidRef(ref: NodeHandle): void;
    isEnabled(ref: NodeHandle): boolean;
    isWorldEnabled(ref: NodeHandle): boolean;
    setEnabled(ref: NodeHandle, enabled: boolean): void;
    getParent(ref: NodeHandle): NodeHandle | null;
    getChildren(ref: NodeHandle): NodeHandle[];
    isAlive(ref: NodeHandle): boolean;
    attach(child: NodeHandle, parent: NodeHandle): void;
    detach(child: NodeHandle): void;
    destroy(node: NodeHandle): void;
    reparent(node: NodeHandle, parent: NodeHandle): void;
    registerPool(pool: ComponentPool): void;
    addSystem(system: System): void;
    step(dt: number): void;
    getTime(): number;
    createTransformPropagationSystem(): System;
    createRenderCollectionSystem(
        spritePool: ComponentPool,
        spriteTypeData: Int32Array,
        atlasLookup: SpriteAtlasLookup,
    ): { system: System; buffer: RenderBuffer };
    setLocalTransform(ref: NodeHandle, a: number, b: number, tx: number, ty: number): void;
    getLocalTransform(ref: NodeHandle): { a: number; b: number; tx: number; ty: number };
    setLocalPosition(ref: NodeHandle, tx: number, ty: number): void;
    getWorldTransform(ref: NodeHandle): { a: number; b: number; tx: number; ty: number };
    /** @internal — for testing */
    getStorage(): FlatTreeStorage;
}

export interface RenderBuffer {
    readonly transforms: Float32Array;  // [a₀,b₀,tx₀,ty₀, a₁,b₁,tx₁,ty₁, ...]
    readonly spriteTypes: Int32Array; // [type₀, type₁, ...]
    count: number;
}

/**
 * Immutable lookup tables mapping sprite type ID -> sprite metadata.
 * All arrays are indexed by sprite type ID. Built once from atlas JSON,
 * never mutated at runtime.
 *
 * Pivot is normalized (0-1). (0.5, 0.5) = center. (0,0) = top-left.
 */
export interface SpriteAtlasLookup {
    readonly widths: Float32Array;
    readonly heights: Float32Array;
    readonly pivotXs: Float32Array;
    readonly pivotYs: Float32Array;
}

export interface TouchInputAccumulator {
    readonly touchX:             Float32Array;   // [MAX_TOUCHES]
    readonly touchY:             Float32Array;   // [MAX_TOUCHES]
    readonly beginX:             Float32Array;   // [MAX_TOUCHES]
    readonly beginY:             Float32Array;   // [MAX_TOUCHES]
    readonly beganSinceConsume:     Uint8Array;     // [MAX_TOUCHES] boolean
    readonly movedSinceConsume:     Uint8Array;     // [MAX_TOUCHES] boolean
    readonly endedSinceConsume:     Uint8Array;     // [MAX_TOUCHES] boolean
    readonly canceledSinceConsume:  Uint8Array;     // [MAX_TOUCHES] boolean
    readonly touchId:            Int32Array;     // [MAX_TOUCHES]
}

export interface TouchState {
    readonly touchX:       Float32Array;   // [MAX_TOUCHES]
    readonly touchY:       Float32Array;   // [MAX_TOUCHES]
    readonly startX:       Float32Array;  // position when BEGAN
    readonly startY:       Float32Array;
    readonly startTime:    Float32Array;  // world time when BEGAN (seconds)
    readonly prevX:        Float32Array;  // position last frame
    readonly prevY:        Float32Array;
    readonly beganThisTick:     Uint8Array;     // [MAX_TOUCHES] boolean
    readonly movedThisTick:     Uint8Array;     // [MAX_TOUCHES] boolean
    readonly endedThisTick:     Uint8Array;     // [MAX_TOUCHES] boolean
    readonly canceledThisTick:  Uint8Array;     // [MAX_TOUCHES] boolean
    readonly touchVisible:            Uint8Array;     // [MAX_TOUCHES]

    visibleTouchCount:   number;
}
