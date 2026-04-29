import {Command, CommandBuffer, CommandBus} from "../CommandBus";
import {World} from "../World";
import TreeNode from "../Node";

describe('command test', () => {
    it('can enqueue commands', () => {
        const bus: CommandBus = new CommandBus();
        const command: Command = () => undefined

        bus.enqueue(command);
        expect(bus.size).toBe(1);
    })

    it('does not run queued commands immediately', () => {
        const bus: CommandBus = new CommandBus();
        let commandRun: boolean = false;
        const command: Command = () => {commandRun = true};

        bus.enqueue(command);
        expect(commandRun).toBe(false);
    })

    it('applies queued commands when flushed', () => {
        const bus: CommandBus = new CommandBus();
        let commandRun: boolean = false;
        const command: Command = () => {commandRun = true};

        bus.enqueue(command);
        bus.flush();
        expect(commandRun).toBe(true);
    })

    it('applies commands in enque order', () => {
        const bus: CommandBus = new CommandBus();
        let lastCommandRun: string | null = null;
        const command1: Command = () => {lastCommandRun = "command1"};
        const command2: Command = () => {lastCommandRun = "command2"};

        bus.enqueue(command1);
        bus.enqueue(command2);
        bus.flush();
        expect(lastCommandRun).toBe("command2");
    })

    it('clears the queue when flushed', () => {
        const bus: CommandBus = new CommandBus();

        bus.enqueue(() => null);
        bus.enqueue(() => null);
        expect(bus.size).toBe(2);
        bus.flush();
        expect(bus.size).toBe(0);
    })

    it('is safe to flush an empty queue', () => {
        const bus: CommandBus = new CommandBus();

        expect(() => bus.flush()).not.toThrow();
    })
})

describe('command buffer', () => {
    it('doesnt execute attach immediately', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node: TreeNode = new TreeNode('1');
        const buffer: CommandBuffer = world.commandBuffer;

        buffer.attach(root, node);
        expect(node.parent).toBeNull();
        expect(root.children).not.toContain(node)

    })

    it('executes attach after flush', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node: TreeNode = new TreeNode('1');
        const buffer: CommandBuffer = world.commandBuffer;
        const bus: CommandBus = world.commandBus;

        buffer.attach(root, node);
        bus.flush();
        expect(node.parent).toBe(root);
        expect(root.children).toContain(node);
    })

    it('doesnt execute detach immediately', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node: TreeNode = new TreeNode('1');
        const buffer: CommandBuffer = world.commandBuffer;

        world.attach(root, node);
        buffer.detach(node);
        expect(node.parent).toBe(root);
        expect(root.children).toContain(node);
    })

    it('executes detach after flush', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node: TreeNode = new TreeNode('1');
        const buffer: CommandBuffer = world.commandBuffer;
        const bus: CommandBus = world.commandBus;

        world.attach(root, node);
        buffer.detach(node);
        bus.flush();
        expect(node.parent).toBeNull();
        expect(root.children).not.toContain(node);
    })

    it('doesnt execute destroy immediately', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node: TreeNode = new TreeNode('1');
        const buffer: CommandBuffer = world.commandBuffer;

        world.attach(root, node);
        buffer.destroy(node);
        expect(node.parent).toBe(root);
        expect(root.children).toContain(node);
    })

    it('executes destroy after flush', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node: TreeNode = new TreeNode('1');
        const buffer: CommandBuffer = world.commandBuffer;
        const bus: CommandBus = world.commandBus;

        world.attach(root, node);
        buffer.destroy(node);
        bus.flush();
        expect(node.parent).toBeNull();
        expect(root.children).not.toContain(node);
    })

    it('doesnt execute reparent immediately', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode('1');
        const node2: TreeNode = new TreeNode('2');
        const buffer: CommandBuffer = world.commandBuffer;

        world.attach(root, node1);
        world.attach(node1, node2);
        buffer.reparent(node2, root);

        expect(node2.parent).toBe(node1);
        expect(node1.children).toContain(node2);
        expect(root.children).not.toContain(node2);

    })

    it('executes reparent after flush', () => {
        const world: World = new World();
        const root: TreeNode = world.root;
        const node1: TreeNode = new TreeNode('1');
        const node2: TreeNode = new TreeNode('2');
        const buffer: CommandBuffer = world.commandBuffer;
        const bus: CommandBus = world.commandBus;

        world.attach(root, node1);
        world.attach(node1, node2);
        buffer.reparent(node2, root);
        bus.flush();

        expect(node2.parent).toBe(root);
        expect(node1.children).not.toContain(node2);
        expect(root.children).toContain(node2);
    })
})
