Problem: The transform propagation system walks the tree and only reaches attached nodes while the render system iterates over the pool, and reaches all nodes that are worldEnabled.

Current Gap: a node can be world enabled but not attached.

Suggested Defensible fix: Only root-reachable nodes are world enabled.

--- 

New Model written out explicitly.

Enabled?: A property that every node has. The abstraction revealed to the developer. Semantically: is the object represented by this node on?
    - has consequences hidden behind abstraction.
    - much more useful

WorldEnabled?: A property that every node has. Consequence of tree structure. Semantically: is this specific node on?
    - A node is world enabled if it has the following properties
        - It is enabled
        - All of its ancestors are enabled
        - Root is an ancestor of this node
    - WYSIWYG
    - useful for systems.

---

How to enforce
    - Freshly allocated nodes are wordDisabled
    - Detach propagates wordDisabled
    - Set enabled doesn't propogate worldEnabled if parent is null
    - Attach stays the same


All Cases

| Case | Node Enabled | All Ancestors Enabled | Root Reachable | World Enabled |
|:-----|:-------------|:----------------------|:---------------|:--------------|
| 1    | T            | T                     | T              | T             |
| 2    | T            | T                     | F              | F             |
| 3    | T            | F                     | T              | F             |
| 4    | T            | F                     | F              | F             |
| 5    | F            | T                     | T              | F             |
| 6    | F            | T                     | F              | F             |
| 7    | F            | F                     | T              | F             |
| 8    | F            | F                     | F              | F             |

1. Create Node (enable), attach to chain that is enabled and leads to root
2. Create Node (enable), attach to chain that is enabled and doesn't lead to root
3. Create Node (enable), attach to chain that contains one non enabled and leads to root
4. Create Node (enable), attach to chain that contains one non enabled and doesn't lead to root
5. Create Node (disable), attach to chain that is enabled and leads to root
6. Create Node (disable), attach to chain that is enabled and doesn't lead to root
7. Create Node (disable), attach to chain that contains one non enabled and leads to root
8. Create Node (disable), attach to chain that contains one non enabled and doesn't lead to root

Every two states that is one transition apart needs to be tested and the rest are compositions of those so no need for tests.
Transitions:
    - 1-2: break chain to root
    - 1-3: disable ancestor
    - 1-5: disable node.
    - 2-1: attach ancestor to root
    - 2-4: disable ancestor
    - 2-6: disable node
    - 3-1: enable ancestors
    - 3-4: break chain to root
    - 3-7: disable node
    - 4-2: Enable ancestor
    - 4-3: attach ancestor to root
    - 4-8: disable node
    - 5-6: break chain to root
    - 5-7: disable ancestor
    - 5-1: enable node
    - 6-5: attach ancestor to root
    - 6-8: disable ancestor
    - 6-2: enable node
    - 7-5: enable ancestors
    - 7-8: break chain to root
    - 7-3: enable node
    - 8-6: enable ancestors
    - 8-7: attach ancestor to root
    - 8-4: enable node

any transition that involves a state switch in  All Ancestors Enabled or Root Reachable needs to be tested a second time using reparent
    - 1-2: reparent to broken chain that is still enabled
    - 1-3: reparent to disabled chain that is still attached
    - 2-1: reparent to attached chain that is still enabled
    - 2-4: reparent to disabled chain that is still broken
    - 3-1: reparent to enabled chain that is still attached
    - 3-4: reparent to broken chain that is still disabled
    - 4-2: reparent to enabled chain that is still broken
    - 4-3: reparent to attached chain that is still disabled
    - 5-6: reparent to broken chain that is still enabled
    - 5-7: reparent to disabled chain that is still attached
    - 6-5: reparent to attached chain that is still enabled
    - 6-8: reparent to disabled chain that is still broken
    - 7-5: reparent to enabled chain that is still attached
    - 7-8: reparent to broken chain that is still disabled
    - 8-6: reparent to enabled chain that is still broken
    - 8-7: reparent to attached chain that is still disabled



Test cases
    - Root is always enabled
    - Freshly created nodes are not worldEnabled
    - Nodes that are attached and world enabled then are detached are not enabled
    - set unatached node enabled doesn't effect world enabled at all
