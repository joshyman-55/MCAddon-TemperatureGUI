// ── main.js ───────────────────────────────────────────────────────────────────
// 26.5 ENTRY POINT — registered in manifest.json as scripts.entry_point.
// Modern era rewrite: API 2.x, dynamic properties, native getBiome() only.
// ─────────────────────────────────────────────────────────────────────────────

import { world, system } from "@minecraft/server";
import { BIOME_DATA } from "./biomeData.js";
import { getBiomeKey } from "./biomeDetection.js";
import { calculateTemperature, toFahrenheit } from "./tempCalculator.js";
import {
    ensurePlayerState, clearPlayerState
    // playerTemp, playerUV, etc. — add back in as playerState.js gets ported
} from "./playerState.js";
import { applyFrostbite, applyHeatstroke } from "./effectsHandler.js";
import { registerSnowballEffect } from "./snowballEffect.js";
import { registerFireEnchantEffect } from "./fireEnchantsEffect.js";

// ── API 2.x requires waiting for world load before most calls work ───────────
world.afterEvents.worldLoad.subscribe(() => {

    world.sendMessage("§a26.5 TemperatureGUI loaded!");

    registerSnowballEffect();
    registerFireEnchantEffect();

    // ── Events ─────────────────────────────────────────────────────────────
    world.afterEvents.playerSpawn.subscribe((event) => {
        ensurePlayerState(event.player);
        // TODO: port spawn/respawn temp logic from main.legacy.js
    });

    world.afterEvents.playerLeave.subscribe((event) => {
        clearPlayerState(event.playerId);
    });

    // ── Main tick ──────────────────────────────────────────────────────────
    let tickCounter = 0;
    system.runInterval(() => {
        tickCounter++;
        const doHeavyCalc = (tickCounter % 20 === 0);

        for (const player of world.getAllPlayers()) {
            try {
                ensurePlayerState(player);
                if (doHeavyCalc) {
                    const biomeKey = getBiomeKey(player);
                    player.sendMessage(`§7[DEBUG] Biome: ${biomeKey}`);
                }
            } catch (e) {
                try {
                    player.onScreenDisplay.setActionBar(`§cError: ${e.message || e}`);
                } catch { }
            }
        }
    }, 1);

});