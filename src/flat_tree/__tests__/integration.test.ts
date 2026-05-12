import {createComponentPool} from "../ComponentPool";
import {createFlatWorld} from "../FlatWorld";
import {NodeHandle, System, refEquals, FlatWorld, ComponentPool} from "../types";
import {NULL} from "../constants";

describe('movement proof (not official movement system, just example one)', () => {
    function createPositionPool(world: FlatWorld, capacity: number) {
        const x = new Float32Array(capacity);
        const y = new Float32Array(capacity);
        const pool = createComponentPool(world, capacity, (a: number, b: number) => {
            let tmp: number;
            tmp = x[a]; x[a] = x[b]; x[b] = tmp;
            tmp = y[a]; y[a] = y[b]; y[b] = tmp;
        });
        return { pool, x, y };
    }

    function createVelocityPool(world: FlatWorld, capacity: number) {
        const vx = new Float32Array(capacity);
        const vy = new Float32Array(capacity);
        const pool = createComponentPool(world, capacity, (a: number, b: number) => {
            let tmp: number;
            tmp = vx[a]; vx[a] = vx[b]; vx[b] = tmp;
            tmp = vy[a]; vy[a] = vy[b]; vy[b] = tmp;
        });
        return { pool, vx, vy };
    }

    function createMovementSystem(
        posPool: ComponentPool, posX: Float32Array, posY: Float32Array,
        velPool: ComponentPool, velVx: Float32Array, velVy: Float32Array,
    ): System {
        return (_world: FlatWorld, dt: number) => {
            for (let i: number = 0; i < velPool.count; i++) {
                const nodeId: number = velPool.nodeIdAt(i);
                const posIdx: number = posPool.getByNodeId(nodeId);

                if (posIdx === NULL) continue;

                posX[posIdx] += velVx[i] * dt;
                posY[posIdx] += velVy[i] * dt;
            }
        }
    }

    it('node with position(0,0) and velocity(10,5), after step(1.0): position is (10, 5)', () => {
        const world: FlatWorld = createFlatWorld(10);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        const { pool: posPool, x: posX, y: posY } = createPositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        posPool.add(node);
        vx[velPool.get(node)] = 10;
        vy[velPool.get(node)] = 5;
        posX[posPool.get(node)] = 0;
        posY[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, posX, posY, velPool, vx, vy);
        world.addSystem(movementSystem);

        world.step(1.0);

        expect(posX[posPool.get(node)]).toBe(10);
        expect(posY[posPool.get(node)]).toBe(5);
    })

    it('node with position(0,0) and velocity(10,5), after two steps of 0.5: position is (10, 5)', () => {
        const world: FlatWorld = createFlatWorld(10);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        const { pool: posPool, x: posX, y: posY } = createPositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        posPool.add(node);
        vx[velPool.get(node)] = 10;
        vy[velPool.get(node)] = 5;
        posX[posPool.get(node)] = 0;
        posY[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, posX, posY, velPool, vx, vy);
        world.addSystem(movementSystem);

        world.step(0.5);
        world.step(0.5);

        expect(posX[posPool.get(node)]).toBe(10);
        expect(posY[posPool.get(node)]).toBe(5);
    })

    it('node with position but no velocity - unaffected by movement system', () => {
        const world: FlatWorld = createFlatWorld(10);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        const { pool: posPool, x: posX, y: posY } = createPositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        posPool.add(node);
        posX[posPool.get(node)] = 0;
        posY[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, posX, posY, velPool, vx, vy);
        world.addSystem(movementSystem);

        world.step(1);

        expect(posX[posPool.get(node)]).toBe(0);
        expect(posY[posPool.get(node)]).toBe(0);
    })

    it('node with velocity but no position — skipped by movement system (no crash)', () => {
        const world: FlatWorld = createFlatWorld(10);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        const { pool: posPool, x: posX, y: posY } = createPositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        vx[velPool.get(node)] = 10;
        vy[velPool.get(node)] = 5;
        const movementSystem: System = createMovementSystem(posPool, posX, posY, velPool, vx, vy);
        world.addSystem(movementSystem);

        expect(() => world.step(1.0)).not.toThrow();
    })

    it('multiple nodes with update correctly', () => {
        const world: FlatWorld = createFlatWorld(10);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        const { pool: posPool, x: posX, y: posY } = createPositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        velPool.add(node1);
        posPool.add(node1);
        velPool.add(node2);
        posPool.add(node2);
        vx[velPool.get(node1)] = 10;
        vy[velPool.get(node1)] = 5;
        posX[posPool.get(node1)] = 0;
        posY[posPool.get(node1)] = 0;
        vx[velPool.get(node2)] = -5;
        vy[velPool.get(node2)] = 12;
        posX[posPool.get(node2)] = 0;
        posY[posPool.get(node2)] = 0;
        const movementSystem: System = createMovementSystem(posPool, posX, posY, velPool, vx, vy);
        world.addSystem(movementSystem);

        world.step(1.0);

        expect(posX[posPool.get(node1)]).toBe(10);
        expect(posY[posPool.get(node1)]).toBe(5);
        expect(posX[posPool.get(node2)]).toBe(-5);
        expect(posY[posPool.get(node2)]).toBe(12);
    })

    it('movement + destroy', () => {
        const world: FlatWorld = createFlatWorld(10);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        const { pool: posPool, x: posX, y: posY } = createPositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        posPool.add(node);
        vx[velPool.get(node)] = 10;
        vy[velPool.get(node)] = 5;
        posX[posPool.get(node)] = 0;
        posY[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, posX, posY, velPool, vx, vy);
        const destroySystem: System = (world: FlatWorld, dt: number) => {
            for (let i = 0; i < posPool.count; i++) {
                if (posX[i] >= 10 && posY[i] >= 5) {
                    world.commandBuffer.destroy(posPool.getNodeHandle(i));
                }
            }
        }
        world.addSystem(movementSystem);
        world.addSystem(destroySystem);

        world.step(0.5);
        expect(posPool.count).toBe(1);
        expect(velPool.count).toBe(1);
        expect(() => world.step(0.5)).not.toThrow();


        expect(velPool.count).toBe(0);
        expect(posPool.count).toBe(0);
        expect(world.isAlive(node)).toBe(false);
    })
})

describe('transform end-to-end', () => {
    function createVelocityPool(world: FlatWorld, capacity: number) {
        const vx = new Float32Array(capacity);
        const vy = new Float32Array(capacity);
        const pool = createComponentPool(world, capacity, (a: number, b: number) => {
            let tmp: number;
            tmp = vx[a]; vx[a] = vx[b]; vx[b] = tmp;
            tmp = vy[a]; vy[a] = vy[b]; vy[b] = tmp;
        });
        return { pool, vx, vy };
    }

    function createMovementSystem(velPool: ComponentPool, vx: Float32Array, vy: Float32Array): System {
        return (_world: FlatWorld, dt: number) => {
            for (let i: number = 0; i < velPool.count; i++) {
                const node: NodeHandle = velPool.getNodeHandle(i);

                const currentTransform: { a: number, b: number, tx: number, ty: number } = _world.getLocalTransform(node);
                _world.setLocalPosition(node, currentTransform.tx + vx[i] * dt, currentTransform.ty + vy[i] * dt);
            }
        }
    }

    it('Movement system + transform propagation', () => {
        const world: FlatWorld = createFlatWorld(10);
        const parent: NodeHandle = world.root;
        const child: NodeHandle = world.createNode();
        world.attach(child, parent);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(parent);
        vx[velPool.get(parent)] = 1;
        vy[velPool.get(parent)] = 2;
        const movementSystem: System = createMovementSystem(velPool, vx, vy);
        const propagationSystem: System = world.createTransformPropagationSystem();
        world.addSystem(movementSystem);
        world.addSystem(propagationSystem);

        let parentTransform: { a: number, b: number, tx: number, ty: number } = world.getWorldTransform(parent);
        let childTransform: { a: number, b: number, tx: number, ty: number } = world.getWorldTransform(child);
        expect(parentTransform).toEqual({ a: 1, b: 0, tx: 0, ty: 0 });
        expect(childTransform).toEqual({ a: 1, b: 0, tx: 0, ty: 0 });
        world.step(1);
        parentTransform = world.getWorldTransform(parent);
        childTransform = world.getWorldTransform(child);
        expect(parentTransform).toEqual({ a: 1, b: 0, tx: 1, ty: 2 });
        expect(childTransform).toEqual({ a: 1, b: 0, tx: 1, ty: 2 });
        world.step(1);
        parentTransform = world.getWorldTransform(parent);
        childTransform = world.getWorldTransform(child);
        expect(parentTransform).toEqual({ a: 1, b: 0, tx: 2, ty: 4});
        expect(childTransform).toEqual({ a: 1, b: 0, tx: 2, ty: 4 });
    })

    it('Movement + propagation + deferred destroy', () => {
        const world: FlatWorld = createFlatWorld(10);
        const parent: NodeHandle = world.root;
        const child: NodeHandle = world.createNode();
        world.attach(child, parent);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(parent);
        vx[velPool.get(parent)] = 1;
        vy[velPool.get(parent)] = 2;
        const movementSystem: System = createMovementSystem(velPool, vx, vy);
        const propagationSystem: System = world.createTransformPropagationSystem();
        const destroyChild: System = (_world: FlatWorld, _: number) => {
            if (_world.isAlive(child)) {
                _world.commandBuffer.destroy(child);
            }
        }
        world.addSystem(movementSystem);
        world.addSystem(propagationSystem);
        world.addSystem(destroyChild);

        let parentTransform: { a: number, b: number, tx: number, ty: number } = world.getWorldTransform(parent);
        expect(parentTransform).toEqual({ a: 1, b: 0, tx: 0, ty: 0 });
        expect(() => world.step(1)).not.toThrow();
        parentTransform = world.getWorldTransform(parent);
        expect(parentTransform).toEqual({ a: 1, b: 0, tx: 1, ty: 2 });
        expect(world.isAlive(child)).toBe(false);
        expect(() => world.step(1)).not.toThrow();
        parentTransform = world.getWorldTransform(parent);
        expect(parentTransform).toEqual({ a: 1, b: 0, tx: 2, ty: 4});
        expect(world.isAlive(child)).toBe(false);
    })

    it('Reparent during step + propagation on next step', () => {
        const world: FlatWorld = createFlatWorld(10);
        const parentA: NodeHandle = world.createNode();
        const parentB: NodeHandle = world.createNode();
        const child: NodeHandle = world.createNode();
        world.attach(parentA, world.root);
        world.attach(parentB, world.root);
        world.attach(child, parentA)
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(parentA);
        velPool.add(parentB);
        vx[velPool.get(parentA)] = 1;
        vy[velPool.get(parentA)] = 1;
        vx[velPool.get(parentB)] = 2;
        vy[velPool.get(parentB)] = 2;
        const movementSystem: System = createMovementSystem(velPool, vx, vy);
        const propagationSystem: System = world.createTransformPropagationSystem();
        const reparentChild: System = (_world: FlatWorld, _: number) => {
            const parentHandle = _world.getParent(child);
            if (parentHandle && refEquals(parentHandle, parentA)) {
                _world.commandBuffer.reparent(child, parentB);
            }
        }
        world.addSystem(movementSystem);
        world.addSystem(propagationSystem);
        world.addSystem(reparentChild);

        let childTransform: { a: number, b: number, tx: number, ty: number } = world.getWorldTransform(child);
        expect(childTransform).toEqual({ a: 1, b: 0, tx: 0, ty: 0 });
        expect(() => world.step(1)).not.toThrow();

        // Child has been reparented but the transform data is behind a frame
        childTransform = world.getWorldTransform(child);
        expect(childTransform).toEqual({ a: 1, b: 0, tx: 1, ty: 1 });
        expect(refEquals(world.getParent(child)!, parentB)).toBe(true);
        expect(() => world.step(1)).not.toThrow();
        childTransform = world.getWorldTransform(child);
        expect(childTransform).toEqual({ a: 1, b: 0, tx: 4, ty: 4});
        expect(refEquals(world.getParent(child)!, parentB)).toBe(true);
    })

    it('Disabled node re-enabled → next step propagates correctly', () => {
        const world: FlatWorld = createFlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        const { pool: velPool, vx, vy } = createVelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(node);
        vx[velPool.get(node)] = 1;
        vy[velPool.get(node)] = 1;
        const movementSystem: System = createMovementSystem(velPool, vx, vy);
        const propagationSystem: System = world.createTransformPropagationSystem();
        world.addSystem(movementSystem);
        world.addSystem(propagationSystem);

        let nodeTransform: { a: number, b: number, tx: number, ty: number } = world.getWorldTransform(node);
        expect(nodeTransform).toEqual({ a: 1, b: 0, tx: 0, ty: 0 });
        world.setEnabled(node, false);
        world.step(1);
        nodeTransform = world.getWorldTransform(node);
        expect(nodeTransform).toEqual({ a: 1, b: 0, tx: 0, ty: 0 });
        world.setEnabled(node, true);
        world.step(1);
        nodeTransform = world.getWorldTransform(node);
        expect(nodeTransform).toEqual({ a: 1, b: 0, tx: 2, ty: 2 });
    })
})
