import { world } from "@minecraft/server";
import { playerBodyTemp, playerUseFahrenheit, playerSnowSpike } from "./playerState.js";
import { toFahrenheit } from "./tempCalculator.js";

const SNOW_SPIKE_DURATION = 6;

export function registerSnowballEffect() {
    world.afterEvents.projectileHitEntity.subscribe((event) => {

        // ── Filter snowball hitting a player ──────────────────────────────────
        if (event.projectile?.typeId !== 'minecraft:snowball') return;
        const hit = event.getEntityHit()?.entity;
        if (!hit || hit.typeId !== "minecraft:player") return;

        // ── Direct Body Temp knock — bypasses the dead zone so every hit is
        // felt immediately, regardless of ambient conditions ───────────────────
        const currentBodyTemp = playerBodyTemp.get(hit.id) ?? 37;
        const chilledBodyTemp = Math.max(32, currentBodyTemp - 0.8);
        playerBodyTemp.set(hit.id, chilledBodyTemp);

        // ── Snow spike — decaying cold state, same pattern as fire spikes.
        playerSnowSpike.set(hit.id, { ticks: SNOW_SPIKE_DURATION });

        // ── Display message in player's unit ──────────────────────────────────
        const useFahrenheit = playerUseFahrenheit.get(hit.id) ?? false;
        const displayTemp = useFahrenheit
          ? Math.round(toFahrenheit(chilledBodyTemp))
          : Math.round(chilledBodyTemp);
        const unit = useFahrenheit ? "°F" : "°C";
        hit.sendMessage(`§b❄ Snowball hit! Body temp dropped to ${displayTemp}${unit}`);
    });
}