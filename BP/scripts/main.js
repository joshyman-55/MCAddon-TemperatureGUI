// src/main.js
import { world as world4, system } from "@minecraft/server";

// src/tempCalculator.js
import { world } from "@minecraft/server";

// src/playerState.js
var playerTemp = /* @__PURE__ */ new Map();
var playerUV = /* @__PURE__ */ new Map();
var playerColdTime = /* @__PURE__ */ new Map();
var playerHeatTime = /* @__PURE__ */ new Map();
var playerHydration = /* @__PURE__ */ new Map();
var playerLastBiome = /* @__PURE__ */ new Map();
var playerUseFahrenheit = /* @__PURE__ */ new Map();
var playerRespawnGrace = /* @__PURE__ */ new Map();
var playerPreDeathTemp = /* @__PURE__ */ new Map();
var playerFireSpike = /* @__PURE__ */ new Map();
var SPAWN_TEMP = 18;
function ensurePlayerState(player) {
  if (!playerTemp.has(player.id)) playerTemp.set(player.id, SPAWN_TEMP);
  if (!playerUV.has(player.id)) playerUV.set(player.id, 0);
  if (!playerColdTime.has(player.id)) playerColdTime.set(player.id, 0);
  if (!playerHeatTime.has(player.id)) playerHeatTime.set(player.id, 0);
  if (!playerHydration.has(player.id)) playerHydration.set(player.id, 0);
  if (!playerLastBiome.has(player.id)) playerLastBiome.set(player.id, "plains");
  if (!playerRespawnGrace.has(player.id)) playerRespawnGrace.set(player.id, 0);
  if (!playerPreDeathTemp.has(player.id)) playerPreDeathTemp.set(player.id, null);
  if (!playerFireSpike.has(player.id)) playerFireSpike.set(player.id, null);
  if (!playerUseFahrenheit.has(player.id)) {
    playerUseFahrenheit.set(player.id, false);
  }
}
function clearPlayerState(playerId) {
  playerTemp.delete(playerId);
  playerUV.delete(playerId);
  playerColdTime.delete(playerId);
  playerHeatTime.delete(playerId);
  playerHydration.delete(playerId);
  playerLastBiome.delete(playerId);
  playerUseFahrenheit.delete(playerId);
  playerRespawnGrace.delete(playerId);
  playerPreDeathTemp.delete(playerId);
  playerFireSpike.delete(playerId);
}

// src/armorDetector.js
import { EquipmentSlot } from "@minecraft/server";

// src/snowballEffect.js
import { world as world2 } from "@minecraft/server";
function registerSnowballEffect() {
  world2.afterEvents.projectileHitEntity.subscribe((event) => {
    if (event.projectile?.typeId !== "minecraft:snowball") return;
    const hit = event.getEntityHit()?.entity;
    if (!hit || hit.typeId !== "minecraft:player") return;
    const current = playerTemp.get(hit.id);
    if (current == void 0) return;
    const cooled = Math.max(-30, current - 3);
    playerTemp.set(hit.id, cooled);
    const useFahrenheit = playerUseFahrenheit.get(hit.id) ?? false;
    const displayTemp = useFahrenheit ? Math.round(cooled * 9 / 5 + 32) : Math.round(cooled);
    const unit = useFahrenheit ? "\xB0F" : "\xB0C";
    hit.sendMessage(`\xA7b\u2744 Snowball hit! Temp dropped to ${displayTemp}${unit}`);
  });
}

// src/fireEnchantsEffect.js
import { world as world3, EquipmentSlot as EquipmentSlot2 } from "@minecraft/server";
var FIRE_SPIKE_CAPS = {
  flame_1: 90,
  fire_aspect_1: 85,
  fire_aspect_2: 100,
  ghast_fireball: 95
};
var SPIKE_DURATION = 8;
function registerFireEnchantEffect() {
  world3.afterEvents.entityHurt.subscribe((event) => {
    const entity = event.hurtEntity;
    if (entity.typeId !== "minecraft:player") return;
    const cause = event.damageSource?.cause ?? "";
    const damagingEntity = event.damageSource?.damagingEntity;
    if (cause !== "entityAttack" || damagingEntity?.typeId !== "minecraft:player") return;
    let spikeCap = null;
    try {
      const attackEquip = damagingEntity.getComponent("minecraft:equippable");
      const mainhand = attackEquip?.getEquipment(EquipmentSlot2.Mainhand);
      if (mainhand) {
        const enchants = mainhand.getComponent("minecraft:enchantable");
        const level = enchants?.getEnchantment("fire_aspect")?.level ?? 0;
        if (level === 2) spikeCap = FIRE_SPIKE_CAPS.fire_aspect_2;
        else if (level === 1) spikeCap = FIRE_SPIKE_CAPS.fire_aspect_1;
      }
    } catch {
    }
    if (spikeCap === null) return;
    const currentTemp = playerTemp.get(entity.id) ?? 18;
    const jumpTarget = spikeCap - 20;
    if (currentTemp < jumpTarget) {
      playerTemp.set(entity.id, jumpTarget);
    }
    const existing = playerFireSpike.get(entity.id);
    if (!existing || spikeCap >= existing.cap) {
      playerFireSpike.set(entity.id, { cap: spikeCap, ticks: SPIKE_DURATION });
    }
  });
  world3.afterEvents.projectileHitEntity.subscribe((event) => {
    if (event.projectile?.typeId !== "minecraft:arrow") return;
    const hit = event.getEntityHit()?.entity;
    if (!hit || hit.typeId !== "minecraft:player") return;
    try {
      const shooter = event.source;
      if (!shooter) return;
      const equip = shooter.getComponent("minecraft:equippable");
      const bow = equip?.getEquipment(EquipmentSlot2.Mainhand);
      if (!bow) return;
      const enchants = bow.getComponent("minecraft:enchantable");
      const hasFlame = enchants?.hasEnchantment("flame");
      if (!hasFlame) return;
    } catch {
      return;
    }
    const current = playerTemp.get(hit.id) ?? 18;
    const jumpTarget = 70;
    if (current < jumpTarget) {
      playerTemp.set(hit.id, jumpTarget);
    }
    const existing = playerFireSpike.get(hit.id);
    if (!existing || FIRE_SPIKE_CAPS.flame_1 >= existing.cap) {
      playerFireSpike.set(hit.id, { cap: FIRE_SPIKE_CAPS.flame_1, ticks: SPIKE_DURATION });
    }
  });
  world3.afterEvents.projectileHitEntity.subscribe((event) => {
    if (event.projectile?.typeId !== "minecraft:fireball" && event.projectile?.typeId !== "minecraft:ghast_fireball" && event.projectile?.typeId !== "minecraft:small_fireball") return;
    const hit = event.getEntityHit()?.entity;
    if (!hit || hit.typeId !== "minecraft:player") return;
    const current = playerTemp.get(hit.id) ?? 18;
    const jumpTarget = 75;
    if (current < jumpTarget) {
      playerTemp.set(hit.id, jumpTarget);
    }
    const existing = playerFireSpike.get(hit.id);
    if (!existing || FIRE_SPIKE_CAPS.ghast_fireball >= existing.cap) {
      playerFireSpike.set(hit.id, { cap: FIRE_SPIKE_CAPS.ghast_fireball, ticks: SPIKE_DURATION });
    }
  });
}

// src/main.js
world4.afterEvents.worldLoad.subscribe(() => {
  world4.sendMessage("\xA7a26.5 TemperatureGUI loaded!");
  registerSnowballEffect();
  registerFireEnchantEffect();
  world4.afterEvents.playerSpawn.subscribe((event) => {
    ensurePlayerState(event.player);
  });
  world4.afterEvents.playerLeave.subscribe((event) => {
    clearPlayerState(event.playerId);
  });
  let tickCounter = 0;
  system.runInterval(() => {
    tickCounter++;
    const doHeavyCalc = tickCounter % 20 === 0;
    for (const player of world4.getAllPlayers()) {
      try {
        ensurePlayerState(player);
      } catch (e) {
        try {
          player.onScreenDisplay.setActionBar(`\xA7cError: ${e.message || e}`);
        } catch {
        }
      }
    }
  }, 1);
});
