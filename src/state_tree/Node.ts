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
}
