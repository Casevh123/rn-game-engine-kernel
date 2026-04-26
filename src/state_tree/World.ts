import TreeNode from "./Node";

export class World {
    readonly root: TreeNode;

    constructor() {
        this.root = new TreeNode("root");
    }
}

type UpdateContext = {}
