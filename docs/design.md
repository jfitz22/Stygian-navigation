# The Last Watch: design

A 20-minute browser minigame for *To Hell and Back*. One player runs the observatory on a shared stream. The other four hold the **Operations Manual** and tell the operator what the machine is saying. When a green beacon hits Elgarz, the ice blazes blue, the game ends, and the party follows the beacon at the table.

## The goal

Find Elgarz among about 60 drifting icebergs and hit it with a **green "this is Elgarz" beacon**. There are only 4, so every green shot is an accusation.

**Beacons:** red (plain, a rebuilding rack of 12), orange sounding charge (prints the echo on impact, without a ping; 6), blue drift log (records the ice's path, shown faintly while that ice is selected; 6), green accusation (4). Every hit pins the ice to the case board.

**Instrument roles:** sonar echo needs the buoy (or an orange charge); the **radio only hears ice carrying a beacon**; the **metal scanner rides on the buoy** and only scans ice inside the buoy's range; aiming uses buoy currents or an orb track.

Elgarz is the only iceberg with all four signs, and **no single sign is proof**:

| Sign | Checked with | Who else has it |
|---|---|---|
| A HALLS echo (even bumps, flat tail) | Sonar echo printout | 9 other large floes, plus frozen monsters in cold water |
| Worked metal | Metal scanner (after keypad calibration) | named decoys and some plain ice with wreckage |
| The Triad on the radio | Radio tuning, gain and decoding | 3 named decoys and 2 plain bergs, plus one cabin wireless station |
| Never near the Tomb of Levistus | Anything inside the Tomb's 300 mi ring is not Elgarz | The Gilded Hulk has the other three signs but slowly circles the Tomb, always inside the ring |

A quarter of the large ice reads HALLS, about half of all ice transmits something, and over twenty icebergs per seed show metal or the Triad. The echo narrows the field; it can't close it.

## The ice

60 floes: 20 small (20 miles or under: not Elgarz, crossed off by length) and 40 large. Every floe has an **echo class**:

| Class | Printout | Large floes |
|---|---|---|
| Solid | no bumps, flat tail | 15 |
| Caverns | uneven bumps, flat tail | 6 |
| Flooded | bumps, steady wavy tail | 4 |
| Frozen monster | even bumps, pulsing tail (double beats that swell and fade sweep to sweep) | 5 |
| Halls | even bumps, flat tail | 10: 3 plain, 2 metal, 3 Triad, 2 with everything (Elgarz and the Gilded Hulk, which circles inside the Tomb's ring) |

**Cold-water twist:** below -40° (printed on the strip, the water at the ice when it was pinged) a monster is too cold to pulse and reads exactly like Halls. Two monsters carry metal or the Triad, so a cold "Halls" with one sign can still be a monster.

**One ping does it.** Every contact comes back with its full printout; the operator clicks through them. The printout is a live trace that sweeps every 2.5 s; the monster's pulse changes size between sweeps, so it has to be watched. Each ping also takes a current reading (Currents powered), as does the buoy as it lands.

**Frozen monsters:** any beacon hit lets one out. It swims for the buoy at the Grindmaw's two speeds (the Grindmaw lever scales it too), eats the buoy if it reaches it, and fades if the buoy is moved a full buoy radius from where it was when the monster woke (or if there's no buoy for 20 s). The ice it leaves reads as caverns.

One named field, **the Graveyard** (five large floes of mixed classes), starts loosely together, 120–300 mi from its centre, and spreads with the current. Four **shoals** beside orbs scatter the sonar: ice inside them only shows on the orbs.

## The sea

- The map is a square drawn around the observatory's reach circle, with the Last Watch on an island in the middle. The chart grid is 12 by 12 squares (A–L, 1–12), 300 mi each.
- Two pairs of wandering gyres drive the water. The deep pair (east and west) push a jet south past the island; the surface pair (north and south) push a jet east. A rim current holds ice inside reach.
- Large ice rides the deep water. Small ice rides the surface and the wind. A typical iceberg crosses about 5.5 squares a watch, and the Tomb about 4.
- The wind veers through well over 100° in a watch, and the water temperature drifts. This keeps the scanner setting changing.
- Stygia is cold: the water runs from about −125° to −250° (colder towards the Tomb and as the night goes on). Every threshold (the cold-water monster rule at −185°, the scanner bands, the orb TEMP lever) sits in that range.

## Seeds and spawning

Every watch has a seed (`?seed=`). With no seed a fresh sea is rolled. At 3:00 Elgarz slips in at the rim of reach, somewhere the buoy and cameras aren't looking. The spot is chosen by tracing candidate routes with the live movement code, keeping only ones that pass through camera view at least twice. The GM can override this by placing Elgarz anywhere.

## The crew and the three books

Three officers each hold one book (`books.html?book=engineer|gunnery|signals`, `?book=all` for the GM). Every book opens with the same orientation pages (the flow and who leads each step, the sieve and cockpit, the sea, breakdowns and the password rules, the case board); then each holds only its own officer's pages. Each step of the flow has a lead who needs one piece from another book:
- **Engineering & Power:** the furnace, the furnace log and shed order, the rune board grid and page shift, the scanner procedure, radio tuning (frequency, gain, band), and its repair flowchart (grate, receiver, scanner).
- **Gunnery & Targeting:** the orbs (lever chart, plate order by housing-rune house), aiming and beacons, the codebook (call sign + band → meaning), and its repair flowchart (launcher, orbs).
- **Signals & Sonar:** the rune catalogue (asked for by both other books), sonar and echoes, decoding the radio lamps into a call sign, and its repair flowchart (winch, sonar head).

## The cockpit

The operator has three views and pans between them with **◀ LOOK LEFT / ▲ LOOK UP / ▼ LOOK DOWN** on the top bar next to **❚❚ PAUSE** (the operator or the GM can pause; a card shows until someone resumes). When looking up, the top half of the main board is still visible below the deck.

**Main board:** cameras with camera control and the furnace down the left; the chart and target lock in the middle; down the right, the case board (top, largest text), the sonar, and currents and weather.

**Orb control:** each orb feed shows its post's WIND and AIR temperature, and a rune is carved on its housing. Set two focus levers from the weather and press three servo plates in the order for the housing rune's house. A locked orb can still lock ice and show its length (red at 20 mi or under). An unlocked orb turns, zooms ×2, tracks drift, follows its tracked ice while watched, and heats more slowly. It relocks when it breaks; a repaired orb has a new housing rune.

**The cabin (look left):** the furnace log (heat in numbers, the last three minutes, the next three as a solid line for what is on now and dotted lines for 1, 2 and 3 systems), the shed order (drag to rank the systems; the lowest goes first, with an alarm), the damper (NORMAL or LOW: LOW burns at 60% but everything powered works 1.6× slower), and checkers with Jerry. Jerry replies a few seconds after your move (more than half his moves are careless); leave him waiting 60 s and he presses a nuisance rune.

**Overhead deck:**
- **Beacon launcher:** colour, fire, aim quality and a shot report.
- **Radio:** tune and decode the locked iceberg.
- **Rune board:** a KTANE-style flip calendar of 12 unlabelled runes.
- **Wire service:** a ticker with the weather, storms, shark, board timer, breakdowns and GM messages.
- **Repair bay.** (Its lower half is reserved for a future tracking board.)

## The case board

Top right of the main board. Locking ice gives it a temporary row; a beacon hit pins it. Columns: number and length, last-seen square (odometer), ECHO (a small copy of the printout as pinged, with the water temperature then; the class is not named), METAL T/F, RADIO (the lamps as shown, frequency, band, wave shape, and SWEPT once the whole band has been searched), and a verdict (? / SUSPECT / EXCLUDED, undoable; excluded rows are stamped, struck through, sink to the bottom and their beacons dim). Readings fill in automatically; the crew still decodes them. Clicking a row re-locks the ice (live if beaconed, otherwise from where it was last seen).

## Onboarding and atmosphere

- The wire service starts as a startup checklist (brew coffee, fill the fuel chute, power the sonar, drop a buoy, power the scrying orbs) that ticks itself off, then becomes the ticker.
- Jerry, the previous operator, left handwritten sticky notes next to the systems; the GM can stick up more.
- After ten minutes storms come more often (and keep coming for as long as the watch runs) and Old Tom wakes: a second hunter that swims to the last buoy splashdown, eats a buoy there, then circles the Watch the opposite way to the Grindmaw.
- The cameras are Scrying Orbs.
- Ending: the chart becomes a feed of Geryon's silhouette ("My humble servants. Through persistence, you have found me. My gates await thee."), then a sonar section of the keep inside the glacier, then ELGARZ IDENTIFIED · CONNECTION ESTABLISHED. Placeholder art for the later art pass.

## Mechanics

- **Orb tracking.** Locked ice that stays in an unlocked orb on screen for 4 s has its real drift measured; the prediction then uses that. The tracking box also shows the ice's size, in red at 20 mi or under.
- **Beacon telemetry.** Ice that already carries a beacon reports its own position and drift, so a lock on it has a 100% hit chance. The second shot at known ice (orange, blue, green) is never an aiming problem.
- **Aiming: an honest hit chance, then a roll.** There is no drift switch: the prediction uses the deep current for ice over 8 miles and the surface current plus wind for smaller ice. At fire time the game estimates the expected miss distance, sigma = fix error + ice speed × model error × (fix age + flight time), where the model error comes from the source (orb track 3%, a fresh nearby current reading 2.5%, much worse for a reading far from the ice or stale, 100% with no reading) and grows with the time since the fix. The chance is 1 − exp(−R² / 2σ²) against a generous hit radius (14 + 0.6 × length mi), capped at 99% (100% only for beacon telemetry). The shot rolls against exactly that number, and the flight is drawn to match: a hit lands on the ice, a miss splashes just beyond the radius. The drift-speed lever lowers the chance (faster ice), the beacon-forgiveness lever raises it (bigger radius). Over 285 test shots the stated and actual hit rates agree within two points. One plain line under the number says what is wrong when it is low.
- **Rune board.** Each rune's house and weight index a 4×4 grid of functions. The page numeral on the flip card shifts the weight. The board flips every 60 s and after 4 presses.
  - Grid (house × weight): Ice COFFEE · SUCCUBUS · COOLANT · CONFETTI; Iron FUEL · SHUTTER · LAUNCH · DEVIL; Ember COFFEE · PURGE · ALARM · LIGHTS; Bone DECOY · LOCKDOWN · RADIO · FUEL. Two FUELs and two COFFEEs in different houses; every board dealt has at least one of each. COFFEE's Ember neighbours are consequences, so miscounting the page shift there costs something.
  - Effects: FUEL (a shovel in the chute), COFFEE (a pot, costs heat), COOLANT (every orb cold, burrowers give up), DECOY (a noisemaker 1.5 buoy ranges from the buoy, to the side of the Grindmaw's approach; it chases that), LAUNCH (red beacon now; wild if nothing is locked), PURGE (empties the chute), SHUTTER (steel shutters over the sonar and orbs for 20 s), LOCKDOWN (the password lock, and a new password), LIGHTS (normal → red → green → normal), RADIO (the cabin radio: a procedural lo-fi loop, and three false stations on the band), ALARM, CONFETTI, DEVIL (top hat, five seconds, every screen), SUCCUBUS (a 4.5 s animated cameo: a purple succubus in a white halter dress billowing over a glowing grate, Marilyn-style, with a heart that beats beside her and pops as she goes; on the orb feed and over the rune board, which she blocks while she is there).
- **Furnace.** Stoking draws from a fuel chute (4 shovels) that only the FUEL rune fills. It burns 0.03 a second, plus 0.07, 0.11 and 0.16 for the first, second and third system running (0.10, 0.21, 0.37): three systems lose a slot about a minute after lighting. Stoking still works while the password lock is up. Low heat cuts power slots, shedding the lowest-ranked system with an alarm. Overfeeding blows the furnace out and cracks the grate. Six systems share three slots: ORBS, SONAR, RADIO, SCANNER, CURRENTS and REPAIR.
- **Fatigue.** Over about 6 minutes the screens vignette, blur and sway, and the operator blinks off. Coffee (brew, then click the mug) clears it.
- **Scanner.** A 3×3 rune keypad. Wind picks the first house, deep vs surface speed picks the direction round the wheel, and temperature picks heaviest, lightest or second lightest. The setting drifts out of tune once the buoy's conditions have disagreed with it for 50 s, about 3–5 times a watch.
- **Radio.** A long slider with a wide, forgiving peak, plus gain matching. Carrier shape transforms the lamps into a call sign, and call sign plus band give the meaning. The wireless adds three false stations. Clipping for 12 s burns out the receiver; a FUSE bar flashes from halfway.
- **Grindmaw.** Always on the chart. After every ping it swims for the ping spot: fast (9 mi/s) when more than 1.5 squares away, steady (3.5 mi/s) when close. If it finds the buoy there, it eats it and tears the winch; either way it then circles the Watch at that distance until the next ping.
- **Breakdowns.** Every breakdown shows the same repair board: four rows, each with three lights (red/yellow/green, left to right), a gauge (0–99) and a fault code (letter, digit, letter). Each row is set OPEN, CLOSE or CUT by the first matching rule in the **owner's** flowchart (seven rules each, in `src/repair.js`); every board needs at least one CLOSE and one CUT. Signals reads the order of the lights and the code (gauge only high or low); Gunnery reads the exact gauge (lights only counted); Engineering reads gauge bands and light counts. The crew needs the REPAIR switch on, except at the grate (mended by hand); a repair waits while the power is off.
  - Engineering: the furnace grate (blowout), the radio receiver (clipping), the metal scanner (about one positive reading in three blows its fuse; the reading still counts)
  - Signals: the buoy winch (a hunter or monster eats the buoy, or it sits 20 s inside a storm), the sonar head (three pings inside 20 s; a HEAD STRAIN gauge shows it)
  - Gunnery: the launcher (jams every 4–7 shots), the orbs (remorhazes)
  - The GM can break any of them.
- **Sonar.** Contacts last 90 s, and successive pings of the same ice are joined by a trail. Each echo draws deep and surface current arrows round the buoy for 25 s.
- **Storms.** Five per watch, each aimed over a camera. The GM can drop more.
- **Cameras.** Seven, evenly spaced round the island, 680 mi range and 90° wide. Their starting bearings come from `tools/tune-cameras.mjs`.

Nothing can end the game early. Every loss is recoverable.

## The password lock
One lock, several triggers. While it is up, a terminal replaces the chart, and the furnace panel and launcher show LOCKED; the sea keeps moving.
- **Asks for the password:** firing green (then it fires), relighting the furnace (then it lights), the operator nodding off at full fatigue (logs back in at 0.7), the GM.
- **Changes it:** the LOCKDOWN rune. It shows "PASSWORD SECURITY UPDATE REQUIRED", with the rules in force listed from the start. The rules rise by one each time: 3, 4, 5, 6, 7, 8. No password yet: any trigger asks to set one.
- **Rules, in order:** includes JERRY; an uppercase letter and a special character; a layer of Hell with its Roman numeral in capitals; its own length; a deadly sin; an archdevil; digits adding to 42; the rune board page in capitals (any page shown while the lock is open). The terminal lists every rule in force and ticks them as you type. Checks are lenient (words found anywhere, any capitals) so a correct password is never refused; only keyboard characters are allowed; ends are trimmed; unlocking is an exact match.
- **Five wrong tries reboot the system:** furnace out, chute empty, all systems off, one or two of the grate, launcher, winch and fuse broken. Beacons, the case board and the chart stay. Then a fresh password under the same rules.
- **GM:** sees the password; buttons to ask for it, force a lockdown, or unlock outright.

## Operator comforts
- **Refresh survival.** The world (random generators included) autosaves to the browser every 5 s once the watch starts; a reload offers RESUME WATCH or NEW WATCH. A resumed watch carries on exactly as it would have.
- **Message log.** LOG on the chart lists the last ten toasts with their times.
- **Keys.** Space ping, 1–7 orbs, ↑/↓ look, L the cabin, ←/→ turn the orb, P pause, M mute.
- **Launcher refill bar.** Under the beacon rack: time to the next red beacon.
- **Chart hover.** Hovering a contact shows a small label with its number and length.

## GM tools

`gm.html`, in a separate window, shows the truth: identities, radios (Triad singers starred), where Elgarz is or when it arrives, its planned sightings, the scanner code, the rune board's current functions, breakdowns, fatigue and the music stations.

Controls:
- **Click-the-map tools:** place or move Elgarz, drop a storm, send the Grindmaw or Old Tom. **Drag any ice** to move it; it moves when released. The map zooms out to 60%.
- **Buttons:** pause, refuel (fills the chute and fixes the grate), repair everything, refill beacons, send the shark away, calibrate, bring Elgarz in now, force a win, clear storms, flip the rune board, fresh coffee, reset with a chosen or new seed.
- **Levers (multipliers):** world drift, Tomb speed, Elgarz speed, Grindmaw speed (0.5–3×, also frozen monsters), furnace burn, remorhaz aggression, beacon forgiveness, fatigue rate. Narrow ranges in 0.05 steps, full-width sliders; double-click a name to reset it to 1×.
- **Rune effects:** a button for every rune function, plus lights back to normal and raise the shutters.
- **Break something:** a button for every machine (and the orb on screen), and the damper.
- **Password lock:** ask for it, force a lockdown, unlock now; the truth view shows the current password and how many rules are in force.
- **Messages:** sent either as pneumatic notes, which rotate round the chart's four corners, or as wire service ticker lines.
