import TreeNode from "./Node";
import {UpdateContext} from "./types";
import {CommandBuffer, CommandBus} from "./CommandBus";

export class World {
    readonly root: TreeNode;
    private _nodesById: Map<string, TreeNode> = new Map();
    private _commandBus: CommandBus = new CommandBus();
    private _commandBuffer: CommandBuffer = new CommandBuffer(this, this._commandBus);

    constructor() {
        this.root = new TreeNode("root");
        this._nodesById.set("root", this.root);
    }

    traversePreOrder(): TreeNode[] {
        const result: TreeNode[] = [];

        const visit = (node: TreeNode) => {
            if (node.enabled) {
                result.push(node);

                for (const child of node.children) {
                    visit(child);
                }
            }
        };

        visit(this.root);
        return result;
    }

    update(dt: number): void {
        const ctx: UpdateContext = {
            world: this,
            commands: this._commandBuffer,
            dt,
        };

        for (const node of this.traversePreOrder()) {
            for (const component of node.components) {
                component.update?.(ctx)
            }
        }

        this._commandBus.flush()
    }

    private isAncestor(possibleAncestor: TreeNode, node: TreeNode): boolean {
        let current: TreeNode | null = node.parent;

        while (current !== null) {
            if (current === possibleAncestor) return true;
            current = current.parent;
        }

        return false;
    }

    private owns(node: TreeNode): boolean {
        return this._nodesById.get(node.id) === node;
    }

    private removeSubtree(node: TreeNode): void {
        for (const child of node.children) {
            this.removeSubtree(child);
        }

        this._nodesById.delete(node.id);
    }

    private addSubtree(node: TreeNode): void {
        if (this._nodesById.has(node.id)) {
            throw new Error("Duplicate id in subtree")
        }

        this._nodesById.set(node.id, node)

        for (const child of node.children) {
            this.addSubtree(child)
        }
    }

    getNode(id: string) {
        return this._nodesById.get(id) ?? null;
    }

    hasNode(id: string) {
        return this._nodesById.has(id);
    }

    attach(parent: TreeNode, child: TreeNode) {
        if (!this.owns(parent)) {
            throw new Error("Parent must already exist in this world")
        }

        if (child.id === "root") {
            throw new Error("Cannot attach root as child");
        }

        if (child.parent !== null) {
            throw new Error("Cannot attach node that already has a a parent, use reparent instead");
        }

        if (this._nodesById.has(child.id)) {
            throw new Error("Cannot attach node because id already exists in this tree")
        }

        this.addSubtree(child);
        child.setParent(parent);
        parent.addChild(child);
    }


    detach(node: TreeNode) {
        if (!this.owns(node)) {
            throw new Error("Node must belong to this world");
        }

        if (node.id === "root") {
            throw new Error("Cannot detach root");
        }

        if (node.parent === null) {
            throw new Error("Cannot detach node if it has no parent");
        }

        node.parent.removeChild(node);
        node.setParent(null);
        this.removeSubtree(node);
    }

    destroy(node: TreeNode) {
        if (!this.owns(node)) {
            throw new Error("Node must belong to this world");
        }

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
        this._nodesById.delete(node.id);
    }

    reparent(node: TreeNode, parent: TreeNode) {
        if (!this.owns(node)) {
            throw new Error("Node must belong to this world");
        }

        if (!this.owns(parent)) {
            throw new Error("Parent must belong to this world");
        }

        if (node.id === "root") {
            throw new Error("Cannot reparent root as child");
        }

        if (node.parent === null) {
            throw new Error("Cannot reparent a node that doesn't have a parent already, use attach instead")
        }

        if (this.isAncestor(node, parent)) {
            throw new Error("Cannot create cycle");
        }

        if (node === parent) {
            throw new Error("Cannot attach a node to itself")
        }

        node.parent.removeChild(node);
        node.setParent(parent);
        parent.addChild(node);
    }

    /**
     * @internal
     *
     * This method is here for testing purposes
     */
    get commandBuffer(): CommandBuffer {
        return this._commandBuffer;
    }

    /**
     * @internal
     *
     * This method is here for testing purposes
     */
    get commandBus(): CommandBus {
        return this._commandBus;
    }
}


