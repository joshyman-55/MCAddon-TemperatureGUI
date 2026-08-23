// ── effectsHandler.js ─────────────────────────────────────────────────────────
// Applies status effects and damage based on the player's current temperature.
// Called once per heavy-calc tick (every 20 ticks) from main.js.
// Imported by: main.js
// ─────────────────────────────────────────────────────────────────────────────

import {
    playerColdTime, playerHeatTime, playerHydration,
    FROSTBITE_THRESHOLD, HEATSTROKE_THRESHOLD, playerOverlayCooldown
} from "./playerState.js";
import { getArmorTempModifier, getFireProtectionCap, getFrostWalkerCap } from "./armorDetector.js";

// ── Screen overlay pulse ────────────────────────────────────────────────────
// Brief camera fade toward a color, used as a visual danger warning. Gated by
// a per-player cooldown (in heavy-calc ticks, ~1s each) so it pulses every
// few seconds instead of every tick, which would be overwhelming.
const OVERLAY_COOLDOWN_TICKS = 3;

function tryOverlayPulse(player, color, holdTime) {
    const cooldown = playerOverlayCooldown.get(player.id) ?? 0;
    if (cooldown > 0) {
        playerOverlayCooldown.set(player.id, cooldown - 1);
        return;
    }
    try {
        player.camera.fade({
            fadeColor: color,
            fadeTime: { fadeInTime: 0.3, holdTime, fadeOutTime: 0.6 }
        });
    } catch (e) {
        try { player.sendMessage(`§c[Overlay ERROR] ${e}`); } catch { }
    }
    playerOverlayCooldown.set(player.id, OVERLAY_COOLDOWN_TICKS);
}

// ── Frostbite ─────────────────────────────────────────────────────────────────
// Cold accumulates when body temp ≤ 35.0°C and drains when warmer.
// Crossing FROSTBITE_THRESHOLD triggers severe slowness + freeze damage.

export function applyFrostbite(player, bodyC) {
    let coldTime = playerColdTime.get(player.id);
    const { coldBonus } = getArmorTempModifier(player);
    const coldThreshold = 35.0 - (coldBonus * 0.1);
    const criticalThreshold = 32.5 - (coldBonus * 0.1);

    const frostWalkerCap = getFrostWalkerCap(player);
    if (frostWalkerCap !== null && bodyC >= frostWalkerCap) {
        coldTime = Math.max(0, coldTime - 20);
        playerColdTime.set(player.id, coldTime);
        return;
    }

    if (bodyC <= coldThreshold) {
        coldTime += 10;
    } else {
        coldTime = Math.max(0, coldTime - 20);
    }

    playerColdTime.set(player.id, coldTime);

    const coldRatio = coldTime / FROSTBITE_THRESHOLD;

    // ── Cold overlay — pulses once past 30% toward frostbite, intensifying ────
    if (coldRatio >= 0.3) {
        const intensity = Math.min(1, coldRatio);
        tryOverlayPulse(
            player,
            { red: 0.55, green: 0.75, blue: 1.0 },
            0.15 + intensity * 0.35
        );
    }

    if (coldTime >= FROSTBITE_THRESHOLD) {
        // Full frostbite — Slowness III + freeze damage
        player.addEffect("slowness", 40, { amplifier: 2, showParticles: true });
        player.applyDamage(1, { cause: "freezing" });
    } else if (coldRatio >= 0.5) {
        // Halfway — Slowness II warning
        player.addEffect("slowness", 40, { amplifier: 1, showParticles: true });
    } else if (bodyC <= coldThreshold) {
        // Early warning — Slowness I
        player.addEffect("slowness", 40, { amplifier: 0, showParticles: true });
    }

    // Extreme cold instant damage
    if (bodyC <= criticalThreshold) player.applyDamage(1, { cause: "freezing" });
    if (bodyC <= 32.0) player.applyDamage(4, { cause: "freezing" });
}

// ── Heatstroke ────────────────────────────────────────────────────────────────
// Heat accumulates when body temp ≥ 39.5°C and is slowed when hydration charges > 0.
// Crossing HEATSTROKE_THRESHOLD triggers nausea.

export function applyHeatstroke(player, bodyC) {
    let heatTime = playerHeatTime.get(player.id);
    let charges = playerHydration.get(player.id);
    const { heatBonus } = getArmorTempModifier(player);
    const heatThreshold = 39.5 + (heatBonus * 0.1);
    const criticalThreshold = 41.5 + (heatBonus * 0.1);
    const hasFireResistance = player.getEffect("fire_resistance") !== undefined;
    const fireProtectionCap = getFireProtectionCap(player);
    const heatCap = hasFireResistance || fireProtectionCap > 0
        ? Math.max(hasFireResistance ? 95 : 0, fireProtectionCap)
        : null;

    if (heatCap !== null && bodyC <= heatCap) {
        heatTime = Math.max(0, heatTime - 20);
        playerHeatTime.set(player.id, heatTime);
        return;
    }

    if (bodyC >= heatThreshold) {
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
    
    // ── Heat overlay — pulses once past 30% toward heatstroke, intensifying ───
    if (heatRatio >= 0.3) {
        const intensity = Math.min(1, heatRatio);
        tryOverlayPulse(
            player,
            { red: 1.0, green: 0.45, blue: 0.1 },
            0.15 + intensity * 0.35
        );
    }

    if (heatTime >= HEATSTROKE_THRESHOLD) {
        // Full heatstroke — Nausea II + Weakness, removes fire resistance
        player.removeEffect("fire_resistance");
        player.addEffect("nausea", 100, { amplifier: 2, showParticles: true });
        player.addEffect("weakness", 100, { amplifier: 1, showParticles: true });
    } else if (heatRatio >= 0.5) {
        // Halfway — Nausea I warning — amplifier 1 so screen distortion is visible
        player.addEffect("nausea", 100, { amplifier: 1, showParticles: true });
    } else if (bodyC >= heatThreshold) {
        // Early warning — Weakness I
        player.addEffect("weakness", 60, { amplifier: 0, showParticles: true });
    }

    // Extreme heat instant damage — fire resistance is stripped at this point
    if (bodyC >= criticalThreshold) {
        player.removeEffect("fire_resistance");
        player.applyDamage(1, { cause: "fire" });
    }
    if (bodyC >= 42.5) player.applyDamage(4, { cause: "fire" });
}