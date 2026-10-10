# Revision 21 (local): LOOK RIGHT, Engineering from the Watch

- The operator's main screen gets LOOK RIGHT: the Engineering station itself (station.html?role=engineer&embed=1 in a
  frame), so everything Engineering does can be done with no officer on Engineering: the furnace controls, the
  breaker panel (fuel, or power for a salvaged ship), the boost's flag code and Morse questions.
- The embedded station never counts as an officer on station: no hello, no stokehold defence, no damage effects, no
  posters, local channel only. A real Engineering officer can join at any time and works alongside it; the stokehold
  defence goes to them alone.
- A link to the Engineering book sits on the LOOK RIGHT header (salvage boards and repairs still read its flowchart).
- Salvage dashboards and FL-3 now say the operator powers ships from LOOK RIGHT when nobody holds Engineering.
- LOOK RIGHT appears only while no officer holds Engineering. When one joins, it hides and the operator is returned to
  the main view (with a toast); when they leave, it comes back (with a toast). The button glows while something waits
  on Engineering (a ship needing power, or the boost's flags or Morse question). The crew board says "covered by the
  operator (LOOK RIGHT)". The stokehold defence still only goes to a real Engineering officer.
- A damaged station lists 6° (was 10°).
