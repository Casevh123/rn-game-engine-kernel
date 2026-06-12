TouchEventBuffer:
    produce writes raw facts
    kernel clears after consumption

TouchState:
    kernel writes normalized frame snapshot
    gameplay systems read this only

we are trying to enforce is deterministic touch behavior

Invariants:
- Delta contract: prevX/prevY position at previous engine read boundary. so if both move/began happen in between frames, delta is 0.
- Time contract: Start time is the time of the first engine read
- ID invariant: ids must be positive, negative id means no touch. Consumer is responsible for id cleanup in buffer.
- Visible touch count invariant: ended / cancelled touches are visible for exactly one frame.


Constraint: Fixed number of touches, any number above max touches throws.


tasks
    - update touchBuffer
    - update InputSystem -> change to beginInputFrame
    - create cleanup -> end input frame
    - create producer interface
    - Update tests
    - Delete phases from constants


Invariant cases to test
    - touches that have ended are active for exaclty one frame
    - touches that have been canceled are active for exaclty one frame
    - touch that has began and moved in between frames has delta 0
    - touch that began and moved in between frames has the correct startX/ startY
    - TouchState is initialized with everything to 0 and everything inactive
    - TouchBuffer is initialized with everything to 0 and id to -1
