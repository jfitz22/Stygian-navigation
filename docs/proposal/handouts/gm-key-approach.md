# GM master key: approach and sample page

## Approach [PROPOSED]

- **Generated from the game data.** A `npm run handouts` script renders both expert manuals and the GM key from the same scenario file and seed, as print-ready HTML (CSS paged media) that you save to PDF from the browser. This guarantees the key matches the game build.
- **Two layers:** the *static* key (true signatures, roster, trajectories, module solution tables) and the *live* GM window (positions, threats, evidence, Lectern error right now).
- **Spoiler-graded:** page 1 is safe to glance at mid-session (pacing, hint ladder); later pages contain the solutions.

## Sample page

```
┌────────────────────────────────────────────────────────────────────┐
│ GM KEY · Scenario "Last Watch v1" · seed 0x5A17                    │
├────────────────────────────────────────────────────────────────────┤
│ HINT LADDER (send via pneumatic tube from the GM window)           │
│  1. "Old Ostrevax swore the Bull sings loudest in the north-east." │
│  2. "Lower a line, officer. The big ones ride the deep water."     │
│  3. "Coldsteel's halls ring hollow, and its bones are iron."       │
│  4. GM: force a Hookspur camera glimpse of Elgarz's straight shadow│
├────────────────────────────────────────────────────────────────────┤
│ BODY            DRAFT     H   M   C         MEDIUM   SEAL          │
│ Elgarz          Colossus  ✓   ✓   G+B+Y     Void     ✠ ♉ ✧         │
│ Drowned Convoy  Glacier   ✓   ✓   –         Void     –             │
│ Penitent Choir  Glacier   ✓   –   G+B       Void     ✧ ✠ ○         │
│ Shed Horn       Glacier   –   ✓   Y+B       Solid    ⚒ ♉ ○         │
│ ...                                                                │
├────────────────────────────────────────────────────────────────────┤
│ COMMON DECODING MISTAKES                                           │
│  Elgarz read with medium SOLID gives  ⚒ ☼ ○ → "does not know"      │
│  Penitent Choir: no Bull. Players may call it Elgarz; it is not.   │
│  Shed Horn seal → "The Bull is known. His house is not here."      │
├────────────────────────────────────────────────────────────────────┤
│ LENS LITANY (plate: Bone Fork, Gallows-Eye, Split Spire, Coil)     │
│  Wind N/NE: Split Spire, Gallows-Eye, Coil, Bone Fork              │
│  Wind E/SE: ...                                                    │
├────────────────────────────────────────────────────────────────────┤
│ TIMELINE                                                           │
│  03:30 Elgarz enters NE   06:00 Penitent Choir enters NW           │
│  12:00 Storm Vharl crosses north   14:00 Shed Horn closest to Tomb │
└────────────────────────────────────────────────────────────────────┘
```
