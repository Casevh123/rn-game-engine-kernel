import {FlatWorld} from "./FlatWorld";
import {NodeHandle} from "./types";

export class CommandBuffer {
    private _world: FlatWorld;
    private _queue: Array<() => void> = [];

    constructor(world: FlatWorld) {
        this._world = world;
    }

    destroy(ref: NodeHandle): void {
        this._queue.push((): void => this._world.destroy(ref));
    }

    attach(child: NodeHandle, parent: NodeHandle): void {
        this._queue.push((): void => this._world.attach(child, parent));
    }

    detach(child: NodeHandle): void {
        this._queue.push((): void => this._world.detach(child));
    }

    reparent(node: NodeHandle, newParent: NodeHandle): void {
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
