import TreeNode from "./Node";

export class World {
    readonly root: TreeNode;

    constructor() {
        this.root = new TreeNode("root");
    }

    isAncestor(possibleAncestor: TreeNode, node: TreeNode): boolean {
        let current: TreeNode | null = node.parent;

        while (current !== null) {
            if (current === possibleAncestor) return true;
            current = current.parent;
        }

        return false;
    }

    attach(parent: TreeNode, child: TreeNode) {
        if (child.id === "root") {
            throw new Error("Cannot attach root as child");
        }

        if (child.parent !== null) {
            throw new Error("Cannot attach node that already has a a parent, use reparent instead");
        }

        if (this.isAncestor(child, parent)) {
            throw new Error("Cannot create cycle");
        }

        child.setParent(parent);
        parent.addChild(child);
    }


    detach(child: TreeNode) {
        if (child.parent === null) {
            throw new Error("Cannot detach child because it has no parent");
        }
        child.parent.removeChild(child);
        child.setParent(null);
    }

    destroy(node: TreeNode) {
        if (node.id === "root") {
            throw new Error("Cannot destroy root");
        }

        for (const child of node.children) {
            this.destroy(child);
        }

        if (node.parent !== null) {
            node.parent.removeChild(node);
        }

        node.setParent(null);
    }

    reparent(node: TreeNode, parent: TreeNode) {
        if (node.id === "root") {
            throw new Error("Cannot reparent root as child");
        }

        if (node.parent === null) {
            throw new Error("Cannot reparent a node that doesn't have a parent already, use attach instead")
        }

        if (this.isAncestor(node, parent)) {
            throw new Error("Cannot create cycle");
        }

        node.parent.removeChild(node);
        node.setParent(parent);
        parent.addChild(node);
    }
}

export type UpdateContext = {}
