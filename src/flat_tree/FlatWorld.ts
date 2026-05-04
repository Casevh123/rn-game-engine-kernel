import {FlatNodeRef} from "./FlatNodeRef";
import {FlatTreeStorage} from "./FlatTreeStorage";
import {NULL, ROOT_ID} from "./constants";

export class FlatWorld {
    private _storage: FlatTreeStorage;
    readonly root: FlatNodeRef;

    constructor(capacity: number) {
        this._storage = new FlatTreeStorage(capacity);
        this.root = new FlatNodeRef(this, ROOT_ID, this._storage.version[ROOT_ID]);
    }

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
        this.assertInWorld(node);
        if (node.id === ROOT_ID) {
            throw new Error("Cannot destroy root node");
        }

        this._destroySubtree(node.id)
    }

    private _destroySubtree(id: number): void {
        let childID: number = this._storage.firstChild[id];
        while (childID !== NULL) {
            const nextChildID: number = this._storage.nextSibling[childID];
            this._destroySubtree(childID);
            childID = nextChildID;
        }

        const parent = this._storage.parent[id];
        if (parent !== NULL) {
            const prev = this._storage.prevSibling[id];
            const next = this._storage.nextSibling[id];

            if (prev !== NULL) {
                this._storage.nextSibling[prev] = next;
            } else {
                this._storage.firstChild[parent] = next;
            }

            if (next !== NULL) {
                this._storage.prevSibling[next] = prev;
            }
        }

        this._storage.free(id)
    }
}
