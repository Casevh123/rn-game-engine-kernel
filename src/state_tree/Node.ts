import {UpdateContext} from "./World";

export default class TreeNode {
    readonly id: string;
    private _parent: TreeNode | null = null;
    private _children: TreeNode[] = [];
    enabled = true;

    get parent() { return this._parent; }
    get children() { return [...this._children]; }

    update(ctx: UpdateContext): void {}

    constructor(id: string) {
        if (typeof id !== "string" || id.length === 0) {
            throw new Error('id must be a non-empty string');
        }

        this.id = id;
    }

    /**
    * @internal
    *
    * This method is a structural mutation and should not be called on the node directly, structural mutations should be done through the world
    */
    setParent(parent: TreeNode | null): void {
        this._parent = parent;
    }

    /**
     * @internal
     *
     * This method is a structural mutation and should not be called on the node directly, structural mutations should be done through the world
     */
    addChild(child: TreeNode): void {
        this._children.push(child);
    }

    /**
     * @internal
     *
     * This method is a structural mutation and should not be called on the node directly, structural mutations should be done through the world
     */
    removeChild(child: TreeNode): void {
        this._children = this._children.filter(c => c !== child)
    }

}
