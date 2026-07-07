import { world } from "@minecraft/server";
import { playerTemp, playerUseFahrenheit } from "./playerState.js";

export function registerSnowballEffect() {
    world.afterEvents.projectileHitEntity.subscribe((event) => {

        // ── Filter snowball hitting a player ──────────────────────────────────
        if (event.projectile?.typeId !== 'minecraft:snowball') return;
        const hit = event.getEntityHit()?.entity;
        if (!hit || hit.typeId !== "minecraft:player") return;

        // ── Get current temp ──────────────────────────────────────────────────
        const current = playerTemp.get(hit.id);
        if (current == undefined) return;

        // ── Apply cooling ─────────────────────────────────────────────────────
        const cooled = Math.max(-30, current - 3);
        playerTemp.set(hit.id, cooled);

        // ── Display message in player's unit ──────────────────────────────────
        const useFahrenheit = playerUseFahrenheit.get(hit.id) ?? false;
        const displayTemp = useFahrenheit ? Math.round((cooled * 9 / 5) + 32) : Math.round(cooled);
        const unit = useFahrenheit ? "°F" : "°C";
        hit.sendMessage(`§b❄ Snowball hit! Temp dropped to ${displayTemp}${unit}`);
    });
}