# TemperatureGUI — Minecraft Bedrock Temperature Addon

**By Joshyman55** · Current version: **26.5.5** · Script API `@minecraft/server` 2.10.0

TemperatureGUI adds a dynamic temperature and survival system to Minecraft Bedrock Edition. Every biome has its own climate with a day/night swing, weather and shelter change how hot or cold it feels, and your body reacts over time with frostbite, heatstroke and thirst.

---

## Features

- **Three-temperature model**
  - **Actual Temp:** environment only (biome, time of day, weather, altitude, shelter, hazards)
  - **Body Temp:** your physiological temperature (32.0–43.0 °C / 89.6–109.4 °F), which slowly follows the environment
  - **Feels Like:** Actual Temp adjusted for humidity and direct contact (fire, lava, snow, ice)
- **Biome climates:** every biome has a default, minimum and maximum temperature, with daily variation in intensity
- **Underground caves stay steady:** cave biomes with a ceiling overhead barely change between day and night
- **Weather, UV and shelter:** rain and thunder cool you down, sunlight builds UV heat, and a roof overhead moderates the temperature
- **Altitude cooling:** gets colder above Y 300
- **Humidity:** humid biomes (jungle, swamp, oceans, sulfur caves…) feel hotter, and dry air makes you thirsty faster
- **Frostbite and heatstroke:** escalating effects, damage and screen overlays
- **Thirst:** 0–20 bar; sprinting, mining, damage and dry air drain it, and water bottles, potions and milk refill it
- **Armor and enchantments:** armor insulation, Fire Resistance, Fire Protection and Frost Walker
- **Combat effects:** snowballs chill you; Fire Aspect, Flame arrows and fireballs heat you up
- **Persistent:** temperature, body temp, humidity, thirst and settings save across relogs

---

## Commands

Type these in chat. **Beta APIs must be enabled** in the world for chat commands to work.

| Command | Effect |
|---|---|
| `;temp celsius` | Show temperatures in °C |
| `;temp fahrenheit` | Show temperatures in °F |
| `;time 12h` | 12-hour clock (3:45 PM) |
| `;time 24h` | 24-hour clock (15:45) |
| `;time military` | Military clock (09:05) |

**Debug (for testing):** `/tag @s add tempgui_debug`, then use a **stick** on a block to print debug info, including the raw biome ID.

---

## Installation

1. Double-click `TemperatureGUI_26.5.5.mcaddon`. Minecraft imports both packs.
2. In your world settings, turn on the **Temperature System BP** and **Temperature System RP**.
3. Under **Experiments**, turn on **Beta APIs** (needed for `;temp` / `;time`).

**Requirements:** Minecraft Bedrock Edition 1.21.0 or newer.

---

## Biome Temperatures (°C / °F)

| Biome | Default | Min | Max |
|---|---|---|---|
| Frozen (ice spikes, frozen peaks…) | −18 °C / 0 °F | −30 °C / −22 °F | −10 °C / 14 °F |
| Snowy | −10 °C / 14 °F | −20 °C / −4 °F | −2 °C / 28 °F |
| Taiga | 5 °C / 41 °F | −8 °C / 18 °F | 12 °C / 54 °F |
| Hills | 8 °C / 46 °F | −2 °C / 28 °F | 16 °C / 61 °F |
| Pale Garden | 10 °C / 50 °F | 0 °C / 32 °F | 16 °C / 61 °F |
| Ocean | 10 °C / 50 °F | 2 °C / 36 °F | 16 °C / 61 °F |
| **Dappled Forest** *(new)* | 11 °C / 52 °F | 2 °C / 36 °F | 18 °C / 64 °F |
| Plains | 12 °C / 54 °F | 5 °C / 41 °F | 22 °C / 72 °F |
| Forest | 13 °C / 55 °F | 4 °C / 39 °F | 20 °C / 68 °F |
| Deep Dark | 13 °C / 55 °F | 6 °C / 43 °F | 18 °C / 64 °F |
| Dark Forest | 14 °C / 57 °F | 4 °C / 39 °F | 20 °C / 68 °F |
| Dripstone Caves | 14 °C / 57 °F | 5 °C / 41 °F | 20 °C / 68 °F |
| Birch Forest | 16 °C / 61 °F | 6 °C / 43 °F | 22 °C / 72 °F |
| Mushroom Fields | 16 °C / 61 °F | 8 °C / 46 °F | 22 °C / 72 °F |
| Lush Caves | 18 °C / 64 °F | 10 °C / 50 °F | 24 °C / 75 °F |
| Swamp | 20 °C / 68 °F | 12 °C / 54 °F | 28 °C / 82 °F |
| Cherry Grove | 20 °C / 68 °F | 10 °C / 50 °F | 26 °C / 79 °F |
| Beach | 22 °C / 72 °F | 16 °C / 61 °F | 30 °C / 86 °F |
| **Sulfur Caves** *(new)* | 25 °C / 77 °F | 21 °C / 70 °F | 31 °C / 88 °F |
| Warm Ocean | 26 °C / 79 °F | 16 °C / 61 °F | 32 °C / 90 °F |
| Jungle | 28 °C / 82 °F | 20 °C / 68 °F | 36 °C / 97 °F |
| Savanna | 33 °C / 91 °F | 24 °C / 75 °F | 40 °C / 104 °F |
| Badlands | 35 °C / 95 °F | 26 °C / 79 °F | 44 °C / 111 °F |
| Desert | 42 °C / 108 °F | 38 °C / 100 °F | 56 °C / 133 °F |
| Nether | 75 °C / 167 °F | 55 °C / 131 °F | 100 °C / 212 °F |
| The End | −120 °C / −184 °F | −150 °C / −238 °F | −90 °C / −130 °F |

---

## Celsius ↔ Fahrenheit

TemperatureGUI calculates everything in Celsius. Switch the HUD to Fahrenheit with `;temp fahrenheit`.

- **°F = °C × 9/5 + 32**
- **°C = (°F − 32) × 5/9**

| °C | °F | Feels |
|---|---|---|
| −40 | −40 | Extreme cold |
| −18 | 0 | Frostbite risk |
| 0 | 32 | Freezing |
| 10 | 50 | Cool |
| 20 | 68 | Comfortable |
| 30 | 86 | Hot |
| 37 | 98.6 | Normal body temp |
| 40 | 104 | Heatstroke range |
| 100 | 212 | Boiling / lava |

---

## Version History

### 26.0 — Core Temp System
**26.0 (March 28, 2026)**
- Biome-based temperature ranges: each biome has a default, min and max temp in Celsius
- Day/night sine curve temperature variation, peaking at MC time 6000 and lowest at 18000
- Block-vote biome fallback: scans nearby blocks to guess the biome when detection fails
- Action bar HUD showing temperature and in-game time
- Celsius-only display
- Frostbite system: accumulates cold exposure, applies Slowness and freeze damage (below −9 °C / 15 °F)
- Heatstroke system: accumulates heat exposure, applies Nausea and Weakness (above 42 °C / 108 °F)
- Player state stored in JavaScript Maps per player ID

**26.0.1 (March 29, 2026)**
- Stability fixes only, no new features

### 26.1 — Unit System Update
**26.1 (April 4, 2026)**
- Added Fahrenheit as an optional display unit, triggered by using a compass item
- Celsius remained the default and the internal calculation unit
- No new survival mechanics

**26.1.1 (April 5, 2026):** bug fixes
**26.1.2 (April 18, 2026):** bug fixes
**26.1.3 (April 25, 2026):** bug fixes

### 26.2 — Armor & Survival Expansion Update
**26.2 (May 14, 2026)**
- Armor resistance: Diamond +8 cold / +6 heat per piece; Netherite +6 heat per piece; Iron +4 cold per piece
- UV system: accumulates during daylight based on sun strength, adds bonus heat on top of biome temp, drains at night or indoors
- Indoor shelter detection: scans up to 8 blocks above the player for a solid roof and moderates temp toward a comfort zone
- Respawn temperature system: saves temp before death and restores it after a grace period if respawning in the same biome family
- Hydration system added

**26.2.1 (May 16, 2026):** bug fixes

### 26.3 — Combat Update
**26.3 (May 24, 2026)**
- Snowball cooling: hitting a player drops temp by 3 °C (5.4 °F) instantly, with a floor of −30 °C (−22 °F); the message shows in the target's preferred unit
- Fire enchant heat spikes: Fire Aspect I caps at 85 °C (185 °F), Fire Aspect II at 100 °C (212 °F), Flame arrow at 90 °C (194 °F) (instant jump to 70 °C (158 °F)), ghast/small fireballs at 95 °C (203 °F) (instant jump to 75 °C (167 °F)); spikes last 8 ticks and a higher cap overwrites a lower one
- Unit toggle moved to `/function tempunit_f` and `/function tempunit_c` via tag polling, permanently replacing the 26.1 compass toggle

**26.3.1 (May 30, 2026):** bug fixes

**26.3.2 (June 19, 2026)**
- Modified the End dimension temp range to −150 °C (−238 °F) to −90 °C (−130 °F) (default −120 °C (−184 °F))
- Fixed a purple color display bug in the HUD temperature colors
- Only signed public release on Google Drive at the time

### 26.4 — Fire and Frost Protection Update
**26.4 (July 1, 2026)**
- Fire Resistance effect: suppresses heatstroke up to 95 °C (203 °F); no protection in lava at 100 °C (212 °F)
- Fire Protection I–IV: requires all 4 armor pieces; the lowest level across pieces sets the cap (I → 60 °C (140 °F), II → 75 °C (167 °F), III → 90 °C (194 °F), IV → 100 °C (212 °F) / full lava immunity)
- Frost Walker I–II (boots): requires all 4 armor pieces; I → immunity down to −89 °C (−128 °F), II → immunity down to −150 °C (−238 °F)
- Area guards: Frost Walker inactive above 0 °C (32 °F); Fire Protection/Resistance inactive below 0 °C (32 °F)
- If both Fire Resistance and Fire Protection are active, the higher cap wins

### 26.5 — The Core Redesign + Thirst Update
**26.5 (September 6, 2026)**
- Migrated to `@minecraft/server` API 2.8.0 (from 1.14.0) and rebuilt on an esbuild + VS Code pipeline (replacing bridge.)
- Replaced Map-based player state with dynamic properties, persisting across relogs via load-on-spawn, save-on-playerLeave and a periodic safety save every 24,000 ticks
- Removed the block-vote biome fallback in favor of native `getBiome()`
- Three-temp model: Actual Temp (ambient only), Body Temp (physiological, clamped 32.0–43.0 °C / 89.6–109.4 °F, one-decimal precision), Feels Like (derived from Actual Temp plus humidity/wetness)
- Combat and personal heat sources (snowballs, fire enchants, fireballs, being on fire) now affect only Body Temp and Feels Like, never Actual Temp
- Snow/ice block contact still affects Actual Temp (real environmental cold)
- Event-based weather detection (rain/thunder) via `world.afterEvents.weatherChange`, replacing the nonexistent `getWeather()` API
- Action bar redesigned into a two-line color-coded display: Actual Temp, Feels Like, Body Temp, Humidity, Weather
- Thirst system: 0–20 scale mirroring the hunger bar; an exhaustion accumulator (sprinting, mining, damage) drives depletion, and water/potions refill it
- Thirst bar JSON UI in progress: icon assets placed and data pipeline wired, currently blocked on a "Type not specified" error in `hud_screen.json`
- Frost/heat screen overlays, Vector3 migration and activity-based heat generation not yet started
- Starts the modern era; does not replace 26.4
- Unit switch changed from `/function tempunit_c` / `tempunit_f` to `/function temperature/celsius` / `temperature/fahrenheit`

**26.5.1 (September 19, 2026)**
- Command toggle moved from `/function` to chat commands (waiting for the stable API release)
- Introduced 24-hour and military time

**26.5.2 (October 10, 2026)**
- Upgraded the Script API to 2.10.0
- Fixed critical bugs

**26.5.5 (October 31, 2026) — New Biomes Update**

*New*
- **Dappled Forest** biome: 11 °C / 52 °F (range 2–18 °C / 36–64 °F), neutral family
- **Sulfur Caves** biome: 25 °C / 77 °F (range 21–31 °C / 70–88 °F), humid, warm family; based on real sulfur caves (Movile Cave ~21 °C / 70 °F, Cueva de Villa Luz ~28 °C / 82 °F)
- **Steady cave temperatures:** Sulfur, Lush, Dripstone and Deep Dark caves swing only 25% as much between day and night and build no UV while there's a ceiling overhead; surface patches open to the sky behave like normal biomes
- Strict chat commands: `;temp celsius | fahrenheit` and `;time 12h | 24h | military`; anything else stays normal chat
- Debug stick limited to players tagged `tempgui_debug`

*Fixes*
- Drinking water bottles, potions and milk now refills thirst (+2) and adds a hydration charge
- Thirst resets to full on respawn
- Snow burial now requires actually being enclosed by snow blocks, not just standing near them
- Indoor detection ignores non-solid blocks (torches, signs, plants, vines, water) as a roof
- Flame arrow heat now checks whether the arrow is burning, with the bow enchantment as a backup
- Heavy armor no longer makes players completely immune to frostbite
- Severe cold (about −24 °C / −11 °F and below) can now push Body Temp into frostbite range
- Sprinting drains thirst at a pace closer to vanilla hunger
- Sleeping resets temperature only once per night
- Body Temp and humidity now save across relogs
- Warm oceans no longer default to cold-lake water temperature
- Player data is fully cleaned up when a player leaves
- Script errors are reported at most once every 5 seconds instead of flooding the screen