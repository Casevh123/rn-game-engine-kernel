import {createFlatTreeStorage} from "./FlatTreeStorage";
import {NULL, ROOT_ID} from "./constants";
import {createCommandBuffer} from "./CommandBuffer";
import {NodeHandle, System, FlatWorld, ComponentPool, FlatTreeStorage, RenderBuffer} from "./types";

export function createFlatWorld(capacity: number): FlatWorld {
    const storage: FlatTreeStorage = createFlatTreeStorage(capacity);
    const root: NodeHandle = { id: ROOT_ID, version: storage.version[ROOT_ID] };
    const pools: Set<ComponentPool> = new Set();
    const systems: System[] = [];
    let stepping: boolean = false;

    // We need a forward reference because commandBuffer captures `world`,
    // and `world` is what we return. We build the world object first, then
    // create the command buffer referencing it.
    const world: FlatWorld = {
        root,
        get capacity() { return storage.capacity; },
        commandBuffer: null as any, // assigned immediately below
        createNode,
        assertValidRef,
        isEnabled,
        isWorldEnabled,
        setEnabled,
        getParent,
        getChildren,
        isAlive,
        attach,
        detach,
        destroy,
        reparent,
        registerPool,
        addSystem,
        step,
        createTransformPropagationSystem,
        createRenderCollectionSystem,
        setLocalTransform,
        getLocalTransform,
        setLocalPosition,
        getWorldTransform,
        getStorage,
    };

    // Now create the command buffer with the real world reference
    (world as any).commandBuffer = createCommandBuffer(world);

    function createNode(): NodeHandle {
        const { id, version } = storage.allocate();
        return { id, version };
    }

    function assertValidRef(ref: NodeHandle): void {
        storage.assertValidRef(ref.id, ref.version);
    }

    function isEnabled(ref: NodeHandle): boolean {
        assertValidRef(ref);
        return storage.enabled[ref.id] === 1;
    }

    function isWorldEnabled(ref: NodeHandle): boolean {
        assertValidRef(ref);
        return storage.worldEnabled[ref.id] === 1;
    }

    // ─── worldEnabled propagation helpers ──────────────────────────────────

    /**
     * Walk subtree rooted at startId, setting worldEnabled = 0.
     * Skips sub-subtrees already worldEnabled = 0 (invariant guarantees
     * their descendants are also 0).
     */
    function _propagateWorldDisable(startId: number): void {
        const stack: number[] = [startId];
        while (stack.length > 0) {
            const current: number = stack.pop()!;
            if (storage.worldEnabled[current] === 0) continue;

            storage.worldEnabled[current] = 0;
            let childId: number = storage.firstChild[current];
            while (childId !== NULL) {
                stack.push(childId);
                childId = storage.nextSibling[childId];
            }
        }
    }

    /**
     * Walk subtree rooted at startId, setting worldEnabled = 1
     * for nodes whose own enabled = 1. Stops descending into
     * branches where enabled = 0 (individually disabled nodes
     * and their descendants stay worldEnabled = 0).
     */
    function _propagateWorldEnable(startId: number): void {
        const stack: number[] = [startId];
        while (stack.length > 0) {
            const current: number = stack.pop()!;
            if (storage.enabled[current] === 0) continue;

            storage.worldEnabled[current] = 1;
            let childId: number = storage.firstChild[current];
            while (childId !== NULL) {
                stack.push(childId);
                childId = storage.nextSibling[childId];
            }
        }
    }

    // ─── public API ────────────────────────────────────────────────────────

    function setEnabled(ref: NodeHandle, enabled: boolean) {
        assertValidRef(ref);

        if (!enabled) {
            storage.enabled[ref.id] = 0;
            _propagateWorldDisable(ref.id);
        } else {
            storage.enabled[ref.id] = 1;

            // If parent is worldDisabled, this node stays worldDisabled
            const parentId: number = storage.parent[ref.id];
            if (parentId !== NULL && storage.worldEnabled[parentId] === 0) return;

            _propagateWorldEnable(ref.id);
        }
    }

    function getParent(ref: NodeHandle): NodeHandle | null {
        assertValidRef(ref);
        if (storage.parent[ref.id] === NULL) {
            return null;
        }

        const id: number = storage.parent[ref.id];
        return { id, version: storage.version[id] };
    }

    function getChildren(ref: NodeHandle): NodeHandle[] {
        assertValidRef(ref);
        const children: NodeHandle[] = [];
        let current: number = storage.firstChild[ref.id];
        while (current !== NULL) {
            children.push({ id: current, version: storage.version[current] });
            current = storage.nextSibling[current];
        }
        return children;
    }

    function isAlive(ref: NodeHandle): boolean {
        return storage.alive[ref.id] === 1
            && storage.version[ref.id] === ref.version;
    }

    function attach(child: NodeHandle, parent: NodeHandle): void {
        if (stepping) {
            throw new Error("Cannot attach during step, use commandBuffer");
        }

        assertValidRef(child);
        assertValidRef(parent);

        if (child.id === ROOT_ID) throw new Error("Cannot attach root");
        if (child.id === parent.id) throw new Error("Cannot attach a node to itself");
        if (storage.parent[child.id] !== NULL) {
            throw new Error("Child already has parent");
        }

        storage.parent[child.id] = parent.id;

        const oldFirst: number = storage.firstChild[parent.id];
        storage.firstChild[parent.id] = child.id;

        storage.prevSibling[child.id] = NULL;
        storage.nextSibling[child.id] = oldFirst;

        if (oldFirst !== NULL) {
            storage.prevSibling[oldFirst] = child.id;
        }

        // Reconcile worldEnabled for the attached subtree
        if (storage.worldEnabled[parent.id] === 0) {
            _propagateWorldDisable(child.id);
        } else {
            _propagateWorldEnable(child.id);
        }
    }

    function detach(child: NodeHandle): void {
        if (stepping) {
            throw new Error("Cannot detach during step, use commandBuffer");
        }

        assertValidRef(child);

        if (child.id === ROOT_ID) throw new Error("Cannot detach root");

        const parentId = storage.parent[child.id];
        if (parentId === NULL) throw new Error("Node has no parent");

        const prev = storage.prevSibling[child.id];
        const next = storage.nextSibling[child.id];

        if (prev !== NULL) {
            storage.nextSibling[prev] = next;
        } else {
            storage.firstChild[parentId] = next;
        }

        if (next !== NULL) {
            storage.prevSibling[next] = prev;
        }

        storage.parent[child.id] = NULL;
        storage.prevSibling[child.id] = NULL;
        storage.nextSibling[child.id] = NULL;

        // If detached from a disabled parent, re-enable subtree
        if (storage.worldEnabled[parentId] === 0) {
            _propagateWorldEnable(child.id);
        }
    }

    function destroy(node: NodeHandle): void {
        if (stepping) {
            throw new Error("Cannot destroy during step, use commandBuffer");
        }

        assertValidRef(node);
        if (node.id === ROOT_ID) {
            throw new Error("Cannot destroy root node");
        }

        _destroySubtree(node.id);
    }

    function _destroySubtree(id: number): void {
        const stack1: number[] = [id];
        const stack2: number[] = [];
        while (stack1.length > 0) {
            const current: number = stack1.pop()!;
            stack2.push(current);
            let childId: number = storage.firstChild[current];
            while (childId !== NULL) {
                stack1.push(childId);
                childId = storage.nextSibling[childId];
            }
        }

        while (stack2.length > 0) {
            const current: number = stack2.pop()!;
            _destroyLeaf(current);
        }
    }

    function _destroyLeaf(id: number) {
        const parentId: number = storage.parent[id];
        if (parentId !== NULL) {
            const prev: number = storage.prevSibling[id];
            const next: number = storage.nextSibling[id];

            if (prev !== NULL) {
                storage.nextSibling[prev] = next;
            } else {
                storage.firstChild[parentId] = next;
            }

            if (next !== NULL) {
                storage.prevSibling[next] = prev;
            }
        }

        for (const pool of pools) {
            pool._removeByNodeId(id);
        }
        storage.free(id);
    }

    function reparent(node: NodeHandle, parent: NodeHandle): void {
        if (stepping) {
            throw new Error("Cannot reparent during step, use commandBuffer");
        }

        assertValidRef(node);
        assertValidRef(parent);

        if (node.id === ROOT_ID) {
            throw new Error("Cannot reparent root node");
        }

        if (node.id === parent.id) {
            throw new Error("Cannot attach a node to itself");
        }

        if (storage.parent[node.id] === NULL) {
            throw new Error("Node does not have a parent, use attach instead");
        }

        if (_isAncestor(node.id, parent.id)) {
            throw new Error("Cannot create cycle");
        }

        if (storage.parent[node.id] === parent.id) {
            throw new Error("Cannot reparent to current parent");
        }

        // remove from old parent
        const oldParent: number = storage.parent[node.id];
        const prev: number = storage.prevSibling[node.id];
        const next: number = storage.nextSibling[node.id];

        if (prev !== NULL) {
            storage.nextSibling[prev] = next;
        } else {
            storage.firstChild[oldParent] = next;
        }

        if (next !== NULL) {
            storage.prevSibling[next] = prev;
        }

        // insert into head of the new parent's children list
        storage.parent[node.id] = parent.id;

        const oldFirst: number = storage.firstChild[parent.id];
        storage.firstChild[parent.id] = node.id;

        storage.nextSibling[node.id] = oldFirst;
        storage.prevSibling[node.id] = NULL;

        if (oldFirst !== NULL) {
            storage.prevSibling[oldFirst] = node.id;
        }

        // Reconcile worldEnabled for the moved subtree
        if (storage.worldEnabled[parent.id] === 0) {
            _propagateWorldDisable(node.id);
        } else if (storage.worldEnabled[node.id] === 0) {
            _propagateWorldEnable(node.id);
        }
    }

    function _isAncestor(possibleAncestorId: number, nodeId: number): boolean {
        let current: number = storage.parent[nodeId];
        while (current !== NULL) {
            if (current === possibleAncestorId) return true;
            current = storage.parent[current];
        }
        return false;
    }

    function registerPool(pool: ComponentPool): void {
        if (!pool.belongsTo(world)) throw new Error("Pool does not belong to this world");
        if (pools.has(pool)) throw new Error("Pool already registered");
        pools.add(pool);
    }

    function addSystem(system: System): void {
        systems.push(system);
    }

    function step(dt: number): void {
        if (stepping) {
            throw new Error("Cannot call step() during step()");
        }
        stepping = true;
        try {
            for (const system of systems) {
                system(world, dt);
            }
        } catch (e) {
            world.commandBuffer.clear();
            throw e;
        } finally {
            stepping = false;
        }

        world.commandBuffer.flush();
    }

    function createTransformPropagationSystem(): System {
        const s = storage;
        return (_world: FlatWorld, _dt: number): void => {
            const stack: number[] = [ROOT_ID];
            while (stack.length > 0) {
                const nodeId: number = stack.pop()!;
                if (s.enabled[nodeId] === 0) {
                    continue;
                }

                const parentId: number = s.parent[nodeId];
                let pa: number = 1;
                let pb: number = 0;
                let px: number = 0;
                let py: number = 0;
                if (parentId !== NULL) {
                    pa = s.worldA[parentId];
                    pb = s.worldB[parentId];
                    px = s.worldTx[parentId];
                    py = s.worldTy[parentId];
                }

                const la: number = s.localA[nodeId];
                const lb: number = s.localB[nodeId];
                const lx: number = s.localTx[nodeId];
                const ly: number = s.localTy[nodeId];

                s.worldA[nodeId] = pa * la - pb * lb;
                s.worldB[nodeId] = pb * la + pa * lb;
                s.worldTx[nodeId] = lx * pa - ly * pb + px;
                s.worldTy[nodeId] = lx * pb + ly * pa + py;

                let child: number = s.firstChild[nodeId];
                while (child !== NULL) {
                    stack.push(child);
                    child = s.nextSibling[child];
                }
            }
        };
    }

    function createRenderCollectionSystem(
        spritePool: ComponentPool,
        spriteTypeData: Int32Array,
    ): { system: System; buffer: RenderBuffer } {
        // Pre-allocate once. Zero GC pressure.
        const buffer: RenderBuffer = {
            transforms: new Float32Array(spritePool.capacity * 4),
            spriteTypes: new Int32Array(spritePool.capacity),
            count: 0,
        }

        const s = storage // close over private storage

        const system: System = (_world: FlatWorld, _dt: number): void => {
            let writeIdx: number = 0;

            for (let i: number = 0; i < spritePool.count; i++) {
                const nodeId: number = spritePool.nodeIdAt(i);

                // skip nodes that are effectively disabled
                if (s.worldEnabled[nodeId] === 0) continue;

                // Gather: read from scattered storage, write contigous
                const base: number = writeIdx * 4;
                buffer.transforms[base] = s.worldA[nodeId];
                buffer.transforms[base + 1] = s.worldB[nodeId];
                buffer.transforms[base + 2] = s.worldTx[nodeId];
                buffer.transforms[base + 3] = s.worldTy[nodeId];
                buffer.spriteTypes[writeIdx] = spriteTypeData[i];

                writeIdx++;
            }

            buffer.count = writeIdx;
        }

        return {system, buffer}
    }

    function setLocalTransform(ref: NodeHandle, a: number, b: number, tx: number, ty: number): void {
        assertValidRef(ref);

        storage.localA[ref.id] = a;
        storage.localB[ref.id] = b;
        storage.localTx[ref.id] = tx;
        storage.localTy[ref.id] = ty;
    }

    function getLocalTransform(ref: NodeHandle): { a: number; b: number; tx: number; ty: number } {
        assertValidRef(ref);

        return {
            a: storage.localA[ref.id],
            b: storage.localB[ref.id],
            tx: storage.localTx[ref.id],
            ty: storage.localTy[ref.id],
        };
    }

    function setLocalPosition(ref: NodeHandle, tx: number, ty: number): void {
        assertValidRef(ref);

        storage.localTx[ref.id] = tx;
        storage.localTy[ref.id] = ty;
    }

    function getWorldTransform(ref: NodeHandle): { a: number; b: number; tx: number; ty: number } {
        assertValidRef(ref);

        return {
            a: storage.worldA[ref.id],
            b: storage.worldB[ref.id],
            tx: storage.worldTx[ref.id],
            ty: storage.worldTy[ref.id],
        };
    }

    function getStorage(): FlatTreeStorage {
        return storage;
    }

    return world;
}
