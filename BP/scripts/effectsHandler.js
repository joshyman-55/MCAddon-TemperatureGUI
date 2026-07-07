// ── effectsHandler.js ─────────────────────────────────────────────────────────
// Applies status effects and damage based on the player's current temperature.
// Called once per heavy-calc tick (every 20 ticks) from main.js.
// Imported by: main.js
// ─────────────────────────────────────────────────────────────────────────────

import {
    playerColdTime, playerHeatTime, playerHydration,
    FROSTBITE_THRESHOLD, HEATSTROKE_THRESHOLD
} from "./playerState.js";
import { getArmorTempModifier, getFireProtectionCap, getFrostWalkerCap } from "./armorDetector.js";

// ── Frostbite ─────────────────────────────────────────────────────────────────
// Cold accumulates when temp ≤ -9°C and drains when warmer.
// Crossing FROSTBITE_THRESHOLD triggers severe slowness + freeze damage.

export function applyFrostbite(player, displayC) {
    let coldTime = playerColdTime.get(player.id);
    const { coldBonus } = getArmorTempModifier(player);
    const coldThreshold = -9 - coldBonus;

    const frostWalkerCap = getFrostWalkerCap(player);
    if (frostWalkerCap !== null && displayC >= frostWalkerCap && displayC <= 0) {
        coldTime = Math.max(0, coldTime - 20);
        playerColdTime.set(player.id, coldTime);
        return;
    }

    if (displayC <= coldThreshold) {
        coldTime += 10;
    } else {
        coldTime = Math.max(0, coldTime - 20);
    }

    playerColdTime.set(player.id, coldTime);

    const coldRatio = coldTime / FROSTBITE_THRESHOLD;

    if (coldTime >= FROSTBITE_THRESHOLD) {
        // Full frostbite — Slowness III + freeze damage
        player.addEffect("slowness", 40, { amplifier: 2, showParticles: true });
        player.applyDamage(1, { cause: "freezing" });
    } else if (coldRatio >= 0.5) {
        // Halfway — Slowness II warning
        player.addEffect("slowness", 40, { amplifier: 1, showParticles: true });
    } else if (displayC <= coldThreshold) {
        // Early warning — Slowness I
        player.addEffect("slowness", 40, { amplifier: 0, showParticles: true });
    }

    // Extreme cold instant damage
    if (displayC <= -40 - coldBonus) player.applyDamage(1, { cause: "freezing" });
    if (displayC <= -60 - coldBonus) player.applyDamage(4, { cause: "freezing" });
}

// ── Heatstroke ────────────────────────────────────────────────────────────────
// Heat accumulates when temp ≥ 42°C and is slowed when hydration charges > 0.
// Crossing HEATSTROKE_THRESHOLD triggers nausea.

export function applyHeatstroke(player, displayC) {
    let heatTime = playerHeatTime.get(player.id);
    let charges = playerHydration.get(player.id);
    const { heatBonus } = getArmorTempModifier(player);
    const heatThreshold = 42 + heatBonus;
    const hasFireResistance = player.getEffect("fire_resistance") !== undefined;
    const fireProtectionCap = getFireProtectionCap(player);
    const heatCap = hasFireResistance || fireProtectionCap > 0
        ? Math.max(hasFireResistance ? 95 : 0, fireProtectionCap)
        : null;

    if (heatCap !== null && displayC <= heatCap && displayC >= 0) {
        heatTime = Math.max(0, heatTime - 20);
        playerHeatTime.set(player.id, heatTime);
        return;
    }

    if (displayC >= heatThreshold) {
        if (charges > 0) {
            // Hydration drains slowly and blocks heat accumulation
            playerHydration.set(player.id, Math.max(0, charges - 10 / 2000));
            heatTime = Math.max(0, heatTime - 10);
        } else {
            heatTime += 10;
        }
    } else {
        heatTime = Math.max(0, heatTime - 20);
    }

    playerHeatTime.set(player.id, heatTime);

    const heatRatio = heatTime / HEATSTROKE_THRESHOLD;

    if (heatTime >= HEATSTROKE_THRESHOLD) {
        // Full heatstroke — Nausea II + Weakness, removes fire resistance
        player.removeEffect("fire_resistance");
        player.addEffect("nausea", 100, { amplifier: 2, showParticles: true });
        player.addEffect("weakness", 100, { amplifier: 1, showParticles: true });
    } else if (heatRatio >= 0.5) {
        // Halfway — Nausea I warning — amplifier 1 so screen distortion is visible
        player.addEffect("nausea", 100, { amplifier: 1, showParticles: true });
    } else if (displayC >= heatThreshold) {
        // Early warning — Weakness I
        player.addEffect("weakness", 60, { amplifier: 0, showParticles: true });
    }

    // Extreme heat instant damage — fire resistance is stripped at this point
    if (displayC >= 50 + heatBonus) {
        player.removeEffect("fire_resistance");
        player.applyDamage(1, { cause: "fire" });
    }
    if (displayC >= 60 + heatBonus) player.applyDamage(4, { cause: "fire" });
}