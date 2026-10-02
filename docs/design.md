# The Last Watch: design

A 20-minute browser minigame for *To Hell and Back*. One player runs the observatory on a shared stream. The other four hold the **Operations Manual** and tell the operator what the machine is saying. When a green beacon hits Elgarz, the ice blazes blue, the game ends, and the party follows the beacon at the table.

## The goal

Find Elgarz among about 60 drifting icebergs and hit it with a **green "this is Elgarz" beacon**. There are only 6, so every green shot is an accusation.

Elgarz is the only iceberg with all four signs, and **no single sign is proof**:

| Sign | Checked with | Who else has it |
|---|---|---|
| Hollow inside | Sonar echo printout | several named decoys |
| Worked metal | Metal scanner (after keypad calibration) | named decoys and some plain ice with wreckage |
| The Triad on the radio | Radio tuning, gain and decoding | 3 named decoys and 2 plain bergs, plus one cabin wireless station |
| Never near the Tomb of Levistus | Anything inside the Tomb's 300 mi ring is not Elgarz | The Gilded Hulk has the other three signs but slowly circles the Tomb, always inside the ring |

About a third of all ice rings hollow (ice caves), about half transmits something, and at least a dozen icebergs per seed show metal or the Triad. The easy echo test can't rule out the field on its own.

## The sea

- The map is a square drawn around the observatory's reach circle, with the Last Watch on an island in the middle. The chart grid is 12 by 12 squares (A–L, 1–12), 300 mi each.
- Two pairs of wandering gyres drive the water. The deep pair (east and west) push a jet south past the island; the surface pair (north and south) push a jet east. A rim current holds ice inside reach.
- Large ice rides the deep water. Small ice rides the surface and the wind. A typical iceberg crosses about 5.5 squares a watch, and the Tomb about 4.
- The wind veers through well over 100° in a watch, and the water temperature drifts. This keeps the scanner setting changing.

## Seeds and spawning

Every watch has a seed (`?seed=`). With no seed a fresh sea is rolled. At 3:00 Elgarz slips in at the rim of reach, somewhere the buoy and cameras aren't looking. The spot is chosen by tracing candidate routes with the live movement code, keeping only ones that pass through camera view at least twice. The GM can override this by placing Elgarz anywhere.

## The cockpit

The operator has two views and pans between them with **▲ LOOK UP / ▼ LOOK DOWN**, side by side on the top bar next to **❚❚ PAUSE** (the operator or the GM can pause; a card shows until someone resumes). When looking up, the top half of the main board is still visible below the deck.

**Main board:** cameras with camera control right underneath, chart, sonar, currents and weather, furnace, the target lock (drift switch and aim quality) and scanner.

**Camera control:** each camera feed shows its post's WIND and AIR temperature. Set two focus levers from those and press three servo plates in the order the rune board page dictates; that camera then stays unlocked (free turning, no heat) until a remorhaz destroys it.

**Overhead deck:**
- **Beacon launcher:** colour, fire, aim quality and a shot report.
- **Radio:** tune and decode the locked iceberg.
- **Rune board:** a KTANE-style flip calendar of 12 unlabelled runes.
- **Wire service:** a ticker with the weather, storms, shark, board timer, breakdowns and GM messages.
- **Repair bay.** (Its lower half is reserved for a future tracking board.)

## The case board

On the main board beside the chart (the metal scanner moved up to the deck). Locking ice gives it a temporary row; a beacon hit pins it. Columns: number, last-seen square (odometer), HOLLOW T/F (with a tiny echo trace), METAL T/F, RADIO (the lamps as shown, frequency, band, wave shape, and SWEPT once the whole band has been searched), and a verdict (? / SUSPECT / EXCLUDED, undoable; excluded rows are stamped, struck through, sink to the bottom and their beacons dim). Readings fill in automatically; the crew still decodes them. Clicking a row re-locks the ice (live if beaconed, otherwise from where it was last seen).

## Onboarding and atmosphere

- The wire service starts as a startup checklist (brew coffee, fill the fuel chute, power the sonar, drop a buoy, power the scrying orbs) that ticks itself off, then becomes the ticker.
- Jerry, the previous operator, left handwritten sticky notes next to the systems; the GM can stick up more.
- After ten minutes storms come more often (and keep coming for as long as the watch runs) and Old Tom wakes: a second hunter that swims to the last buoy splashdown, eats a buoy there, then circles the Watch the opposite way to the Grindmaw.
- The cameras are Scrying Orbs.
- Ending: the chart becomes a feed of Geryon's silhouette ("My humble servants. Through persistence, you have found me. My gates await thee."), then a sonar section of the keep inside the glacier, then ELGARZ IDENTIFIED · CONNECTION ESTABLISHED. Placeholder art for the later art pass.

## Mechanics

- **Camera tracking.** Locked ice that stays in the camera on screen for 4 s has its real drift measured; the prediction then uses it instead of the buoy and the drift switch. Aim quality shows a CAMERA TRACK bar.
- **Aiming.** A beacon flies to the predicted position: last fix + buoy current reading + drift switch. Aim quality (0–100%, with a lamp) is built from fix age, reading age and how far the reading was taken from the target. It can't see whether the drift switch is wrong. Every miss reports the distance and the reasons, and the chart draws a line from the splash to where the target really was. Camera fixes are accurate to 1–3 mi.
- **Rune board.** Each rune's house and weight index a 4×4 grid of functions. The page numeral on the flip card shifts the weight. The board flips every 60 s and after 4 presses.
  - Functions: FUEL, COFFEE (costs heat), WIPERS, WIRELESS, LAMPS (normal / night / red), LAUNCH (red, amber or blue only), VENT, BELL, NOTHING.
- **Furnace.** Stoking draws from a fuel chute (4 shovels) that only the FUEL rune fills. Low heat cuts power slots. Overfeeding blows the furnace out and cracks the grate.
- **Fatigue.** Over about 7 minutes the screens vignette, blur and sway, and the operator blinks off. Coffee (brew, then click the mug) clears it.
- **Scanner.** A 3×3 rune keypad. Wind picks the first house, deep vs surface speed picks the direction round the wheel, and temperature picks heaviest, lightest or second lightest. The setting drifts out of tune once the buoy's conditions have disagreed with it for 50 s, about 3–5 times a watch.
- **Radio.** A long slider with a wide, forgiving peak, plus gain matching. Carrier shape transforms the lamps, and band plus lamps give the meaning. The wireless adds three false stations. Clipping for 12 s blows the fuse; a FUSE bar flashes from halfway.
- **Grindmaw.** Always on the chart. After every ping it swims for the ping spot: fast (9 mi/s) when more than 1.5 squares away, steady (3.5 mi/s) when close. If it finds the buoy there, it eats it and tears the winch; either way it then circles the Watch at that distance until the next ping.
- **Breakdowns.** Every breakdown goes through the same repair board: five rows, each a gauge (low/middle/high/red) and a lamp (red/white/blue/dark); rules say what to CLOSE or CUT, otherwise leave it OPEN; every board has at least one CUT and one CLOSE:
  - cameras (remorhazes, now faster)
  - the furnace grate (blowout)
  - the launcher (jams every 4–7 shots)
  - the winch (shark)
  - the radio fuse (clipping)
- **Sonar.** Contacts last 90 s, and successive pings of the same ice are joined by a trail. Each echo draws deep and surface current arrows round the buoy for 25 s.
- **Storms.** Five per watch, each aimed over a camera. The GM can drop more.
- **Cameras.** Seven, evenly spaced round the island, 680 mi range and 90° wide. Their starting bearings come from `tools/tune-cameras.mjs`.

Nothing can end the game early. Every loss is recoverable.

## GM tools

`gm.html`, in a separate window, shows the truth: identities, radios (Triad singers starred), where Elgarz is or when it arrives, its planned sightings, the scanner code, the rune board's current functions, breakdowns, fatigue and the music stations.

Controls:
- **Click-the-map tools:** place or move Elgarz, drop a storm, send the shark.
- **Buttons:** pause, refuel (fills the chute and fixes the grate), repair everything, refill beacons, send the shark away, calibrate, bring Elgarz in now, force a win, clear storms, flip the rune board, fresh coffee, reset with a chosen or new seed.
- **Levers (multipliers):** world drift, Tomb speed, Elgarz speed, Grindmaw speed, furnace burn, remorhaz aggression, beacon forgiveness, fatigue rate.
- **Messages:** sent either as pneumatic notes, which rotate round the chart's four corners, or as wire service ticker lines.
