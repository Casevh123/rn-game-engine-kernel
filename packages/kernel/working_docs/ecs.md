### this is a formalization for the component and system layer of the engine, not the tree
Let $\mathcal{C}$ be the set of component types.
for each $C \in \mathcal{C}$, let $D_C$ be its value space.
Let $E$ be the set of all entities.

**DEFINITION 0.1 - Component Type** \
A component type $C$ determines a value space $D_C$, for example:
$$
D_{position} = \mathbb{R}^2
$$

**DEFINITION 0.2 - Component State** \
The state of a component type $C$ is a partial function
$$
c_{C}: E \rightharpoonup D_C
$$
its domain,
$$
\operatorname{dom}(c_C) \subseteq E,
$$
is the set of entities that possess a component of type $C$. \
**DEFINITION 0.3 - Component value** \
For every
$$
e \in \operatorname{dom}(c_C),
$$
the value
$$
c_C(e) \in D_C
$$
is the component value of type $C$ associated with $e$.

**DEFINITION 0.4 - World State** \
A world state $W$ is a family of component states indexed by component type:
$$
W = (c_C)_{C \in \mathcal{C} }.
$$
Equivalently, the space of possible world states is 
$$
\mathcal{W} = \prod_{C \in \mathcal{C}} (E \rightharpoonup D_C).
$$

**DEFINITION 0.5 - Entity signature** \
Given a world state W, the component signature of an entity $e$ is
$$
\sigma_W(e) = \{ C \in \mathcal{C} \mid e \in \operatorname{dom}(c_C) \}
$$
Thus,
$$
\sigma_W(e) \in \mathcal{P}(\mathcal{C})
$$
For example,
$$
\sigma_W(e) = \{\text{Position}, \text{Velocity}, \text{Sprite} \}.
$$

**DEFINITION 0.6 - Query Result** \
let $S \subseteq \mathcal{C}$ be a finite set of required component types.
The result of querying world $W$ for the component types in $S$ is
$$
Q_W(S) = \{ e \in E \mid S \subseteq \sigma_W(e) \}.
$$
in words: $Q_W (S)$ is the set of entities that posses every component type in $S$.
Equivalently,
$$
Q_W (S) = \bigcap_{C \in S} \operatorname{dom}(c_C).
$$

**DEFINITION 0.7 - Query Projection** \
For a query signature $S$, define
$$
\pi_{W, S} : Q_W(S) \to D_S
$$
by
$$
\pi_{W, S}(e) = (c_C(e))_{C \in S}
$$

### A more general definition of a query
at one point we may want exclusion \
**DEFINITION 0.8 - Structural Query** \
A structural query is a predicate
$$
q: \mathcal{P}(\mathcal{C}) \to \{\text{true}, \text{false}\}.
$$
A result in world $W$ is 
$$
[\![q]\!]_W = \{e \in E \mid q(\sigma_W(e))\}.
$$
For required components $R$ and excluded components $X$, define
$$
q_{R,X}(S) \iff R \subseteq S \land X \cap S = \varnothing
$$

**DEFINITION 0.9 - System**\
A system is a state transition on worlds with deferred structural commands
$$
s: \mathcal{W} \to \mathcal{W} \times \text{Cmds}.
$$
If the system receives external input, time, or events from some input space $I$, then
$$
s: I \times \mathcal{W} \to \mathcal{W} \times \text{Cmds}.
$$
For example,
$$
s(\Delta t, W) = (W', \{...\}).
$$
