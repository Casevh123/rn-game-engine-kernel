import TreeNode from "../state_tree/Node";

describe('node', () => {
    it('needs an id', () => {
        // Throws an error without an id
        expect(() => new TreeNode("")).toThrow();
        expect(() => new TreeNode(null as any)).toThrow();

        // Works with an id
        let node: TreeNode = new TreeNode("hi");
        expect(node.id).toBe("hi");
    })

    it('starts with no parent node', () => {
        let node: TreeNode = new TreeNode("hi");

        expect(node.parent).toBeNull();
    })

    it('starts with no children', () => {
        let node: TreeNode = new TreeNode("hi");

        expect(node.children.length).toBe(0);
    })

    it('get children return copy not internal array', () => {
        let parent: TreeNode = new TreeNode("parent");
        let child: TreeNode = new TreeNode("child");

        let children: TreeNode[] = child.children;

        children.push(child);

        expect(children.length).toBe(1);
        expect(parent.children.length).toBe(0);
    })
})
