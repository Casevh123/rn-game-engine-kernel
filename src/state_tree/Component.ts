import TreeNode from "./Node";
import {UpdateContext} from "./types";

export abstract class Component {
    node!: TreeNode;

    onAttach?(): void;
    update?(ctx: UpdateContext): void;
}
