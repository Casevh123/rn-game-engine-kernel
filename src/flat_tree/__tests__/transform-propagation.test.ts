import {FlatWorld} from "../FlatWorld";
import {System} from "../types";
import {FlatNodeRef} from "../FlatNodeRef";
import {FlatTreeStorage} from "../FlatTreeStorage";

describe('Root behaviour', () => {
    it('Root with identity local → world is identity after step', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const root: FlatNodeRef = world.root;
        const storage: FlatTreeStorage = world.getStorage();

        storage.worldA[root.id] = 10;
        storage.worldB[root.id] = 10;
        storage.worldTx[root.id] = 10;
        storage.worldTy[root.id] = 10;
        expect(world.getWorldTransform(root)).toEqual({a: 10, b: 10, tx: 10, ty: 10});
        propagation(world, 0);

        expect(world.getWorldTransform(root)).toEqual({a: 1, b: 0, tx: 0, ty: 0});
    })

    it('Root with non-identity local → world equals local', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const root: FlatNodeRef = world.root;

        world.setLocalTransform(root, 10, 10, 10, 10);
        propagation(world, 0);

        expect(world.getWorldTransform(root)).toEqual({a: 10, b: 10, tx: 10, ty: 10});
    })
})

describe('Singe parent child -- translation', () => {
    it('Parent at origin, child translated (5, 10) — child world position is (5, 10).', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalPosition(child, 5, 10);
        propagation(world, 0);

        expect(world.getWorldTransform(child)).toEqual({a: 1, b: 0, tx: 5, ty: 10});
    })

    it('Parent translated (10, 20), child translated (5, 0) — child world position is (15, 20).', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalPosition(child, 5, 0);
        world.setLocalPosition(parent, 10, 20)
        propagation(world, 0);

        expect(world.getWorldTransform(child)).toEqual({a: 1, b: 0, tx: 15, ty: 20});
    })
})

describe('Single parent-child — rotation only', () => {
    it('Parent rotated 90° (a=0, b=1), child at (1, 0) — child world position is (0, 1).', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalTransform(parent, 0, 1, 0, 0);
        world.setLocalPosition(child, 1, 0)
        propagation(world, 0);

        expect(world.getWorldTransform(child).tx).toBe(0);
        expect(world.getWorldTransform(child).ty).toBe(1);
    })

    it('Parent rotated 90°, child at (0, 1) — child world position is (-1, 0).', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalTransform(parent, 0, 1, 0, 0);
        world.setLocalPosition(child, 0, 1)
        propagation(world, 0);

        expect(world.getWorldTransform(child).tx).toBe(-1);
        expect(world.getWorldTransform(child).ty).toBe(0);
    })

    it('Parent rotated 45°, child at (1, 0) — child world position ≈ (cos45, sin45)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalTransform(parent, Math.cos(Math.PI/4), Math.sin(Math.PI/4), 0, 0);
        world.setLocalPosition(child, 1, 0)
        propagation(world, 0);

        expect(world.getWorldTransform(child).tx).toBeCloseTo(Math.cos(Math.PI/4));
        expect(world.getWorldTransform(child).ty).toBeCloseTo(Math.sin(Math.PI/4));
    })
})

describe('Single parent-child — scale only', () => {
    it('Parent scaled 2 (a=2, b=0), child at (3, 4) — child world position is (6, 8)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalTransform(parent, 2, 0, 0, 0);
        world.setLocalPosition(child, 3, 4)
        propagation(world, 0);

        expect(world.getWorldTransform(child).tx).toBe(6);
        expect(world.getWorldTransform(child).ty).toBe(8);
    })

    it('Parent scaled 0.5, child at (10, 0) — child world position is (5, 0)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalTransform(parent, 0.5, 0, 0, 0);
        world.setLocalPosition(child, 10, 0)
        propagation(world, 0);

        expect(world.getWorldTransform(child).tx).toBe(5);
        expect(world.getWorldTransform(child).ty).toBe(0);
    })
})

describe('Single parent-child — combined rotation + scale', () => {
    it('Parent pos(10,0) rot(90°) scale(2), child at (1,0) — child world position (10, 2), child world a≈0, b≈2 (scale 2, rotation 90°)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalTransform(parent, 0, 2, 10, 0);
        world.setLocalPosition(child, 1, 0)
        propagation(world, 0);

        expect(world.getWorldTransform(child)).toEqual({a: 0, b: 2, tx: 10, ty: 2});
    })

    it('Parent pos(0,0) rot(45°) scale(2), child at (1,0)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const propagation: System = world.createTransformPropagationSystem();
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);

        world.setLocalTransform(parent, 2 * Math.cos(Math.PI/4), 2 * Math.sin(Math.PI/4), 0, 0);
        world.setLocalPosition(child, 1, 0)
        propagation(world, 0);

        const childTransform: {a: number; b: number; tx: number; ty: number} = world.getWorldTransform(child);
        expect(childTransform.a).toBeCloseTo(Math.sqrt(2));
        expect(childTransform.b).toBeCloseTo(Math.sqrt(2));
        expect(childTransform.tx).toBeCloseTo(Math.sqrt(2));
        expect(childTransform.ty).toBeCloseTo(Math.sqrt(2));
    })
})

describe('Multi-level chains', () => {
    it('Three-level translation chain — grandparent tx=10, parent tx=5, child tx=1. Child world tx = 16.', () => {
        const world: FlatWorld = new FlatWorld(10);
        const grandParent: FlatNodeRef = world.root;
        const parent: FlatNodeRef = world.createNode();
        const child: FlatNodeRef = world.createNode();
        world.attach(parent, grandParent);
        world.attach(child, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalPosition(grandParent, 10, 0);
        world.setLocalPosition(parent, 5, 0);
        world.setLocalPosition(child, 1, 0);
        propagation(world, 0);

        const childTransform: {a: number; b: number; tx: number; ty: number} = world.getWorldTransform(child);
        expect(childTransform.tx).toBe(16);
        expect(childTransform.ty).toBe(0);
    })

    it('Three-level with rotation — grandparent rot(90°), parent pos(1,0), child pos(1,0)', () => {
        const world: FlatWorld = new FlatWorld(10);
        const grandParent: FlatNodeRef = world.root;
        const parent: FlatNodeRef = world.createNode();
        const child: FlatNodeRef = world.createNode();
        world.attach(parent, grandParent);
        world.attach(child, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalTransform(grandParent, 0, 1, 0, 0);
        world.setLocalPosition(parent, 1, 0);
        world.setLocalPosition(child, 1, 0);
        propagation(world, 0);

        const childTransform: {a: number; b: number; tx: number; ty: number} = world.getWorldTransform(child);
        expect(childTransform.tx).toBe(0);
        expect(childTransform.ty).toBe(2);
    })

    it('Three-level with scale — grandparent scale(2), parent scale(3), child pos(1,0). Child world tx = 6, child world scale = 6.', () => {
        const world: FlatWorld = new FlatWorld(10);
        const grandParent: FlatNodeRef = world.root;
        const parent: FlatNodeRef = world.createNode();
        const child: FlatNodeRef = world.createNode();
        world.attach(parent, grandParent);
        world.attach(child, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalTransform(grandParent, 2, 0, 0, 0);
        world.setLocalTransform(parent, 3, 0, 0, 0);
        world.setLocalPosition(child, 1, 0);
        propagation(world, 0);

        const childTransform: {a: number; b: number; tx: number; ty: number} = world.getWorldTransform(child);
        expect(childTransform.a).toBe(6);
        expect(childTransform.b).toBe(0);
        expect(childTransform.tx).toBe(6);
        expect(childTransform.ty).toBe(0);
    })

    it('Rotation compounds through chain — grandparent rot(45°), parent rot(45°). Child world rotation ≈ 90°', () => {
        const world: FlatWorld = new FlatWorld(10);
        const grandParent: FlatNodeRef = world.root;
        const parent: FlatNodeRef = world.createNode();
        const child: FlatNodeRef = world.createNode();
        world.attach(parent, grandParent);
        world.attach(child, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalTransform(grandParent, Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), 0, 0);
        world.setLocalTransform(parent, Math.cos(Math.PI / 4), Math.sin(Math.PI / 4), 0, 0);
        propagation(world, 0);

        const childTransform: {a: number; b: number; tx: number; ty: number} = world.getWorldTransform(child);
        expect(childTransform.a).toBeCloseTo(Math.cos(Math.PI / 2));
        expect(childTransform.b).toBeCloseTo(Math.sin(Math.PI / 2));
    })
})

describe('Sibling Independence', () => {
    it('Siblings get independent world transforms', () => {
        const world: FlatWorld = new FlatWorld(10);
        const parent: FlatNodeRef = world.root;
        const sibling1: FlatNodeRef = world.createNode();
        const sibling2: FlatNodeRef = world.createNode();
        world.attach(sibling1, parent);
        world.attach(sibling2, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalTransform(sibling1, 1, 1, 1, 1);
        world.setLocalTransform(sibling2, 2, 2, 2, 2);
        propagation(world, 0);

        expect(world.getWorldTransform(sibling1)).toEqual({a: 1, b: 1, tx: 1, ty: 1});
        expect(world.getWorldTransform(sibling2)).toEqual({a: 2, b: 2, tx: 2, ty: 2});
    })

    it('Modifying one child\'s local doesn\'t affect sibling after re-propagation', () => {
        const world: FlatWorld = new FlatWorld(10);
        const parent: FlatNodeRef = world.root;
        const sibling1: FlatNodeRef = world.createNode();
        const sibling2: FlatNodeRef = world.createNode();
        world.attach(sibling1, parent);
        world.attach(sibling2, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalTransform(sibling1, 1, 1, 1, 1);
        world.setLocalTransform(sibling2, 2, 2, 2, 2);
        propagation(world, 0);
        world.setLocalTransform(sibling1, 0, 0, 0, 0);
        propagation(world, 0);

        expect(world.getWorldTransform(sibling2)).toEqual({a: 2, b: 2, tx: 2, ty: 2});
    })
})

describe('Mutation between frames', () => {
    it('Change parent local position, re-propagate → child world position updates', () => {
        const world: FlatWorld = new FlatWorld(10);
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalTransform(parent, 1, 0, 1, 0);
        world.setLocalTransform(child, 1, 0, 1, 0);
        propagation(world, 0);
        expect(world.getWorldTransform(child)).toEqual({a: 1, b: 0, tx: 2, ty: 0});
        world.setLocalTransform(parent, 1, 0, 1, 1);
        propagation(world, 0);

        expect(world.getWorldTransform(child)).toEqual({a: 1, b: 0, tx: 2, ty: 1});
    })

    it('Change parent local rotation, re-propagate → child world position rotates', () => {
        const world: FlatWorld = new FlatWorld(10);
        const parent: FlatNodeRef = world.root;
        const child: FlatNodeRef = world.createNode();
        world.attach(child, parent);
        const propagation: System = world.createTransformPropagationSystem();

        world.setLocalTransform(parent, Math.cos(Math.PI / 2), Math.sin(Math.PI / 2), 0, 0);
        world.setLocalTransform(child, 1, 0, 1, 0);
        propagation(world, 0);
        let childTransform: {a: number, b: number, tx: number, ty: number} = world.getWorldTransform(child);
        expect(childTransform.tx).toBeCloseTo(0);
        expect(childTransform.ty).toBeCloseTo(1);
        world.setLocalTransform(parent, Math.cos(Math.PI), Math.sin(Math.PI), 0, 0);
        propagation(world, 0);

        childTransform = world.getWorldTransform(child);
        expect(childTransform.tx).toBeCloseTo(-1);
        expect(childTransform.ty).toBeCloseTo(0);
    })
})

describe('Structural mutation interaction', () => {
    it('Reparent via command buffer → child\'s world reflects new parent after step', () => {
        const world: FlatWorld = new FlatWorld(10);
        const parentA: FlatNodeRef = world.createNode();
        const parentB: FlatNodeRef = world.createNode();
        const child: FlatNodeRef = world.createNode();
        world.attach(parentA, world.root);
        world.attach(parentB, world.root);
        world.attach(child, parentA);
        const propagationSystem: System = world.createTransformPropagationSystem();
        const reparent: System = (world: FlatWorld, _: number): void => {
            if (world.getParent(child)?.equals(parentA)) {
                world.commandBuffer.reparent(child, parentB);
            }
        }
        world.addSystem(propagationSystem);
        world.addSystem(reparent);

        world.setLocalPosition(parentA, 1, 1);
        world.setLocalPosition(parentB, 2, 2);
        world.step(0);
        expect(world.getWorldTransform(child)).toEqual({a: 1, b: 0, tx: 1, ty: 1});
        world.step(0);

        expect(world.getWorldTransform(child)).toEqual({a: 1, b: 0, tx: 2, ty: 2});
    })

    it('Destroy child, surviving sibling\'s world still correct after re-propagation', () => {
        const world: FlatWorld = new FlatWorld(10);
        const parent: FlatNodeRef = world.createNode();
        const siblingA: FlatNodeRef = world.createNode();
        const siblingB: FlatNodeRef = world.createNode();
        world.attach(parent, world.root);
        world.attach(siblingA, parent);
        world.attach(siblingB, parent);
        const propagationSystem: System = world.createTransformPropagationSystem();
        const destroy: System = (world: FlatWorld, _: number): void => {
            if (world.isAlive(siblingA)) {
                world.commandBuffer.destroy(siblingA);
            }
        }
        world.addSystem(propagationSystem);
        world.addSystem(destroy);

        world.setLocalPosition(parent, 1, 1);
        world.step(0);
        expect(world.getWorldTransform(siblingB)).toEqual({a: 1, b: 0, tx: 1, ty: 1});
        world.step(0);

        expect(world.getWorldTransform(siblingB)).toEqual({a: 1, b: 0, tx: 1, ty: 1});
    })

    it('Destroyed node\'s transform slots reset on reallocation', () => {
        const world: FlatWorld = new FlatWorld(10);
        const doomedNode: FlatNodeRef = world.createNode();

        world.setLocalTransform(doomedNode, 10, 10, 10, 10);
        world.destroy(doomedNode);
        const reincarnatedNode: FlatNodeRef = world.createNode();
        expect(reincarnatedNode.id).toBe(doomedNode.id);
        expect(reincarnatedNode.version).toBe(doomedNode.version + 1);

        expect(world.getLocalTransform(reincarnatedNode)).toEqual({a: 1, b: 0, tx: 0, ty: 0});
    })
})
