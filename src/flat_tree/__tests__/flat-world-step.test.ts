import {createFlatWorld} from "../FlatWorld";
import {createComponentPool} from "../ComponentPool";
import {NodeHandle, System, FlatWorld, ComponentPool} from "../types";

describe('happy paths', () => {
    it('step with no systems and no commands, no-op doesnt throw', () => {
        const world: FlatWorld = createFlatWorld(10);

        expect(() => world.step(1)).not.toThrow();
    })

    it('step runs a single registered system', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        const values = new Int32Array(5).fill(0);
        const pool: ComponentPool = createComponentPool(world, 5, (a, b) => {
            const tmp = values[a]; values[a] = values[b]; values[b] = tmp;
        });
        world.registerPool(pool);
        const testSystem: System = (world: FlatWorld, dt: number): void => {
            for (let i = 0; i < pool.count; i++) {
                values[i] = 100;
            }
        };
        world.addSystem(testSystem);

        pool.add(node);
        expect(values[pool.get(node)]).toBe(0);
        world.step(5);

        expect(values[pool.get(node)]).toBe(100);
    })

    it('step passes the correct dt to a system', () => {
        const world: FlatWorld = createFlatWorld(10);
        let x: number = 0;
        const testSystem: System = (world: FlatWorld, dt: number): void => {
            x = dt;
        }
        world.addSystem(testSystem);

        expect(x).toBe(0);
        world.step(5);

        expect(x).toBe(5);
    })

    it('step runs in register system oder', () => {
        const world: FlatWorld = createFlatWorld(10);
        let lastRun: string = "";
        const systemA: System = (world: FlatWorld, dt: number): void => {
            lastRun = "systemA"
        }
        const systemB: System = (world: FlatWorld, dt: number): void => {
            lastRun = "systemB"
        }
        world.addSystem(systemA);
        world.addSystem(systemB);

        world.step(5);

        expect(lastRun).toBe("systemB");
    })

    it('step runs flush after all systems run', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        let failed: boolean = false;
        const system: System = (world: FlatWorld, dt: number): void => {
            world.commandBuffer.destroy(node);
            if (world.isAlive(node) !== true) {
                failed = true;
            }
        }
        world.addSystem(system);

        expect(world.isAlive(node)).toBe(true);
        world.step(1);

        expect(failed).toBe(false);
        expect(world.isAlive(node)).toBe(false);
    })
})

describe('command integration', () => {
    it('command enqueued during system is NOT visible during same system', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        let failed: boolean = false;
        const system: System = (world: FlatWorld, dt: number): void => {
            world.commandBuffer.destroy(node);
            if (world.isAlive(node) !== true) {
                failed = true;
            }
        }
        world.addSystem(system);

        expect(world.isAlive(node)).toBe(true);
        world.step(1);

        expect(failed).toBe(false);
    })

    it('command enqueued by systemA is NOT visible during systemB', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        let failed: boolean = false;
        const systemA: System = (world: FlatWorld, dt: number): void => {
            world.commandBuffer.destroy(node);
        }
        const systemB: System = (world: FlatWorld, dt: number): void => {
            if (world.isAlive(node) !== true) {
                failed = true;
            }
        }
        world.addSystem(systemA);
        world.addSystem(systemB);

        world.step(1);

        expect(failed).toBe(false);
    })

    it('flushes all commands from all systems', () => {
        const world: FlatWorld = createFlatWorld(10);
        const nodeA: NodeHandle = world.createNode();
        const nodeB: NodeHandle = world.createNode();
        const systemA: System = (world: FlatWorld, dt: number): void => {
            world.commandBuffer.destroy(nodeA);
        }
        const systemB: System = (world: FlatWorld, dt: number): void => {
            world.commandBuffer.destroy(nodeB);
        }
        world.addSystem(systemA);
        world.addSystem(systemB);

        expect(world.isAlive(nodeA)).toBe(true);
        expect(world.isAlive(nodeB)).toBe(true);
        world.step(1);

        expect(world.isAlive(nodeA)).toBe(false);
        expect(world.isAlive(nodeB)).toBe(false);
    })
})

describe('Error Cases', () => {
    it('step() during step() throws', () => {
        const world: FlatWorld = createFlatWorld(10);
        const system: System = (world: FlatWorld, dt: number): void => {
            world.step(1);
        }
        world.addSystem(system);

        expect(() => world.step(1)).toThrow("Cannot call step() during step()");
    })

    it('System that throws does not leave world in corrupted state', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        let timesRan: number = 0;
        const system: System = (world: FlatWorld, dt: number): void => {
            if (timesRan === 0) {
                timesRan = 1;
                world.commandBuffer.destroy(node);
                throw new Error("This system is ruining everything");
            } else {
                world.commandBuffer.destroy(node);
                timesRan++;
            }
        }
        world.addSystem(system);
        expect(() => world.step(1)).toThrow("This system is ruining everything");
        expect(world.isAlive(node)).toBe(true);
        expect(world.commandBuffer.size).toBe(0);

        expect(() => world.step(1)).not.toThrow();
        expect(world.isAlive(node)).toBe(false);
        expect(world.commandBuffer.size).toBe(0);
    })

    it('Cannot attach during step', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        const system: System = (world: FlatWorld, dt: number): void => {
            world.attach(node, world.root);
        }
        world.addSystem(system);

        expect(() => world.step(1)).toThrow("Cannot attach during step, use commandBuffer");
    })

    it('Cannot detach during step', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        const system: System = (world: FlatWorld, dt: number): void => {
            world.detach(node);
        }
        world.addSystem(system);

        expect(() => world.step(1)).toThrow("Cannot detach during step, use commandBuffer");
    })

    it('Cannot destroy during step', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        const system: System = (world: FlatWorld, dt: number): void => {
            world.destroy(node);
        }
        world.addSystem(system);

        expect(() => world.step(1)).toThrow("Cannot destroy during step, use commandBuffer");
    })

    it('Cannot reparent during step', () => {
        const world: FlatWorld = createFlatWorld(10);
        const nodeA: NodeHandle = world.createNode();
        const nodeB: NodeHandle = world.createNode();
        world.attach(nodeA, world.root);
        world.attach(nodeB, world.root);
        const system: System = (world: FlatWorld, dt: number): void => {
            world.reparent(nodeA, nodeB);
        }
        world.addSystem(system);

        expect(() => world.step(1)).toThrow("Cannot reparent during step, use commandBuffer");
    })
})
