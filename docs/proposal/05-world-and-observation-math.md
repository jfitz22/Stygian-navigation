# 5. World, observation and tracking model

Everything here is **[PROPOSED]** and every constant is **[TUNE]**. The goal is the simplest model that (a) makes wind and current matter in a way players can reason about, (b) is deterministic for testing, and (c) never lies.

## 5.1 Units, clock and scale

| Quantity | Proposal | Why |
|---|---|---|
| Distance | Miles. Lore uses miles (the 1,000-mile rule) | One unit for map, ranges and the exclusion rule |
| Map | 4,800 × 3,200 mi slice of Stygia, observatory on a southern cliff at (2,400, 250) | Large enough that the Tomb and Elgarz can be >1,000 mi apart with room to move |
| Clock | **Watch time** in real minutes:seconds since ignition (`07:14`) | Players reason in real time; no conversion needed |
| Fiction | One watch-second ≈ ten Stygian minutes (shown on a small dial: "BELL 3") | Makes speeds physically plausible: 0.5 mi per watch-second ≈ 3 mph |
| Sim step | Fixed 10 Hz (dt = 0.1 s), RK2 integration; render at display rate with interpolation | Deterministic, cheap, testable |
| Randomness | Single seeded PRNG (e.g. mulberry32) per subsystem stream, scenario seed in the URL | Reproducible bugs and playtests |

## 5.2 Drift model

### Fields

- **Wind** `W(x, t)`: a slowly veering prevailing wind plus 2 to 4 authored storm cells. Each storm is a moving Gaussian vortex with a centre path (authored spline), radius 200 to 400 mi, peak 40 to 60 world-mph (≈ 7 to 10 mi per watch-second in sim units).
- **Surface current** `Us(x, t)`: sum of authored jets (flow along a spline with a Gaussian cross-profile) and gyres (Rankine vortices), plus a small wind-driven term `0.01 · rot(W, +30°)` so storms visibly stir the surface (an Ekman-flavoured nod, cheap and explainable).
- **Deep current** `Ud(x)`: separate authored jets and gyres, nearly steady, with a gentle 8-minute pulse in strength (±15%). Different directions from the surface layer in key regions, especially along Elgarz's path.

All fields are analytic functions, so the truth sim, the Orrery/Loom samplers and the GM view all evaluate the same code.

### Berg motion

For each berg *i* with draft class *c*:

```
v_i = a_s(c)·Us(x_i,t) + a_d(c)·Ud(x_i) + a_w(c)·W(x_i,t) + v_sep(i)
x_i(t+dt) = x_i(t) + v_i·dt          (RK2)
```

| Draft class | a_s (surface) | a_d (deep) | a_w (wind) | Examples |
|---|---|---|---|---|
| Floe | 1.00 | 0.00 | 0.030 | Generic small ice (NSIDC's ~2% of wind for free-drifting sea ice is the inspiration) |
| Berg | 0.70 | 0.30 | 0.015 | Most candidates |
| Glacier | 0.35 | 0.65 | 0.006 | Drowned Convoy, Mirrorberg, Shed Horn |
| Colossus | 0.10 | 0.90 | 0.002 | **Elgarz**, Tomb of Levistus |

`v_sep` is a soft separation push so bergs never overlap and coastlines repel. No inertia, no Coriolis: drift literature includes both, but they add lag and curvature players cannot measure, so I drop them for legibility. I note the simplification in the GM key.

**Why this is good gameplay:** a floe in a storm zips downwind; a colossus ignores the storm and follows a deep current the players cannot see unless they lower a buoy line. The same sea teaches two lessons.

### Elgarz's authored entrance (back-integration)

1. Author **where** Elgarz should be at watch time 03:30: just inside the north-east edge of Hookspur Post's view and the Sweep's far ring.
2. Integrate the *same* drift equation **backwards** from 03:30 to 00:00 to find the start position. Because the model has no inertia, backward integration is exact (to step error).
3. Integrate forwards for 60 minutes and **assert** (automated test) that the minimum distance to the Tomb is ≥ 1,050 mi, that Elgarz stays inside observation coverage between 03:30 and at least 45:00, and that it never collides with the coast.
4. A deep slow gyre ("the Gyre of Patience") near the centre of coverage keeps Elgarz lingering. It slows every deep-keeled berg there, so it is honest.

With the sample numbers below Elgarz moves ~0.48 mi/s, so it covers ~100 mi in the first 3½ minutes and ~700 mi over a 25-minute session. The Choir Receiver hears its triad from the start at low strength (`strength ∝ 1/d`), rising noticeably as it approaches: this is the "detectable approach."

## 5.3 Observation records

Every measurement creates an immutable record:

```ts
type Observation = {
  id: string;
  sensor: 'sweep' | 'camera' | 'sonar' | 'hearkener' | 'choir' | 'orrery' | 'loom' | 'lens';
  sampledAt: number;      // watch time the world was sampled
  deliveredAt: number;    // watch time the players can see it
  shape:                  // what it says, always with honest uncertainty
    | { kind: 'point'; x: number; y: number; r: number }        // circle containing truth
    | { kind: 'fan'; ox: number; oy: number; brg: number; dBrg: number; rMin: number; rMax: number }
    | { kind: 'bearing'; ox: number; oy: number; brg: number; dBrg: number }
    | { kind: 'cell'; brg0: number; brg1: number; r0: number; r1: number; intensity: number };
  attrs: Record<string, number | string>;   // draft estimate, echo trace id, triad id, wind vector...
  truthId?: string;       // hidden: which body produced it (GM view and tests only)
};
```

**Honesty invariant (tested):** for every record, the true position of `truthId` at `sampledAt` lies inside the record's shape. Noise is zero-mean and clipped to the stated bound. Readings can be coarse; they are never wrong.

**Delivered vs sampled:** the chart always draws a record at its **sampled** position. A sonar contact delivered at 07:23 that was sampled at 07:14 shows where the berg was at 07:14, with both stamps printed beside it. The berg has moved on, which is the point.

### Per-sensor parameters

| Sensor | Shape | Precision | Delay | Range | Weather effect |
|---|---|---|---|---|---|
| Sweep | cell | 6° × 150 mi | 0 (sampled when the arm passes) | 1,400 mi far, 700 mid, 350 near (near = finer cells, 3° × 50 mi) | Storm cells add clutter blooms that are honestly labelled with a ragged edge |
| Camera MARK | fan | bearing ±1°; range band from length class and storm light (e.g. 120 to 180 mi) | 0 | 350 mi × visibility | Visibility from Orrery; snow obscures, WIPE clears for 6 s |
| Sonar | point | r = 15 mi; draft ±20% | 9 s + 2 s per 100 mi | 450 mi from buoy | Storm over buoy adds +5 mi uncertainty |
| Hearkener | bearing | ±6° (±3° with DAMPER low) | 0 | 900 mi for loud sources | Storms raise noise floor |
| Choir | bearing | ±2° at peak strength | 0 | 2,500 mi, strength ∝ 1/d | Gramophone radio bleed |
| Orrery | vector | ±5° and ±10% | refresh 20 s | posts and observatory | |
| Loom | vector | ±5° and ±10% | refresh 20 s | live buoys only; deep layer needs lowered line | |

### Fading and persistence

- Sweep blooms: alpha = `exp(-(now − deliveredAt)/15 s)`.
- Sonar contacts on chart: `exp(-(now − deliveredAt)/40 s)`; a faint ghost at 10% persists until 3 minutes old so trails remain readable.
- Pins, pencil, snapshots, track cards, beacons: persist until removed.
- Any record can be **kept**: dragging it to a track card or pressing PIN converts it into a permanent amber mark with its stamps.

## 5.4 Association and tracking (the Reckoner)

### Association is a player act

Players drag records onto a track card. The Reckoner never silently guesses which echo belongs to which berg. It does provide one honest helper: if the implied speed between two fixes exceeds 1.2 mi/s (faster than anything in the scenario) a **IMPLAUSIBLE** lamp lights. It does not block.

### Prediction

Given fixes `f_k = (p_k, σ_k, t_k)` on a card, a draft class `c` chosen on the knob, and the latest Orrery/Loom samples (with ages):

1. **Environment velocity** `v_env(x, t)` uses the Reckoner's *own* sampled fields (interpolated from buoy and station samples). It has no access to the truth. If no deep sample exists near the track, the Reckoner uses the "standard keel assumption" printed in Expert B's manual: deep ≈ ½ × surface.
2. **Fitted velocity** `v_fit`: weighted least squares over the fixes (needs ≥ 2).
3. **Residual** `r = v_fit − mean(v_env over the fix interval)`. Displayed on the card as **RESIDUAL 0.36 @ 119°**. When `|r| > 0.15` and no deep sample exists, the **DEEP?** lamp lights.
4. **Present estimate**: `p̂(now) = p_last + ∫ (v_env + r) dt` from `t_last` to now.
5. **Uncertainty ring**: `σ(Δt) = √(σ_last² + (σ_v·Δt)²)`, with `σ_v = min(σ_fit, σ_env)` and `σ_env = 0.03 + 0.002·envAge` (mi/s, age in seconds). The ring is drawn at 2σ and labelled **RECKONED** so it reads as a prediction.

This is a lightweight alpha-beta style estimator: fixes correct position, the environment model carries it forward. It is also explainable on paper, which matters because the Plotter may beat it.

### Worked example (numbers from a quick calculation)

Elgarz (colossus) is at a spot where surface current = 0.35 mi/s toward 060°, deep current = 0.52 toward 100°, wind 6.67 (sim units) toward 248°.

- **Truth:** `0.10·Us + 0.90·Ud + 0.002·W` ≈ **0.48 mi/s toward 098°**.
- **Reckoner with draft = glacier and no deep sample** (keel assumption): ≈ 0.20 toward 058°. Error ≈ 0.36 mi/s. With a 25-mile beam, the Lens slides off the target in about **70 s**: not enough for a full scan. The DEEP? lamp is lit because two fixes disagree with this model.
- **Reckoner with draft = colossus and a fresh deep sample**: matches truth within sample precision (±10%, ±5°), error ≲ 0.05 mi/s. The beam holds for **8+ minutes**.
- **Two camera/sonar fixes 90 s apart, no environment** (σ ≈ 15 mi each): `σ_v ≈ 0.24 mi/s`; the beam holds ~1.5 to 2 minutes, enough with patient manual trim.

So: environment data is the difference between "fight the lens" and "it holds." Good fixes alone are a legitimate, harder path.

## 5.5 Alignment and scan evidence

- Beam radius `R = 25 mi` (TUNE). The Lens's overdrive power setting widens it to 35 mi.
- Alignment `q = exp(−(d/R)²)` where `d` = distance from the aim point to the true position of the nearest body. The needle shows `q` honestly and continuously.
- Aim point = Reckoner prediction (SLAVE) + manual trim offset (2 mi per detent). Trim persists as an offset, so a good correction stays good.
- Evidence rate per channel: `dE/dt = 1.6 · P · g(q) · k_cal` per second, where `g(q) = max(0, (q − 0.35)/0.65)`, `P` is the Lens power setting (0.6 / 1 / 1.4), and `k_cal = 0.4` for M and C channels until the Lens Litany is calibrated.
- Each channel needs 100 units: about 60 s of good alignment at normal power. Channels fill **in parallel** if their requirements are met (C needs the Choir Receiver powered and peaked within ±2° of the target).
- **No reset.** Misalignment pauses accumulation. Evidence is stored per body, so returning to a body later resumes where it stopped.
- **Honest body tracking:** if the beam slides onto a different berg, a **NEW BODY** lamp flashes and the vials switch to that body's stored evidence. The Lens never credits one body with another's interior.
- On reaching 100, the channel prints an artefact (tomograph, rosette, triad). The artefacts require expert interpretation (section 7), so a full scan produces three conversations.

## 5.6 The lock criterion (Moorage Lectern)

The players submit: a fix position `p_T`, its time `T`, a velocity `v`, and a three-glyph **seal** (from the decoded choir triad). Most groups will press LOAD on a track card and tweak.

The Lectern evaluates, using the deterministic sim's truth for Elgarz:

```
e0 = | p_T + v·(now − T)        − x_E(now)      |
e1 = | p_T + v·(now + 90 − T)   − x_E(now + 90) |
```

| Grade | Condition | Lamp and sound |
|---|---|---|
| **Bound** | seal = Elgarz's seal, e0 ≤ 60 mi, e1 ≤ 90 mi | All four lamps, deep chain sound, Lens auto-holds Elgarz |
| **Strong** | e0 ≤ 120, e1 ≤ 180 | Three lamps |
| **Warm** | e0 ≤ 250, e1 ≤ 350 | Two lamps |
| **Faint** | otherwise | One lamp |

Seal behaviour:
- **No seal or a wrong seal:** "THE MOORAGE DOES NOT KNOW THIS NAME." No grade shown. This prevents brute-force searching the map with the Lectern.
- **The Shed Horn's seal (Geryon alone):** "THE BULL IS KNOWN. HIS HOUSE IS NOT HERE." An honest, lore-flavoured near miss that confirms the Horn is Geryonite and is not Elgarz.
- **Elgarz's seal:** grades as above.

Tolerances are deliberately generous relative to Elgarz's speed (~0.48 mi/s): a solution from a 2-minute-old fix with a velocity within ~30% passes. The 90-second look-ahead makes the velocity matter, so a perfect position with no motion estimate only scores Strong.

**Bound** is sustained: once bound, the Lectern keeps the lock regardless of later events, and the Lens can be pointed at Elgarz at any time with perfect alignment. This is the tabletop payoff (section 6.6).

## 5.7 Alternative models considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Authored splines** for every berg, environment purely decorative | Total pacing control | Violates the brief: weather must move ice | Rejected |
| **Spline plus environment perturbation** | Control plus some honesty | Players cannot explain residual motion; feels arbitrary | Rejected |
| **Kinematic drift with authored fields + back-integrated Elgarz** (this proposal) | Fully honest, explainable, testable; pacing via field authoring | Authoring fields takes iteration; needs a field-editing debug tool | **Recommended** |
| **Full dynamic drift** (mass, drag², Coriolis, inertia) | Realistic | Lag and curvature unreadable to players; harder to author | Rejected for gameplay |
| **Kalman filter in Reckoner** | Principled uncertainty | Opaque to players; more tuning | Possible later; the alpha-beta-style blend is easier to explain in Expert B's manual |
| **Grid-based fields** (precomputed vector textures) | Fast for many bergs | Authoring harder; sampling artefacts | Only if performance demands it (it should not at ~80 bodies) |

## 5.8 Tuning knobs (collected)

Beam radius; evidence rate; alignment threshold; sonar delay and radius; fade constants; Choir range; draft coefficients; storm schedule; Elgarz arrival time; Lectern tolerances; leviathan and remorhaz speeds and attraction radii; buoy and brand stock and rebuild time; furnace capacity and stoke duration. All live in one `scenario.json` and can be edited live from the GM window.

## 5.9 GM/debug truth view

The GM window shows: true body positions and IDs, signatures, draft classes, current and wind fields as streamlines, the next 2 minutes of every body's path, each observation's `truthId`, threat targets and ETAs, every evidence store, and the Lectern's live e0/e1 for the current track card. A timeline scrubber lets the GM fast-forward the world during prep (not during play) to rehearse.
