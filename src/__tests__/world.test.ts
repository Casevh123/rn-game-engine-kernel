import {World} from "../state_tree/World";
import TreeNode from "../state_tree/Node";

describe('world', () => {
    it('creates root', () => {
        let world: World = new World();

        expect(world.root).not.toBeNull();
        expect(world.root.id).toBe("root");
    })

    it('creates root with null parent', () => {
        let world: World = new World();

        expect(world.root.parent).toBeNull();
    })
})

describe('mutation', () => {
    it('attach sets parent and adds to children', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const child: TreeNode = new TreeNode("child");

        world.attach(root, child);
        expect(root.children).toContainEqual(child);
        expect(child.parent).toBe(root);
    })

    it("detach clears parent", () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const child: TreeNode = new TreeNode("parent");

        world.attach(root, child);
        world.detach(child);
        expect(root.children).not.toContainEqual(child);
        expect(child.parent).toBeNull();
    })

    it("cannot attach root as child", () => {
        const world: World = new World();
        const root = world.root;
        const parent: TreeNode = new TreeNode("parent");

        expect(() => world.attach(parent, root)).toThrow();
    })

    it("cannot attach a node that already has a parent", () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode("node1");
        const node2: TreeNode = new TreeNode("node2");

        world.attach(root, node1);
        expect(() => world.attach(node2, node1)).toThrow();
    })

    it("cannot create a cycle", () => {
        const world: World = new World();
        const node1: TreeNode = new TreeNode("node1");
        const node2: TreeNode = new TreeNode("node2");
        const node3: TreeNode = new TreeNode("node2");

        world.attach(node1, node2);
        world.attach(node2, node3);
        expect(() => world.attach(node3, node1)).toThrow();
    })

    it('cannot destroy root', () => {
        const world: World = new World();
        const root: TreeNode = world.root;

        expect(() => world.destroy(root)).toThrow();
    })
})
