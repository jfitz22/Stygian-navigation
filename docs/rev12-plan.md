# Revision 12: the officers' stations

Revision 11 gave each officer a book. Revision 12 gives each officer a **station**: their own screen, joined to the
game with the GM code, with a steady job, a triggered defence game, and a share of the Watch's fleet.

## At a glance

| | Steady job (station) | Triggered defence (every 3–7 min) | If the defence fails |
|---|---|---|---|
| **Gunnery** | The beacon workshop | Missile Command over the seven orb towers | each tower hit: that orb is destroyed |
| **Signals** | The detailed case board | Minesweeper | the buoy is destroyed (winch broken) |
| **Engineering** | The furnace log, shed order and damper | Lights Out (also when the furnace runs into the red) | lowest-priority system off, one shovel purged, lights red |
| **Everyone** | The fleet: the Watch's naval defences (Battleship), on every screen and the cabin wall | | all ships lost: devil reinforcements attack, the watch pauses for the GM |

Blue beacons are retired. Stock: **6 red, 3 orange, 3 green**; the red rack no longer refills: beacons come from the workshop.

---

## 1. Stations

- `station.html?role=gunnery|signals|engineer`. The officer types the 4-character GM code shown on the operator's
  top bar (the same code the GM uses), and picks nothing else.
- **The game is the only source of truth.** It already sends a snapshot every second over the link (same computer:
  BroadcastChannel; other computers: Supabase Realtime). Stations draw from that, and send actions back:
  build steps, fleet moves, a defence game's result, a call sign typed on the case board.
- A defence game runs **on the station**, from a seed the game sends, and reports one result. Nothing time-critical
  crosses the network mid-game.
- **Layout:** the steady job on the left, the fleet on the right. A triggered defence takes over the whole screen with
  an alarm, then hands it back.
- **Safety net:** if a station is not connected, its defence events are skipped (rescheduled) and the operator can
  still play exactly as in revision 11. The game shows which stations are connected (small lamps on the top bar).

## 2. Triggered defences

**Timing.** Each station has its own timer: the first event 3–7 minutes after the furnace is first lit, then every
3–7 minutes. Events are kept at least 45 s apart across stations, so two rarely overlap. Timers stop while the watch
is paused or the fleet is being deployed. The GM can fire any event at any time.

### Gunnery: Missile Command, "Hold the towers"
- The seven orb towers stand along the bottom, named like the real posts (GALLOWS REACH ... MIDSEA PILLAR).
- About 60 s of devil fire in waves. Click to burst flak where the cursor is; one battery, a short reload, no ammo limit.
- More fire as the watch goes on (about 8 incoming early, 14 late).
- **Every tower hit is that orb destroyed** in the main game: it needs repair and relocks, as after a remorhaz.
  A tower already down cannot be hit again.

### Signals: Minesweeper, "Clear the field"
- 8 × 8, 8 mines, **90 s**. Left click opens, right click flags. The first click is always safe and opens an area.
- **No-guess boards:** each board is checked by a small solver before it is dealt, so it can always be solved by logic.
- **Lose, or time runs out:** the buoy is destroyed and the winch breaks (no buoy in the water: the winch still breaks).

### Engineering: Lights Out, "Reset the breakers"
- 5 × 5 breaker panel, **60 s**. Pressing a breaker flips it and its four neighbours; get every breaker dark.
- Boards are made by pressing 3–5 random breakers on a dark panel, so every board is solvable in five presses or fewer.
- **Triggers:** the 3–7 minute timer, **and** the furnace heat entering the red zone (above 90), at most once a minute.
- **Fail:** the lowest-priority system switches off, one shovel is purged from the chute, and the lights go red.

## 3. The fleet (Battleship)

The Watch's naval defences, in the cabin (replacing checkers) and on every station. No Jerry: an enemy devil fleet.

- **Grid:** 8 × 8. Columns are **runes**, rows are **numbers** (flavour only, no lookups, no English letters).
- **Your fleet:** four ships, 4, 3, 3 and 2 cells. **The enemy:** the same, placed at random and hidden.
- **Deployment.** After the furnace is lit, the watch **holds** (nothing moves, no timers) while the crew drags the
  ships onto the grid; right click or R rotates. Anyone can drag; the operator's drags win a conflict. When all four
  are placed, the watch begins.
- **Firing.** On any screen: a button pad of 8 runes and 8 numbers, BACKSPACE and FIRE. Anyone can fire. The enemy
  fires back a few seconds later (it hunts around its hits, but not perfectly).
- **The 45-second rule:** if nobody fires for 45 s, the enemy takes a free shot. *(Assumed; confirm.)*
- **Enemy fleet sunk:** a new enemy fleet is placed, and your fleet resets automatically, each ship shifted a few
  squares, so play carries straight on.
- **All your ships sunk:** devil reinforcements attack. A full-screen alert on every screen, the watch pauses, and
  **only the GM can unpause**, once the fight at the table is over. Your fleet then resets as above.

## 4. The beacon workshop (Gunnery's steady job)

Each beacon is built to the design of the department that designed its parts: the recipe lives in that book.

| Beacon | Recipe lives in | Who helps |
|---|---|---|
| **Red** | Gunnery book: the shell | nobody |
| **Orange** (sounding) | Gunnery: the shell · **Engineering** book: the sounding core | Engineering |
| **Green** (transmitter) | Gunnery: the shell and the Navy's call (codebook) · **Engineering**: the core · **Signals** book: the transmitter crystal | all three |

**At the bench:**
1. **Take a casing.** It arrives stamped with a **serial** (three letters and two digits, e.g. `KTR-47`) and a
   **status lamp** (red, yellow or green). Random every build, so no recipe can be memorised.
2. **Fit the parts.** Drag them from the tray into the cutaway. Parts are told apart by eye, not by name:
   - fuse: one or two bands, red or white;
   - fins: straight, swept or split;
   - cap: brass, iron or glass;
   - orange and green also take a **sounding core** (1–4 notches; brass or rubber seal);
   - green also takes a **transmitter crystal** (3, 5 or 7 facets; clear, smoky or rose).

   Each book's recipe is a few lines keyed to the serial and the lamp. Example draft (Gunnery, red shell):
   *Fuse: digits add to an odd number = two red bands, otherwise one. Fins: a vowel in the serial = swept, otherwise
   straight. Cap: iron if the lamp is red, otherwise brass.* The final rules are written with the books and tested
   so every part comes up.
3. **Pack the charge.** The charge chamber is a small grid; drag the charge blocks in until they fill it exactly
   (right click or R rotates). Each puzzle is made by cutting a filled chamber into pieces and scrambling them, so it
   always has a solution. Red: 4 × 4 in 4 pieces · orange: 5 × 4 in 5 · green: 5 × 5 in 6.
4. **SEAL.** A wrong part pops back out of its slot; fix it and seal again.
5. **Cure.** The sealed beacon sits in the rack until the operator has the **WORKSHOP** switch on for about 15 s.
   Curing pauses if the power drops. Then it joins the launcher's stock.

The WORKSHOP switch is a seventh power system: still only three on at once.

## 5. The other steady jobs

- **Signals: the detailed case board.** Every row of the operator's board, larger: the echo printout, length, last
  seen square, metal, and for the radio the lamps as shown, the wave shape and the band. Signals types the **call
  sign** they decoded into the row; the operator's board shows it. Signals can also set verdicts and pin rows; changes
  show on both boards.
- **Engineering: the furnace.** The furnace log, the shed order and the damper, as in the cabin. Changes from either
  screen apply to both.

## 6. Changes to the main game

- Blue beacons removed (stock, launcher colours, payload logic, drift log, case board, GM, tests).
- Stock 6 red / 3 orange / 3 green; no red refill. The launcher shows the workshop's rack and what is curing.
- New power system: **WORKSHOP**.
- The **fleet deployment hold** at the start of the watch.
- The cabin: checkers replaced by the fleet board. Jerry's "your move" note goes.
- Defence event scheduler, results applied to the world (orbs destroyed, buoy lost, the Engineering penalty).
- Overheat (heat above 90) as an Engineering trigger.
- Lamps on the top bar for which stations are connected.

## 7. The books

- **Orientation:** the flow table gains the workshop and the fleet; the breakdowns page lists the defence events;
  blue removed from the beacon colours.
- **Gunnery:** the workshop page (the bench, the red shell recipe, the call for green), the defence page.
- **Engineering:** the sounding core recipe, the Lights Out page and its penalty.
- **Signals:** the transmitter crystal recipe, the Minesweeper page and its penalty.
- Still checked to fit US Letter, and still written as the Navy's manual.

## 8. GM page

- Buttons to fire each station's defence, and to unpause after reinforcements.
- Which stations are connected; each one's next event time.
- Workshop stock and anything curing.
- Both fleets, with the enemy's ships visible to the GM.

## 9. Tests

- Every Lights Out board is solvable; every Minesweeper board is solvable without guessing; every packing puzzle is
  solvable; every workshop recipe part comes up across serials.
- Event outcomes apply correctly (towers to orbs, buoy, Engineering penalty), and skipped stations do not fail.
- Fleet: deployment hold, auto-reset with a shift, reinforcements pause, the 45-second rule.
- Stock and curing; blue fully gone; save and resume still exact.

## 10. Build order (each step leaves the game playable)

1. The station shell and the link: three roles join with the code and see live data; connection lamps.
2. Blue removed, the new stock, WORKSHOP power, the workshop (parts, packing, curing).
3. The defence scheduler, then Lights Out, Minesweeper, Missile Command.
4. The fleet: deployment hold, firing pad, enemy, reset, reinforcements.
5. The Signals case board and the Engineering furnace screen.
6. The books and the GM page.

If Saturday gets close, steps 5 and the fancier parts of step 6 can slip; steps 1–4 are the revision.

## Stretch

- **Chess with Jerry**, on the cabin wall and every station, after the rest has been played.

## To confirm

1. The 45-second rule: the enemy takes a free shot?
2. Does winning a defence game give anything, or is not losing the reward?
