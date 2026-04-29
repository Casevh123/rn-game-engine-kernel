import {FlatNodeRef} from "./FlatNodeRef";
import {FlatTreeStorage} from "./FlatTreeStorage";
import {NULL, ROOT_ID} from "./constants";

export class FlatWorld {
    readonly storage: FlatTreeStorage;
    readonly root: FlatNodeRef;

    constructor(capacity: number) {
        this.storage = new FlatTreeStorage(capacity);
        this.root = new FlatNodeRef(this, ROOT_ID, this.storage.version[ROOT_ID]);
    }

    createNode(): FlatNodeRef {
        const { id, version } = this.storage.allocate();
        return new FlatNodeRef(this, id, version);
    }

    assertValidRef(ref: FlatNodeRef): void {
        this.storage.assertValidRef(ref.id, ref.version);
    }

    isEnabled(ref: FlatNodeRef): boolean {
        this.assertValidRef(ref);
        return this.storage.enabled[ref.id] === 1;
    }

    setEnabled(ref: FlatNodeRef, enabled: boolean) {
        this.assertValidRef(ref);
        this.storage.enabled[ref.id] = enabled ? 1 : 0;
    }

    attach(child: FlatNodeRef, parent: FlatNodeRef) {
        this.assertValidRef(child);
        this.assertValidRef(parent);

        if (child.id === ROOT_ID) throw new Error("Cannot attach root");
        if (child.id === parent.id) throw new Error("Cannot attach a node to itself");
        if (this.storage.parent[child.id] !== NULL) {
            throw new Error("Child already has parent");
        }

        this.storage.parent[child.id] = parent.id;

        const oldFirst: number = this.storage.firstChild[parent.id];
        this.storage.firstChild[parent.id] = child.id;

        this.storage.prevSibling[child.id] = NULL;
        this.storage.nextSibling[child.id] = oldFirst;

        if (oldFirst !== NULL) {
            this.storage.prevSibling[oldFirst] = child.id;
        }
    }

    detach(child: FlatNodeRef): void {
        this.assertValidRef(child);

        if (child.id === ROOT_ID) throw new Error("Cannot detach root");

        const parent = this.storage.parent[child.id];
        if (parent === NULL) throw new Error("Node has no parent");

        const prev = this.storage.prevSibling[child.id];
        const next = this.storage.nextSibling[child.id];

        if (prev !== NULL) {
            this.storage.nextSibling[prev] = next;
        } else {
            this.storage.firstChild[parent] = next;
        }

        if (next !== NULL) {
            this.storage.prevSibling[next] = prev;
        }

        this.storage.parent[child.id] = NULL;
        this.storage.prevSibling[child.id] = NULL;
        this.storage.nextSibling[child.id] = NULL;
    }
}
