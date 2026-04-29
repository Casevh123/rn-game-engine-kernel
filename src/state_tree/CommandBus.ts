import {WorldCommands} from "./types";
import {World} from "./World";
import TreeNode from "./Node";

export type Command = () => void;

export class CommandBus {
    private queue: Command[] = [];

    enqueue(command: Command): void {
        this.queue.push(command);
    }

    flush(): void {
        const commands = this.queue;
        this.queue = [];

        for (const command of commands) {
            command();
        }
    }

    get size(): number {
        return this.queue.length;
    }
}

export class CommandBuffer implements WorldCommands {
    constructor(
        private readonly world: World,
        private readonly commandBus: CommandBus
    ) {}

    attach(parent: TreeNode, child: TreeNode): void {
        this.commandBus.enqueue(() => {
            this.world.attach(parent, child);
        });
    }

    detach(node: TreeNode): void {
        this.commandBus.enqueue(() => {
            this.world.detach(node);
        });
    }

    destroy(node: TreeNode): void {
        this.commandBus.enqueue(() => {
            this.world.destroy(node);
        });
    }

    reparent(node: TreeNode, newParent: TreeNode): void {
        this.commandBus.enqueue(() => {
            this.world.reparent(node, newParent);
        });
    }
}
