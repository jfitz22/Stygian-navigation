# 8. Visual and audio direction

## 8.1 Look [PROPOSED]

**One-line pitch:** a 1970s naval sonar room built by devils out of iron, brass and cracked porcelain, then left in a freezer for a thousand years.

| Layer | Treatment |
|---|---|
| **Room** | Dark riveted iron, brass bezels with worn edges, porcelain insulator knobs (some cracked), frosted glass, hoarfrost creeping into corners. Warm furnace glow from the Engineering side lights the left edge of the Main view |
| **Panels** | Each panel is a separate module with its own bezel, screws, engraved brass nameplate and a small stencilled number (Objects in Space's modular feel). Blanking plates mark future expansion |
| **Displays** | Each display type has its own visual language (Signal Simulator's variety): phosphor green PPI, amber nixie numerals, monochrome raster camera, indigo glass Loom, paper strips, brass orrery, iron keypad |
| **Abstraction** | Bold, thick strokes and few colours inside displays (In Other Waters). Texture lives on the frames; data stays clean |
| **Labels** | Infernal military engraving on some panels; others deliberately unlabelled; a few later handwritten paper labels taped on by the sentries ("DO NOT PING TWICE") as diegetic hints |
| **Motion** | Needles have inertia and slight overshoot. Knobs click in detents. Breakers thunk with a 2-frame camera shake. The Sweep arm rotates at a steady, hypnotic rate. Phosphor fades over seconds |

### Palette (draft)

| Token | Hex | Use |
|---|---|---|
| iron-900 | `#0d0f12` | Room background |
| iron-700 | `#1b1f24` | Panel faces |
| brass | `#b08d57` | Bezels, nameplates |
| brass-light | `#e8d7a8` | Engraved text |
| porcelain | `#e9e4d6` | Knobs, insulators |
| phosphor | `#5cff9d` | Live measurement |
| amber | `#ffb347` | Decoded / authored |
| ghost | `#f4f1e6` | Predictions |
| threat | `#ff4b3a` | Danger |
| resonance | `#b070ff` | Deep current, choir |
| frost | `#9ad0ff` | Frost, Tomb |

All data colours are checked for contrast on their display background and for deuteranopia/protanopia distinguishability; every state also has a shape change.

## 8.2 Sound [PROPOSED]

All sound is synthesised at runtime with the Web Audio API or made from licence-free recordings, so there are no asset licensing issues.

| Category | Examples | Purpose |
|---|---|---|
| **Bed** | Wind (intensity follows the observatory's local wind), furnace thrum (pitch follows coal draw), distant ice groans | Constant sense of a living machine and a living world |
| **Controls** | Relay clicks, breaker thunks, knob detents, crank ratchets, chain rattle (deep line), printer chatter, pneumatic whoosh | Immediate feedback (Nauticrawl's lesson) |
| **Instruments** | Sonar ping and echo (delay matches processing), Choir chords (actual three-note synthesis; tone families are timbres), Hearkener hiss and low leviathan drone, Lens hum rising with alignment | Information by ear: the Choir and Lens can be tuned by sound alone |
| **Threats** | Remorhaz: a rising seismic rumble in the post's channel; Grindmaw: a sub-bass swell; Brood: chittering | Warnings with spatial meaning |
| **Comforts** | Percolator gurgle, gramophone records (public-domain recordings or original compositions), the bell, the imp's groan at its own jokes | Character |

**Mixing rules:** information sounds duck the bed by 6 dB. Three separate volume controls (Ambience, Instruments, Music) plus a big **MUTE ALL** on the frame (accessibility requirement), and a "streamer mix" preset that lowers bass for Discord compression. The gramophone is the only music, so muting music never removes information.

## 8.3 Streaming and accessibility

- Target 1920 × 1080; the layout scales down to 1280 × 720 with text staying ≥ 14 px.
- No essential information carried by colour alone or by sound alone (every chord has a lamp pattern; every alarm has a lamp).
- Flicker capped below 3 Hz; afterglows instead of flashes.
- A "high legibility" toggle that strips frame textures and thickens display strokes.
- A "describe" hotkey (GM window only) that reads out the current panel's state in plain text, for a visually impaired player or for the GM to check what the operator is seeing.

## 8.4 Concept art pipeline

Stage 2 (grey-box) uses the wireframe proportions. Stage 4 (polish) layers hand-made SVG and canvas art: bezels and frames as reusable SVG components, displays drawn live in canvas. A painted concept mockup is welcome before Stage 4; I can produce an SVG/HTML concept render of the Main view once you approve the layout.
