# 1. Sourced mechanics and inspiration analysis

## Confidence labels

| Label | Meaning |
|---|---|
| **DEV** | Stated by the developer in their own writing or talk. |
| **GUIDE** | Described in a community player guide (reliable for controls; weaker evidence for design intent). |
| **PRESS** | Interview or review written by a third party. |
| **REF** | Scientific, government or technical reference. |
| **LORE** | Published D&D material. |
| **INFERENCE** | My own reading of what the mechanic implies for our game. |

**Access caveat for this whole section:** every claim below was confirmed through search-engine summaries of the linked page, because the page itself was blocked by this environment's network policy. I list the URL that the search result pointed at. Claims I added from general background knowledge are marked **(background)** so you can discount them until I can open the source.

---

## 1.1 Nauticrawl (Andrea Interguglielmi / Armor Games Studios, 2019)

**Sources**
- Game Developer deep dive, *Crafting mystery through gameplay in Nauticrawl*: https://www.gamedeveloper.com/design/game-design-deep-dive-crafting-mystery-through-gameplay-in-i-nauticrawl-i-
- Official devlog, *UX design of a roguelike inside a cockpit sim* (4 April 2019): https://armor-games-studios.itch.io/20000atm/devlog/74563/ux-design-of-a-roguelike-inside-a-cockpit-sim
- Official devlog, *How a real-time simulated machine ended up with a turn based gameplay*: https://armor-games-studios.itch.io/20000atm/devlog/83453/how-a-real-time-simulated-machine-ended-up-with-a-turn-based-gameplay
- Official devlog, *Crawling and flying? Avoiding feature creeping*: https://armor-games-studios.itch.io/20000atm/devlog/35219/crawling-and-flying-avoiding-feature-creeping
- Wireframe magazine interview: https://wireframe.raspberrypi.org/articles/deep-dive-a-chat-with-the-creator-of-nauticrawl
- Steam guide *Nauticrawler control reference guide* (by Yvad): https://steamcommunity.com/sharedfiles/filedetails/?id=2090550207

**What is verified**
- **DEV/PRESS** The first puzzle is turning the machine on, and the game deliberately does not announce success: the cockpit "comes to life all of a sudden," which is the reward. (Game Developer deep dive, via search summary.)
- **DEV** Early builds used WASD for movement. Beta testers found that the absence of a physical control in the cockpit broke immersion and blocked players who never discovered the key mapping, so movement moved onto in-world controls. (UX devlog.)
- **DEV** The interface is fully diegetic with no 2D HUD, which the developer notes makes adding new UI hard because nothing automatically makes room for it. (UX devlog.)
- **DEV** With no tutorial, the UX itself becomes a puzzle, so the cockpit must *give clues about what new levers will do*. (UX devlog.)
- **DEV/PRESS** Real-time play made players manage controls while warning lights flashed and enemies closed in, which was too frustrating. The outside world became turn-based so players could think, while the machine simulation inside stayed real-time, because being locked out of the levers during an enemy turn "would feel wrong." (Turn-based devlog and Wireframe interview, via search summary.)
- **GUIDE** Concrete controls listed in the community reference: status panel switch, engine on/off, two fuel tank gauges with a selector switch, engine heat gauge with a heat-release pull tab, cloak strength and cloak power, engine power and fuel injection dials, forward thrust lever, radar power and radar range, periscope scan, a "finder" screen, battery level, a deployable net-hook with a charging switch, mainframe power, and later modules with altitude, anchor, radio transmitter and a Morse transmitter. (Steam guide.)
- **GUIDE** The start sequence: a switch beneath the central monitor activates the mainframe, after which the only green button in the vessel starts blinking slowly and can be pressed. (Chaptercheats hint summary: https://www.chaptercheats.com/cheat/pc/440593/nauticrawl/hint/154434.)
- **GUIDE** The radar shows a top-down view with fog of war; a central monitor logs events inside and outside the vehicle. (Departee's Guide, https://steamcommunity.com/sharedfiles/filedetails/?id=1866034592.)

**What I take from it (INFERENCE)**
1. **A single unique affordance teaches the start.** One green button, one brass crank. We should use distinctive control shapes to signpost a few critical first actions (the furnace door, the master breaker) and let everything else be discovered.
2. **Reaction elsewhere is the tutorial.** When the operator flips something, a lamp, needle or sound must respond within ~200 ms, even if the meaningful effect takes longer to spin up.
3. **Keep the machine real-time and slow the world.** Our brief requires a real-time world. Nauticrawl's lesson still applies: the *world's* tempo must leave room to think. Our icebergs move at a few pixels per second at default zoom, threats take 45 to 90 seconds to arrive, and no task needs two clicks within a reaction window.
4. **Diegetic layout is expensive to extend.** Reserve blank panel real estate (blanking plates with screws) from day one for modules added after playtests.
5. **Heat-vent tab pattern.** A pull tab that dumps heat is perfect for our camera posts and furnace.

---

## 1.2 Signal Simulator (Blagovest Penev, 2018)

**Sources**
- Steam store feature list: https://store.steampowered.com/app/839310/Signal_Simulator/
- Community guide *[1.7.8] A beginner's guide to all of Signal Simulator's systems*: https://steamcommunity.com/sharedfiles/filedetails/?id=1941945919 (mirror: https://steamsolo.com/guide/1-7-8-a-beginner-s-guide-to-all-of-signal-simulator-s-systems-signal-simulator/)
- Community guide *How To Signal Simulator*: https://steamcommunity.com/sharedfiles/filedetails/?id=1802581493
- Calibration discussion thread: https://steamcommunity.com/app/839310/discussions/0/1742227264191124017/
- Coordinate detection thread: https://steamcommunity.com/app/839310/discussions/0/1742229167217737896/

**What is verified (GUIDE unless stated)**
- **DEV (store page)** The loop: scan the sky for anomalies, set the right frequency to detect coordinates, steer radio antennas, detect the signal, download raw data, decode it; maintain servers through terminal commands.
- **Frequency tuner:** turn a black dial until the noise stops and a "Frequency locked" lamp turns green; an "Auto scan" button does it for you once tracking tech is unlocked.
- **Coordinate detector:** on/off switch, a separate graph on/off switch, volume and audio play/stop. It gives *min/max ranges* rather than an exact coordinate, and the signal can sit just outside them.
- **Antenna control:** an on/off switch, ten knobs to enter azimuth and elevation, and a "Start rotation" button.
- **Signal strength hill-climb:** adjust azimuth in 1° steps until the bar turns green, then 0.1°, then 0.01°. Each axis contributes up to 50%, 100% is practically unreachable (~98% reported), and download proceeds above 80%.
- **Calibration:** when azimuth or elevation calibration error passes ±10, detection drops by 5%; you set the antenna to 0, walk to a platform panel and press calibrate.
- **Weather and wind:** weather generates wind that physically disturbs antenna position and can drift the antenna off target in bad weather.
- **Power balancer:** boost one system's efficiency by prioritising it at the cost of others; the display shows each system's % efficiency.
- **Server heat:** servers heat up over time and fail more often when hot; a terminal command spins fans to shed heat; failed servers need a reboot command or a physical repair visit. (How To guide summary.)

**What I take from it (INFERENCE)**
1. **Coarse-to-fine hill climbing with an honest strength meter** is an excellent single-operator alignment mechanic: calm, audible, and it never needs fast hands. I use it for the Choir Receiver and for manual trim on the Deep Imager.
2. **Report ranges and bands.** Their coordinate detector reports a band. Our instruments should report honest uncertainty (bearing fans, range bands, ellipses) for players to intersect on the chart.
3. **Weather pushes the instrument itself.** In our game the wind and current push the *target*, and storms degrade optics and buoy stability. Same idea, one step further.
4. **Percent efficiency as power feedback** is a legible way to show partial power. I prefer a needle per system on the breaker wall.
5. **Walking to a calibration platform** becomes our "Engineering Wall" view: a second camera angle with repair and calibration controls.

---

## 1.3 Keep Talking and Nobody Explodes (Steel Crate Games, 2015)

**Sources**
- Supplied manual: `KeepTalkingAndNobodyExplodes-BombDefusalManual-v1.pdf` (**not attached to this session**). Public copy: https://www.bombmanual.com/print/KeepTalkingAndNobodyExplodes-BombDefusalManual-v1.pdf
- Ben Kane, *Designing Asymmetric Gameplay for Keep Talking and Nobody Explodes*, GDC 2016: https://gdcvault.com/play/1023471/Designing-Asymmetric-Gameplay-For-Keep (slides: https://media.gdcvault.com/gdc2016/Presentations/Kane_Ben_Designing_Asymmetric_Gameplay.pdf)
- Voices of VR podcast #98 with Ben Kane: https://voicesofvr.com/98-ben-kane-on-designing-keep-talking-and-nobody-explodes/
- Wikipedia overview: https://en.wikipedia.org/wiki/Keep_Talking_and_Nobody_Explodes

**What is verified**
- **DEV (GDC abstract)** The game is "about communication between players"; the team tuned puzzles inside and outside the game to keep players talking in ways that create tension, mistakes and hilarity. The talk notes that parallel solving is possible with many readers, but consistent, granular communication works best.
- **PRESS** Bombs carry up to 11 modules, solvable in any order. Needy modules cannot be disarmed and demand periodic attention, specifically to interrupt communication.
- **GUIDE/background** Module patterns in the v1 manual, described structurally (I am deliberately not reproducing any tables):
  - *Wires* and *The Button*: an ordered list of conditions that depend on the bomb's serial number, batteries and indicators. Teaches "global context changes local answers."
  - *Keypads*: four symbols, the expert finds the one column containing all four and reads the order. Teaches "describe an unnameable picture."
  - *Simon Says*: a flashing colour maps to a press colour via a table keyed on strike count and serial vowel. Teaches "the rule changes as you make mistakes."
  - *Memory*: five stages, each answer depends on earlier stages. Teaches "the expert must keep a record."
  - *Morse Code*: decode a blinking light into a word, then transmit at the frequency the manual pairs with it. Teaches "time-based signals plus a lookup that sets a dial."
  - *Complicated Wires*: a Venn diagram over four wire properties. Teaches "several binary observations combine into one action."
  - *Wire Sequences*: cumulative counts across panels. Teaches "state that persists across pages."
  - *Mazes*: the operator sees two markers and their position; only the expert sees walls. Teaches "the expert holds the map, the operator holds the position."
  - *Needy Knobs*: the operator reads a light pattern; the expert says which way to turn a knob before a timer expires. Teaches "a short recurring interruption that only needs one sentence."

**What I take from it (INFERENCE)**
1. **Every module needs one thing only the operator can see and one thing only an expert knows.** We add a third ingredient: something only *the world* knows right now (wind octant, active post, buoy depth), so the answer changes with the situation and cannot be memorised.
2. **Context pages beat password pages.** KTaNE's best modules are rules applied to evidence. Our modules turn ambiguous instrument output into a usable measurement, which is the scientific fantasy we want.
3. **Needy modules exist to interrupt.** We use exactly one light needy mechanism (the Boiler Governor) and keep it gentle, because our pressure comes from the moving world.
4. **Strikes become local consequences.** A wrong answer cracks a lens for 15 seconds or blows one fuse. There is no global strike counter.

---

## 1.4 EmptyEpsilon (Daid and contributors)

**Sources**
- Official site: https://daid.github.io/EmptyEpsilon/
- Science wiki page: https://github.com/daid/EmptyEpsilon/wiki/Science
- Odysseus LARP blog, *Steering the Starship: Empty Epsilon*: https://www.odysseuslarp.com/blog/steering-the-starship-empty-epsilon

**What is verified (DEV wiki/site via search summary)**
- **Science scanning:** align two scanning frequencies to the target's to complete a basic scan. A **deep scan** is harder, needs both frequency *and* modulation aligned per scan type, and yields shield and beam frequencies and the status of subsystems.
- **Cross-station payoff:** after a deep scan, Helms and Weapons see the target's firing arcs.
- **Probes:** Relay launches probes and can link one to the Science station's view.
- **Engineering:** more power makes a system more effective and hotter. Coolant is unlimited in reserve but only a finite amount can be applied at once, so Engineering budgets it. Overheated or damaged systems need repair crews physically sent to the right room.

**What I take from it (INFERENCE)**
1. **Two-stage scan, increasing difficulty.** Our "survey" (sweep, sonar, camera) versus "deep examination" (Lodestar Lens) split mirrors this.
2. **A scan result unlocks a capability elsewhere.** Our deep scan's resonance result unlocks the anchorage keypad and the Lens's auto-hold.
3. **Linked probe view** maps to sounding buoys whose hydrophones feed the Hearkener.
4. **Power raises heat** applies directly to camera posts, which is where our remorhaz risk comes from.
5. **Throughput-limited coolant** suggests our cooling valve board: you can cool one hot thing quickly, or two slowly.

---

## 1.5 Objects in Space (Flat Earth Games, 2018)

**Sources**
- Game Developer, *Alt.Ctrl.GDC Showcase: Objects in Space*: https://www.gamedeveloper.com/design/alt-ctrl-gdc-showcase-i-objects-in-space-i-
- Make: magazine on alt.ctrl.GDC 2017: https://makezine.com/2017/05/29/gdc-weird-video-games-controls
- New Atlas feature: https://newatlas.com/objects-in-space-game-control-panel/46388/

**What is verified (PRESS/DEV interview via search summary)**
- The game is a "modempunk" stealth trading sim. The team built Arduino-driven physical panels for alt.ctrl.GDC 2017, inspired by submarines and naval vessels, to give "a sense of navigating, rather than directly steering."
- The controller was built from **modular pieces**, partly so it could still run if one part broke or was confiscated at airport security.
- The panels are styled as retro space-capsule consoles and the game can be played almost entirely through them.

**What I take from it (INFERENCE)**
1. **Navigate, do not steer.** Our players never steer a ship; they steer instruments. The emotional verb is "plotting."
2. **Modular panels with their own bezel and personality** make each system recognisable on a stream and let us add or remove panels without redesigning the room.

---

## 1.6 In Other Waters (Gareth Damian Martin / Jump Over The Age, 2020)

**Sources**
- Paste interview: https://www.pastemagazine.com/games/in-other-waters/in-other-waters-developer-interview
- GameSpace interview: https://gamespace.com/featured/interview-with-the-mind-behind-in-other-waters-gareth-damian-martin/
- Brief's link (Endless Mode): https://www.endlessmode.com/video-games/in-other-waters/in-other-waters-developer-interview (not reachable through search; may be the same interview re-hosted)
- GameSpot review: https://www.gamespot.com/reviews/in-other-waters-review/1900-6417449/

**What is verified**
- **DEV (interview)** The interface draws on 1980s and 1990s anime for "a beautiful and bold sense of abstraction," contrasted against "layers and layers of thin, overly complex holographic interfaces," and on Japanese industrial design, especially radios and synthesizers; Martin imported a replica Panasonic Cougar 7 radio while designing.
- **DEV** The design applies "an interactive fiction or pen and paper RPG ethos" to a UI-based game.
- **PRESS** Movement is via nodes on a bathymetric chart; a sonar pulse reveals new nodes; the player scans a node before travelling to it; life forms are studied repeatedly until identified and then sampled. Several reviewers note the interface is *deliberately* a little cumbersome so the work feels like work.

**What I take from it (INFERENCE)**
1. **Bold abstraction reads on stream.** Thick strokes, two or three colours per display, big glyphs. This is our readability rule.
2. **Repeated observation builds identification.** Their "study until catalogued" maps onto our evidence channels that fill only while the Lens holds alignment.
3. **A little friction is the fantasy.** We keep a few deliberate steps (lowering a buoy line, marking a camera reading) because they feel like fieldwork.

---

## 1.7 Iron Lung (David Szymanski, 2022)

**Sources**: https://en.wikipedia.org/wiki/Iron_Lung_(video_game)

- **PRESS** The player sees outside only through grainy black-and-white snapshots from an external camera and navigates by coordinates on a paper map, because the porthole is welded shut.
- **INFERENCE** The *capture* moment is dramatic. Our camera posts stream live, but the **Snapshot Printer** freezes a frame onto a paper slip with a timestamp, and that slip persists on the chart table.

---

## 1.8 Physical references

| Source | Verified point | How we use it |
|---|---|---|
| NOAA Ocean Exploration, *Sonar*: https://oceanexplorer.noaa.gov/technology/sonar/ (**REF**) | Active sonar emits a pulse and times the echo to get range and orientation; passive sonar only listens and emits nothing. | Sounder (active, ranges, noisy, attracts the leviathan) vs Hearkener (passive, bearings only, silent). |
| NSIDC, *Science of Sea Ice*: https://nsidc.org/learn/parts-cryosphere/sea-ice/science-sea-ice (**REF**) | Sea ice drift is forced by winds and ocean currents; freely drifting sea ice moves at roughly 2% of wind speed; collisions build ridges above and keels below. | Wind coefficient for small floes ≈ 2 to 3%; keels justify draft-dependent drift. |
| Iceberg drift literature, e.g. *Operational iceberg drift forecasting in Northwest Greenland* (Cold Regions Sci. & Tech.): https://www.sciencedirect.com/science/article/abs/pii/S0165232X14001918 and *Prediction of an iceberg drift trajectory during a storm* (Annals of Glaciology): https://www.cambridge.org/core/journals/annals-of-glaciology/article/prediction-of-an-iceberg-drift-trajectory-during-a-storm/7537DC11338767400EAA87358B5AF648 (**REF**) | Operational models balance water drag on the keel (summed over depth layers), air drag, Coriolis and sea-surface slope; water drag dominates for deep-keeled bergs; a dimensionless parameter separates wind-dominated from current-dominated drift. | Our two-layer current model, with draft class choosing how much each layer and the wind matter. We drop Coriolis and inertia for legibility. |
| Radar/ARPA manuals (Canadian Coast Guard Auxiliary chapters on radar operation and ARPA): https://ccga-pacific.org/files/library/Ch._2-Radar_Operations.pdf and https://ccga-pacific.org/files/library/Ch._5-ARPA.pdf; NGA Pub. 1310 (link in brief, not reachable) (**REF**) | PPI displays can show simulated afterglow "echo trails"; *true trails* grow in proportion to a target's speed over ground; relative-motion displays keep own ship fixed, true-motion displays move it. | Phosphor persistence on the Sounder and on the chart. Our chart is a fixed true-motion plot because the observatory never moves. |
| Alpha-beta and nearest-neighbour tracking: https://kalmanfilter.net/alphabeta.html and MATLAB GNN tracker docs: https://www.mathworks.com/help/fusion/ref/globalnearestneighbormultiobjecttracker.html (**REF**) | Alpha-beta filters are a standard lightweight radar tracker for near-linear motion; gating plus nearest-neighbour association attaches new detections to the right track. | The Reckoner uses a gated alpha-beta style update; the *players* do the association by dragging marks onto a track card. |
| Fagerholt and Lorentzon, *Beyond the HUD* (Chalmers MSc, 2009): https://www.researchgate.net/publication/277202228_Beyond_the_HUD_-_User_Interfaces_for_Increased_Player_Immersion_in_FPS_Games (**REF**) | Defines diegetic, non-diegetic, spatial and meta UI; argues that system information integrated into the world lets players reason within the fiction. | Every readout is a physical object. The only non-diegetic UI is the GM window and an accessibility layer. |

## 1.9 Lore references

| Source | Verified point (**LORE**, via search summaries) |
|---|---|
| *Fiendish Codex II: Tyrants of the Nine Hells* (Wikipedia entry: https://en.wikipedia.org/wiki/Fiendish_Codex_II:_Tyrants_of_the_Nine_Hells; fan wiki summary: https://gamelore.fandom.com/wiki/Pillar_of_Geryon) | The Pillar of Geryon is jammed into the slow-moving glacier Elgarz, which grinds around Stygia and never comes within 1,000 miles of Levistus's Tomb. The Pillar is a crude humanoid granite block about 9 ft high. Placing your left hand in Geryon's right grants abilities. |
| Tomb of Levistus summaries (https://gamelore.fandom.com/wiki/Tomb_of_Levistus, https://forgottenrealms.fandom.com/wiki/Levistus) | The iceberg prison drifts slowly through Stygia, Levistus visible ~100 ft deep in exceptionally clear ice; it sometimes enters the Styx, can lodge between larger bergs for years, and has been seen near the harbour of Tantlin. |
| Stygia (https://forgottenrealms.fandom.com/wiki/Stygia) | A frozen sea of jagged icebergs lit by green-blue "frostfire" auroras. |

**Campaign adaptation (not published):** Citadel Coldsteel inside Elgarz; the Last Watch observatory and its garrison; the anchorage. I will keep these labelled as original in all player-facing and GM materials.

**Design use (INFERENCE):** "Frostfire" gives us a fiction for the wide-area search instrument (it reads distortions in the aurora). The Tomb's clear ice and its habit of lodging between bergs make it a fine calibration reference and a good occasional obstacle in the drift field.

## 1.10 Summary of borrowed patterns

| Pattern | Source | Our instrument |
|---|---|---|
| Unlabelled machine that reacts loudly when started | Nauticrawl | Furnace ignition and Master Breaker |
| Real-time machine, slow world | Nauticrawl | Global tempo and threat travel times |
| Coarse-to-fine hill-climb with honest strength meter | Signal Simulator | Choir Receiver, Lens trim |
| Ranges and bands for uncertainty | Signal Simulator | Bearing fans, range bands, ellipses |
| Weather perturbs the instrument | Signal Simulator | Storm sway on camera posts and buoy stability |
| Power balance trade-off | Signal Simulator, EmptyEpsilon | Breaker Wall |
| Basic scan vs deep scan | EmptyEpsilon | Survey instruments vs Lodestar Lens |
| Power makes heat; repair is physical | EmptyEpsilon | Camera post heat, repair sleds, valve board |
| Contextual lookup rules, local consequences | KTaNE | Six modules in section 7 |
| Bold abstract instrument language | In Other Waters | Display style guide |
| Frozen snapshot as evidence | Iron Lung | Snapshot Printer slips |
| Afterglow echo trails | Radar/ARPA references | Sounder and chart persistence |
| Wind plus current drift, keel depth | NSIDC, iceberg literature | Two-layer drift model |
