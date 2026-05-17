import {NodeHandle, CommandBuffer, FlatWorld} from "./types";

export function createCommandBuffer(world: FlatWorld): CommandBuffer {
    'worklet';
    let queue: Array<() => void> = [];

    return {
        destroy(ref: NodeHandle): void {
            queue.push((): void => world.destroy(ref));
        },

        attach(child: NodeHandle, parent: NodeHandle): void {
            queue.push((): void => world.attach(child, parent));
        },

        detach(child: NodeHandle): void {
            queue.push((): void => world.detach(child));
        },

        reparent(node: NodeHandle, newParent: NodeHandle): void {
            queue.push((): void => world.reparent(node, newParent));
        },

        flush(): void {
            const commands: Array<() => void> = queue;
            queue = [];
            for (const cmd of commands) {
                cmd();
            }
        },

        clear(): void {
            queue = [];
        },

        get size(): number {
            return queue.length;
        },
    };
}
