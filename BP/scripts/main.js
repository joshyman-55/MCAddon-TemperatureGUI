// ── main.js ───────────────────────────────────────────────────────────────────
// 26.5 ENTRY POINT — registered in manifest.json as scripts.entry_point.
// Modern era rewrite: API 2.x, dynamic properties, native getBiome() only.
// ─────────────────────────────────────────────────────────────────────────────

import { world, system } from "@minecraft/server";
import { BIOME_DATA } from "./biomeData.js";
import { getBiomeKey } from "./biomeDetection.js";
import { calculateTemperature, toFahrenheit } from "./tempCalculator.js";
import { getNearestGroundBlocks } from "./blockUtils.js";
import {
  playerTemp, playerUV, playerColdTime, playerHeatTime, playerHydration,
  playerLastBiome, playerUseFahrenheit, SPAWN_TEMP,
  playerRespawnGrace, RESPAWN_GRACE_TICKS, playerPreDeathTemp,
  playerFireSpike,
  ensurePlayerState, clearPlayerState,
  savePersistedState, loadPersistedState
} from "./playerState.js";
import { applyFrostbite, applyHeatstroke } from "./effectsHandler.js";
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

  // ── HUD color helpers ─────────────────────────────────────────────────────────

  function getTempColor(c) {
    if (c <= 0) return "§d"; // purple  — freezing
    if (c <= 9) return "§b"; // blue    — very cold
    if (c <= 15) return "§a"; // green   — cool
    if (c <= 25) return "§e"; // yellow  — comfortable
    if (c <= 35) return "§6"; // orange  — hot
    return "§c";              // red     — dangerous
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

  // ── Events ────────────────────────────────────────────────────────────────────

  world.afterEvents.playerSpawn.subscribe((event) => {
    const isNew = !playerTemp.has(event.player.id);
    ensurePlayerState(event.player);
    
    if (isNew) {
      loadPersistedState(event.player);
    }

    const biomeKey = getBiomeKey(event.player);
    const biome = BIOME_DATA[biomeKey] ?? BIOME_DATA.plains;

    if (isNew) {
      // First ever join — start at biome default
      playerTemp.set(event.player.id, biome.default);
      playerDisplayTemp.set(event.player.id, biome.default);
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
      const key = getBiomeKey(player);
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

  world.afterEvents.itemUse.subscribe((event) => {
    const item = event.itemStack;
    const source = event.source;

    // Drinking water / potions adds hydration charges (max 3)
    if (item?.typeId === "minecraft:potion" ||
      item?.typeId === "minecraft:water_bucket" ||
      item?.typeId === "minecraft:glass_bottle") {
      if (!source || !playerHydration.has(source.id)) return;
      const charges = playerHydration.get(source.id) ?? 0;
      if (charges < 3) playerHydration.set(source.id, charges + 1);
    }
  });

  // ── Main tick ─────────────────────────────────────────────────────────────────

  let tickCounter = 0;

  system.runInterval(() => {
    tickCounter++;
    const doHeavyCalc = (tickCounter % 20 === 0);

    for (const player of world.getAllPlayers()) {
      try {
        ensurePlayerState(player);
        if (!playerDisplayTemp.has(player.id)) {
          playerDisplayTemp.set(player.id, playerTemp.get(player.id) ?? SPAWN_TEMP);
        }

        const time = world.getTimeOfDay();
        const simTemp = playerTemp.get(player.id);
        const useFahrenheit = playerUseFahrenheit.get(player.id);

        // ── Smooth HUD display — lerps every tick toward simulation temp ──
        // Fast enough to feel responsive, slow enough to avoid skipping
        const prevDisplay = playerDisplayTemp.get(player.id);
        const smoothDisplay = prevDisplay + (simTemp - prevDisplay) * 0.12;
        playerDisplayTemp.set(player.id, smoothDisplay);

        const displayValue = useFahrenheit
          ? Math.round(toFahrenheit(smoothDisplay))
          : Math.round(smoothDisplay);
        const unit = useFahrenheit ? "°F" : "°C";

        player.onScreenDisplay.setActionBar(
          `§fTemp: ${getTempColor(smoothDisplay)}${displayValue}${unit}  ` +
          `${getTimeColor(time)}${getTimeString(time)}`
        );

        if (!doHeavyCalc) continue;

        // Unit toggle using tags

        const hasF = player.hasTag("tempunit_f");
        const hasC = player.hasTag("tempunit_c");
        if (hasF) playerUseFahrenheit.set(player.id, true);
        else if (hasC) playerUseFahrenheit.set(player.id, false);

        // ── Temperature calculation — once per second ─────────────────────
        const uv = playerUV.get(player.id);
        const lastBiome = playerLastBiome.get(player.id);

        const result = calculateTemperature(player, simTemp, uv, lastBiome, time);

        playerTemp.set(player.id, result.newTemp);
        playerUV.set(player.id, result.newUV);
        if (lastBiome !== result.biomeKey) {
          playerLastBiome.set(player.id, result.biomeKey);
        }

        const displayC = Math.round(result.newTemp);

        // ── Effects & damage ──────────────────────────────────────────────
        applyFrostbite(player, displayC);
        applyHeatstroke(player, displayC);

      } catch (e) {
        try {
          player.onScreenDisplay.setActionBar(`§cError: ${e.message || e}`);
        } catch { }
      }
    }
  }, 1);

  // ── Debug stick ───────────────────────────────────────────────────────────────
  // Right-click any block with a stick to print full debug info to chat.

  world.beforeEvents.itemUseOn.subscribe((event) => {
    if (event.itemStack.typeId !== "minecraft:stick") return;
    const player = event.source;
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
      `§b[DEBUG] Biome: ${getBiomeKey(player)} | ` +
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
  });
});