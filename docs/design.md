# The Last Watch: design

A 20-minute browser minigame for *To Hell and Back*. One player runs the observatory on a shared stream. The other four hold the **Operations Manual** and tell the operator what the machine is saying. When a beacon hits Elgarz, the game ends and the party follows the beacon at the table.

## The goal

Find Elgarz among ~65 drifting icebergs and hit it with a beacon.

Elgarz is the only iceberg with all four signs:

| Sign | Checked with |
|---|---|
| Hollow inside | Sonar echo printout |
| Worked metal | Metal scanner (after rune calibration) |
| The Triad on the radio | Radio tuning plus the lamp code |
| Never within 1,000 miles of the Tomb of Levistus | The dashed ring on the chart |

About 25 icebergs drift into the Tomb's ring at some point, so the crew can rule them out and tag them. Eight more icebergs show one or two signs to mislead them.

## The screen

One 16:9 screen with eight panels:

| Panel | What it does |
|---|---|
| **Cameras** | Five fixed posts on the map. Each shows a live view of the ice drifting past. Click an iceberg to lock onto it. Watching a camera heats it, and a hot camera draws a remorhaz that you can see crawling toward the lens. |
| **Chart** | The shared map: Tomb ring, cameras, buoy, sonar contacts that fade, the shark, the predicted position of your lock, tagged icebergs in colour. |
| **Sonar** | Drop a buoy, ping, and get contacts 6 seconds later at the position they had when you pinged. Three pings in one area within two minutes bring the shark, which eats the buoy. |
| **Currents & wind** | Measured at the buoy. Feeds the prediction. |
| **Lock & beacon** | Shows the lock, the SURFACE/DEEP drift switch, beacon colours and the fire button. |
| **Radio** | Tune to the locked target until the signal peaks, then read three lamps. |
| **Metal scanner** | Calibrate with the rune keypad, then hold alignment to finish a scan. |
| **Furnace & power** | Five systems, three can run at once. |

Across the top: coffee, wipers, music, lamps and bell. The buttons swap places after you press them. The wipers also clear snow off a camera during storms.

## Why the currents matter

Large icebergs ride the deep current. Small ones ride the surface current and the wind. The machine predicts where a locked iceberg has drifted using the latest current reading and the drift switch. The scanner, the radio and the beacon all aim at that prediction.

- A stale fix, a reading taken far from the target, or the wrong drift setting makes the prediction wander off. The scanner needle drops, the radio fades and the beacon misses.
- A fresh ping, a buoy near the target and the right setting give a hit.

The prediction is never secretly wrong. It uses exactly what the players measured.

## The manual's jobs

| Page | The crew decodes |
|---|---|
| Echo printout | Bumps and tail shape: solid, hollow, or alive |
| Size | Over 8 miles long means DEEP |
| Radio | Lamp colours plus frequency band give a meaning; only Elgarz gives "The Triad" |
| Runes | Wind direction picks the leading house, then go round the wheel by weight |
| Repair board | Five conduit rules for a camera a remorhaz destroyed |
| Hazards | The shark's three-ping rule; camera heat and "ground shaking" |

## Pacing (tested automatically)

| Watch time | What happens |
|---|---|
| 0:00 to 3:30 | Learn the machine on nearby ice. Elgarz is out of reach. |
| ~3:35 | Elgarz drifts into sonar reach in the north-east. |
| ~7:00 to 11:30 | Elgarz passes through the Gallows Reach camera. |
| 8:00 to 20:00 | Identify and mark it. |

## Hazards

- **Remorhaz:** a camera watched for about 70 seconds gets hot enough to draw one. It takes about 90 seconds to crawl in, visible on that camera. Switch away and it gives up once the camera cools. If it arrives, the repair board brings the camera back.
- **The Grindmaw:** always visible on the chart and on sonar when close. Three pings in one area within two minutes and it hunts the buoy. Move the buoy to save it; a lost buoy is rebuilt in 30 seconds.

Nothing can end the game early. Every loss is recoverable.

## GM tools

`gm.html`, opened in a second tab on the GM's own screen, shows the truth: every iceberg's identity, the shark and remorhazes, camera heat. Its buttons pause, repair everything, refill beacons, send the shark away, calibrate the scanner, force a win, reset, and send hint notes that appear on the operator's screen.

## Tuning

All numbers live in `src/scenario.js` (`TUNING`). `node tools/check.mjs` verifies the pacing, the Tomb distance, the shark rule and that a good shot hits while a sloppy one misses.
