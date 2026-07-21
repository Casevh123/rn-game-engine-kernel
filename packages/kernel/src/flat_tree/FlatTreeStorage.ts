import {NULL, ROOT_ID} from "./constants";
import {FlatTreeStorage} from "./types";

export function createFlatTreeStorage(capacity: number): FlatTreeStorage {
    'worklet';
    if (capacity < 1) {
        throw new Error("Capacity must be at least 1");
    }

    const parent = new Int32Array(capacity);
    const firstChild = new Int32Array(capacity);
    const nextSibling = new Int32Array(capacity);
    const prevSibling = new Int32Array(capacity);
    const alive = new Int32Array(capacity);
    const enabled = new Int32Array(capacity);
    const worldEnabled = new Int32Array(capacity);
    const version = new Int32Array(capacity);
    const freeNext = new Int32Array(capacity);
    const localA = new Float32Array(capacity);
    const localB = new Float32Array(capacity);
    const localTx = new Float32Array(capacity);
    const localTy = new Float32Array(capacity);
    const worldA = new Float32Array(capacity);
    const worldB = new Float32Array(capacity);
    const worldTx = new Float32Array(capacity);
    const worldTy = new Float32Array(capacity);

    parent.fill(NULL);
    firstChild.fill(NULL);
    nextSibling.fill(NULL);
    prevSibling.fill(NULL);
    alive.fill(0);
    enabled.fill(1);
    worldEnabled.fill(0);
    version.fill(0);
    freeNext.fill(NULL);
    localA.fill(1);
    localB.fill(0);
    localTx.fill(0);
    localTy.fill(0);
    worldA.fill(1);
    worldB.fill(0);
    worldTx.fill(0);
    worldTy.fill(0);

    alive[ROOT_ID] = 1;
    version[ROOT_ID] = 1;
    worldEnabled[ROOT_ID] = 1;

    let freeHead: number = capacity > 1 ? 1 : NULL;

    for (let i = 1; i < capacity - 1; i++) {
        freeNext[i] = i + 1;
    }

    if (capacity > 1) {
        freeNext[capacity - 1] = NULL;
    }

    function allocate(): { id: number; version: number } {
        if (freeHead === NULL) throw new Error("FlatTreeStorage is full");

        const id: number = freeHead;
        freeHead = freeNext[id];

        alive[id] = 1;
        enabled[id] = 1;
        worldEnabled[id] = 0;
        version[id]++;

        parent[id] = NULL;
        firstChild[id] = NULL;
        nextSibling[id] = NULL;
        prevSibling[id] = NULL;
        localA[id] = 1;
        localB[id] = 0;
        localTx[id] = 0;
        localTy[id] = 0;
        worldA[id] = 1;
        worldB[id] = 0;
        worldTx[id] = 0;
        worldTy[id] = 0;

        return { id, version: version[id] };
    }

    function free(id: number): void {
        assertAlive(id);
        if (id === ROOT_ID) throw new Error("Cannot free root");

        alive[id] = 0;
        enabled[id] = 1;
        worldEnabled[id] = 0;

        parent[id] = NULL;
        firstChild[id] = NULL;
        nextSibling[id] = NULL;
        prevSibling[id] = NULL;
        localA[id] = 1;
        localB[id] = 0;
        localTx[id] = 0;
        localTy[id] = 0;
        worldA[id] = 1;
        worldB[id] = 0;
        worldTx[id] = 0;
        worldTy[id] = 0;

        freeNext[id] = freeHead;
        freeHead = id;
    }

    function assertInBounds(id: number): void {
        if (!Number.isInteger(id) || id < 0 || id >= capacity) {
            throw new Error(`Node id ${id} is out of bounds`);
        }
    }

    function assertAlive(id: number): void {
        assertInBounds(id);
        if (alive[id] !== 1) {
            throw new Error(`Node id ${id} is not alive`);
        }
    }

    function assertValidRef(id: number, ver: number): void {
        assertAlive(id);
        if (version[id] !== ver) {
            throw new Error("Stale node reference");
        }
    }

    return {
        capacity,
        parent,
        firstChild,
        nextSibling,
        prevSibling,
        alive,
        enabled,
        worldEnabled,
        version,
        localA,
        localB,
        localTx,
        localTy,
        worldA,
        worldB,
        worldTx,
        worldTy,
        allocate,
        free,
        assertInBounds,
        assertAlive,
        assertValidRef,
    };
}
