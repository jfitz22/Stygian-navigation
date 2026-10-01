# The Last Watch Observatory: Implementation Proposal

**Status:** Proposal for GM review. No production code has been written. Everything here is open to revision.
**Campaign:** *To Hell and Back* (high-level D&D, Stygia).
**Prepared from:** `Last_Watch_Astra_Complete_Handoff.md` (the design brief).

## How to read this

The brief asked for ten deliverables in a fixed order. Each lives in its own file:

| # | File | Contents |
|---|---|---|
| 1 | [01-research.md](01-research.md) | Sourced mechanics analysis of the reference games and physical references, with confidence labels |
| 2 | [02-core-loop-and-vignette.md](02-core-loop-and-vignette.md) | The repeatable loop, roles at the table, a 5-minute play vignette |
| 3 | [03-cockpit-layout.md](03-cockpit-layout.md) | Three-view cockpit, wireframe ([img/cockpit-wireframe.svg](img/cockpit-wireframe.svg)), what every panel reveals |
| 4 | [04-dependencies-and-power.md](04-dependencies-and-power.md) | Interaction matrix, dependency graph, power and heat model, alternate designs |
| 5 | [05-world-and-observation-math.md](05-world-and-observation-math.md) | Drift model, sampled vs delivered observations, tracking, alignment, scan evidence, lock criterion |
| 6 | [06-roster-pacing-hazards.md](06-roster-pacing-hazards.md) | Iceberg roster, signature matrix, Elgarz trajectory, pacing, remorhaz, leviathan, beacon retaliation, repair |
| 7 | [07-puzzle-modules.md](07-puzzle-modules.md) | Six KTaNE-pattern modules wired into the machinery, dialogue samples |
| 7b | [handouts/](handouts/) | Mockup pages for Expert A and Expert B manuals, GM key approach |
| 8 | [08-visual-audio.md](08-visual-audio.md) | Art, palette, motion, sound plan, stream legibility rules |
| 9 | [09-architecture-and-testing.md](09-architecture-and-testing.md) | Code architecture, hosting, stages, automated and human tests, GM controls |
| 10 | [10-risks-and-decisions.md](10-risks-and-decisions.md) | Risk register, recommended improvements, decisions I need from you |

## Labels used throughout

- **[HARD]** a requirement taken from the brief. I will not change these without your sign-off.
- **[PROPOSED]** my design choice. Feel free to veto or swap.
- **[TUNE]** a number that exists only to be playtested. Treat every value marked this way as a first guess.

## One-paragraph pitch

The party sits in a frozen observatory built around a huge engraved chart table. Every instrument either *finds* ice, *measures* it, *measures the sea that moves it*, *follows* it, or *proves what is inside it*, and each one leaves marks on the shared chart that fade unless the players pin them down. One operator drives everything with the mouse. Expert A holds the **Optics & Choir Codex** (cameras, runes, signals, metal). Expert B holds the **Sounding & Engine Manual** (echoes, cavities, valves, repairs, the boiler). The other two players keep the candidate ledger and argue about trajectories. Icebergs drift by a simple, honest wind-plus-two-layer-current model, so the players who sample the deep current can predict a colossal glacier and the players who ignore it lose their lock halfway through a scan. Elgarz arrives from the north-east around minute 3½, faintly heralded by a threefold hum on the Choir Receiver. Proving it takes three different instruments, two manuals, and one argument about the Tomb of Levistus.

## Biggest changes I am proposing relative to the brief

These are explained in their sections and collected again in [10-risks-and-decisions.md](10-risks-and-decisions.md).

1. **Two-layer currents.** Small floes ride wind and surface current; colossal glaciers ride a deep current that only a lowered buoy line can measure. This makes the current apparatus essential for tracking the very object the players care about, and gives an honest "residual drift" clue.
2. **Graded lock feedback.** The coordinate lectern answers with a graded strength reading (Faint, Warm, Strong, Bound), so a near-miss teaches the players how to improve their solution.
3. **Back-integrated Elgarz.** I author where Elgarz should be at minute 3½ and integrate the same drift field *backwards* to find its starting point. The arrival is authored and still fully explained by the simulated sea.
4. **A second GM window.** The truth view, hints and overrides live in a separate browser window (same machine, synced locally) so it never appears on the stream.
5. **A convincing two-of-three decoy with a lore exit.** *Geryon's Shed Horn* carries real Geryonite resonance and worked metal but is solid ice, and its path passes within ~700 miles of the Tomb. Sharp players can eliminate it by the 1,000-mile rule before scanning it fully.

## Research limitations (please read)

- **The PDFs listed in the brief's source pack were not attached to this session.** Only the handoff markdown arrived. My notes on the KTaNE manual rely on the publicly known structure of the v1 manual plus search-index summaries; my Stygia lore relies on search summaries of *Fiendish Codex II* passages. Please attach the PDFs and I will re-check every claim in section 1 and every rule in the module section against them.
- **This environment's network policy blocked direct page fetches** for gamedeveloper.com, itch.io, steamcommunity.com, daid.github.io, bombmanual.com, gdcvault.com and wireframe.raspberrypi.org. Web search still worked, so every reference claim comes from search-engine summaries of those pages. Section 1 marks this explicitly. If you add those hosts to the environment's allowed domains (cloud environment menu in the session title bar, then Edit, Network access) I can read them in full and tighten the citations.
