import {FlatWorld} from "./FlatWorld";
import {FlatNodeRef} from "./FlatNodeRef";

export class CommandBuffer {
    private _world: FlatWorld;
    private _queue: Array<() => void> = [];

    constructor(world: FlatWorld) {
        this._world = world;
    }

    destroy(ref: FlatNodeRef): void {
        this._queue.push((): void => this._world.destroy(ref));
    }

    attach(child: FlatNodeRef, parent: FlatNodeRef): void {
        this._queue.push((): void => this._world.attach(child, parent));
    }

    detach(child: FlatNodeRef): void {
        this._queue.push((): void => this._world.detach(child));
    }

    reparent(node: FlatNodeRef, newParent: FlatNodeRef): void {
        this._queue.push((): void => this._world.reparent(node, newParent));
    }

    flush(): void {
        const commands: Array<() => void> = this._queue;
        this._queue = [];
        for (const cmd of commands) {
            cmd();
        }
    }

    clear(): void {
        this._queue = [];
    }

    get size(): number {
        return this._queue.length;
    }
}
