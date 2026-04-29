import {Command, CommandBus} from "../state_tree/CommandBus";

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
