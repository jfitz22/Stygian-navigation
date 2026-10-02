# The Last Watch

![The Last Watch, mid-game](docs/screenshot.png)

A 20-minute observatory minigame for a D&D session in Stygia. One player works the machine on stream; four players hold the Operations Manual and decode what it says. Find Elgarz, prove it, mark it with a green beacon.

- **Play:** `index.html` (add `?seed=1234` to replay a particular sea; without it every watch is a fresh one)
- **Operations Manual** (save as PDF for the crew): `manual.html` (first edition) and `manual2.html` (second edition: the diagram book, US Letter)
- **GM truth view** (your screen only, passphrase `geryon`): `gm.html`
- **Design:** [docs/design.md](docs/design.md)

## Run it locally

The game uses ES modules, so it needs a local web server (opening the file directly will not work):

```sh
npx http-server -p 8080
# then open http://localhost:8080
```

Use the **▲ LOOK UP** button (or the up arrow key) to reach the overhead deck: the beacon launcher, the rune board, the wire service ticker and the repair bay.

Open `gm.html` in a **separate browser window** (not a background tab of the game's window: browsers pause hidden tabs, and the game would freeze). Both must be in the same browser.

## Host it

Everything is static. GitHub Pages serves the `live` branch at `https://jfitz22.github.io/Stygian-navigation/`. Builds under test go in `playtest/` on `live`, at `.../Stygian-navigation/playtest/`.

## Checks

```sh
node tools/check.mjs        # 40 seeds; pass a number for more or fewer
```

Runs whole sessions headless across many seeds and verifies the guarantees: Elgarz arrives at 3:00 and is seen on camera at least twice, it never enters the Tomb's ring or leaves reach, ice crosses several chart squares, storms white out cameras, the furnace, shark, keypad and radio rules, and that a careful green shot wins while careless ones miss.

`node tools/tune-cameras.mjs` searches for the bearing each of the evenly spaced camera posts should start at, so Elgarz's possible routes pass through camera view. Use it if you change the currents.

## Tuning

All gameplay numbers are in `src/scenario.js` under `TUNING`. Named icebergs, the radio table and the cabin wireless stations are in the same file.
