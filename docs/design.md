# The Last Watch: design

A 20-minute browser minigame for *To Hell and Back*. One player runs the observatory on a shared stream. The other four hold the **Operations Manual** and tell the operator what the machine is saying. When a green beacon hits Elgarz, the ice blazes blue, the game ends, and the party follows the beacon at the table.

## The goal

Find Elgarz among about 60 drifting icebergs and hit it with a **green "this is Elgarz" beacon**. There are only 6 of those, so every green shot is an accusation.

Elgarz is the only iceberg with all four signs:

| Sign | Checked with |
|---|---|
| Hollow inside | Sonar echo printout |
| Worked metal | Metal scanner (after keypad calibration) |
| The Triad on the radio | Radio tuning, gain and decoding |
| Shuns the Tomb of Levistus | It swerves away from the Tomb's 300 mi ring; anything seen inside the ring is ruled out |

Thirteen named decoys show one to three signs. Several are hollow and metal and differ only on the radio, where the lamps can look like the Triad until the manual's procedure is applied (wrong band, stepped carrier read backwards, a smooth herald that looks like a jagged Triad).

## The sea

- The map is a square drawn around the observatory's reach circle. The Last Watch stands on an island in the middle, so only the corners are out of reach. The chart grid is 12 by 12 squares (A–L, 1–12), 300 mi each.
- Two pairs of gyres drive the water. The deep pair (east and west) push a jet south past the island. The surface pair (north and south) push a jet east. Their centres wander, so ice does not ride the same ring forever. A rim current holds ice inside reach.
- Large ice rides the deep water. Small ice rides the surface and the wind. A typical iceberg crosses about four squares in a session.
- The Tomb drifts at a little under half the ice's pace.

## Seeds and spawning

Every watch has a seed (`?seed=`), shown on the intro card and top bar. With no seed a fresh sea is rolled. The seed decides the currents, the wind, the cold side of the sea, the Tomb, the ice, the radio frequencies, the storms and the keypad plate. The GM can see and set it.

At 3:00 **Elgarz slips quietly into the sea** at the rim of reach, somewhere the buoy and cameras are not looking. The game traces where each candidate rim spot would carry it (the same movement code as the live game, so the plan comes true) and only picks spots that pass through camera view at least twice before the watch ends. Two more named decoys slip in later, so a newcomer is not automatically suspicious.

## The screen

| Panel | What it does |
|---|---|
| **Cameras** | Seven fixed posts placed by `tools/tune-cameras.mjs`. Click an iceberg to lock onto it. Watching a camera heats it fast; a hot camera draws a remorhaz. Cameras cool quickly when you look away. |
| **Chart** | The whole sea with the grid, the Tomb ring, cameras, buoy, fading sonar contacts, the shark and its course, the lock's predicted position, tagged ice. |
| **Sonar** | Drop a buoy, ping, get contacts 5 s later at where they were at the ping. |
| **Currents & wind** | Wind, surface and deep current, and water temperature at the buoy. Feeds the prediction and the scanner code. |
| **Lock & beacon** | The lock, the SURFACE/DEEP drift switch, beacon colours (red/amber/blue rebuild; green has 6) and the fire button. |
| **Radio** | A long frequency slider, fine buttons and a gain slider. Lamps flash only when tuned and gained correctly; too much gain clips. |
| **Metal scanner** | A 3×3 keypad of runes. Once set, hold the alignment needle in the green on a locked target. |
| **Furnace & power** | Heat burns down; stoke it. Low heat cuts power slots; overfeeding blows it out. |

Across the top: coffee, wipers, music, lamps and bell. They swap places after you press them. The wipers clear snow during storms. The music puts three false wireless stations on the radio band.

## Why the currents matter

The machine predicts where a locked iceberg has drifted using the latest buoy reading and the drift switch. The scanner, the radio and the beacon all aim at that prediction. The deep and surface water run in different directions, so the wrong switch misses. A reading taken far from the target is wrong for the target. The prediction is never secretly wrong; it uses exactly what the players measured.

## The manual's jobs

| Page | The crew decodes |
|---|---|
| Furnace | Where the heat needle is; two shovels, never three |
| Sonar & Grindmaw | Every ping calls the shark to that spot; ping, then move the buoy |
| Echo printout | Bumps and tail shape: solid, hollow, or alive |
| Currents & beacon | Size picks DEEP or SURFACE; fresh fix, nearby reading |
| Radio | Music off test; carrier shape transforms the lamps (smooth as shown, stepped reversed, jagged swaps red and blue); band + lamps give a meaning |
| Scanner | Wind picks the first house; deep vs surface speed picks the direction round the wheel; temperature picks heaviest / lightest / second lightest from each house |
| Cameras | Heat, remorhazes, the five-rule repair board, storms |

## Hazards

- **The Grindmaw:** always on the chart. After every ping it swims slowly and relentlessly to the spot of the latest ping and eats a buoy it finds there (30 s to rebuild).
- **Remorhaz:** a camera watched for about 45 s draws one. Switch away and it gives up once the camera cools.
- **Furnace:** blowouts and brownouts switch systems off; relight and carry on.
- **Storms:** three per watch, each aimed over a camera post.

Nothing can end the game early. Every loss is recoverable.

## GM tools

`gm.html`, in a separate window on the GM's screen, shows the truth: every iceberg's identity and radio, where Elgarz is (or when it will arrive) and its planned sightings, the current scanner code, the music stations, the shark and remorhazes. Its buttons pause, refuel the furnace, repair everything, refill beacons, send the shark away, calibrate the scanner, bring Elgarz in early, force a win, reset with a chosen or new seed, and send hint notes to the operator's screen.
