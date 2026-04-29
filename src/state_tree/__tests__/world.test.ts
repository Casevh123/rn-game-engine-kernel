import {World} from "../World";
import TreeNode from "../Node";

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
    describe('attach', () => {
        it('sets parent and adds to children', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const child: TreeNode = new TreeNode("child");

            world.attach(root, child);
            expect(root.children).toContainEqual(child);
            expect(child.parent).toBe(root);
        })

        it("cannot attach root as child", () => {
            const world: World = new World();
            const root = world.root;
            const node: TreeNode = new TreeNode("node");
            world.attach(root, node);

            expect(() => world.attach(node, root)).toThrow("Cannot attach root as child");
        })

        it("cannot attach a node that already has a parent", () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node1: TreeNode = new TreeNode("node1");
            const node2: TreeNode = new TreeNode("node2");

            world.attach(root, node1);
            world.attach(root, node2);
            expect(() => world.attach(node2, node1)).toThrow("Cannot attach node that already has a a parent, use reparent instead");
        })

        it("cannot attach node to parent that doesn't belong to world", () => {
            const world: World = new World();
            const parent: TreeNode = new TreeNode("node1");
            const child: TreeNode = new TreeNode("node2");

            expect(() => world.attach(parent, child)).toThrow("Parent must already exist in this world");
        })

        it('cannot reparent a node to itself', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node1: TreeNode = new TreeNode("node1");

            world.attach(root, node1);
            expect(() => world.reparent(node1, node1)).toThrow("Cannot attach a node to itself");
        })
    })

    describe('detach', () => {
        it("Clears parent and removes from children", () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const child: TreeNode = new TreeNode("parent");

            world.attach(root, child);
            world.detach(child);
            expect(root.children).not.toContainEqual(child);
            expect(child.parent).toBeNull();
        })

        it('cannot detach node that doesnt belong to this world', () => {
            const world1: World = new World();
            const world2: World = new World();
            const node1: TreeNode = new TreeNode("node1");

            world2.attach(world2.root, node1);
            expect(() => world1.detach(node1)).toThrow("Node must belong to this world");
        })

        it('cannot detach root', () => {
            const world: World = new World();

            expect(() => world.detach(world.root)).toThrow("Cannot detach root");
        })

        it('cannot detach a node that has no parent', () => {
            const world: World = new World();
            const child: TreeNode = new TreeNode("child");

            world.attach(world.root, child);
            child.setParent(null);

            expect(() => world.detach(child)).toThrow("Cannot detach node if it has no parent");
        })
    })

    describe('destroy', () => {
        it('removes node from parents children', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node: TreeNode = new TreeNode("node1");

            world.attach(root, node);
            world.destroy(node);

            expect(root.children).not.toContain(node);
        })

        it('clears destroyed ndoe parent', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node: TreeNode = new TreeNode("node1");

            world.attach(root, node);
            world.destroy(node);

            expect(node.parent).toBeNull();
        })

        it('cannot destroy node that doesnt belong to this world', () => {
            const world1: World = new World();
            const world2: World = new World();
            const node1: TreeNode = new TreeNode("node1");

            world2.attach(world2.root, node1);
            expect(() => world1.destroy(node1)).toThrow("Node must belong to this world");
        })

        it('cannot destroy root', () => {
            const world: World = new World();
            const root: TreeNode = world.root;

            expect(() => world.destroy(root)).toThrow("Cannot destroy root");
        })
    })

    describe('reparent', () => {
        it('changes parent and adds to children of new parent and removes from children of old parent', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node1: TreeNode = new TreeNode("node1");
            const node2: TreeNode = new TreeNode("node2");

            world.attach(root, node1);
            world.attach(root, node2);
            world.reparent(node2, node1);

            expect(node2.parent).toBe(node1);
            expect(node1.children).toContain(node2);
            expect(root.children).not.toContain(node2);
        })

        it('cannot reparent if node doesnt belong to this world', () => {
            const world1: World = new World();
            const world2: World = new World();

            const node1: TreeNode = new TreeNode("node1");
            world1.attach(world1.root, node1)

            expect(() => world2.reparent(node1, world2.root)).toThrow("Node must belong to this world");
        })

        it('cannot reparent if new parent doesnt belong to this world', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node1: TreeNode = new TreeNode("node1");
            const node2: TreeNode = new TreeNode("node2");

            world.attach(root, node1);
            expect(() => world.reparent(node1, node2)).toThrow("Parent must belong to this world");
        })

        it('cannot reparent root', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node1: TreeNode = new TreeNode("node1");

            world.attach(root, node1);
            expect(() => world.reparent(root, node1)).toThrow("Cannot reparent root as child");
        })

        it('cannot create cycles', () => {
            const world: World = new World();
            const root: TreeNode = world.root;
            const node1: TreeNode = new TreeNode("node1");
            const node2: TreeNode = new TreeNode("node2");
            const node3: TreeNode = new TreeNode("node3");

            world.attach(root, node1);
            world.attach(node1, node2);
            world.attach(node2, node3);
            expect(() => world.reparent(node1, node3)).toThrow("Cannot create cycle")
        })
    })
})

describe('node lookup', () => {
    it('puts root in lookup', () => {
        const world: World = new World();
        expect(world.hasNode("root")).toBe(true);
    })

    it('getNode returns null if there is no node', () => {
        const world: World = new World();

        expect(world.getNode("1")).toBeNull();
    })

    it('puts attached child in lookup', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode("node1");

        world.attach(root, node1);
        expect(world.hasNode("node1")).toBe(true);
        expect(world.getNode("node1")).toBe(node1);
    })

    it('destroy removes descendents from lookup', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode("node1");
        const node2: TreeNode = new TreeNode("node2");

        world.attach(root, node1);
        world.attach(node1, node2);

        world.destroy(node1);
        expect(world.hasNode("node1")).toBe(false);
        expect(world.hasNode("node2")).toBe(false);
    })

    it("detach removes descendants from lookup and attach restores them", () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode("node1");
        const node2: TreeNode = new TreeNode("node2");

        world.attach(root, node1);
        world.attach(node1, node2);

        world.detach(node1);
        expect(world.hasNode("node1")).toBe(false);
        expect(world.hasNode("node2")).toBe(false);

        world.attach(root, node1);
        expect(world.hasNode("node2")).toBe(true);
    })

    it("removes destroyed children", () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode("node1");
        const node2: TreeNode = new TreeNode("node2");

        world.attach(root, node1);
        world.attach(node1, node2);

        world.destroy(node1);
        expect(world.hasNode("node1")).toBe(false);
        expect(world.hasNode("node2")).toBe(false);
    })

    it('rejects duplicate ids', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode("node1");
        const node2: TreeNode = new TreeNode("node1");

        world.attach(root, node1);
        expect(() => world.attach(node1, node2)).toThrow("Cannot attach node because id already exists in this tree");
    })
})
