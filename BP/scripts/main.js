// ── main.js ───────────────────────────────────────────────────────────────────
// 26.5 ENTRY POINT — registered in manifest.json as scripts.entry_point.
// Modern era rewrite: API 2.x, dynamic properties, native getBiome() only.
// ─────────────────────────────────────────────────────────────────────────────

import { world, system } from "@minecraft/server";
import { BIOME_DATA } from "./biomeData.js";
import { getBiomeKey } from "./biomeDetection.js";
import { calculateTemperature, calculateBodyTemp, getBodyTempTarget, getHumidityTarget, calculateHumidity, calculateFeelsLike, toFahrenheit, roundToTenth } from "./tempCalculator.js";
import { getNearestGroundBlocks } from "./blockUtils.js";
import {
  playerTemp, playerBodyTemp, playerHumidity,playerUV, playerColdTime, playerHeatTime, playerHydration,
  playerThirst, playerThirstExhaustion, THIRST_MAX, THIRST_EXHAUSTION_THRESHOLD,
  EXHAUSTION_SPRINT, EXHAUSTION_JUMP, EXHAUSTION_SPRINT_JUMP,
  EXHAUSTION_MINE_BLOCK, EXHAUSTION_PER_DAMAGE, EXHAUSTION_DRY_AIR,
  playerLastBiome, playerUseFahrenheit, playerTimeFormat, SPAWN_TEMP,
  playerRespawnGrace, RESPAWN_GRACE_TICKS, playerPreDeathTemp,
  BODY_TEMP_LERP_RATE, HUMIDITY_LERP_RATE,
  playerFireSpike, playerSnowSpike, playerBurialTime, playerActivityHeat,
  ensurePlayerState, clearPlayerState,
  savePersistedState, loadPersistedState
} from "./playerState.js";
import { applyFrostbite, applyHeatstroke, applyDehydration } from "./effectsHandler.js";
import { getArmorTempModifier, getFireProtectionCap, getFrostWalkerCap } from "./armorDetector.js";
import { isPlayerBurning } from "./hazardDetection.js";
import { registerSnowballEffect } from "./snowballEffect.js";
import { registerFireEnchantEffect } from "./fireEnchantsEffect.js";

world.afterEvents.worldLoad.subscribe(() => {
  world.sendMessage("§a[TempGUI] v26.5 loaded!");

  registerSnowballEffect();
  registerFireEnchantEffect();

  // ── Smooth display temp (separate from simulation temp) ───────────────────────
  // playerTemp = actual simulation value, updated every 20 ticks
  // playerDisplayTemp = what the HUD shows, lerped every tick toward playerTemp
  // This eliminates the "skip every second" visual artifact
  const playerDisplayTemp = new Map();
  const playerRestoreDone = new Set();
  const playerLastWeather = new Map();
  // ── World weather tracking — player.dimension.getWeather() is not a
  // callable function on this game version, so we track weather changes
  // via the event instead, which is confirmed to exist and work.
  let currentWorldWeather = "clear";
  try {
    world.afterEvents.weatherChange.subscribe((event) => {
      const w = event.newWeather;
      currentWorldWeather = w === "Thunder" ? "thunder"
        : w === "Rain" ? "rain"
        : "clear";
    });
  } catch (e) {
    world.sendMessage("§e[Warn] weatherChange event unavailable: " + e);
  }
  const playerContactHeat = new Map();
  const playerContactCold = new Map(); 

  // ── HUD color helpers ─────────────────────────────────────────────────────────

  function getTempColor(c) {
    if (c <= 0) return "§d"; // purple  — freezing
    if (c <= 9) return "§b"; // blue    — very cold
    if (c <= 15) return "§a"; // green   — cool
    if (c <= 25) return "§e"; // yellow  — warm
    if (c <= 35) return "§6"; // orange  — hot
    return "§c";              // red     — dangerous
  }

  function getWeatherString(weather) {
    if (weather === "thunder") return "§bThunder";
    if (weather === "rain") return "§9Rain";
    return "§fClear";
  }

  function getTimeColor(time) {
    if (time >= 23000 || time < 1000) return "§6";
    if (time < 11000) return "§e";
    if (time < 13000) return "§6";
    return "§9";
  }

  function getTimeString(time) {
    const totalMinutes = ((time + 6000) % 24000) / 24000 * 1440;
    let hours = Math.floor(totalMinutes / 60) % 24;
    const mins = Math.floor(totalMinutes % 60);
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mins < 10 ? "0" : ""}${mins} ${ampm}`;
  }

  function getTimeString24(time) {
    const totalMinutes = ((time + 6000) % 24000) / 24000 * 1440;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = Math.floor(totalMinutes % 60);
    return `${hours}:${mins < 10 ? "0" : ""}${mins}`;
  }

  function getTimeStringMilitary(time) {
    const totalMinutes = ((time + 6000) % 24000) / 24000 * 1440;
    const hours = Math.floor(totalMinutes / 60) % 24;
    const mins = Math.floor(totalMinutes % 60);
    return `${hours < 10 ? "0" : ""}${hours}:${mins < 10 ? "0" : ""}${mins}`;
  }

  function addThirstExhaustion(player, amount) {
    const current = playerThirstExhaustion.get(player.id) ?? 0;
    let updated = current + amount;

    if (updated >= THIRST_EXHAUSTION_THRESHOLD) {
      updated -= THIRST_EXHAUSTION_THRESHOLD;
      const thirst = playerThirst.get(player.id) ?? THIRST_MAX;
      playerThirst.set(player.id, Math.max(0, thirst - 1));
    }

    playerThirstExhaustion.set(player.id, updated);
  }

  // ── Events ────────────────────────────────────────────────────────────────────

  world.afterEvents.playerSpawn.subscribe((event) => {
    const isNew = !playerTemp.has(event.player.id);
    ensurePlayerState(event.player);
    
    let restored = false;
    if (isNew) {
      playerRestoreDone.add(event.player.id);
      restored= loadPersistedState(event.player) === true;
    }

    const biomeKey = getBiomeKey(event.player, playerLastBiome.get(event.player.id));
    const biome = BIOME_DATA[biomeKey] ?? BIOME_DATA.plains;

    if (isNew && !restored) {
      // First ever join — start at biome default
      playerTemp.set(event.player.id, biome.default);
      playerDisplayTemp.set(event.player.id, biome.default);
    } else if (isNew && restored) {
      // Player state was restored from a previous session — leave temp alone
      playerDisplayTemp.set(event.player.id, playerTemp.get(event.player.id));
    } else if (!event.initialSpawn) {
      // Respawn after death — use safe category temp
      const hotBiomes = ["desert", "nether", "savanna", "badlands", "jungle"];
      const coldBiomes = ["taiga", "snowy", "frozen", "hills"];
      const specialBiomes = ["end", "deepdark"];

      let spawnTemp;
      if (hotBiomes.includes(biomeKey)) spawnTemp = 28;
      else if (coldBiomes.includes(biomeKey)) spawnTemp = 5;
      else if (specialBiomes.includes(biomeKey)) spawnTemp = 10;
      else spawnTemp = 18;

      // ── Body Temp & Humidity — also reset on respawn, same as Actual Temp ──
      // Prevents carrying over dangerous body temp or extreme humidity from
      // the moment of death into the fresh respawn.
      playerBodyTemp.set(event.player.id, 37);
      playerHumidity.set(event.player.id, 50);

      playerTemp.set(event.player.id, spawnTemp);
      playerDisplayTemp.set(event.player.id, spawnTemp);
      playerUV.set(event.player.id, 0);
      playerColdTime.set(event.player.id, 0);
      playerHeatTime.set(event.player.id, 0);
      playerRespawnGrace.set(event.player.id, RESPAWN_GRACE_TICKS);
    }
    // else: returning player (initialSpawn=true but already has state) — leave temp alone
  });

  world.afterEvents.playerLeave.subscribe((event) => {
    clearPlayerState(event.playerId);
    playerDisplayTemp.delete(event.playerId);
    playerRestoreDone.delete(event.playerId); 
  });

  // Save temp and biome before death — fire and lava deaths don't restore
  const FIRE_LAVA_CAUSES = ["fire", "fireTick", "lava", "magma", "onFire"];
  world.afterEvents.entityDie.subscribe((event) => {
    const entity = event.deadEntity;
    if (entity.typeId !== "minecraft:player") return;
    const cause = event.damageSource?.cause ?? "";
    if (FIRE_LAVA_CAUSES.includes(cause)) {
      // Fire/lava death — null means no snap on grace end
      playerPreDeathTemp.set(entity.id, null);
    } else {
      // Save temp AND biome at time of death
      playerPreDeathTemp.set(entity.id, {
        temp: playerTemp.get(entity.id) ?? null,
        biome: playerLastBiome.get(entity.id) ?? null
      });
    }
  });

  // Sleeping resets temperature to a comfortable biome-appropriate value
  try {
    world.afterEvents.playerSleepStateChange.subscribe((event) => {
      if (!event.isSleeping) return;
      const player = event.player;
      const key = getBiomeKey(player, playerLastBiome.get(player.id));
      const biome = BIOME_DATA[key] ?? BIOME_DATA.plains;
      const reset = Math.max(biome.min, Math.min(biome.max,
        biome.default + (Math.random() * 10 - 5)));
      playerTemp.set(player.id, reset);
      playerDisplayTemp.set(player.id, reset); // snap display on sleep too
      playerUV.set(player.id, 0);
      playerColdTime.set(player.id, 0);
      playerHeatTime.set(player.id, 0);
    });
  } catch (e) {
    world.sendMessage("§e[Warn] playerSleepStateChange unavailable: " + e);
  }

  world.afterEvents.itemCompleteUse.subscribe((event) => {
    const item = event.itemStack;
    const source = event.source;

    // Drinking water / potions adds hydration charges (max 3)
    if (item?.typeId === "minecraft:potion" ||
      item?.typeId === "minecraft:water_bucket" ||
      item?.typeId === "minecraft:glass_bottle") {
      if (!source || !playerHydration.has(source.id)) return;
      const charges = playerHydration.get(source.id) ?? 0;
      if (charges < 3) playerHydration.set(source.id, charges + 1);

      const currentThirst = playerThirst.get(source.id) ?? THIRST_MAX;
      playerThirst.set(source.id, Math.min(THIRST_MAX, currentThirst + 2));
    }
  });

  world.afterEvents.playerBreakBlock.subscribe((event) => {
    addThirstExhaustion(event.player, EXHAUSTION_MINE_BLOCK);
  });

  world.afterEvents.entityHurt.subscribe((event) => {
    const entity = event.hurtEntity;
    if (entity.typeId !== "minecraft:player") return;
    const damage = event.damage ?? 0;
    addThirstExhaustion(entity, damage * EXHAUSTION_PER_DAMAGE);
  });

  // ── Chat-command unit toggle — ;celsius / ;c / ;fahrenheit / ;f, mirrors
  // the /function tag toggle but as a WorldEdit-style chat shortcut. Cancelled
  // so the raw command doesn't broadcast to everyone else in chat. The actual
  // tag mutation is deferred to system.run() since chatSend fires in
  // restricted-execution mode — same reason setDynamicProperty had to move
  // out of beforeEvents.playerLeave earlier.
  try {
    world.beforeEvents.chatSend.subscribe((event) => {
      // event.sender.sendMessage("§d[DEBUG] chatSend fired: " + event.message);
      const msg = event.message.trim().toLowerCase();
      const sender = event.sender;
      const hasCelsius = msg === ";c" || msg === ";celsius" || msg.includes("celsius");
      const hasFahrenheit = msg === ";f" || msg === ";fahrenheit" || msg.includes("fahrenheit");
      const isSwitchCmd = msg.startsWith(";switch") || hasCelsius || hasFahrenheit;

      if (isSwitchCmd) {
        if (hasCelsius && hasFahrenheit) {
          event.cancel = true;
          system.run(() => {
            sender.sendMessage("§cSay just one: try \";c\" for Celsius or \";f\" for Fahrenheit.");
          });
        } else if (hasCelsius) {
          event.cancel = true;
          system.run(() => {
            if (sender.hasTag("tempunit_c")) {
              sender.sendMessage("§bYou're already set to Celsius (°C).");
              return;
            }
            sender.removeTag("tempunit_f");
            sender.addTag("tempunit_c");
            sender.sendMessage("§bTemperature unit set to Celsius (°C)");
          });
        } else if (hasFahrenheit) {
          event.cancel = true;
          system.run(() => {
            if (sender.hasTag("tempunit_f")) {
              sender.sendMessage("§6You're already set to Fahrenheit (°F).");
              return;
            }
            sender.removeTag("tempunit_c");
            sender.addTag("tempunit_f");
            sender.sendMessage("§6Temperature unit set to Fahrenheit (°F)");
          });
        }
      }

      const hasMilitary = msg === ";military" || msg === ";mil" || msg.includes("military");
      const has24 = msg === ";24h" || msg.includes("24h") || msg.includes("24-hour") || msg.includes("24 hour");
      const has12h = msg === ";12h" || msg.includes("12h") || msg.includes("12-hour") || msg.includes("12 hour");
      const isClockCmd = msg.startsWith(";switch") || hasMilitary || has24 || has12h;

      if (!isClockCmd) return;

      const clockPicks = [hasMilitary, has24, has12h].filter(Boolean).length;
      if (clockPicks > 1) {
        event.cancel = true;
        system.run(() => {
          sender.sendMessage("§cSay just one: try \";24h\", \";military\", or \";12h\".");
        });
      } else if (hasMilitary) {
        event.cancel = true;
        system.run(() => {
          if (sender.hasTag("timemil")) {
            sender.sendMessage("§bYou're already set to military time.");
            return;
          }
          sender.removeTag("time12"); sender.removeTag("time24");
          sender.addTag("timemil");
          sender.sendMessage("§bClock set to military (00:00)");
        });
      } else if (has24) {
        event.cancel = true;
        system.run(() => {
          if (sender.hasTag("time24")) {
            sender.sendMessage("§bYou're already set to 24-hour.");
            return;
          }
          sender.removeTag("time12"); sender.removeTag("timemil");
          sender.addTag("time24");
          sender.sendMessage("§bClock set to 24-hour (0:00)");
        });
      } else if (has12h) {
        event.cancel = true;
        system.run(() => {
          if (sender.hasTag("time12")) {
            sender.sendMessage("§bYou're already set to 12-hour.");
            return;
          }
          sender.removeTag("time24"); sender.removeTag("timemil");
          sender.addTag("time12");
          sender.sendMessage("§bClock set to 12-hour");
        });
      }
    });
  } catch (e) {
    world.sendMessage("§e[Warn] chatSend unavailable — ;c/;f/;24h/etc. need Beta APIs enabled: " + e);
  }

  // ── Main tick ─────────────────────────────────────────────────────────────────

  let tickCounter = 0;

  system.runInterval(() => {
    tickCounter++;
    const doHeavyCalc = (tickCounter % 20 === 0);

    for (const player of world.getAllPlayers()) {
      try {
        if (!playerRestoreDone.has(player.id)) {
          playerRestoreDone.add(player.id);
          ensurePlayerState(player);
          if (loadPersistedState(player) === true) {
            playerDisplayTemp.set(player.id, playerTemp.get(player.id));
          }
        }
        ensurePlayerState(player);

        if (player.isSprinting) {
          addThirstExhaustion(player, EXHAUSTION_SPRINT);
        }

        const currentActivityHeat = playerActivityHeat.get(player.id) ?? 0;
        const newActivityHeat = player.isSprinting
        ? Math.min(1, currentActivityHeat + 0.01)
        : Math.max(0, currentActivityHeat - 0.02);
        playerActivityHeat.set(player.id, newActivityHeat);

        if (!playerDisplayTemp.has(player.id)) {
          playerDisplayTemp.set(player.id, playerTemp.get(player.id) ?? SPAWN_TEMP);
        }

        const time = world.getTimeOfDay();
        const simTemp = playerTemp.get(player.id);
        const useFahrenheit = playerUseFahrenheit.get(player.id);
        const timeFormat = playerTimeFormat.get(player.id) ?? "12";
        const timeString = timeFormat === "military"
          ? getTimeStringMilitary(time)
          : timeFormat === "24"
          ? getTimeString24(time)
          : getTimeString(time);

        // ── Smooth HUD display — lerps every tick toward simulation temp ──
        // Fast enough to feel responsive, slow enough to avoid skipping
        const prevDisplay = playerDisplayTemp.get(player.id);
        const smoothDisplay = prevDisplay + (simTemp - prevDisplay) * 0.12;
        playerDisplayTemp.set(player.id, smoothDisplay);

        const displayValue = useFahrenheit
          ? Math.round(toFahrenheit(smoothDisplay))
          : Math.round(smoothDisplay);
        const unit = useFahrenheit ? "°F" : "°C";
        const thirstDisplay = playerThirst.get(player.id) ?? THIRST_MAX;

        const humidityValue = playerHumidity.get(player.id) ?? 50;
        const contactHeatValue = playerContactHeat.get(player.id) ?? 0;
        const contactColdValue = playerContactCold.get(player.id) ?? 0;
        const feelsLikeValue = calculateFeelsLike(smoothDisplay, humidityValue, 0, contactHeatValue + contactColdValue);
        const feelsLikeDisplay = useFahrenheit
          ? Math.round(toFahrenheit(feelsLikeValue))
          : Math.round(feelsLikeValue);
        const weatherValue = playerLastWeather.get(player.id) ?? null;

        const bodyTempValue = playerBodyTemp.get(player.id) ?? 37;
        const bodyTempDisplay = useFahrenheit
          ? roundToTenth(toFahrenheit(bodyTempValue))
          : roundToTenth(bodyTempValue);

        player.onScreenDisplay.setActionBar(
          `§fTemp: ${getTempColor(smoothDisplay)}${displayValue}${unit} §7(Feels ${getTempColor(feelsLikeValue)}${feelsLikeDisplay}${unit}§7)  ` +
          `${getTimeColor(time)}${timeString}\n` +
          `§fBody: ${getTempColor(bodyTempValue)}${bodyTempDisplay}${unit}  ` +
          `§3Humidity: ${Math.round(humidityValue)}%  ${getWeatherString(weatherValue)} ` +
          `§9Thirst: ${thirstDisplay}/${THIRST_MAX}`
        );

        if (!doHeavyCalc) continue;

        // Unit toggle using tags

        const hasF = player.hasTag("tempunit_f");
        const hasC = player.hasTag("tempunit_c");
        if (hasF) playerUseFahrenheit.set(player.id, true);
        else if (hasC) playerUseFahrenheit.set(player.id, false);

        const timeTagMil = player.hasTag("timemil");
        const timeTag24 = player.hasTag("time24");
        const timeTag12 = player.hasTag("time12");
        if (timeTagMil) playerTimeFormat.set(player.id, "military");
        else if (timeTag24) playerTimeFormat.set(player.id, "24");
        else if (timeTag12) playerTimeFormat.set(player.id, "12");

        // ── Temperature calculation — once per second ─────────────────────
        const uv = playerUV.get(player.id);
        const lastBiome = playerLastBiome.get(player.id);

        const result = calculateTemperature(player, simTemp, uv, lastBiome, time, currentWorldWeather);

        playerTemp.set(player.id, result.newTemp);
        playerUV.set(player.id, result.newUV);
        if (lastBiome !== result.biomeKey) {
          playerLastBiome.set(player.id, result.biomeKey);
        }

        // ── Body Temp — lags behind a scaled target derived from Actual Temp,
        // not raw ambient directly (32–43°C physiological scale). Armor acts
        // as insulation here — heavier cold/heat bonus slows the lerp rate,
        // meaning body temp swings more gently instead of just raising the
        // symptom threshold (that part is handled separately in effectsHandler).
        const currentBodyTemp = playerBodyTemp.get(player.id) ?? 37;
        const thirstNow = playerThirst.get(player.id) ?? THIRST_MAX;
        const dehydrationSeverity = thirstNow >= 10 ? 0 : (10 - thirstNow) / 10;
        const dehydrationAmplifier = 1 + dehydrationSeverity * 2;
        const baseBodyTempTarget = getBodyTempTarget(result.newTemp) + newActivityHeat;
        // ── Dehydration amplifies how far Body Temp is pulled toward heat —
        // thirstier players overheat faster. Only applied on the heat side
        // (above the 37°C baseline); cold-side targets are unaffected.
        const bodyTempTarget = baseBodyTempTarget > 37
            ? 37 + (baseBodyTempTarget - 37) * dehydrationAmplifier
            : baseBodyTempTarget;
        const { coldBonus, heatBonus } = getArmorTempModifier(player);
        const insulation = coldBonus + heatBonus;
        const insulationFactor = Math.max(0.3, 1 - insulation / 100);
        const effectiveLerpRate = BODY_TEMP_LERP_RATE * insulationFactor;
        const skinInsulationFactor = Math.max(0.5, 1 - insulation / 150);
        let newBodyTemp = calculateBodyTemp(currentBodyTemp, bodyTempTarget, effectiveLerpRate);

        // ── Personal burning — separate from nearby fire blocks. If the
        // player themselves is ablaze, push Body Temp directly toward a
        // feverish target regardless of what Actual Temp/ambient is doing.
        if (isPlayerBurning(player) && newBodyTemp < 39.0) {
            newBodyTemp = Math.min(39.0, newBodyTemp + 0.5);
        }


        // ── Fire Resistance — actively cools Body Temp back toward a safe
        // baseline, not just blocking symptoms (that part still happens
        // separately in effectsHandler.js). Skin (Feels Like) protection
        // from fire/lava contact is handled below via hasFireResistance.

        const hasFireResistance = player.getEffect("fire_resistance") !== undefined;
        if (hasFireResistance && newBodyTemp > 37.5) {
            newBodyTemp = Math.max(37.5, newBodyTemp - 0.6);
        }

        // ── Fire Protection / Frost Walker — suppress Body Temp itself
        // (internal regulation from gear), but deliberately do NOT touch
        // Feels Like/contactHeat/contactCold — skin sensation stays
        // unaffected by these enchantments, unlike Fire Resistance above.
        const fireProtCap = getFireProtectionCap(player);
        if (fireProtCap > 0 && newBodyTemp > 38.0) {
            newBodyTemp = Math.max(38.0, newBodyTemp - 0.3);
        }
        const frostWalkCap = getFrostWalkerCap(player);
        if (frostWalkCap !== null && newBodyTemp < 36.0) {
            newBodyTemp = Math.min(36.0, newBodyTemp + 0.3);
        }

        playerBodyTemp.set(player.id, newBodyTemp);

                // ── Contact heat — direct skin contact (fire/lava), separate from
        // ambient. Takes the worst single source rather than stacking them.
        // Fire Resistance suppresses fire/lava-sourced heat specifically —
        // your skin isn't actually burning, so it shouldn't feel like it.
        let contactHeat = 0;
        if (!hasFireResistance) {
            if (result.inLava) contactHeat = 40;
            else if (result.onFire) contactHeat = 15;
            else if (result.nearLava) contactHeat = 12;
        }
        if (isPlayerBurning(player) && !hasFireResistance) {
            contactHeat = Math.max(contactHeat, 18);
        }

        // ── Campfire warmth — standing near a lit campfire should be felt
        // personally (Feels Like) and, when close enough, actually warm the
        // body a little, not just tint the ambient air.
        if (result.campfire === "on") contactHeat = Math.max(contactHeat, 10);
        else if (result.campfire === "close") contactHeat = Math.max(contactHeat, 6);
        else if (result.campfire === "near") contactHeat = Math.max(contactHeat, 3);

        if ((result.campfire === "on" || result.campfire === "close") && newBodyTemp < 38.0) {
            newBodyTemp = Math.min(38.0, newBodyTemp + 0.2);
            playerBodyTemp.set(player.id, newBodyTemp);
        }

        // ── Combat fire hits (Fire Aspect, Flame arrow, Fireball) — the spike
        // set in fireEnchantsEffect.js already bumps Body Temp directly; while
        // that spike is still active (ticking down), Feels Like should reflect
        // it too, not just the environmental checks above.
        const activeFireSpike = playerFireSpike.get(player.id);
        if (activeFireSpike && activeFireSpike.ticks > 0) {
            contactHeat = Math.max(contactHeat, 20);
        }

        playerContactHeat.set(player.id, contactHeat * skinInsulationFactor);

        // ── Contact cold — snow/ice contact, symmetric to contactHeat above.
        // Takes the worst single source rather than stacking.
        let contactCold = 0;
        if (result.onBlueIce) contactCold = -14;
        else if (result.onPackedIce) contactCold = -11;
        else if (result.buriedInSnow) contactCold = -16;
        else if (result.inPowderSnow) contactCold = -13;
        else if (result.onIce) contactCold = -8;
        else if (result.onSnowLayer) contactCold = -5;

        // ── Snowball spike — decays over a few ticks after a hit ───────────
        const snowSpike = playerSnowSpike.get(player.id);
        if (snowSpike && snowSpike.ticks > 0) {
            contactCold = Math.min(contactCold, -12);
            playerSnowSpike.set(player.id, { ticks: snowSpike.ticks - 1 });
        } else if (snowSpike) {
            playerSnowSpike.set(player.id, null);
        }

        // ── Burial escalation — the longer you're buried/in powder snow, the
        // colder Feels Like gets (no cap here) and Body Temp keeps dropping
        // slowly toward the physiological floor, instead of stopping early.
        const isBuried = result.buriedInSnow || result.inPowderSnow;
        let burialTicks = playerBurialTime.get(player.id) ?? 0;
        if (isBuried) {
            burialTicks += 1;
            playerBurialTime.set(player.id, burialTicks);

            const burialCold = Math.min(-16 - burialTicks * 2, -60);
            contactCold = Math.min(contactCold, burialCold);

            newBodyTemp = Math.max(32, newBodyTemp - 0.4);
            playerBodyTemp.set(player.id, newBodyTemp);
        } else if (burialTicks > 0) {
            playerBurialTime.set(player.id, 0);
        }

        playerContactCold.set(player.id, contactCold * skinInsulationFactor);

        // ── Humidity — lags toward a biome/weather/indoor target ──────────
        const humidityTarget = getHumidityTarget(result.biomeKey, result.inWater, result.weather, result.indoors);
        const currentHumidity = playerHumidity.get(player.id) ?? humidityTarget;
        const newHumidity = calculateHumidity(currentHumidity, humidityTarget, HUMIDITY_LERP_RATE);
        playerHumidity.set(player.id, newHumidity);
        playerLastWeather.set(player.id, result.weather);

        const dryness = Math.max(0, (30 - newHumidity) / 30);
        if (dryness > 0) {
          addThirstExhaustion(player, dryness * EXHAUSTION_DRY_AIR);
        }

        // ── Feels Like (heavy-calc copy, unused for display) — kept for
        // parity/logging; the action bar recomputes its own every tick
        const feelsLike = calculateFeelsLike(result.newTemp, newHumidity, 0, contactHeat + contactCold);

        const displayC = Math.round(result.newTemp);
        const bodyC = roundToTenth(newBodyTemp);

        // ── Effects & damage ──────────────────────────────────────────────
        applyFrostbite(player, bodyC);
        applyHeatstroke(player, bodyC);
        applyDehydration(player, thirstNow);

        // ── Autosave — beforeEvents.playerLeave can't call setDynamicProperty
        // (read-only mode), so persistence has to happen here instead, once
        // per heavy-calc tick (~1/sec) rather than relying on a leave hook.
        savePersistedState(player);

      } catch (e) {
        try {
          player.onScreenDisplay.setActionBar(`§cError: ${e.message || e}`);
        } catch { }
      }
    }
  }, 1);

  // ── Debug stick ───────────────────────────────────────────────────────────────
  // Right-click any block with a stick to print full debug info to chat.

  world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.itemStack?.typeId !== "minecraft:stick") return;
    const player = event.player;
    if (!player || !playerTemp.has(player.id)) return;

    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    const blockAt = player.dimension.getBlock({ x: px, y: py, z: pz });
    const blockBelow = player.dimension.getBlock({ x: px, y: py - 1, z: pz });

    const { foundIds, groundY } = getNearestGroundBlocks(player, 5, 50);
    const foundList = [...foundIds].slice(0, 8).join(", ");

    let rawBiome = "unavailable";
    try { rawBiome = player.dimension.getBiome(player.location).id ?? "unknown"; } catch { }

    player.sendMessage(
      `§b[DEBUG] Biome: ${getBiomeKey(player, playerLastBiome.get(player.id))} | ` +
      `Temp: ${Math.round(playerTemp.get(player.id))}°C | Y: ${py}`
    );
    player.sendMessage(`§e[DEBUG] rawBiome: ${rawBiome}`);
    player.sendMessage(
      `§7[DEBUG] blockAt: ${blockAt?.typeId} | blockBelow: ${blockBelow?.typeId}`
    );
    player.sendMessage(
      `§a[DEBUG] groundY: ${groundY} | found: ${foundList}`
    );
    const preDeathData = playerPreDeathTemp.get(player.id);
    player.sendMessage(
      `§d[DEBUG] Grace: ${playerRespawnGrace.get(player.id) ?? 0} | ` +
      `PreDeath: ${preDeathData ? `${Math.round(preDeathData.temp)}°C (${preDeathData.biome})` : "none"}`
    );
    let rawWeather = "error";
    try { rawWeather = player.dimension.getWeather(); } catch (e) { rawWeather = `ERROR: ${e}`; }
    player.sendMessage(
      `§e[DEBUG] rawWeather: ${rawWeather} | stored: ${playerLastWeather.get(player.id) ?? "null"}`
    );
    player.sendMessage(
      `§b[DEBUG] BodyTemp: ${playerBodyTemp.get(player.id)?.toFixed(1) ?? "?"}°C | ` +
      `coldTime: ${playerColdTime.get(player.id) ?? 0}/1000 | heatTime: ${playerHeatTime.get(player.id) ?? 0}/2000`
    );
    player.sendMessage(
      `§d[DEBUG] Humidity: ${playerHumidity.get(player.id)?.toFixed(1) ?? "?"}% | ` +
      `Weather(stored): ${playerLastWeather.get(player.id) ?? "null"}`
    );
  });
});