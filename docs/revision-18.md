# Revision 18: the Fleet Officer and the salvo battle

Built on revision 17 (the Snake work). The old one-shot Battleship is replaced.

## The battle (`src/fleet.js`, `src/fleetui.js`)
- Two 12 × 12 tables; ships never touch; the enemy never moves. Ours: 2/3/3/3 (the flagship is the Fleet Officer's;
  the three-long ships carry Gunnery, Signals and Engineering). Theirs: 4/3/3/2.
- Salvo rounds: both fleets fire together every 70 s (the GM sets it: "time between salvos"), or when the commander
  fires. One shot per ship afloat; every hit the enemy lands costs it a shot next round.
- Commander: the Fleet Officer's station; with nobody on it, the operator from the cabin wall. Officers watch.
- Specials, loaded by flag code (12 flags; the codebook gives runes by house and weight; Signals' pad is unlabelled):
  Gunnery's heavy shell (2 × 2, uses a red or orange beacon, never green), Signals' sounding (row or column count;
  dragged, R turns it), Engineering's boost (one of ours moves a square).
- Salvage: a sunk ship opens a salvage board on the commander's screen, read with Engineering's flowchart (EN-5), and
  needs power from Engineering's breaker panel (Lights Out now offers fuel or power). With no Engineering on station it
  relaunches by itself after 5 rounds.
- While one of ours is down, the enemy shells the Watch every 3 rounds (one machine, never while a shelled machine is
  still broken). Losing the whole fleet cracks the furnace grate; the fleet is refitted a minute later. Devil
  reinforcements are gone.
- Hits on an officer's ship crack their station's glass; relaunch or a won wave mends it.
- Minesweeping's second reward now sights one square of an enemy hull.
- Old saves: the old fleet is replaced with a fresh one on load.

## Also
- Snake: a 17-wide board, the cable starts at 20 and must reach 30 (collect 10), drifting sparks, ends sink after 6 s.
- The Stokehold stoker falls back to the throwing sprite if the standing one is not ready.
- Manuals: a fourth book, FLEET COMMAND (FL-1 the battle, FL-2 the codebook, FL-3 salvage); LW-0E, the step table,
  GU-2, EN-7 and SI-6 updated.

## Balance (`node tools/sim-fleet.mjs`, simulated crews, about 40 s a round)
About 10 minutes a wave, 3–4 waves in a 40-minute session, about one of our ships sunk a wave, the whole fleet almost
never lost. A quick salvage avoids the shelling; a slower crew sees 2–3 shells a session.
