# 7. KTaNE-pattern modules wired into the machinery

Six modules are proposed. Four are core, two are support. Every rule, glyph name and table below is original. The KTaNE manual inspired the **patterns** only (contextual lookup, describe-an-unnameable-glyph, cross-module state, a gentle needy), as described in section 1.3.

## 7.0 Design rules for every module [PROPOSED]

1. **Three ingredients:** something only the operator sees, something only an expert knows, and something the *world* decides right now (wind octant, active post, medium, damage cause). Answers cannot be memorised between runs or between scans.
2. **Every module has a consequence:** it changes what an instrument can do or say. If the players skip it, there is always a slower path.
3. **Local failure:** a wrong answer costs 10 to 15 seconds on that instrument only.
4. **One page per module per manual,** with a box at the top saying **"Ask the operator for:"** so the expert starts talking immediately.
5. **Each expert is needed every 2 to 3 minutes** on average (see 7.8). Nobody reads silently for long.

| # | Module | Instrument | Expert | Frequency | Result |
|---|---|---|---|---|---|
| 1 | **Lens Litany** (rune keypad) | Lodestar Lens / Moorage Lectern | A | Once per session + once for anchorage | Lens M and C channels run at full speed; later wakes the anchorage |
| 2 | **Choir Hymnal** (triad decoder) | Choir Receiver | A + B | Per resonant body | Identifies tone families; produces the Seal for the Lectern |
| 3 | **Echo Atlas and Tomograph** | Echo Strip, Lens H channel | B | Per sonar contact or scan | Interior class (hollow evidence), medium for Module 2, heartbeat warning |
| 4 | **Linesman's Board** (valves and fuses) | Engineering Wall | B | Per repair | Restores a damaged post or severed buoy line |
| 5 | **Rangefinder Drum** | Watch Posts | A | Per camera MARK | Bearing, length class and range band of a camera fix |
| 6 | **Boiler Governor** (needy) | Furnace | B | Every 3 to 4 minutes | Keeps full 12-coal capacity |

---

## 7.1 Module 1: Lens Litany (rune keypad)

**Operator sees:** four iron keys on the Lens calibration plate, each with a large glyph (drawn from a pool of 20). Also visible elsewhere: the Orrery's wind octant, the active Watch Post's name.

**Expert A knows:** the **Rune Catalogue** (20 glyphs with a descriptive name, an *Order* and a *weight*) and the **Litany Rules**:

1. **Leading Order** from the wind octant on the Orrery: N or NE → *Ice*; E or SE → *Ember*; S or SW → *Bone*; W or NW → *Iron*.
2. Press runes grouped by Order, starting with the leading Order and moving clockwise around the Order Wheel (Ice → Iron → Ember → Bone → Ice). Skip Orders with no runes on the plate.
3. Within one Order press the lowest weight first. **Exception:** if the active post is a sea post (Saltgrave or Brine), press the highest weight first.
4. Ties: the key nearer the top-left goes first.
5. If **Bull's Brow** is on the plate it is always pressed last. ("Geryon answers last.")

**Consequence:** calibrated Lens fills M and C at full speed (×2.5 compared with uncalibrated). Wrong press: frost cracks across the lens, 15 s cooldown, same runes remain.

**Second role, Anchorage Litany:** after a Bound lock, the same keypad on the Lectern shows four new runes. Step 1 changes: the Leading Order comes from the **petal count on Elgarz's lodestone rosette** (3 → Ice, 4 → Iron, 5 → Ember, 6 or more → Bone). So the M-channel proof is needed to open the anchorage.

**Sample dialogue**
> **Operator:** Four keys. Top-left is a sort of fork with three prongs and a bar. Top-right looks like a U with horns.
> **Expert A:** Horns, that's Bull's Brow, it goes last no matter what. Fork with a bar is "Bone Fork", Bone, weight 2. What's the wind?
> **Operator:** Orrery says... south-south-west, the arrow is between S and SW.
> **Expert A:** Either way that's Bone. So Bone Fork first. Next?

**Instance generation:** for each scenario seed, the plate's runes are picked so that (a) at least two Orders appear, (b) the answer differs for at least two wind octants (so the world matters), (c) Bull's Brow appears in the anchorage version only. The GM key lists the solution for every octant.

---

## 7.2 Module 2: Choir Hymnal (triad decoder, cross-expert)

**Operator sees and hears:** when the Choir Receiver is peaked on a resonant body, up to three stacked waves on the scope and a repeating lamp sequence of three **pairs** (e.g. *red-red, red-white, white-white*, pause). Each pair is one note of the chord. The speaker plays the chord.

**Expert A knows:** the **Hymnal**: a table of 9 ordered lamp pairs × 4 *media* (Solid, Water, Void, Living). Each cell names a note, its tone family, and its **seal glyph**.

**Expert B knows:** how to determine the **medium** from an echo trace or tomograph of the same body (Module 3). Without a medium, Expert A must guess a row.

**Procedure:** B gives the medium → A reads each pair in that row → note names → families present → three seal glyphs. The operator dials the seal glyphs into the Lectern's three seal wheels.

**Consequence:** identifies which tone families are present (the C signature) and produces the Seal. Decoding with the wrong medium yields a plausible but different set of notes, which the Lectern will refuse ("THE MOORAGE DOES NOT KNOW THIS NAME"). The instrument showed the true lamps; the slip is in the decoding, and the GM key shows the correct reading.

**Why it is good conversation:** A cannot finish without B, B's answer comes from a different instrument (sonar or Lens), and the result changes how the room thinks about a candidate. The Penitent Choir decodes to Glass + Buzz with no Bull, and the Shed Horn to Bull + Buzz: both are exciting and both are wrong.

**Sample dialogue** (see the vignette, section 2.4, minute 06:10).

---

## 7.3 Module 3: Echo Atlas and Cavity Tomograph

**Operator sees:** (a) on the **Echo Strip**, a printed waveform with countable features: number of humps (1 to 3), tail (flat, ringing, fuzzy), notch (yes/no), and the stamp line; (b) on the **Orrery**, the frost band (1 to 4); (c) for Lens H artefacts, a **tomograph**: an 8 × 8 grid slice with shaded cells.

**Expert B knows:** the **Echo Atlas** flowchart and the **Tomograph Rules**:

*Echo Atlas (excerpt of logic)*
1. Frost band 3 or 4: the first hump is surface skin. Ignore it.
2. No humps left → **Solid**.
3. One hump + flat tail → **Single void** (medium Void).
4. One hump + ringing tail → **Bell void** (medium Void, *likely to ring on the Hearkener*).
5. Two or more humps + ringing tail → **Vaulted void, multiple chambers** (medium Void).
6. Any humps + fuzzy tail → **Soft walls**. If the strip shows a slow repeating ripple: **Living** (medium Living). *Do not brand what has a heartbeat.*
7. A notch anywhere → **sharp interior edge** (dressed stone or metal; confirm with the Lens).
8. If the contact's draft class is Floe, the medium is always Water regardless of the above.

*Tomograph rules*
- A **chamber** is an enclosed group of shaded cells.
- **Built halls** if there are ≥ 5 chambers *and* any straight wall at least 3 cells long. Otherwise **natural cavities**.
- Count chambers touching the right edge: that is the number of passages leading toward the anchorage face (flavour for the GM's dungeon).

**Consequence:** H signature (secondary from echo, primary from tomograph), medium for Module 2, the heartbeat warning before branding.

---

## 7.4 Module 4: Linesman's Board (repair)

**Operator sees:** on the Engineering Wall, six conduits for the damaged system. Each conduit shows: sheath material (brass, iron, porcelain), frost (yes/no), a small star tag (yes/no), and its lamp at the far end (lit/dark). The damaged-system cluster shows the **cause** icon (claw = remorhaz, jaw = Grindmaw, swarm = brood) and the station name.

**Expert B knows:** the **Linesman's Rules**, applied to each conduit in order, first match wins:
1. Lamp dark **and** porcelain → **CUT**.
2. Frosted **and** star → **BYPASS**, unless the cause is the jaw, then **SHUT**.
3. Iron **and** not frosted → **OPEN**.
4. Brass → **OPEN** at a shelf post (Gallowmere, Hookspur); **SHUT** at a sea post or buoy.
5. Anything else → **SHUT**.

The operator sets each conduit's four-way handle, then pulls the sled-dispatch handle.

**Consequence:** a correct board dispatches the repair sled (30 to 45 s travel). A wrong conduit sparks: 10 s delay, that conduit resets, the rest stay set.

**Why it fits:** repair involves operating actual controls with an expert, which the brief asked for, and the context (cause, station type) means the same board differs every time.

---

## 7.5 Module 5: Rangefinder Drum (camera fixes)

**Operator sees:** after MARK, three brass glyph wheels (bearing, length, range), a light-lamp colour (clear white, storm amber, ember red), a fine bearing needle (0 to 14 ticks), and the active post name.

**Expert A knows:**
- **Numeral runes:** six glyphs worth 0 to 5.
- **Post offsets:** Saltgrave +2, Gallowmere +8, Brine +14, Hookspur +19.
- Bearing = (bearing wheel + post offset) × 15° + needle ticks. (Bearings are measured *from the post*, which is marked on the chart.)
- **Length wheel** → length class: Floe, Berg, Great (> 2 mi), Colossal (> 8 mi). Under ember light, read one class smaller (the ember filter exaggerates).
- **Range wheel + light colour** → range band (e.g. Coil in storm light = 120 to 180 mi).

**Consequence:** a numeric fix fan on the chart (the operator places it with the RULER tool from the post; the Plotter can do it on paper). Length class feeds the Reckoner's draft class choice.

**Design note:** this is the module most often used. It must be quick (under 30 seconds once learned) and it gives Expert A a steady rhythm. If playtests show it is too slow, the drum can print the bearing in plain numerals on a "clear light" lamp, keeping the cipher only in storm and ember light.

---

## 7.6 Module 6: Boiler Governor (needy)

**Operator sees:** three pressure gauges (needles in Low, Mid or High zones), the flame colour in the furnace window (orange, blue, green), and a small sand-glass that starts when the governor drifts (60 s).

**Expert B knows:**
- Find the gauge that disagrees with the other two. If all three agree, it is the left gauge. If all three differ, it is the one reading High.
- Orange flame: turn that gauge's valve one turn toward the others' reading. Blue: two turns. Green: shut it fully, then open one turn.

**Consequence if ignored:** capacity drops from 12 to 9 coal until fixed. Nothing breaks.
**Humane timing:** the drift timer pauses whenever the Lens is above 0.7 alignment mid-scan, and never starts within 45 s of a threat warning.

---

## 7.7 Ideas held in reserve

- **Deep Line Plumb:** a knob-and-lamp calibration when lowering a buoy line (weight the line to the right depth using a table keyed by draft class). Good if the Loom feels too passive.
- **Pneumatic Tube Cipher:** canisters from the sentries in a simple substitution cipher that Expert A can read, carrying optional lore and GM hints.
- **Gramophone Records:** four records; one, played while the Choir Receiver is peaked on Elgarz, harmonises audibly. A pure easter egg.

## 7.8 Engagement budget (keeping experts busy)

| Typical minute-by-minute need | Expert A | Expert B |
|---|---|---|
| Every camera MARK (~every 1 to 2 min) | Drum | |
| Every sonar contact worth reading (~every 2 min) | | Echo Atlas |
| Each resonant body (3 to 5 per session) | Hymnal | Medium |
| Each scan artefact | Rosette | Tomograph |
| Repairs (0 to 3 per session) | | Linesman |
| Boiler (every 3 to 4 min) | | Governor |
| Lens calibration (1 to 2 per session) | Litany | |

Expert B has slightly more scattered short tasks; Expert A has a heavier rhythm with the drum. Playtest data (section 9.5) should check that neither is idle for more than ~3 minutes.

## 7.9 Difficulty, authoring and the GM key

- **Difficulty dials:** pool size of runes (12 / 20 / 28); number of exceptions in each rule list (print a "Novice" or "Veteran" edition of each manual); whether the drum's clear-light reading is plain numerals; whether the Hymnal needs the medium at all (Novice: a single row).
- **Authored per scenario, generated from a seed:** the scenario JSON fixes the world; the seed picks keypad runes, drum glyph sets, Linesman conduit layouts and Governor drifts under solvability constraints. Both manuals stay the same between seeds; only the instances change. Re-running the seed reproduces everything for debugging.
- **GM key:** printed from the same seed: each body's true signatures and seal, Litany solutions for each wind octant, the expected Hymnal decode for each body under each medium (including the wrong ones, so the GM can recognise a mistake), Linesman answers for each station and cause, and a timeline of world events.
