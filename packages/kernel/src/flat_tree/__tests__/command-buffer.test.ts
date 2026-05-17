import {createFlatWorld} from "../FlatWorld";
import {createCommandBuffer} from "../CommandBuffer";
import {createComponentPool} from "../ComponentPool";
import {NodeHandle, refEquals, FlatWorld, CommandBuffer, ComponentPool} from "../types";

describe('command-buffer test', () => {
    describe('happy paths', () => {
        it('enqueue destroy, node alive after enqueue, dead after flush', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.destroy(node);
            expect(world.isAlive(node)).toBe(true);
            buffer.flush();

            expect(world.isAlive(node)).toBe(false);
        })

        it('enqueue attach, child unattached after enqueue, attached after flush', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.attach(node, world.root);
            expect(world.getParent(node)).toBe(null);
            buffer.flush();

            expect(refEquals(world.getParent(node)!, world.root)).toBe(true);
        })

        it('enqueue detach, child attached after enqueue, unattached after flush', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            world.attach(node, world.root);
            buffer.detach(node);
            expect(refEquals(world.getParent(node)!, world.root)).toBe(true);
            buffer.flush();

            expect(world.getParent(node)).toBe(null);
        })

        it('enqueue reparent, node under old parent after enqueue, under new after flush', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const oldParent: NodeHandle = world.createNode();
            const newParent: NodeHandle = world.createNode();
            const child: NodeHandle = world.createNode();


            world.attach(oldParent, world.root);
            world.attach(newParent, world.root);
            world.attach(child, oldParent);
            buffer.reparent(child, newParent);
            expect(refEquals(world.getParent(child)!, oldParent)).toBe(true);
            expect(refEquals(world.getParent(child)!, newParent)).toBe(false);
            buffer.flush();

            expect(refEquals(world.getParent(child)!, oldParent)).toBe(false);
            expect(refEquals(world.getParent(child)!, newParent)).toBe(true);
        })

        it('increments size after enqueue', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            expect(buffer.size).toBe(0);
            buffer.destroy(node);

            expect(buffer.size).toBe(1);
        })

        it('size is 0 after flush', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.destroy(node);
            expect(buffer.size).toBe(1);
            buffer.flush();

            expect(buffer.size).toBe(0);
        })

        it('clear() clears the queue but doesn\'t run commands', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.destroy(node);
            expect(buffer.size).toBe(1);
            buffer.clear();

            expect(buffer.size).toBe(0);
            expect(world.isAlive(node)).toBe(true);
        })

        it('second flush after first flush is no-op, size stays 0 (doesn\'t throw)', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.destroy(node);
            buffer.flush();
            expect(buffer.size).toBe(0);

            expect(() => buffer.flush()).not.toThrow();
            expect(buffer.size).toBe(0);
        })

        it('buffer is reusable — enqueue after flush works, second flush executes new commands', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.attach(node, world.root);
            expect(world.getParent(node)).toBe(null);
            buffer.flush();
            buffer.destroy(node);
            expect(refEquals(world.getParent(node)!, world.root)).toBe(true);
            expect(world.isAlive(node)).toBe(true);
            buffer.flush();

            expect(world.isAlive(node)).toBe(false);
        })
    })

    describe('Ordering', () => {
        it('FIFO — enqueue destroy(A) then destroy(B), A destroyed before B', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const nodeA: NodeHandle = world.createNode();
            const nodeB: NodeHandle = world.createNode();

            world.attach(nodeA, world.root);
            world.attach(nodeB, nodeA);
            buffer.destroy(nodeA);
            buffer.destroy(nodeB);

            expect(() => buffer.flush()).toThrow(`Node id ${nodeB.id} is not alive`);
        })

        it('FIFO — enqueue attach then reparent on same node, both succeed in order', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const nodeA: NodeHandle = world.createNode();
            const nodeB: NodeHandle = world.createNode();

            world.attach(nodeA, world.root);
            buffer.attach(nodeB, world.root);
            buffer.reparent(nodeB, nodeA);

            expect(() => buffer.flush()).not.toThrow();
            expect(refEquals(world.getParent(nodeB)!, nodeA)).toBe(true);
        })
    })

    describe('Error Cases', () => {
        it('flush throws when destroying an already dead node (double destroy)', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.destroy(node);
            buffer.destroy(node);

            expect(() => buffer.flush()).toThrow(`Node id ${node.id} is not alive`);
        })

        it('flush throws when attaching node that already has parent', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const nodeA: NodeHandle = world.createNode();
            const nodeB: NodeHandle = world.createNode();

            world.attach(nodeA, world.root);
            buffer.attach(nodeB, world.root);
            buffer.attach(nodeB, nodeA);

            expect(() => buffer.flush()).toThrow("Child already has parent");
        })

        it('flush throws on detach of parentless node', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const node: NodeHandle = world.createNode();

            buffer.detach(node);

            expect(() => buffer.flush()).toThrow("Node has no parent");
        })

        it('flush throws on reparent creating cycle', () => {
            const world: FlatWorld = createFlatWorld(10);
            const buffer: CommandBuffer = createCommandBuffer(world);
            const nodeA: NodeHandle = world.createNode();
            const nodeB: NodeHandle = world.createNode();
            const nodeC: NodeHandle = world.createNode();

            world.attach(nodeA, world.root);
            buffer.attach(nodeB, nodeA);
            buffer.attach(nodeC, nodeB);
            buffer.reparent(nodeA, nodeC);

            expect(() => buffer.flush()).toThrow("Cannot create cycle");
        })
    })

    describe('World integration', () => {
        it('destroy via command buffer triggers registered pool cleanup', () => {
            const world: FlatWorld = createFlatWorld(10);
            const node: NodeHandle = world.createNode();
            const buffer: CommandBuffer = createCommandBuffer(world);
            const values = new Int32Array(5).fill(0);
            const pool: ComponentPool = createComponentPool(world, 5, (a, b) => {
                const tmp = values[a]; values[a] = values[b]; values[b] = tmp;
            });
            world.registerPool(pool);

            pool.add(node);
            buffer.destroy(node);
            expect(pool.count).toBe(1);
            buffer.flush();

            expect(pool.count).toBe(0);
        })

        it('destroy subtree via command buffer removes all descendent components', () => {
            const world: FlatWorld = createFlatWorld(10);
            const root: NodeHandle = world.root;
            const node1: NodeHandle = world.createNode();
            const node2: NodeHandle = world.createNode();
            const node3: NodeHandle = world.createNode();
            const values = new Int32Array(5).fill(0);
            const pool: ComponentPool = createComponentPool(world, 5, (a, b) => {
                const tmp = values[a]; values[a] = values[b]; values[b] = tmp;
            });
            const buffer: CommandBuffer = createCommandBuffer(world);
            world.registerPool(pool);

            world.attach(node1, root);
            world.attach(node2, node1);
            world.attach(node3, node2);
            pool.add(node1);
            pool.add(node2);
            pool.add(node3);
            buffer.destroy(node1);
            expect(pool.count).toBe(3);
            buffer.flush();

            expect(pool.count).toBe(0);
        })
    })
})
