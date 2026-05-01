import {FlatWorld} from "./FlatWorld";

export class FlatNodeRef {
    constructor(
        private readonly world: FlatWorld,
        readonly id: number,
        readonly version: number,
    ) {}

    assertValid(): void {
        this.world.assertValidRef(this);
    }

    get enabled(): boolean {
        this.assertValid();
        return this.world.isEnabled(this);
    }

    set enabled(value: boolean) {
        this.assertValid();
        this.world.setEnabled(this, value);
    }

    equals(otherNode: FlatNodeRef): boolean {
        return (this.id === otherNode.id && this.version === otherNode.version);
    }

    belongsTo(world: FlatWorld): boolean {
        return this.world === world;
    }
}
