import {FlatNodeRef} from "./FlatNodeRef";
import {FlatTreeStorage} from "./FlatTreeStorage";
import {ROOT_ID} from "./constants";

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
}
