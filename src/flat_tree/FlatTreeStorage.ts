import {NULL, ROOT_ID} from "./constants";

export class FlatTreeStorage {
    readonly parent: Int32Array;
    readonly firstChild: Int32Array;
    readonly nextSibling: Int32Array;
    readonly prevSibling: Int32Array;
    readonly alive: Int32Array;
    readonly enabled: Int32Array;
    readonly version: Int32Array;
    readonly freeNext: Int32Array;
    private freeHead: number;

    // Local transform (relative to parent)
    readonly localA: Float32Array; // sCos
    readonly localB: Float32Array; // sSin
    readonly localTx: Float32Array;
    readonly localTy: Float32Array;

    // World transform (computer by propagation system)
    readonly worldA: Float32Array;
    readonly worldB: Float32Array;
    readonly worldTx: Float32Array;
    readonly worldTy: Float32Array;

    constructor(readonly capacity: number) {
        if (capacity < 1) {
            throw new Error("Capacity must be at least 1");
        }

        this.parent = new Int32Array(capacity);
        this.firstChild = new Int32Array(capacity);
        this.nextSibling = new Int32Array(capacity);
        this.prevSibling = new Int32Array(capacity);
        this.alive = new Int32Array(capacity);
        this.enabled = new Int32Array(capacity);
        this.version = new Int32Array(capacity);
        this.freeNext = new Int32Array(capacity);
        this.localA = new Float32Array(capacity);
        this.localB = new Float32Array(capacity);
        this.localTx = new Float32Array(capacity);
        this.localTy = new Float32Array(capacity);
        this.worldA = new Float32Array(capacity);
        this.worldB = new Float32Array(capacity);
        this.worldTx = new Float32Array(capacity);
        this.worldTy = new Float32Array(capacity);

        this.parent.fill(NULL);
        this.firstChild.fill(NULL);
        this.nextSibling.fill(NULL);
        this.prevSibling.fill(NULL);
        this.alive.fill(0);
        this.enabled.fill(1);
        this.version.fill(0);
        this.freeNext.fill(NULL);
        this.localA.fill(1);
        this.localB.fill(0);
        this.localTx.fill(0);
        this.localTy.fill(0);
        this.worldA.fill(1);
        this.worldB.fill(0);
        this.worldTx.fill(0);
        this.worldTy.fill(0);

        this.alive[ROOT_ID] = 1;
        this.version[ROOT_ID] = 1;

        this.freeHead = capacity > 1 ? 1 : NULL;

        for (let i = 1; i < capacity - 1; i++) {
            this.freeNext[i] = i + 1;
        }

        if (capacity > 1) {
            this.freeNext[capacity - 1] = NULL;
        }
    }

    allocate(): { id: number; version: number} {
        if (this.freeHead === NULL) throw new Error("FlatTreeStorage is full");

        const id: number = this.freeHead;
        this.freeHead = this.freeNext[id];

        this.alive[id] = 1;
        this.enabled[id] = 1;
        this.version[id]++;

        this.parent[id] = NULL;
        this.firstChild[id] = NULL;
        this.nextSibling[id] = NULL;
        this.prevSibling[id] = NULL;
        this.localA[id] = 1;
        this.localB[id] = 0;
        this.localTx[id] = 0;
        this.localTy[id] = 0;
        this.worldA[id] = 1;
        this.worldB[id] = 0;
        this.worldTx[id] = 0;
        this.worldTy[id] = 0;

        return { id, version: this.version[id] };
    }

    free(id: number): void {
        this.assertAlive(id);
        if (id === ROOT_ID) throw new Error("Cannot free root");

        this.alive[id] = 0;
        this.enabled[id] = 1;

        this.parent[id] = NULL;
        this.firstChild[id] = NULL;
        this.nextSibling[id] = NULL;
        this.prevSibling[id] = NULL;
        this.localA[id] = 1;
        this.localB[id] = 0;
        this.localTx[id] = 0;
        this.localTy[id] = 0;
        this.worldA[id] = 1;
        this.worldB[id] = 0;
        this.worldTx[id] = 0;
        this.worldTy[id] = 0;

        this.freeNext[id] = this.freeHead;
        this.freeHead = id;
    }

    assertInBounds(id: number): void {
        if (!Number.isInteger(id) || id < 0 || id >= this.capacity) {
            throw new Error(`Node id ${id} is out of bounds`);
        }
    }

    assertAlive(id: number): void {
        this.assertInBounds(id);
        if (this.alive[id] !== 1) {
            throw new Error(`Node id ${id} is not alive`);
        }
    }

    assertValidRef(id: number, version: number): void {
        this.assertAlive(id);
        if (this.version[id] !== version) {
            throw new Error("Stale node reference");
        }
    }
}
