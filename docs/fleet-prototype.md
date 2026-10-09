# Fleet Officer prototype: the shared sea

A playable test of the Fleet Officer's game, judged by feel before any art, station or manual work.
Page: `fleet-proto.html`. Rules: `src/seawar.js`. Balance runs: `node tools/sim-seawar.mjs`.

## Rules as built
- **The sea:** 11×11. Our home waters are the bottom 3 rows, theirs the top 3, open water between.
  5 glaciers (1–2 squares) drift a square every 3 beats in the open water; they stop ships and shells ("ICE").
- **Fog:** our ships see the 8 squares around each of their squares. Enemy ships show only inside that,
  under a star shell, if spotted by a near-ram, or for good once an orange beacon is lodged in them.
- **Fleets:** ours 2/3/3/3 (the 2 is the Fleet Officer's flagship; the 3s carry Gunnery, Signals, Engineering).
  Theirs 4/3/3/2.
- **The beat:** every 25 s (or READY) both fleets act at once. Each ship gets one order: fire at any square, move one
  square, or turn 90° about its second square. No order: it holds fire. Moves resolve first, then every shell lands.
- **Shot marks fade after 8 beats** (ships move, so old news goes stale).
- **Specials:** each department hoists three flags; the Fleet Officer's codebook reads each flag by its place in the
  hoist and gives a rune; the department enters the three runes and a special token is loaded. The Fleet Officer
  fires it as one ship's order. New flags 75 s after it is used.
  - Gunnery: broadside (3 in a line), star shell (lights a 3×3 for a beat), orange beacon (the ship hit stays visible).
  - Signals: aerial scan (how many enemy ship squares in a 3×3).
  - Engineering: repair party (patches one hole).
- **The enemy:** fires at what it sees, then around its hits, then blind into our side of the sea. Its guns are ready
  80% of beats. Sometimes it closes on its last contact; badly damaged ships pull back.
- **Waves:** sink their fleet and ours is refitted (sunk ships included) and a new wave comes. Lose all four: the fleet is lost.

## Balance (simulated steady Fleet Officer, 25 s beats)
A wave takes about 6 minutes; about 3.7 waves in a 40-minute session; about 4–6% of waves lost.

## Left for after the prototype
Station pages for each department, the Fleet Officer's book, station damage visuals, the enemy shelling the Watch,
the link with the main game, art.

## What to judge
Is it fun? Is the Fleet Officer busy but not swamped? Do the flag codes feel good or like a chore? Is 25 s right?
