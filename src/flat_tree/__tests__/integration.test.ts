import {ComponentPool} from "../ComponentPool";
import {FlatWorld} from "../FlatWorld";
import {NodeHandle, System, refEquals} from "../types";
import {NULL} from "../constants";

describe('movement proof (not official movement system, just example one)', () => {
    class PositionPool extends ComponentPool {
        x: Float32Array;
        y: Float32Array;

        constructor(world: FlatWorld, capacity: number) {
            super(world, capacity);
            this.x = new Float32Array(capacity);
            this.y = new Float32Array(capacity);
        }

        protected swapComponentData(indexA: number, indexB: number): void {
            let tmp: number;
            tmp = this.x[indexA]; this.x[indexA] = this.x[indexB]; this.x[indexB] = tmp;
            tmp = this.y[indexA]; this.y[indexA] = this.y[indexB]; this.y[indexB] = tmp;
        }
    }

    class VelocityPool extends ComponentPool {
        vx: Float32Array;
        vy: Float32Array;

        constructor(world: FlatWorld, capacity: number) {
            super(world, capacity);
            this.vx = new Float32Array(capacity);
            this.vy = new Float32Array(capacity);
        }

        protected swapComponentData(indexA: number, indexB: number): void {
            let tmp: number;
            tmp = this.vx[indexA]; this.vx[indexA] = this.vx[indexB]; this.vx[indexB] = tmp;
            tmp = this.vy[indexA]; this.vy[indexA] = this.vy[indexB]; this.vy[indexB] = tmp;
        }
    }

    function createMovementSystem(posPool: PositionPool, velPool: VelocityPool): System {
        return (_world: FlatWorld, dt: number) => {
            for (let i: number = 0; i < velPool.count; i++) {
                const nodeId: number = velPool.nodeIdAt(i);
                const posIdx: number = posPool.getByNodeId(nodeId);

                if (posIdx === NULL) continue;

                posPool.x[posIdx] += velPool.vx[i] * dt;
                posPool.y[posIdx] += velPool.vy[i] * dt;
            }
        }
    }

    it('node with position(0,0) and velocity(10,5), after step(1.0): position is (10, 5)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        const posPool: PositionPool = new PositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        posPool.add(node);
        velPool.vx[velPool.get(node)] = 10;
        velPool.vy[velPool.get(node)] = 5;
        posPool.x[posPool.get(node)] = 0;
        posPool.y[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, velPool);
        world.addSystem(movementSystem);

        world.step(1.0);

        expect(posPool.x[posPool.get(node)]).toBe(10);
        expect(posPool.y[posPool.get(node)]).toBe(5);
    })

    it('node with position(0,0) and velocity(10,5), after two steps of 0.5: position is (10, 5)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        const posPool: PositionPool = new PositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        posPool.add(node);
        velPool.vx[velPool.get(node)] = 10;
        velPool.vy[velPool.get(node)] = 5;
        posPool.x[posPool.get(node)] = 0;
        posPool.y[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, velPool);
        world.addSystem(movementSystem);

        world.step(0.5);
        world.step(0.5);

        expect(posPool.x[posPool.get(node)]).toBe(10);
        expect(posPool.y[posPool.get(node)]).toBe(5);
    })

    it('node with position but no velocity - unaffected by movement system', () => {
        const world: FlatWorld = new FlatWorld(10);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        const posPool: PositionPool = new PositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        posPool.add(node);
        posPool.x[posPool.get(node)] = 0;
        posPool.y[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, velPool);
        world.addSystem(movementSystem);

        world.step(1);

        expect(posPool.x[posPool.get(node)]).toBe(0);
        expect(posPool.y[posPool.get(node)]).toBe(0);
    })

    it('node with velocity but no position — skipped by movement system (no crash)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        const posPool: PositionPool = new PositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        velPool.vx[velPool.get(node)] = 10;
        velPool.vy[velPool.get(node)] = 5;
        const movementSystem: System = createMovementSystem(posPool, velPool);
        world.addSystem(movementSystem);

        expect(() => world.step(1.0)).not.toThrow();
    })

    it('multiple nodes with update correctly', () => {
        const world: FlatWorld = new FlatWorld(10);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        const posPool: PositionPool = new PositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node1: NodeHandle = world.createNode();
        const node2: NodeHandle = world.createNode();
        velPool.add(node1);
        posPool.add(node1);
        velPool.add(node2);
        posPool.add(node2);
        velPool.vx[velPool.get(node1)] = 10;
        velPool.vy[velPool.get(node1)] = 5;
        posPool.x[posPool.get(node1)] = 0;
        posPool.y[posPool.get(node1)] = 0;
        velPool.vx[velPool.get(node2)] = -5;
        velPool.vy[velPool.get(node2)] = 12;
        posPool.x[posPool.get(node2)] = 0;
        posPool.y[posPool.get(node2)] = 0;
        const movementSystem: System = createMovementSystem(posPool, velPool);
        world.addSystem(movementSystem);

        world.step(1.0);

        expect(posPool.x[posPool.get(node1)]).toBe(10);
        expect(posPool.y[posPool.get(node1)]).toBe(5);
        expect(posPool.x[posPool.get(node2)]).toBe(-5);
        expect(posPool.y[posPool.get(node2)]).toBe(12);
    })

    it('movement + destroy', () => {
        const world: FlatWorld = new FlatWorld(10);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        const posPool: PositionPool = new PositionPool(world, 5);
        world.registerPool(velPool);
        world.registerPool(posPool);
        const node: NodeHandle = world.createNode();
        velPool.add(node);
        posPool.add(node);
        velPool.vx[velPool.get(node)] = 10;
        velPool.vy[velPool.get(node)] = 5;
        posPool.x[posPool.get(node)] = 0;
        posPool.y[posPool.get(node)] = 0;
        const movementSystem: System = createMovementSystem(posPool, velPool);
        const destroySystem: System = (world: FlatWorld, dt: number) => {
            for (let i = 0; i < posPool.count; i++) {
                if (posPool.x[i] >= 10 && posPool.y[i] >= 5) {
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
    class VelocityPool extends ComponentPool {
        vx: Float32Array;
        vy: Float32Array;

        constructor(world: FlatWorld, capacity: number) {
            super(world, capacity);
            this.vx = new Float32Array(capacity);
            this.vy = new Float32Array(capacity);
        }

        protected swapComponentData(indexA: number, indexB: number): void {
            let tmp: number;
            tmp = this.vx[indexA]; this.vx[indexA] = this.vx[indexB]; this.vx[indexB] = tmp;
            tmp = this.vy[indexA]; this.vy[indexA] = this.vy[indexB]; this.vy[indexB] = tmp;
        }
    }

    function createMovementSystem(velPool: VelocityPool): System {
        return (_world: FlatWorld, dt: number) => {
            for (let i: number = 0; i < velPool.count; i++) {
                const node: NodeHandle = velPool.getNodeHandle(i);

                const currentTransform: { a: number, b: number, tx: number, ty: number } = _world.getLocalTransform(node);
                _world.setLocalPosition(node, currentTransform.tx + velPool.vx[i] * dt, currentTransform.ty + velPool.vy[i] * dt);
            }
        }
    }

    it('Movement system + transform propagation', () => {
        const world: FlatWorld = new FlatWorld(10);
        const parent: NodeHandle = world.root;
        const child: NodeHandle = world.createNode();
        world.attach(child, parent);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(parent);
        velPool.vx[velPool.get(parent)] = 1;
        velPool.vy[velPool.get(parent)] = 2;
        const movementSystem: System = createMovementSystem(velPool);
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
        const world: FlatWorld = new FlatWorld(10);
        const parent: NodeHandle = world.root;
        const child: NodeHandle = world.createNode();
        world.attach(child, parent);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(parent);
        velPool.vx[velPool.get(parent)] = 1;
        velPool.vy[velPool.get(parent)] = 2;
        const movementSystem: System = createMovementSystem(velPool);
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
        const world: FlatWorld = new FlatWorld(10);
        const parentA: NodeHandle = world.createNode();
        const parentB: NodeHandle = world.createNode();
        const child: NodeHandle = world.createNode();
        world.attach(parentA, world.root);
        world.attach(parentB, world.root);
        world.attach(child, parentA)
        const velPool: VelocityPool = new VelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(parentA);
        velPool.add(parentB);
        velPool.vx[velPool.get(parentA)] = 1;
        velPool.vy[velPool.get(parentA)] = 1;
        velPool.vx[velPool.get(parentB)] = 2;
        velPool.vy[velPool.get(parentB)] = 2;
        const movementSystem: System = createMovementSystem(velPool);
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
        const world: FlatWorld = new FlatWorld(10);
        const node: NodeHandle = world.createNode();
        world.attach(node, world.root);
        const velPool: VelocityPool = new VelocityPool(world, 5);
        world.registerPool(velPool);
        velPool.add(node);
        velPool.vx[velPool.get(node)] = 1;
        velPool.vy[velPool.get(node)] = 1;
        const movementSystem: System = createMovementSystem(velPool);
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
