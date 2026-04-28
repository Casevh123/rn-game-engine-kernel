import {World} from "../state_tree/World";
import TreeNode from "../state_tree/Node";

describe("traversal", () => {
    it('includes root', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode("node1");

        world.attach(root, node1);
        const traversal: TreeNode[] = world.traversePreOrder();

        expect(traversal).toContain(root);
    });

    it('handles root only tree', () => {
        const world: World = new World();
        const root: TreeNode = world.root;

        const traversal: TreeNode[] = world.traversePreOrder();

        expect(traversal).toContain(root);
        expect(traversal.length).toBe(1);
    })

    it('handles flat tree', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const nodeA: TreeNode = new TreeNode("A");
        const nodeB: TreeNode = new TreeNode("B");
        const nodeC: TreeNode = new TreeNode("C");

        world.attach(root, nodeA);
        world.attach(root, nodeB);
        world.attach(root, nodeC);
        const traversal: TreeNode[] = world.traversePreOrder();
        const traversalIds: string[] = traversal.map(node => node.id);

        expect(traversalIds).toEqual(['root', 'A', 'B', 'C']);
    })

    it('handles nested children', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const nodeA: TreeNode = new TreeNode("A");
        const nodeB: TreeNode = new TreeNode("B");
        const nodeC: TreeNode = new TreeNode("C");
        const nodeD: TreeNode = new TreeNode("D");
        const nodeE: TreeNode = new TreeNode("E");

        world.attach(root, nodeA);
        world.attach(root, nodeB);
        world.attach(nodeA, nodeC);
        world.attach(nodeA, nodeD);
        world.attach(nodeB, nodeE);
        const traversal: TreeNode[] = world.traversePreOrder();
        const traversalIds: string[] = traversal.map(node => node.id);

        expect(traversalIds).toEqual(['root', 'A', 'C', 'D', 'B', 'E']);
    })

    it('is deterministic accross multiple calls', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const nodeA: TreeNode = new TreeNode("A");
        const nodeB: TreeNode = new TreeNode("B");
        const nodeC: TreeNode = new TreeNode("C");
        const nodeD: TreeNode = new TreeNode("D");
        const nodeE: TreeNode = new TreeNode("E");

        world.attach(root, nodeA);
        world.attach(root, nodeB);
        world.attach(nodeA, nodeC);
        world.attach(nodeA, nodeD);
        world.attach(nodeB, nodeE);
        const traversal1: TreeNode[] = world.traversePreOrder();
        const traversal2: TreeNode[] = world.traversePreOrder();
        const traversalIds1: string[] = traversal1.map(node => node.id);
        const traversalIds2: string[] = traversal2.map(node => node.id);

        expect(traversalIds1).toEqual(traversalIds2);
    })

    it('does not mutate relationships', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const nodeA: TreeNode = new TreeNode("A");
        const nodeB: TreeNode = new TreeNode("B");
        const nodeC: TreeNode = new TreeNode("C");
        const nodeD: TreeNode = new TreeNode("D");
        const nodeE: TreeNode = new TreeNode("E");

        world.attach(root, nodeA);
        world.attach(root, nodeB);
        world.attach(nodeA, nodeC);
        world.attach(nodeA, nodeD);
        world.attach(nodeB, nodeE);
        world.traversePreOrder();

        expect(root.children).toContain(nodeA);
        expect(root.children).toContain(nodeB);
        expect(nodeA.parent).toBe(root);
        expect(nodeB.parent).toBe(root);
        expect(nodeA.children).toContain(nodeC);
        expect(nodeA.children).toContain(nodeD);
        expect(nodeC.parent).toBe(nodeA);
        expect(nodeD.parent).toBe(nodeA);
        expect(nodeB.children).toContain(nodeE);
        expect(nodeE.parent).toBe(nodeB);

    })
})
