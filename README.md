# 🏜️ Dustbowl Royale

A cartoony, **chubby-character isometric battle royale** set in a post-apocalyptic wasteland. Runs entirely in the browser (no install, no build step) on **PC (keyboard + mouse or gamepad)** and **phones (touch)**.

Jump from the cargo blimp, loot crates and houses, fight up to 24 bots and infected wildlife, drive rusty vehicles, and outrun the shrinking toxic dust storm to be the **last chonk standing**.

## ▶ Play

- **Online:** enable GitHub Pages (Settings → Pages → Deploy from branch → `main` / root). Then play at `https://zzyzxisme.github.io/dustbowl-royale/`
- **Locally:** run a static server in this folder, for example `npx serve` or `python3 -m http.server 8000`, then open `http://localhost:8000`. ES modules don't load from `file://`.

## 🎮 Controls

| Action | Keyboard + Mouse | Gamepad | Touch |
|---|---|---|---|
| Move | `W A S D` | Left stick | Drag left side |
| Aim / Shoot | Mouse / Left click | Right stick / `RT` | Drag right side (push far to fire), tap to shoot once |
| Aim down sights | Right click | `LT` | – |
| Sprint | `Shift` | Push stick fully / `L3` | Push stick fully |
| Reload | `R` | `X` | RELOAD |
| Interact / loot / drive | `E` | `A` | USE |
| Weapon slots | `1` `2` `3` / mouse wheel | D-pad ← → / `R3`, `Y` swap | SWAP |
| Grenade | `G` | `RB` | NADE |
| Bandage / Medkit / Soda | `H` / `J` / `K` | D-pad ↑ / `LB` (smart heal) / D-pad ↓ | HEAL (smart) |
| Crouch | `C` / `Ctrl` | `B` | CROUCH |
| Map | `M` / `Tab` | `View` | MAP |
| Jump from blimp | `Space` | `A` | USE / JUMP |
| Vehicle brake / horn | `Space` / `Q` | `B` | – |
| Pause / Help | `Esc` / `F1` | `Start` | ⏸ |

The full control list is also in the in-game **How to Play** screen.

## ✨ Features

- **One map, "Rustwater Flats" (72×72 tiles).** Places include:
  - Trailer Park, Old Town and the Gas Station
  - a collapsed overpass and an army checkpoint
  - a farm with fields, Radio Hill with a bunker, and the Junkyard
  - a dried lake with a crashed plane
- **Bots:** 5 to 24 (15 by default). Each bot works out what to do on its own: loot, roam, fight, heal, or move into the safe zone. Difficulty comes in Easy, Normal and Hard.
- **Infected wildlife:**
  - Straw Dogs, which hunt in packs
  - Carrion Crows, which dive-bomb from above
  - Glow Rats, which swarm
  - the Bloat Hog mini-boss, which charges and drops rare loot
- **Loot:**
  - 6 weapons, each in 3 rarities, plus Jar Grenades
  - 3 ammo types
  - Bandages, Medkits and Fizzy Soda
  - helmets, vests and backpacks in levels 1–3
  - wooden boxes, loot crates, a bunker locker, and supply drops with red smoke
  - a **death stash** left by every KO'd player, which you can loot
- **Vehicles:** Dune Buggy and Rust Bucket pickup. They drift, leave skid marks, and can run over enemies. They catch fire when damaged and explode when destroyed.
- **Storm:** a shrinking toxic dust storm over 5 phases, plus explosive barrels and radioactive goo.
- **Art:** all of it is drawn in code as crisp cartoon vector art. It's sharp on retina and HD screens and loads no image files.
- **Audio:** all sound is generated in the browser with the Web Audio API. Sounds are positioned left/right and get quieter with distance. The western-style music gets more intense during fights. Music and sound effects each have their own on/off switch and volume slider.
- **Settings:** graphics quality (Low / Medium / High), screen shake, aim assist and an FPS counter. Settings are remembered in the browser.
- **Installable (PWA):** add it to your home screen for fullscreen landscape play, and it can work offline.

## 🧱 Tech

Plain JavaScript ES modules and Canvas 2D, with no dependencies and no build step.

```
index.html, css/style.css, manifest.webmanifest, sw.js
js/main.js      boot + fixed-timestep loop
js/game.js      match flow, player control, combat, loot, storm, supply drops, particles
js/ai.js        bot brains
js/entities.js  humans, creatures, vehicles, containers, inventory rules
js/world.js     map layout, collision, line-of-sight, A* pathfinding
js/render.js    isometric renderer (cached ground chunks, depth sorting, roofs, storm, effects)
js/art.js       procedural cartoon art
js/audio.js     synthesized SFX + adaptive music
js/input.js     keyboard/mouse, gamepad, touch twin-sticks
js/ui.js        HUD, minimap, menus, loot panel, settings
```

See [PLAN.md](PLAN.md) for the original design plan.
