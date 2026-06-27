import {FlatTreeStorage, FlatWorld, NodeHandle} from "../types";
import {createFlatWorld} from "../FlatWorld";
import {NULL, ROOT_ID} from "../constants";

/*
* This file is designed to test the accuracy of the world enabled invariant
*
* Invariant: a node is world enabled iff the node is enabled
*                                       && all ancestors are enabled
*                                       && it is descendant of root
*
* Root is always enabled
*
* defined recursively:
*   (base) root is world enabled
*    any non-root node is world enabled if the node is enabled and its parent is world enabled.
*
* This file tests the transitions between 8 different states
* 1. Enabled, all ancestors enabled, descendant of root
* 2. Enabled, all ancestors enabled, not a descendant of root
* 3. Enabled, ancestor disabled, descendant of root
* 4. Enabled, ancestor disabled, not a descendant of root
* 5. Disabled, all ancestors enabled, descendant of root
* 6. Disabled, all ancestors enabled, not a descendant of root
* 7. Disabled, ancestor disabled, descendant of root
* 8. Disabled, ancestor disabled, not a descendant of root
*
* Practical invariant:
* the set of worldEnabled nodes must equal the set of alive nodes reachable
* by the transform propagation traversal: start at root, descend through
* firstChild/nextSibling, and stop at disabled branches.
* */
describe('world enabled tests', () => {
    let world: FlatWorld;
    let storage: FlatTreeStorage;
    let con_e_chain: Chain;
    let con_d_chain: Chain;
    let broke_e_chain: Chain;
    let broke_d_chain: Chain;
    let node: NodeHandle;

    beforeEach(() => {
        world = createFlatWorld(1000);
        storage = world.getStorage();

        // create chains
        con_e_chain = createChain(world, true, true);
        con_d_chain = createChain(world, true, false);
        broke_e_chain = createChain(world, false, true);
        broke_d_chain = createChain(world, false, false);

        node = world.createNode();
    })

    it('root cannot be disabled', () => {
        expect(() => world.setEnabled(world.root, false)).toThrow(`Cannot disable root node (id ${ROOT_ID})`);
    })

    it('enabled unattached node is not world enabled', () => {
        expectAllWorldEnabledByTraversal(storage);

        world.attach(node, world.root);
        expectAllWorldEnabledByTraversal(storage);

        world.detach(node);
        expectAllWorldEnabledByTraversal(storage);
    });

    // This is the only time we test the base state
    describe('directly change the nodes enabled status', () => {
        it('1 -> 5 -> 1', () => {
            // act # 1
            world.attach(node, con_e_chain.leaf);

            // assert # 1
            expectAllWorldEnabledByTraversal(storage);

            // act # 2
            world.setEnabled(node, false);

            // assert # 2
            expectAllWorldEnabledByTraversal(storage);

            // act # 3
            world.setEnabled(node, true);

            // assert # 3
            expectAllWorldEnabledByTraversal(storage);
        })

        it('2 -> 6 ->, no-op', () => {
            // act # 1
            world.attach(node, broke_e_chain.leaf);

            // assert # 1
            expectAllWorldEnabledByTraversal(storage);

            // act # 2
            world.setEnabled(node, false);

            // assert # 2
            expectAllWorldEnabledByTraversal(storage);

            // act # 3
            world.setEnabled(node, true);

            // assert # 3
            expectAllWorldEnabledByTraversal(storage);
        })

        it('3 -> 7 -> 3, no-op', () => {
            // act # 1
            world.attach(node, con_d_chain.leaf);

            // assert # 1
            expectAllWorldEnabledByTraversal(storage);

            // act # 2
            world.setEnabled(node, false);

            // assert # 2
            expectAllWorldEnabledByTraversal(storage);

            // act # 3
            world.setEnabled(node, true);

            // assert # 3
            expectAllWorldEnabledByTraversal(storage);
        })

        it('4 -> 8 -> 4, no-op', () => {
            // act # 1
            world.attach(node, broke_d_chain.leaf);

            // assert # 1
            expectAllWorldEnabledByTraversal(storage);

            // act # 2
            world.setEnabled(node, false);

            // assert # 2
            expectAllWorldEnabledByTraversal(storage);

            // act # 3
            world.setEnabled(node, true);

            // assert # 3
            expectAllWorldEnabledByTraversal(storage);
        })
    })

    describe('change the nodes chain', () => {
        // Redundantly test the same state transitions but transition with different method.
        describe('mutate chains', () => {
            it('1 -> 2 -> 1', () => {
                // arrange
                world.attach(node, con_e_chain.leaf);

                // act # 1
                breakChain(con_e_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                connectChain(con_e_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('1 -> 3 -> 1', () => {
                // arrange
                world.attach(node, con_e_chain.leaf);

                // act # 1
                disableChain(con_e_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                enableChain(con_e_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('2 -> 4 -> 2, no-op', () => {
                // arrange
                world.attach(node, broke_e_chain.leaf);

                // act # 1
                disableChain(broke_e_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                enableChain(broke_e_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('3 -> 4 -> 3, no-op', () => {
                // arrange
                world.attach(node, con_d_chain.leaf);

                // act # 1
                breakChain(con_d_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                connectChain(con_d_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('5 -> 6 -> 5, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, con_e_chain.leaf);

                // act # 1
                breakChain(con_e_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                connectChain(con_e_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('5 -> 7 -> 5, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, con_e_chain.leaf);

                // act # 1
                disableChain(con_e_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                enableChain(con_e_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('6 -> 8 -> 6, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, broke_e_chain.leaf);

                // act # 1
                disableChain(broke_e_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                enableChain(broke_e_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('7 -> 8 -> 7, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, con_d_chain.leaf);

                // act # 1
                breakChain(con_d_chain, world);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                connectChain(con_d_chain, world);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })
        })

        describe('swap chains', () => {
            it('1 -> 2 -> 1', () => {
                // arrange
                world.attach(node, con_e_chain.leaf);

                // act # 1
                world.reparent(node, broke_e_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('1 -> 3 -> 1', () => {
                // arrange
                world.attach(node, con_e_chain.leaf);

                // act # 1
                world.reparent(node, con_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('1 -> 4 -> 1', () => {
                // arrange
                world.attach(node, con_e_chain.leaf);

                // act # 1
                world.reparent(node, broke_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('2 -> 3 -> 2, no-op', () => {
                // arrange
                world.attach(node, broke_e_chain.leaf);

                // act # 1
                world.reparent(node, con_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, broke_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('2 -> 4 -> 2, no-op', () => {
                // arrange
                world.attach(node, broke_e_chain.leaf);

                // act # 1
                world.reparent(node, broke_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, broke_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('3 -> 4 -> 3, no-op', () => {
                // arrange
                world.attach(node, con_d_chain.leaf);

                // act # 1
                world.reparent(node, broke_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_d_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            // ---

            it('5 -> 6 -> 5, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, con_e_chain.leaf);

                // act # 1
                world.reparent(node, broke_e_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('5 -> 7 -> 5, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, con_e_chain.leaf);

                // act # 1
                world.reparent(node, con_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('5 -> 8 -> 5, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, con_e_chain.leaf);

                // act # 1
                world.reparent(node, broke_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('6 -> 7 -> 6, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, broke_e_chain.leaf);

                // act # 1
                world.reparent(node, con_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, broke_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('6 -> 8 -> 6, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, broke_e_chain.leaf);

                // act # 1
                world.reparent(node, broke_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, broke_e_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })

            it('7 -> 8 -> 7, no-op', () => {
                // arrange
                world.setEnabled(node, false);
                world.attach(node, con_d_chain.leaf);

                // act # 1
                world.reparent(node, broke_d_chain.leaf);

                // assert # 1
                expectAllWorldEnabledByTraversal(storage);

                // act # 2
                world.reparent(node, con_d_chain.leaf);

                // assert # 2
                expectAllWorldEnabledByTraversal(storage);
            })
        })
    })
})


function createChain(world: FlatWorld, connected: boolean, enabled: boolean): Chain {
    const seed: NodeHandle = world.createNode();
    const arbitrary_ancestor: NodeHandle = world.createNode();
    const leaf: NodeHandle = world.createNode();

    world.attach(arbitrary_ancestor, seed);
    world.attach(leaf, arbitrary_ancestor);

    if (connected) {
        world.attach(seed, world.root);
    }

    if (!enabled) {
        world.setEnabled(arbitrary_ancestor, false);
    }

    return {
        leaf,
        arbitrary_ancestor,
        seed,
    }
}

function deriveWorldEnabledByTransformTraversal(storage: FlatTreeStorage): Int32Array {
    const expected = new Int32Array(storage.alive.length);

    const stack: Array<{ id: number; parentWorldEnabled: boolean}> = [
        { id: ROOT_ID, parentWorldEnabled: true }
    ];

    while (stack.length > 0) {
        const { id, parentWorldEnabled } = stack.pop()!;

        if (storage.alive[id] === 0) continue;

        const selfWorldEnabled: boolean =
            id === ROOT_ID
                ? true
                : parentWorldEnabled && storage.enabled[id] === 1;

        expected[id] = selfWorldEnabled ? 1 : 0

        if (!selfWorldEnabled) {
            continue;
        }

        let child: number = storage.firstChild[id];
        while (child !== NULL) {
            stack.push({ id: child, parentWorldEnabled: selfWorldEnabled });
            child = storage.nextSibling[child];
        }
    }

    return expected;
}

function expectAllWorldEnabledByTraversal(storage: FlatTreeStorage): void {
    const expected: Int32Array = deriveWorldEnabledByTransformTraversal(storage);

    for (let id = 0; id < storage.capacity; id++) {
        if (storage.alive[id] === 0) continue;
        expect(storage.worldEnabled[id]).toBe(expected[id]);
    }
}

function connectChain(chain: Chain, world: FlatWorld): void {
    world.attach(chain.seed, world.root);
}

function breakChain(chain: Chain, world: FlatWorld): void {
    world.detach(chain.seed);
}

function enableChain(chain: Chain, world: FlatWorld): void {
    world.setEnabled(chain.arbitrary_ancestor, true);
}

function disableChain(chain: Chain, world: FlatWorld): void {
    world.setEnabled(chain.arbitrary_ancestor, false);
}




/*
    chain names shall be written as connected-status_enabled-status_chain
    connected-status can be root connected-> con or root broken -> broke, enabled status can be enabled -> e, or disabled -> d .

    note the name refers to the status of the chain going into the test, as part of the tests the status will be changed.

    arbitrary_ancestor must be the only disabled node in a disabled chain.
 */
type Chain = {
    leaf: NodeHandle
    arbitrary_ancestor: NodeHandle;
    seed: NodeHandle;
}
