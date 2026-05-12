import {FlatNodeRef} from "./FlatNodeRef";
import {FlatTreeStorage} from "./FlatTreeStorage";
import {NULL, ROOT_ID} from "./constants";
import {ComponentPool} from "./ComponentPool";
import {CommandBuffer} from "./CommandBuffer";
import {System} from "./types";

export class FlatWorld {
    private _storage: FlatTreeStorage;
    readonly root: FlatNodeRef;
    private _pools: Set<ComponentPool> = new Set();
    private _systems: System[] = [];
    private _stepping: boolean = false;
    readonly commandBuffer: CommandBuffer;

    constructor(capacity: number) {
        this._storage = new FlatTreeStorage(capacity);
        this.root = new FlatNodeRef(this, ROOT_ID, this._storage.version[ROOT_ID]);
        this.commandBuffer = new CommandBuffer(this);
    }

    get capacity(): number { return this._storage.capacity; }

    createNode(): FlatNodeRef {
        const { id, version } = this._storage.allocate();
        return new FlatNodeRef(this, id, version);
    }

    assertValidRef(ref: FlatNodeRef): void {
        this._storage.assertValidRef(ref.id, ref.version);
    }

    assertInWorld(ref: FlatNodeRef): void {
        if (!ref.belongsTo(this)) {
            throw new Error("Node does not belong to this world");
        }
        this.assertValidRef(ref);
    }

    isEnabled(ref: FlatNodeRef): boolean {
        this.assertInWorld(ref);
        return this._storage.enabled[ref.id] === 1;
    }

    setEnabled(ref: FlatNodeRef, enabled: boolean) {
        this.assertInWorld(ref);
        this._storage.enabled[ref.id] = enabled ? 1 : 0;
    }

    getParent(ref: FlatNodeRef): FlatNodeRef | null {
        this.assertInWorld(ref);
        if (this._storage.parent[ref.id] === NULL) {
            return null;
        }

        const id: number = this._storage.parent[ref.id];
        return new FlatNodeRef(this, id, this._storage.version[id]);
    }

    getChildren(ref: FlatNodeRef): FlatNodeRef[] {
        this.assertInWorld(ref);
        const bareChildren: {id: number, version: number}[] = []
        let current: number = this._storage.firstChild[ref.id];
        while (current !== NULL) {
            bareChildren.push({id: current, version: this._storage.version[current]});
            current = this._storage.nextSibling[current];
        }

        return bareChildren.map(bare => new FlatNodeRef(this, bare.id, bare.version));
    }

    isAlive(ref: FlatNodeRef): boolean {
        if (!ref.belongsTo(this)) {
            throw new Error("Node does not belong to this world");
        }
        return this._storage.alive[ref.id] === 1
            && this._storage.version[ref.id] === ref.version;
    }

    attach(child: FlatNodeRef, parent: FlatNodeRef): void {
        if (this._stepping) {
            throw new Error("Cannot attach during step, use commandBuffer")
        }

        this.assertInWorld(child);
        this.assertInWorld(parent);

        if (child.id === ROOT_ID) throw new Error("Cannot attach root");
        if (child.id === parent.id) throw new Error("Cannot attach a node to itself");
        if (this._storage.parent[child.id] !== NULL) {
            throw new Error("Child already has parent");
        }

        this._storage.parent[child.id] = parent.id;

        const oldFirst: number = this._storage.firstChild[parent.id];
        this._storage.firstChild[parent.id] = child.id;

        this._storage.prevSibling[child.id] = NULL;
        this._storage.nextSibling[child.id] = oldFirst;

        if (oldFirst !== NULL) {
            this._storage.prevSibling[oldFirst] = child.id;
        }
    }

    detach(child: FlatNodeRef): void {
        if (this._stepping) {
            throw new Error("Cannot detach during step, use commandBuffer")
        }

        this.assertInWorld(child);

        if (child.id === ROOT_ID) throw new Error("Cannot detach root");

        const parent = this._storage.parent[child.id];
        if (parent === NULL) throw new Error("Node has no parent");

        const prev = this._storage.prevSibling[child.id];
        const next = this._storage.nextSibling[child.id];

        if (prev !== NULL) {
            this._storage.nextSibling[prev] = next;
        } else {
            this._storage.firstChild[parent] = next;
        }

        if (next !== NULL) {
            this._storage.prevSibling[next] = prev;
        }

        this._storage.parent[child.id] = NULL;
        this._storage.prevSibling[child.id] = NULL;
        this._storage.nextSibling[child.id] = NULL;
    }

    destroy(node: FlatNodeRef): void {
        if (this._stepping) {
            throw new Error("Cannot destroy during step, use commandBuffer")
        }

        this.assertInWorld(node);
        if (node.id === ROOT_ID) {
            throw new Error("Cannot destroy root node");
        }

        this._destroySubtree(node.id)
    }

    private _destroySubtree(id: number): void {
        const stack1: number[] = [id];
        const stack2: number[] = [];
        while (stack1.length > 0) {
            const node: number = stack1.pop()!;
            stack2.push(node);
            let childId: number = this._storage.firstChild[node];
            while (childId !== NULL) {
                stack1.push(childId);
                childId = this._storage.nextSibling[childId];
            }
        }

        while (stack2.length > 0) {
            const node: number = stack2.pop()!;
            this._destroyLeaf(node);
        }
    }

    private _destroyLeaf(id: number) {
        const parent: number = this._storage.parent[id];
        if (parent !== NULL) {
            const prev: number = this._storage.prevSibling[id];
            const next: number = this._storage.nextSibling[id];

            if (prev !== NULL) {
                this._storage.nextSibling[prev] = next;
            } else {
                this._storage.firstChild[parent] = next;
            }

            if (next !== NULL) {
                this._storage.prevSibling[next] = prev;
            }
        }

        for (const pool of this._pools) {
            pool._removeByNodeId(id);
        }
        this._storage.free(id)
    }

    reparent(node: FlatNodeRef, parent: FlatNodeRef): void {
        if (this._stepping) {
            throw new Error("Cannot reparent during step, use commandBuffer")
        }

        this.assertInWorld(node);
        this.assertInWorld(parent);

        if (node.id === ROOT_ID) {
            throw new Error("Cannot reparent root node");
        }

        if (node.id === parent.id) {
            throw new Error("Cannot attach a node to itself");
        }

        if (this._storage.parent[node.id] === NULL) {
            throw new Error("Node does not have a parent, use attach instead");
        }

        if (this._isAncestor(node.id, parent.id)) {
            throw new Error("Cannot create cycle");
        }

        if (this._storage.parent[node.id] === parent.id) {
            throw new Error("Cannot reparent to current parent");
        }

        //remove from old parent
        const oldParent: number = this._storage.parent[node.id];
        const prev: number = this._storage.prevSibling[node.id];
        const next: number = this._storage.nextSibling[node.id];

        if (prev !== NULL) {
            this._storage.nextSibling[prev] = next;
        } else {
            this._storage.firstChild[oldParent] = next;
        }

        if (next !== NULL) {
            this._storage.prevSibling[next] = prev;
        }

        //insert into head of the new parents children list
        this._storage.parent[node.id] = parent.id;

        const oldFirst: number = this._storage.firstChild[parent.id];
        this._storage.firstChild[parent.id] = node.id;

        this._storage.nextSibling[node.id] = oldFirst;
        this._storage.prevSibling[node.id] = NULL;

        if (oldFirst !== NULL) {
            this._storage.prevSibling[oldFirst] = node.id;
        }
    }

    private _isAncestor(possibleAncestorId: number, nodeId: number): boolean {
        let current: number = this._storage.parent[nodeId];
        while (current !== NULL) {
            if (current === possibleAncestorId) return true;
            current = this._storage.parent[current];
        }

        return false;
    }

    registerPool(pool: ComponentPool): void {
        if (!pool.belongsTo(this)) throw new Error("Pool does not belong to this world");
        if (this._pools.has(pool)) throw new Error("Pool already registered");
        this._pools.add(pool);
    }

    addSystem(system: System): void {
        this._systems.push(system);
    }

    step(dt: number): void {
        if (this._stepping) {
            throw new Error("Cannot call step() during step()");
        }
        this._stepping = true;
        try {
            for (const system of this._systems) {
                system(this, dt);
            }
        } catch (e) {
            this.commandBuffer.clear();
            throw e;
        } finally {
            this._stepping = false;
        }

        this.commandBuffer.flush();
    }

    createTransformPropagationSystem(): System {
        const s: FlatTreeStorage = this._storage;
        return (_world: FlatWorld, dt: number): void => {
            const stack: number[] = [ROOT_ID];
            while (stack.length > 0) {
                const nodeId: number = stack.pop()!;
                if (s.enabled[nodeId] === 0) {
                    continue;
                }

                const parentId: number = s.parent[nodeId];
                let pa: number = 1; // pa stands for parent [world] a, etc.
                let pb: number = 0;
                let px: number = 0;
                let py: number = 0;
                if (parentId !== NULL) {
                    // parent world transforms
                    pa = s.worldA[parentId];
                    pb = s.worldB[parentId];
                    px = s.worldTx[parentId];
                    py = s.worldTy[parentId];
                }

                let la: number = s.localA[nodeId]; // la stands for [child] local a, etc
                let lb: number = s.localB[nodeId];
                let lx: number = s.localTx[nodeId];
                let ly: number = s.localTy[nodeId];

                s.worldA[nodeId] = pa * la - pb * lb;
                s.worldB[nodeId] = pb * la + pa * lb;
                s.worldTx[nodeId] = lx * pa - ly * pb + px;
                s.worldTy[nodeId] = lx * pb + ly * pa + py;

                // add children (it's gonna do them in reverse order)
                let child: number = s.firstChild[nodeId];
                while (child !== NULL) {
                    stack.push(child);
                    child = s.nextSibling[child];
                }
            }
        }
    }

    setLocalTransform(ref: FlatNodeRef, a: number, b: number, tx: number, ty: number): void {
        this.assertInWorld(ref);

        this._storage.localA[ref.id] = a;
        this._storage.localB[ref.id] = b;
        this._storage.localTx[ref.id] = tx;
        this._storage.localTy[ref.id] = ty;
    }

    getLocalTransform(ref: FlatNodeRef): {a: number, b: number, tx: number, ty: number} {
        this.assertInWorld(ref);

        return {
            a: this._storage.localA[ref.id],
            b: this._storage.localB[ref.id],
            tx: this._storage.localTx[ref.id],
            ty: this._storage.localTy[ref.id],
        }
    }

    setLocalPosition(ref: FlatNodeRef, tx: number, ty: number): void {
        this.assertInWorld(ref);

        this._storage.localTx[ref.id] = tx;
        this._storage.localTy[ref.id] = ty;
    }

    getWorldTransform(ref: FlatNodeRef): {a: number, b: number, tx: number, ty: number} {
        this.assertInWorld(ref);

        return {
            a: this._storage.worldA[ref.id],
            b: this._storage.worldB[ref.id],
            tx: this._storage.worldTx[ref.id],
            ty: this._storage.worldTy[ref.id],
        }
    }

    /**
     * @internal
     *
     * for testing purposes
     */
    getStorage(): FlatTreeStorage {
        return this._storage;
    }
}
