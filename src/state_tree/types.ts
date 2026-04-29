import {World} from "./World";
import TreeNode from "./Node";

export interface WorldCommands {
    attach(parent: TreeNode, child: TreeNode): void;
    detach(node: TreeNode): void;
    destroy(node: TreeNode): void;
    reparent(node: TreeNode, newParent: TreeNode): void;
}

export type UpdateContext = {
    world: World;
    commands: WorldCommands;
    dt: number;
}
