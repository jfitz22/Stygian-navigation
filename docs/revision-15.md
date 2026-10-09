# Revision 15 review

Base: Revision 14, `cb29c3b2ff66d1ae11921da85c577729dc8ec08b`.
Branch: `codex/revision-15-art`. Backup tag: `backup/revision-14-before-art`.
This branch is for review only. Do not merge or deploy until Jordan approves.

## Changes

- Ported the approved green enamel/charcoal steel, paper, fixed-end nameplates, button caps, amber lamps, porthole, fog and iceberg textures onto Revision 14. The original animated fire remains behind the furnace grate.
- Retained Revision 14 fleet rendering and rules; no photographic ship replacements or white backgrounds.
- Added skiff/tower art to gunnery and ceramic connector plates plus curved wires to the fuse game. Hit targets cover the visible terminal plates.
- SUCCUBUS replaces the GM DEVIL button. Legacy DEVIL rune indices and commands invoke the same new behavior, preserving saved rune mappings.
- All 15 supplied covers appear in `src/banner-catalog.js`, with equal selection weight. The host chooses two distinct covers per activation and distributes them across six operator panels and each officer primary board/fleet board. An active defence becomes that officer's primary board.
- Curtains descend in 700 ms, hold for 5 seconds, then rise in 550 ms. One or two randomly selected operator/connected-officer primary panels require PULL UP. The GM remains uncovered. Heart greeting, large cord handle, keyboard activation and reduced-motion support included.
- Host snapshots preserve image choices and dismissed state through officer refresh/reconnection. Stale dismissals cannot affect a new roll. Local/relay duplicate messages and out-of-order snapshots are ignored.
- No preview auto-setup, heat/fatigue freezing, audio suppression or network configuration changes were imported.
- Removed an obsolete blue-beacon count that displayed undefined on the GM screen.

## Verification

- `node tools/check.mjs`: all 245 checks pass, covering the existing game simulation. The legacy DEVIL expectation now checks the SUCCUBUS alias.
- `node tools/check-banners.mjs`: 200 rolls; all 15 images reachable, two distinct covers, correct panel set and 1–2 sticky panels, timing, unchanged gameplay RNG, stale/duplicate/wrong-role dismissal, save/load and old-save defaults.
- Browser: all six operator covers and all officer covers render; GM remains uncovered; images load; automatic lifting and persistent pull work; inert controls are restored.
- Actual Supabase relay verified with BroadcastChannel disabled in a separate browser context: one GM click causes one roll. Officer reload preserves its sticky curtain, and remote pulling is acknowledged by the host and removes the cover.
- Fuse-box pointer drag completed a matching connection with the new art. Gunnery and fuse-board screenshots inspected. Terminal asset returns HTTP 200.
- `git diff --check` clean.

## Review / operating notes

Run `python -m http.server 8772 --bind 127.0.0.1` from this checkout, then open `http://127.0.0.1:8772/`. GM: `/gm.html`; officers: `/station.html?role=gunnery` (also signals/engineer), using the operator's code. Use a separate room from a live session. All participants should load Revision 15 together; mixed Revision 14/15 pages do not share the new banner UI.

Banner images are original supplied PNGs, loaded on demand, approximately 3 MB each. A first roll on a slow connection may show the curtain backing before the image finishes loading. Save timers use wall-clock time: ordinary curtains expire while closed; sticky curtains remain until pulled. Defence timers continue during the distraction, as in the existing game.

The regression and browser checks are evidence of compatibility, not a guarantee for every browser/device. No production deployment or merge is part of this revision.
