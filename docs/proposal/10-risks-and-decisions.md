# 10. Risks, recommended improvements, and decisions for the GM

## 10.1 Hard requirements vs my choices

| Topic | Hard (from brief) | My suggestion (changeable) |
|---|---|---|
| Players | One operator, two private manuals, others reason | Plotter and Watchkeeper roles as soft suggestions |
| World | One continuous, real-time, deterministic simulated sea; wind and current move ice; Tomb visible and moving; Elgarz ≥ 1,000 mi from Tomb; Elgarz arrives ~3 to 4 min | Two-layer currents; kinematic drift; back-integrated arrival; Gyre of Patience |
| Honesty | No fabricated readings; sampled vs delivered times | Honesty invariant: every stated uncertainty contains the truth |
| Evidence | Three signatures from real instrument interactions; decoys with one or two | Specific instruments per signature; seals; Shed Horn and Penitent Choir decoys |
| Hazards | Remorhazes at hot posts; leviathan drawn to repeated pings; local, recoverable; ~60 s redeploy | Specific speeds, noise model, bell easter egg |
| Power | Capacity competition, spin-up, heat | Coal units, STOKE/DAMPER, breaker trips |
| Modules | Rune keypad, signal decoder, valves/fuses, needy calibration; two manuals; GM key | Six modules as specified; engagement budget |
| Look | Dense diegetic infernal cockpit, many display types, readable on stream | Three views and focus mode; palette; synthesised audio |
| Delivery | Static web, no softlock, GM controls | TypeScript + Vite + Canvas; GitHub Pages; BroadcastChannel GM window |

## 10.2 Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | **Operator overload**: too many panels and alarms for one person | Medium | High | Threat warnings ≥ 45 s; Governor pauses during scans; Watchkeeper role; focus mode; playtest stress ratings |
| 2 | **Too long for a D&D session** (learning curve eats the evening) | High | High | Paper-prototype the modules first; Novice manual editions; GM hint ladder; Elgarz arrival adjustable; Rangefinder Drum plain-numeral fallback |
| 3 | **Experts idle or drowning** | Medium | Medium | Engagement budget (7.8); log-based gap analysis; adjust which panels need which expert |
| 4 | **Tracking feels unfair** (lens slips for reasons players cannot see) | Medium | High | Honest alignment needle, DEEP? lamp, RESIDUAL readout, ring labelled RECKONED; Expert B page on the keel assumption |
| 5 | **Chart clutter** after 20 minutes | High | Medium | Fading, layer toggles on the chart frame (sweep, sonar, camera, hearkener, pencil), a "tidy" button that archives faded marks to a drawer |
| 6 | **Lectern brute-forcing** | Low | Medium | Requires a correct seal before grading |
| 7 | **Spoilers in shipped client** | Medium | Low | GM passphrase gate; optionally a private repo or local GM file |
| 8 | **Scope creep** (many panels × art × audio) | High | High | Staged plan with your review at each gate; grey-box must be fun before art |
| 9 | **Stream compression** ruins phosphor and grain | Medium | Medium | High-legibility toggle; test on your actual Discord/VTT setup in Stage 2 |
| 10 | **Physics model too opaque** | Low | Medium | Kinematic model with 4 draft classes; Expert B's manual explains it in one paragraph |
| 11 | **Lore mismatch** with your sources (PDFs not yet reviewed) | Medium | Low | Re-check once PDFs are attached |
| 12 | **Browser audio autoplay policies** | High | Low | Furnace ignition click doubles as the audio unlock gesture |

## 10.3 Improvements I recommend (beyond the brief)

1. **Two-layer currents** make the current apparatus essential for the exact object the players care about, and create an honest "residual drift" identity clue. This is the single strongest way to make weather and currents *mechanically central*.
2. **Graded Lectern** (Faint to Bound) turns the final lock into a hot-and-cold refinement loop, which is more fun and more forgiving.
3. **Seals tie the choir to the lock**, so decoding is consequential and cross-expert, and the Lectern cannot be brute-forced.
4. **Rosette opens the anchorage**, so all three signatures matter to both identification and the final payoff.
5. **The Coldsteel Tomograph** gives you a physical handout for the next dungeon, linking the minigame directly to the campaign.
6. **Sentry voice through the pneumatic tube** lets you deliver hints diegetically and adds melancholy; the memorial lamp reinforces it.
7. **Snapshot slips and track cards** make the chart a research record the party built, which is satisfying to screenshot after the session.
8. **Paper prototype first.** The most uncertain part is human conversation, which code cannot test. Two evenings with printed modules will save weeks.

## 10.4 Decisions I need from you

Please answer these before Stage 1. My recommendation is listed first.

1. **Session length target:** (a) 20 to 30 minutes as briefed, tuned toward 25; (b) up to 45 minutes as a centrepiece.
2. **Draft model:** approve the two-layer current and four draft classes?
3. **Brand on Elgarz:** (a) Coldsteel's wards repel brands, shown as "BRAND REPELLED" (dramatic, honest, but a limited identity test); (b) the brand sticks like any other berg; (c) the launcher refuses to fire at colossi.
4. **Payoff contents:** which of the anchorage rewards in 6.7 fit your Coldsteel plans (docking gate, Lodestar Shard, sentry captain's message, tomograph map)? Should the tomograph show real map information or stay atmospheric?
5. **Handout format:** A5 booklet, half-letter booklet, or single-sided letter/A4 pages? Colour or black-and-white printing?
6. **Who plays the experts?** If you know the two players, I can tune each manual's tone and difficulty (one liturgical, one engineering) to suit them.
7. **Stream setup:** Discord screen share, Foundry/Roll20 embed, or a TV in the room? This decides minimum text size and audio mix.
8. **GM window:** same machine (BroadcastChannel) is enough, or do you need to run the GM view from a different device?
9. **Spoiler protection:** passphrase gate is enough, or private repo/local GM file?
10. **Names:** keep "Last Watch", "Lodestar Lens", "Grindmaw", "Tide Loom", "Moorage Lectern", etc., or would you like to rename anything to match your campaign's voice?
11. **Source PDFs:** please attach them (KTaNE manual, Fiendish Codex II, Dungeon #176, Codex devils, Dragon #427, *A Paladin in Hell*) so I can verify lore and module patterns.
12. **Network access:** to verify the reference articles in full, allow these hosts in the environment's network settings: gamedeveloper.com, itch.io, steamcommunity.com, daid.github.io, bombmanual.com, gdcvault.com, wireframe.raspberrypi.org. Optional; the design does not depend on it.

## 10.5 What happens after approval

1. Revise this proposal with your answers.
2. Stage 0 paper prototype (printable module drafts in this repo).
3. Stage 1 headless sim with an SVG trajectory plot you can open in a browser to check Elgarz's route, the Tomb distance and the decoys.
4. Stage 2 grey-box, deployed to GitHub Pages for you to click through.
