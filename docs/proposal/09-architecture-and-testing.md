# 9. Code architecture, hosting, stages and tests

## 9.1 Recommended stack [PROPOSED]

| Concern | Recommendation | Alternatives considered |
|---|---|---|
| Language | **TypeScript** | Plain JS (fewer guard rails for a math-heavy sim) |
| Build | **Vite** static build | Parcel; no build (harder once the code grows) |
| Rendering | **Canvas 2D** for displays and the chart, **SVG/DOM** for frames and controls | PixiJS/WebGL (only if Canvas profiling demands it); Phaser (a game framework we would mostly fight); Unity/Godot WebGL export (heavy downloads, less control over crisp UI, slower iteration for 2D instrumentation) |
| UI state | A small hand-rolled store (signals or a tiny reducer); no React needed | Svelte or Preact if the panel count makes plain DOM painful |
| Audio | **Web Audio API**, synthesised | Howler.js for sample playback |
| Tests | **Vitest** (unit, property-based with fast-check), **Playwright** (smoke, visual) | Jest |
| Hosting | **GitHub Pages** via GitHub Actions | Netlify, Cloudflare Pages; itch.io as an HTML5 upload |
| GM window | Second tab/window on the same machine, synced with **BroadcastChannel** | WebRTC/peer for a GM on another machine (adds complexity; only if needed) |

No backend is needed.

## 9.2 Project structure

```
/src
  /sim                 pure TypeScript, no DOM, deterministic
    world.ts           fixed-step loop, clock, seeded RNG streams
    fields.ts          wind, surface current, deep current, storms (analytic)
    bergs.ts           drift integration, separation, draft classes
    sensors/           sweep, camera, sonar, hearkener, choir, orrery, loom
    observations.ts    Observation records, honesty clipping
    reckoner.ts        track fit, residual, prediction, uncertainty
    lens.ts            alignment, evidence stores, artefacts
    lectern.ts         lock grading, seals
    power.ts           furnace, breakers, spin-up, governor
    threats/           remorhaz.ts, grindmaw.ts, brood.ts
    modules/           litany.ts, hymnal.ts, echo.ts, linesman.ts, drum.ts, governor.ts
    events.ts          typed event bus (sim → UI and audio)
  /ui
    views/             main.ts, engineering.ts, galley.ts, focus.ts
    panels/            one file per panel; each subscribes to sim state
    chart/             chart renderer, tools (pin, pencil, dividers, ruler)
    controls/          knob, lever, breaker, crank, keypad primitives
  /audio               synth voices, mixer, mute
  /gm                  gm.html entry, truth view, overrides, hint sender
  /scenario
    last-watch.json    authored world, bodies, fields, storms, tuning
/handouts              print templates (HTML + paged CSS) → PDF
/tests
  sim/                 unit and property tests
  bots/                scripted headless playthroughs
  e2e/                 Playwright smoke and screenshot tests
/tools
  field-editor.html    debug view to author currents and storms
  back-integrate.ts    computes Elgarz start position from its 03:30 waypoint
```

**Key boundary:** `/sim` never imports from `/ui`. The UI reads state snapshots and sends commands (`{type: 'ping', buoy: 'NE'}`). This lets the whole game run headless at 100× speed for tests and bots.

**Save/restore:** the full sim state serialises to JSON every 10 s into `localStorage` (wrapped in try/catch), so an accidental refresh mid-session resumes where it was. The GM window can also export/import a snapshot file.

## 9.3 Development stages

| Stage | Deliverable | You review |
|---|---|---|
| **0. Paper prototype** (1 to 2 days) | Printed drafts of Modules 1, 2, 5; a fake drum and lamp sheet; play them with two friends over voice | Is the talking fun? Are the rules too long? |
| **1. Headless sim** | Fields, bergs, Elgarz back-integration, sensors, observations, Reckoner, Lens, Lectern, threats; CLI that prints a run and an SVG plot of trajectories | Trajectory plot; Elgarz timing; 1,000-mile check |
| **2. Grey-box cockpit** | All three views with flat shapes, every control wired, chart tools working, GM window with truth view | Can a first-timer start the furnace and find a berg? |
| **3. Modules and handouts** | All six modules in-game; manuals and GM key generated as print-ready PDFs | Full play with your group's experts in mind |
| **4. Hazards and pacing pass** | Remorhaz, Grindmaw, brood, repairs, tuning from playtests | Session length, stress level |
| **5. Art and audio** | Final panel art, room art, synthesised sound, accessibility options | Look and feel on your actual stream |
| **6. Rehearsal build** | Locked scenario, GM key final, one full dress rehearsal | Go / no-go |

## 9.4 Hosting steps (GitHub Pages)

1. Repository `Stygian-navigation` (this one) holds the code.
2. A GitHub Actions workflow runs `npm ci && npm test && npm run build` on push to the main branch and publishes `dist/` to Pages.
3. The game lives at `https://<user>.github.io/Stygian-navigation/`; the GM window at `.../gm.html`.
4. **Spoiler hygiene:** the scenario truth necessarily ships in the client (no backend). The GM page asks for a passphrase before rendering, which keeps players from wandering into it casually; it is not real security. If that matters, the repository can be private with Pages restricted, or the GM page can be distributed as a local file.

## 9.5 Testing strategy

### Automated (every push)

| Test | What it proves |
|---|---|
| **Determinism** | Same seed + same command log → identical state hash after 30 minutes of sim time |
| **Honesty invariant** (property test) | Every observation's shape contains the true position at `sampledAt`, for thousands of random sensor uses |
| **Elgarz contract** | Enters coverage between 03:15 and 03:45; stays ≥ 1,050 mi from the Tomb for 60 min; remains observable from 03:30 to 45:00 |
| **Decoy contract** | Shed Horn and Penitent Choir each come within 1,000 mi of the Tomb at least once before 20:00 |
| **Signature uniqueness** | Exactly one body has H, M and full triad |
| **Evidence paths** | For each signature there are ≥ 2 independent instrument paths that can produce it |
| **No-softlock fuzzing** | Random command sequences (including hostile ones: ping one buoy 100 times, overdraw power, fire all brands at the Cradle, never cool a post) for 60 sim minutes; afterwards a scripted "competent recovery bot" must still reach a Bound lock within 15 sim minutes |
| **Bot playthroughs** | A "competent" bot (uses environment data) and a "naive" bot (fixes only) both finish; the competent bot finishes faster by a target margin (proves environment data matters) |
| **Lens hold time** | With fresh deep-current data, Elgarz holds ≥ 4 minutes at default trim; without, it drifts off in ≤ 90 s |
| **Module solvability** | For every seed in a set of 1,000: every module instance has exactly one correct answer, and the answer changes with its world context |
| **Performance** | 80 bodies + all overlays render at ≥ 60 fps on a mid-range laptop (Playwright trace) |
| **Visual smoke** | Playwright screenshots of each view at 1080p and 720p compared to approved baselines |

### Human playtests

| Question | How to measure |
|---|---|
| **Is the interplay deep?** | Log every command with timestamps. After each session, count distinct cross-instrument chains (e.g. Echo → medium → Hymnal → seal). Target: each session uses ≥ 8 of the ~12 designed dependency edges. Ask: "name a moment when one machine changed what another one could do." |
| **Do first-timers understand it?** | Time to ignition (target < 2 min with no help), time to first fix (< 5 min), time to first completed scan (< 10 min). Count GM hints used. Post-session: each player draws the loop from memory |
| **Do experts stay engaged?** | From the log, compute the longest gap between manual-dependent events per expert (target < 3 min). Ask experts to rate boredom and overload 1 to 5 |
| **Is the operator overloaded?** | Count moments where two warnings were active simultaneously; ask the operator to rate stress 1 to 5; watch the recording for missed warnings |
| **Can unusual actions softlock?** | Ask one tester per session to play "chaos operator" for 5 minutes; the GM records any recovery assist needed |
| **Does the payoff land?** | Ask the party what they now know about Coldsteel and how they plan to approach it |

**Telemetry:** an in-memory log the GM can export as JSON after the session. No network calls.

## 9.6 GM controls (separate window)

| Control | Purpose |
|---|---|
| **Truth view** | Section 5.9 |
| **Pause / slow / speed** world | Handle table interruptions (pizza, rules questions) |
| **Hint ladder** | Send one of four escalating pneumatic-tube messages, or free text in the sentries' voice |
| **Repair all / resupply** | Restore posts, buoys, brands instantly |
| **Threat controls** | Send a threat home, freeze it, or spawn it toward a chosen target for drama |
| **Grant / revoke** | Grant a signature artefact for a body, set the Lens calibrated, force any Lectern grade |
| **Pacing** | Shift Elgarz's arrival ±2 minutes before the session starts (re-runs the back-integration) |
| **Reset** | Full reset to ignition, or reload any autosave |
| **Describe** | Plain-text readout of any panel |
| **Session log** | Export telemetry |
