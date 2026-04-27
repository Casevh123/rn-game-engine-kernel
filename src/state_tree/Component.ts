import TreeNode from "./Node";

export abstract class Component {
    node!: TreeNode;

    onAttach?(): void;
    update?(): void;
}
