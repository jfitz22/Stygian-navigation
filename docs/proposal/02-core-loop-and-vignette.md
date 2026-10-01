# 2. Core gameplay and table conversation

## 2.1 Roles at the table [HARD with PROPOSED names]

| Seat | Has | Does |
|---|---|---|
| **Operator** | The browser, mouse, speakers. Shares screen to VTT/Discord. | Clicks, turns, reads aloud, describes symbols. Cannot see either manual. |
| **Expert A: Optics & Choir Officer** | *The Optics & Choir Codex* (printed, ~10 pages) | Decodes camera rangefinder drums, rune keypads, the Choir Receiver's tone triads, magnetic rosettes (worked metal). |
| **Expert B: Sounding & Engine Officer** | *The Sounding & Engine Manual* (printed, ~10 pages) | Decodes echo traces (cavities), valve and fuse boards, boiler governor, buoy line depth and repair procedures. |
| **Investigator 1: Plotter** | Paper chart sheet (optional printable), pencil | Keeps the candidate ledger, asks for fixes, proposes which berg to chase. |
| **Investigator 2: Watchkeeper** | Nothing but ears | Watches threats (Hearkener, post thermometers), tracks time, reminds the room about the 1,000-mile rule. |

The investigator roles are suggestions. The real point is that the screen holds more information than the operator can narrate alone, so non-expert players naturally start watching specific panels. To support this, every panel has a big, glanceable state (lamp colour, needle zone) that someone other than the operator can call out.

## 2.2 The repeatable loop [HARD loop, PROPOSED instruments]

```
        ┌──────────────────────────────────────────────────────────────┐
        │                                                              │
  FIND ─┼─► SELECT ─► OBSERVE (2+ independent fixes) ─► CORRELATE ──►  │
  sweep │   pin a     camera mark / sonar contact /      drag marks     │
  choir │   candidate hearkener cross-bearing          onto a track card│
  hum   │                                                   │          │
        │                                                   ▼          │
        │   MEASURE THE SEA ─────────────────────────► PREDICT          │
        │   wind (Orrery), surface + deep current        Reckoner      │
        │   (Tide Loom)                                   ghost + ring │
        │                                                   │          │
        │                                                   ▼          │
        │                                      HOLD (Lodestar Lens)    │
        │                                      auto-aim + manual trim  │
        │                                                   │          │
        │                                                   ▼          │
        │                      PROVE: Hollow (B) · Metal (A) · Choir (A+B)
        │                                                   │          │
        │                ┌──────────────────────────────────┴───┐      │
        │                ▼                                      ▼      │
        └──── TAG / ANNOTATE / BEACON                    LOCK & ANCHOR │
              (not Elgarz)                               (Elgarz)     │
```

### What each step needs

| Step | Typical method | Alternatives | Output |
|---|---|---|---|
| **Find** | Frostfire Sweep shows "mass blooms" in range-bearing cells | Choir Receiver hum from a bearing; Hearkener groan; seeing it from a camera post | A rough region |
| **Select** | Click the bloom or contact, press **PIN** to drop a numbered brass pin | Draw a pencil ring | A candidate ID on the ledger |
| **Observe** | Camera post *Mark* (bearing, apparent length, range drum, needs Expert A) | Sonar contact from a buoy (range, draft, after a delay); two passive bearings from different hydrophones | Timestamped fixes |
| **Correlate** | Drag two or more fixes onto a track card | Single fix plus environment model | A track with an estimated velocity |
| **Measure the sea** | Weather Orrery (wind) and Tide Loom (surface and deep current) sampled recently near the candidate | Rely on two-fix velocity only (worse for long holds) | Inputs for prediction |
| **Predict** | Reckoner propagates the track to *now* | Plotter does it on paper | Ghost position plus uncertainty ring |
| **Hold** | Lens slaved to the Reckoner, operator trims with two knobs while a strength needle peaks | Lens on manual only | Alignment quality |
| **Prove** | Three evidence channels fill while alignment holds; each produces an artefact an expert must interpret | Partial evidence can come from other instruments (see section 6) | H / M / C findings |
| **Tag** | Annotate the pin; optionally fire a beacon harpoon | Leave it | Persistent tracking or a note |
| **Lock and anchor** | Enter a moving solution at the Moorage Lectern; answer the anchorage litany | GM assist | Payoff (section 6.6) |

The loop is *systemic*. Nothing forces the order. A player who hears a triad on the Choir Receiver can bearing-chase it before anything appears on camera. A player can scan a berg without a full track if they are patient with manual trim.

## 2.3 Detailed operator/expert conversation (single module)

The **Rangefinder Drum** on a camera post. The operator has pointed Post Saltgrave at a large berg and pressed **MARK**. A three-wheel brass drum clicks to a set of glyphs, and a small lamp beside it glows amber.

> **Operator:** Okay, the drum has three wheels. Left wheel is a sort of hook with two dots. Middle one is a triangle with a line through the top. Right one is the spiral, the one we saw before. The little lamp is amber.
>
> **Expert A:** Amber means you're in "storm light", page 3. Which post are you on?
>
> **Operator:** Saltgrave. It's on the tag above the screen.
>
> **Expert A:** Saltgrave adds two to the bearing wheel. Hook-with-two-dots is 4, so bearing wheel is 6, times fifteen... 90 degrees from the post, plus the needle offset. What's the needle on the bearing scale?
>
> **Operator:** Just past the third tick.
>
> **Expert A:** So about 93 degrees. Triangle-with-line is length class "great", so it's longer than two miles. Spiral in storm light means range band 120 to 180 miles.
>
> **Plotter:** I'm drawing a fan from Saltgrave at 93 degrees, 120 to 180 out. That lands right on the bloom we pinned as number 4. So pin 4 is a big one.
>
> **Watchkeeper:** Saltgrave's thermometer is in the orange. Didn't it go red last time right before the remorhaz?
>
> **Operator:** Switching to Brine Post to let it cool.

What made this a conversation: the operator holds the symbols, post name and needle; Expert A holds the conversion rules; the Plotter turns a number into a shape on the chart; the Watchkeeper connects heat to danger.

## 2.4 Vignette: about five minutes of play (minute 6 to 11)

*Context: the party has had the furnace lit for six minutes. They have scanned one berg (it turned out to be the Drowned Convoy: hollow and metal, no choir). Two remorhaz scares have taught them that camera posts get hot. The Choir Receiver has been picking up a faint triad from the north-east for about two minutes.*

**06:10** The operator twists the Choir Receiver's big bakelite dial. The oscilloscope trace firms up from noise into three stacked waves. The speaker produces a low, slow chord with a bell-like overtone.

> **Operator:** Three notes. Lowest one is a sort of groan. Middle one... buzzy. Top one is pure, like a glass. The lamps under the scope flash in pairs: red-red, red-white, white-white, then a pause.
>
> **Expert A:** That's a triad pattern. I need the "medium" before I can read it. Page 6 says if the signal passes through hollow ice the table shifts. Rin, do you know what it's passing through?
>
> **Expert B:** Only if we ping it. I need an echo trace.

**06:40** *Power decision.* The Sounder needs 3 coals. The breaker wall shows 12 coals capacity; Choir (2), Sweep (3), Reckoner (2), one camera post (2), Tide Loom (1) and the percolator (1) are already drawing 11.

> **Operator:** I'm out of coal. What do I turn off?
>
> **Plotter:** Kill the sweep. We already know where the hum is.
>
> **Watchkeeper:** And the coffee.
>
> **Operator:** The coffee is the only thing keeping me alive. ...Fine.

The operator flips the Sweep breaker down. Its scope fades to a dull green ring and the big rotating aurora overlay on the chart freezes, with a small "STALE 0:04" card that counts up. The percolator gurgles to a stop and the dad-joke ticker remarks: *WHY DID THE IMP QUIT THE PERCOLATOR? IT COULDN'T HANDLE THE PRESSURE.*

**07:05** *Instrument surprise.* The operator drags the sounding buoy launcher's aim crosshair 300 miles north-east, toward the hum's bearing, and fires. A thump, a cable whine, and 20 seconds later the buoy lamp turns green. They ping. On the Hearkener, the waterfall display whites out for six seconds. On the chart, after a nine-second "PROCESSING" clatter from the echo printer, three phosphor dots bloom near the buoy, stamped **S 07:14** (sampled) and **D 07:23** (delivered). The middle dot is enormous.

> **Plotter:** That dot was sampled at 07:14. It's already moved. Pin it as 7.
>
> **Operator:** The printer is spitting out a strip. It's a wavy line with... two humps, then a ringing tail that goes flat, then a notch.
>
> **Expert B:** Water temperature?
>
> **Operator:** The Orrery says minus... the frost needle is in the second band.
>
> **Expert B:** Second band, double hump with ringing tail: "vaulted void, multiple chambers." That's hollow, and big. Notch means a sharp edge inside, page 4 says "dressed stone or metal, confirm by lens." And Dev, your medium is "void".
>
> **Expert A:** Void row... red-red is the Fallen Note, that's Buzz. Red-white is the Bound Bull. White-white is the Glass Psalm. Buzz, Bull and Glass: fiendish, Geryon's own, and celestial. That's a full Geryonite triad.

The table erupts. The Plotter writes "7: HOLLOW? CHOIR!" in the ledger.

**08:00** *Hazard decision.* The Watchkeeper notices the Hearkener's waterfall: a slow, heavy smear that was at bearing 040 a minute ago is now at 055 and brightening.

> **Watchkeeper:** Something big is coming toward the buoy we just pinged. Is that the shark?
>
> **Expert B:** Page 8: "a broad low band that walks across bearings is the Grindmaw." If it reaches an active buoy it eats it. We get maybe a minute.
>
> **Plotter:** We need a second fix before we lose sonar. Can we see 7 from a camera?
>
> **Operator:** Gallowmere Post is closest, but it's in the storm.

The operator switches to Gallowmere. The image is grainy, streaked with snow. They pull the **wiper lever** on the post panel (it costs a quarter-coal pulse) and the snow clears for a few seconds, enough to see a long, low, dark-veined glacier with a straight-edged shadow along one flank. They press **MARK** and the drum clicks.

**08:50** Expert A decodes a bearing and range band. The Plotter's fan crosses the faded sonar dot's projected path. Two fixes, 1 minute 40 apart. The operator drags both onto a fresh track card labelled 7. The Reckoner draws a ghost ahead of the oldest mark and a wide ring.

> **Operator:** The ring is huge. And there's a lamp on the Reckoner saying "DEEP?".
>
> **Expert B:** That's "the berg is not following the surface current." Page 9: lower a buoy line to read the deep current.
>
> **Watchkeeper:** The shark!
>
> **Operator:** Okay, I'm reeling the buoy... no wait. If I reel it in I can't read the deep current.
>
> **Plotter:** Ping from the *other* buoy, the west one. Pull the shark away.

The operator fires one ping from Buoy West (no target there, pure decoy). The Hearkener band hesitates, then starts walking back west. The operator lowers Buoy North-East's deep line (a crank, 15 seconds of chain rattle). The Tide Loom shows a second, slower arrow layer in indigo beneath the surface arrows. The Reckoner's ring shrinks by half.

**10:30** The operator powers the Lodestar Lens (5 coals: they switch off the camera post and the Choir Receiver to afford it). The Lens hums, rises through a 15-second spin-up, then its alignment needle swings into the green. The three evidence vials begin to fill.

> **Watchkeeper:** Before we celebrate: where's the Tomb? Is 7 more than a thousand miles from it?
>
> **Plotter:** Tomb's down in the south-west corner. Measuring... about thirteen hundred. And the Horn thing we saw earlier was only eight hundred from it.
>
> **Expert A:** So 7 is still alive as Elgarz, and the Horn can't be.

They are about four minutes from a full scan, with a leviathan wandering west, a cold camera post, and a percolator that the operator keeps eyeing.
