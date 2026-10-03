# Black Iron art branch — review only

Base: Revision 8, d37a90c1f87e3c9e80b21b4760972bf256e1de06.
Preserved on GitHub as `codex/pre-black-iron-2026-10-03`.
Art branch: `codex/black-iron-art`.

Do not merge or publish until Jordan explicitly approves. GitHub Pages currently
serves `live`; this change does not update that branch or deployment settings.
Keep the pre-art branch as the clean reference even after a future release.

## Integration

The art is an additive CSS layer plus a presentation module. The module reads
furnace state to animate fire and textures the existing iceberg silhouette before
its original feature marks are drawn. It does not mutate game state. Original
orb button event handlers and the original ending remain in app.js.

The mockup's demo state, power switching, muted audio stub, desk, style selector,
custom ending, and added launcher safety-cover interaction are not included.
Orange sounding and blue drift-log beacon labels retain Revision 8 meanings.
The original startup flow, notes, sound controls, and all challenge settings remain.
The source PNGs are locally served assets (approximately 4.95 MB total); no runtime
image generation or backend is required. They originated in the local art study.

## Validation (2026-10-03)

- Baseline: `node tools/check.mjs 40`, 106 PASS / 0 FAIL, exit 0.
- Art branch: same command, 106 PASS / 0 FAIL, exit 0.
- Logs are in docs/art-validation/.
- No changes to sim.js, scenario.js, glyphs.js, audio.js, GM or either manual.
- Browser: startup, mute control, deck navigation, 12 rune keys, orange beacon
  selection, repair crew display, pause/resume, fuel consumption (4 to 3), and
  power toggle verified. QA setup used existing debug/GM hooks only in the test
  browser; no such setup is shipped.
- Isolated browser test: camera power enabled; hold-to-turn changed heading from
  180 to 194 degrees and stopped at 194 on release.
- Original Geryon ending played through to win screen; Keep Watching returned.
- Visual inspection at the desktop preview size covered both decks and the latest
  case-board/sonar arrangement. Only console errors observed were missing favicon
  requests, unrelated to this change.

These checks are not an exhaustive human playthrough or cross-browser certification.
Please review clue legibility and physical control appearance during normal play.
The original fixed-size scaling and narrow-screen limitations remain.

## Preview

Serve this branch using the README's local-server instructions. The preview in this
session is http://127.0.0.1:8768/ . It is the real game, not the relaxed art demo.
