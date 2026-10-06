# Revisions 11 + 12: roles, books and stations (living plan)

One page that holds what is decided and what is still open, so the planning doesn't sprawl.
Decided items move here; open items are taken one at a time.

## Decided

### Structure
- Three manual holders: **Engineer**, **Gunnery**, **Signals**. One operator on the main screen.
- Each phase of the flow has a lead (with the operator) who needs one piece from another role.
- Every book opens with the same **orientation** section: situation and flowchart, who leads what, a map of the control board,
  general information (hit chance, hunters and monsters, shoals, storms, remorhaz), the hazard table, the password rules,
  the sieve (what Elgarz looks like).
- The first-edition manual (A4) is retired. Books are US Letter, print-ready.
- Password: no word lists in the books (players know them). Rules list only, in the orientation. The password system stays
  as it is for now; it will be redone later.

### Roles
- **Engineer**: rune board grid and page shift, metal scanner calibration, the furnace projection (station), repairs to
  the furnace grate, radio receiver and metal scanner (it sometimes blows a fuse right after a positive reading: the reading still counts, then it needs repairing).
- **Gunnery**: orbs (unlock and use), fires every beacon, builds beacons, translates radio call signs (codebook),
  repairs to the launcher and orbs.
- **Signals**: the Rune Keeper (glyph ↔ house and weight), sonar and buoy, echoes (cold water as a short risk note),
  decodes the radio pattern into a call sign, keeps the detailed case board, repairs to the buoy winch and the sonar head (overdriven by 3 pings within about 20 s).

### Repairs
- One repair bay. A broken machine shows rows of conduits; each row has **3 status lights** (red, yellow, green),
  a **gauge reading** (a number, not a dial) and a **3-character fault code**. Each row is set OPEN, CLOSED or CUT.
- **Each role has its own first-match flowchart**, applied to the machines they own. Signals cares most about the code
  and light order (gauge only high or low); Gunnery about the gauge value (lights only counted); Engineer about bands and counts.
- Every board, for every department, needs at least one CLOSE and one CUT.
- Wrong: sparks, wrong rows reset, 4 s lockout. Then the crew works.
- The repair bay is a powered system; **furnace repairs are done by hand** (no power), so there is no deadlock.
- The furnace can still break (overstoking to the top).

### Orbs
- Locked orbs: view, lock on, length. Ice under 20 miles shows its length **in red** (no "NOT ELGARZ").
- **Unlocking earns:** turning, **tracking** (drift), **zoom**, and the orb heats more slowly.
- A tracking orb turns by itself to follow its ice **only while you are watching that orb**. No tracking in the background.
- An orb **relocks** whenever it breaks or is repaired.
- Unlock: WIND and TEMP levers from the orb's weather (Gunnery), plus three plates in the order for the **house of the rune on the orb's housing** (Signals names the house). The housing rune is new every time the orb relocks.

### Power and furnace
- Each running system costs heat; the fire goes out when heat runs out.
- The Engineer **drags the systems into a priority ranking**. When heat gets low, the lowest-ranked system shuts off, with a loud warning.
- A simple **damper**: NORMAL, or LOW (burns slower, but tasks take longer to update).
- Seven switches (orbs, sonar, radio, scanner, currents, workshop, repair bay), at most three on.
- **No silent brownout.**
- **Engineer's station:** furnace heat as numbers, and a graph: the last 3 minutes of heat, and a projection for the next
  3 minutes (solid line for the systems on now, dotted lines for 1, 2 and 3 systems), showing when the fire goes out.
- The operator keeps just the switches and the green/red indicators.

### Radio
- The operator tunes in. The signal gives a pattern, Signals decodes it into a call sign, Gunnery translates the call sign.

### Case board
- The operator's case board shows as much as it can.
- Signals' station shows it blown up, and lets them manage it (verdicts, notes, pins), synced both ways.
- Per row: number, position and time last seen, size, a copy of the echo trace, the metal result, and for the radio a
  **sketch of the wave shape and the light colours** recorded automatically. Decoding stays by hand: Signals enters the call sign.

### Beacons
- Starting stock: **6 red, 3 orange, 3 blue, 3 green**. The red rack no longer refills by itself.
- The **workshop** (Gunnery station) builds any colour; the non-red recipes are harder.
- Gunnery assembles a beacon, then it needs **power for about 15 s** to finish.

### Breakage and tuning
- **Stygia is much colder:** water roughly -250° to -125°. Every temperature threshold (cold water, scanner bands, orb TEMP lever) scales with it, so the game plays the same.
- Launcher jams every few shots (unchanged).
- The buoy is lost if it's left inside a storm for a while, or if a monster reaches it.
- Fatigue reaches logout in about **5 minutes** (was 7).
- The GM can break anything.

### Station games
- Gunnery: the workshop (steady), plus a defence game (Asteroids or Missile Command).
- Signals: **not decided yet** (revision 12).
- **Checkers vs. Jerry** sits on the operator screen, behind a new LOOK LEFT view.

## Open (one at a time)
1. **Repairs:** write the three flowcharts (7 rules + default each).
2. **Furnace numbers:** heat cost per system, LOW damper rates, the warning threshold.
4. **The Engineer's station game** (now that checkers is on the operator screen).
5. **Workshop recipes:** what makes a red, and what makes the harder ones.
6. **Radio tuning load:** should gain and band move to the Engineer's book.
7. **Fewer, better ice candidates** (later).

## Future (after Saturday)
- Magic items frozen in a few glaciers: hit them with a green or blue beacon and the party gets the item after the session.

## Status (2026-10-06)
Revision 11 built on branch `revision-11`: the three books (`books.html`), the repair rework with three flowcharts,
the new breakdowns, the REPAIR switch, the furnace model with shed order and damper, the cabin (furnace log and
Jerry's checkers), the orb changes, the colder sea, fatigue at six minutes, GM break buttons.
Left for revision 12: the station screens, the beacon workshop (and 6/3/3/3 with no refill), the Signals station
game, the Engineer's station game.
