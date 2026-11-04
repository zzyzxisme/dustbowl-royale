# Dustbowl Royale — Draft Plan (v0.1, for review)

An original, cartoon-style **isometric battle royale** set in a post-apocalyptic wasteland.
It runs in the browser on PC (keyboard + mouse or gamepad) and on phones (touch).
It's in the same genre as PUBG (drop in, loot, last one standing), but every name, character, map and asset is original.

> Status: **DRAFT — waiting for your review.** No game code gets written until you approve or change this plan.

---

## 1. Core loop (one match ≈ 6–10 minutes)

1. **Drop in.** You and the bots parachute onto a small map from a passing cargo blimp. Hold the jump key to choose when to drop.
2. **Loot.** Open crates, smash wooden boxes, search houses, and take everything a dead bot was carrying.
3. **Survive.** Fight bots and infected animals while a **toxic dust storm** pushes everyone toward a shrinking safe zone (4 phases).
4. **Drive.** Jump into a rusty vehicle to cross the map fast or run people over.
5. **Win.** Be the last chubby survivor standing. Then you get a results screen (placement, kills, damage) and can play again.

## 2. Map: one level, kept small to save resources

- **"Rustwater Flats"**: a 72 × 72 tile isometric map (about 60–90 s to cross on foot, about 20 s by vehicle).
- Places on the map: a ruined gas station, a trailer park, a collapsed overpass, a junkyard, a dried lake with a crashed plane, a small farm (where the straw dogs live), and a radio tower on a hill.
- Props: dead cars, barrels (some explode), tyre stacks, sandbags, broken fences, dead trees, tumbleweeds, and puddles of radioactive goo.
- The map layout is hand-designed. Small details like debris and cracks are placed with a fixed random seed, so every match uses the same map with varied clutter.
- A minimap sits in the corner and a full map opens with M. Both show the storm circle and the next safe zone.

## 3. Characters: cartoony, chubby, readable

- Every human is round and chubby with a big head and stubby limbs, plus a bobbing walk, squash-and-stretch animation, and goofy faces (blinking, a surprised face when hit).
- Visible gear: helmet (3 levels), vest (3 levels), backpack, and the held weapon.
- Bots get random outfits (gas masks, bandanas, welding goggles, mohawks, hard hats) and silly wasteland names ("Big Tuna", "Mama Rust", "Sir Crumbs").

## 4. Infected and mutant wildlife (PvE)

| Creature | Behaviour | Threat |
|---|---|---|
| **Straw Dogs** (scarecrow hounds) | Packs of 2–4 sleep around the farm and fields, then sprint at you when they notice you | Medium. Weak to fire and shotguns |
| **Carrion Crows** (flying) | Circle overhead, then dive-bomb. Their shadow on the ground shows where they'll land | Low damage, hard to hit |
| **Glow Rats** (rodents) | Swarms of 5–8 come out of junk piles and sewers. Fast and tiny | Low each, dangerous in a swarm |
| **Bloat Hog** (mini-boss) | One big, slow, armoured hog that charges. Drops high-tier loot | High |

- Creatures attack bots too, so bots have to deal with them as well.
- Creatures respawn in small numbers in their home areas, capped so the action stays steady without hurting performance.

## 5. Bots

- **Recommended: 15 bots by default. A slider in the menu goes from 5 to 24** (25 players counting you, which is your requested maximum).
- Each bot runs a simple state machine: drop → loot nearest building → wander/patrol → engage (strafe, take cover, reload) → flee and heal → move into the zone → use vehicles sometimes.
- Difficulty setting (Easy / Normal / Hard) changes aim accuracy, reaction time, and how aggressive bots are.
- To keep the frame rate up, bots far from you update their thinking less often and skip expensive line-of-sight checks.

## 6. Loot, items, inventory (kept simple)

- **Weapons (2 slots plus melee):** Pipe Wrench (melee), Pea-Shooter Pistol, Rattle SMG, Boomstick Shotgun, Rust Rifle (AR), Long Tom (sniper), and Jar Grenades. Weapons come in 3 rarities (grey, green, purple) with a small damage bonus.
- **Ammo:** 3 types (light, shells, heavy).
- **Healing:** Bandage (slow, up to 75 HP), Medkit (full), Fizzy Soda (boost / regen).
- **Armor:** Helmet L1–L3 and Vest L1–L3. Armor absorbs damage and wears down as it does.
- **Containers:**
  - **Wooden boxes**: smash them for 1–2 common items.
  - **Loot crates**: press E to open. Better loot.
  - **Supply drop**: one or two per match fall with a parachute and give the best loot. Everyone sees the flare.
  - **Death crates**: when a bot or player dies, they drop a crate with everything they carried. Open it to take items.
- Loot screen: a simple grid that pops up next to the crate. Tap or click to take an item, or use "Take All". You walk over ammo and healing items to pick them up automatically.

## 7. Vehicles

- **Dune Buggy**: 2 seats, fast, flimsy.
- **Rust Bucket Pickup**: 4 seats, tough, slower.
- **Moped** (stretch goal): 1 seat, very fast, tips over.
- Each vehicle has fuel and health, explodes when destroyed, can run over enemies and creatures, and has drifting physics with skid marks and dust trails. Bots can drive simple point-to-point routes.

## 8. Graphics ("high quality cartoon")

- **Engine:** custom HTML5 Canvas 2D renderer with isometric depth sorting, written in plain JavaScript (ES modules). There's no build step, so it runs straight from GitHub Pages.
- **Art style:** every sprite (characters, creatures, vehicles, props, tiles) is drawn in code as vector art with thick outlines, soft cel-shading and bright colors over a dusty orange/teal palette. Sprites are pre-rendered once at the device's pixel ratio, so they stay crisp on HD and retina screens and run fast.
- **Effects:** soft drop shadows, muzzle flashes, bullet tracers, dust and smoke particles, cartoon "POW" hit sparks, an explosion shockwave, a toxic-storm haze over the edges of the screen, a day-to-dusk light shift, and screen shake (can be turned off).
- Graphics quality setting (Low / Medium / High) controls particle count, shadows and resolution scale, so older phones stay smooth.
- **Why no image files?** Making all the art in code means no licensing issues, a tiny download, and a consistent style. The trade-off is that the art is "clean cartoon vector", not painted illustration.

## 9. Audio (music and sound effects can be toggled separately)

- **All audio is generated live in the browser using the Web Audio API** at the device's native sample rate (usually 48 kHz). There are no audio files to download or license.
- **Sound effects:** sound changes with distance and left/right position. Includes:
  - each weapon firing, reloading, empty clicks
  - hits and footsteps
  - opening crates, smashing boxes, picking up loot
  - vehicle engine pitch that follows speed, plus horn and crash sounds
  - explosions
  - creatures: dogs snarling, crows cawing, rats squeaking, the hog grunting
  - storm wind
  - UI clicks, the victory fanfare and the defeat sting
- **Music:** a procedural looping soundtrack (twangy dusty guitar-style synth with drums) that builds to a tenser layer during fights and the final circle.
- Settings: Master, Music and SFX volume sliders, plus separate **Music on/off** and **SFX on/off** switches (also available from the pause menu). Settings are remembered in the browser.
- *Honest caveat:* synthesized audio sounds good and fits the cartoon style, but it isn't studio-recorded. If you want recorded audio later, we can add royalty-free CC0 sample packs.

## 10. Controls

### Keyboard + Mouse
| Action | Key |
|---|---|
| Move | **W A S D** |
| Aim | **Mouse** |
| Shoot / Melee | **Left Click** |
| Aim down sights (zoom) | **Right Click** |
| Sprint | **Shift** |
| Reload | **R** |
| Interact (open crate, loot, enter/exit vehicle) | **E** |
| Weapon slots | **1 / 2 / 3** (melee) or **Mouse Wheel** |
| Throw grenade | **G** |
| Use bandage / medkit / soda | **H** / **J** / **K** |
| Crouch | **C** or **Ctrl** |
| Map | **M** |
| Drop from blimp / open parachute | **Space** |
| In vehicle: drive / brake / horn | **W A S D** / **Space** / **Q** |
| Pause / Settings | **Esc** or **P** |

A **"How to Play"** screen in the main menu lists every key. A first-run tooltip and an in-game help overlay (press **F1** or **?**) show the same list.

### Gamepad (Xbox / PlayStation / generic, via the browser Gamepad API)
- Left stick moves, right stick aims (with aim assist), **RT** shoots, **LT** aims down sights, **A/✕** interacts, **X/□** reloads, **Y/△** swaps weapon, **B/○** crouches, **RB** throws a grenade, **LB** heals, **D-pad** picks an item, **Start** pauses, **View/Select** opens the map.
- Menus can be navigated with the gamepad, and on-screen prompts switch to gamepad buttons when a controller is detected.

### Mobile / touch
- Left virtual joystick moves. Right virtual joystick aims, and pushing it past the edge fires (twin-stick style). There's also an optional fire button.
- On-screen buttons for reload, interact, weapon swap, grenade, heal, crouch and map.
- Fullscreen and landscape lock prompt, plus an installable PWA so the game can be added to the home screen.
- On phones, the UI scales up and the default graphics quality is Medium.

## 11. Screens and UI

- Main menu: Play, Bots slider, Difficulty, Settings, How to Play, Credits.
- In-game HUD:
  - health and armor bars
  - weapon and ammo
  - players alive and kill count
  - kill feed (e.g. "Big Tuna bonked Sir Crumbs with a wrench")
  - storm timer
  - minimap
  - damage-direction indicators
- Pause menu (Resume, Settings, How to Play, Quit), plus a spectate-the-killer screen and a results screen after you die or win.

## 12. Technical architecture

```
dustbowl-royale/
├── index.html              # entry point, canvas + UI overlay
├── manifest.webmanifest    # PWA (add to home screen)
├── sw.js                   # offline cache
├── css/style.css
├── js/
│   ├── main.js             # boot, game loop (fixed 60 Hz update, rendering decoupled)
│   ├── engine/             # iso math, camera, renderer, input (kb/mouse/gamepad/touch), audio, particles
│   ├── art/                # procedural sprite painters (characters, creatures, vehicles, props, tiles)
│   ├── world/              # map definition, collision grid, spatial hash, storm zone
│   ├── entities/           # player, bot AI, creatures, vehicles, projectiles, crates/loot
│   ├── game/               # match flow, items/weapons data, inventory, damage
│   └── ui/                 # menus, HUD, settings, help overlay, mobile controls
├── PLAN.md
└── README.md               # how to play + controls
```

- **Performance budget:** steady 60 fps on a mid-range laptop and 30 fps or better on a mid-range phone, with 25 players plus around 30 creatures plus particles. The game uses a spatial hash for collisions, culls anything off screen, pools bullets and particles, and pre-renders sprites.
- **Hosting:** GitHub Pages (free) gives you a link you can open on PC or phone.
  - On a free GitHub plan, Pages needs the repo to be **public**.
  - If the repo stays private, you can still play locally by running a one-line static server (`npx serve`).

## 13. Build milestones (each one is committed and pushed, so there's always something playable)

| # | Milestone | Result |
|---|---|---|
| M1 | Engine core: iso renderer, map, camera, player movement, keyboard/mouse input | Walk around the wasteland |
| M2 | Weapons, shooting, health/armor, crates and loot, death crates | Combat sandbox |
| M3 | Bots with AI, storm zone, match flow (drop → win/lose), HUD and minimap | **Full playable match** |
| M4 | Creatures (straw dogs, crows, rats, bloat hog) | PvE threats |
| M5 | Vehicles (buggy, pickup) | Driving |
| M6 | Audio: sound effects plus procedural music, with toggles and sliders | Sound on/off |
| M7 | Gamepad and mobile touch controls, PWA, How-to-Play screen, settings | All platforms |
| M8 | Polish: particles, juice, balancing, performance pass, README | Release v1.0 |

**Usage and credits:** I can't see your remaining cloud credits from inside this session. To protect against running out, I'll work in the order above and commit and push after every milestone, so whatever exists is always saved and playable. If time gets tight, I'll cut from the bottom of the list below instead of leaving the game half-working.

## 14. Proposed scale-backs (things to drop first if credits run low)

1. Moped vehicle (keep buggy and pickup).
2. Bloat Hog mini-boss.
3. Spectate-the-killer camera (the results screen is enough).
4. Day-to-dusk lighting shift.
5. Bots driving vehicles (bots stay on foot).
6. Offline PWA caching (keep "add to home screen" only).

Not included in v1 by design: online multiplayer, a skin shop or progression, multiple maps, voice chat.

## 15. Questions for you

1. **Name:** "Dustbowl Royale" is a working title. Should I keep it or change it?
2. **Repo visibility:** public (free GitHub Pages link to play on any device) or private (play locally only)?
3. **Bot count default:** is 15 by default with a max of 24 OK?
4. Anything to add or cut before I start M1?
