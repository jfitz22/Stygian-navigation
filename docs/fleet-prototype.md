# Fleet Officer prototype, version 2: "Salvo & Soundings"

A playable test of the Fleet Officer's game, judged by feel before any art, station or manual work.
Page: `fleet-proto.html`. Rules: `src/salvo.js`. Balance runs: `node tools/sim-salvo.mjs`.

Version 1 (one shared sea, fog, ships that move) was dropped after play: too much clicking, no real tracking,
and choosing between moving and shooting felt limiting. Static enemies keep every mark true.

## Rules as built
- **Two boards, 12×12.** Ours (we see it) and theirs (we map it with our shots). Ships never touch.
  Their ships never move.
- **Fleets:** ours 2/3/3/3 (the 2 is the Fleet Officer's flagship; the 3s carry Gunnery, Signals, Engineering).
  Theirs 4/3/3/2.
- **Salvo rounds:** up to 60 s, or press FIRE. Both fleets fire at once: one shot for each of our ships afloat; they
  fire one per ship afloat plus one from their flagship's guns. Hits name the ship's length.
- **Sinking** shows the ship's outline, and the water round it is marked clear (ships never touch).
- **Glaciers:** 4 on each board, drifting a square a round in the direction of their arrow (they turn back at the
  edge). They stop shells ("ICE"). One that runs into a ship scrapes it: a free hit, and on their board the log says
  where ("the glacier at C2 struck a ship at C3").
- **Specials, loaded by flag code:** a department hoists three flags; the Fleet Officer's codebook reads each by its
  place in the hoist; the department enters the three runes. New flags 75 s after the special is used.
  - Gunnery: heavy shell, a 2×2 burst.
  - Signals: sounding, the number of ship squares in one row or column.
  - Engineering: boost, one of our ships moves a square (their hits on it go stale).
- **Waves:** sink their fleet and ours is refitted, and a new wave comes. Lose all four: the fleet is lost.

## Balance (simulated steady Fleet Officer, about 35 s a round)
Board size, simulated: 10×10 ≈ 7 min a wave, 12×12 ≈ 9 min, 14×14 ≈ 11 min. Chosen: 12×12.
With their flagship's extra gun: about 2.5–3 waves in a 40-minute session; 7–10% of waves lost.

## Not in the prototype yet
Station pages for each department, the Fleet Officer's book, station damage visuals, the link to the main game, art.
