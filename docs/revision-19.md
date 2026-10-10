# Revision 19: five ships a side, the Fleet Officer's own games, shells, clearance and disguised warships

Built on revision 18.

## The battle (`src/fleet.js`, `src/fleetui.js`)
- Five ships a side. Ours: the Fleet Officer's main ship (4) and picket (2), Gunnery, Signals, Engineering (3 each).
  Theirs: 5, 4, 3, 3, 2. A wave ends when the enemy is down to one ship (it runs); ours is refitted, a new fleet comes.
- All four specials start loaded, each with an icon and an animation (burst, sounding sweep, boost wake, scan flash).
- Department reloads: four flags (codebook is 4 places × 12 flags). Every second reload (2nd, 4th, 6th…) a Morse
  question follows (six words at most, three one-word answers in Morse). Wrong answer: 60 s lockout, then new flags
  and a new question.
- The Fleet Officer's special: the crosshair scan (7 squares, R turns the long arm), sights hulls without hitting.
  Reloaded by decoding a dispatch (Mastermind: 4 lights, 6 colours, 8 tries), or the dispatch unmasks a disguised
  warship instead (tagged on the chart, EXCLUDED on the case board).
- Enemy: drops stale hits when ours move (boost, redeploy, relaunch); sounds a row or column of our water every 4
  salvos (red band on our table) and works along it if it finds us.
- Salvage: one dashboard per sunk ship in the right-hand column: board → power from Engineering → the commander
  redeploys her anywhere (or at random; after 3 salvos ready she is placed automatically). No auto relaunch: with no
  Engineering the GM relaunches.
- Shells on the Watch while one of ours is down: 50% the first salvo, then 20% a salvo, never while a shelled machine
  is still broken. A shell breaks a machine and/or asks for the password; every third ask without a security update
  is a lockdown. The operator's screen shakes and the wire says why.
- Station damage (the Fleet Officer's is the 4-long): 1 hit cracks the glass, 2 tilt the station 10°, sunk turns the
  lights red, until she is back at sea. Table clicks stay accurate on a tilted station.

## Also
- Depth charges: the Fleet Officer's defence (upside-down Space Invaders, 45 s, 4 hull hits). Fail: their main ship
  (or another of ours) takes a hit and the enemy knows where.
- Green beacon: after the password, FLEET OFFICER CLEARANCE REQUIRED (two Morse questions, three Morse answers each).
  Skipped with no Fleet Officer; waived if they drop out; stands down after 3 minutes; GM can grant it.
- Four disguised warships in the sea (large, hollow, metal, radio RRW MID; orbs show an iron hull). A beacon in one
  plots a whole enemy ship on the fleet tables (once each). Own random numbers: the rest of the sea is unchanged.
- Beacons: 5 red, 2 orange, 1 green at the start and at most (the workshop will not overfill the rack).
- Operator: DEPLOY AT RANDOM on the deploy card; four crew cards; wire messages for station events.
- Stations: the fleet tables sit under the flag panel in the right column (smaller); posters reach the Fleet Officer.
- GM: load specials, relaunch our sunk ships, land a hit on a chosen ship (either side), enemy radar sweep, enemy
  falls back (new fleet in 90 s), depth charges, grant clearance.
- Manuals: FL-1 to FL-5 (battle, codebook + Morse reloads, salvage and shells, Morse table and clearance, dispatches,
  warships and depth charges); LW-0, LW-0B, LW-0C, LW-0E, GU-1, GU-2, GU-5, EN-7, SI-6 updated.

## Balance (`node tools/sim-fleet.mjs`)
About 7 minutes a wave, ~5 waves in 40 minutes, no fleets lost; about 7 of our ships sunk a session and roughly as
many shells on the Watch (fewer in play, since a still-broken shelled machine blocks the next shell).
