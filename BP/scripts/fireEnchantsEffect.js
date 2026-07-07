import { world, EquipmentSlot } from "@minecraft/server";
import { playerFireSpike, playerTemp } from "./playerState.js";

const FIRE_SPIKE_CAPS = {
    flame_1: 90,
    fire_aspect_1: 85,
    fire_aspect_2: 100,
    ghast_fireball: 95,
};
const SPIKE_DURATION = 8;

export function registerFireEnchantEffect() {

    // ── Fire Aspect melee ─────────────────────────────────────────────────────
    world.afterEvents.entityHurt.subscribe((event) => {
        const entity = event.hurtEntity;
        if (entity.typeId !== "minecraft:player") return;

        const cause = event.damageSource?.cause ?? "";
        const damagingEntity = event.damageSource?.damagingEntity;

        if (cause !== "entityAttack" || damagingEntity?.typeId !== "minecraft:player") return;

        let spikeCap = null;

        try {
            const attackEquip = damagingEntity.getComponent("minecraft:equippable");
            const mainhand = attackEquip?.getEquipment(EquipmentSlot.Mainhand);
            if (mainhand) {
                const enchants = mainhand.getComponent("minecraft:enchantable");
                const level = enchants?.getEnchantment("fire_aspect")?.level ?? 0;
                if (level === 2) spikeCap = FIRE_SPIKE_CAPS.fire_aspect_2;
                else if (level === 1) spikeCap = FIRE_SPIKE_CAPS.fire_aspect_1;
            }
        } catch { }

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

    // ── Flame arrow ───────────────────────────────────────────────────────────
    world.afterEvents.projectileHitEntity.subscribe((event) => {
        if (event.projectile?.typeId !== "minecraft:arrow") return;
        const hit = event.getEntityHit()?.entity;
        if (!hit || hit.typeId !== "minecraft:player") return;

        try {
            const shooter = event.source;
            if (!shooter) return;
            const equip = shooter.getComponent("minecraft:equippable");
            const bow = equip?.getEquipment(EquipmentSlot.Mainhand);
            if (!bow) return;
            const enchants = bow.getComponent("minecraft:enchantable");
            const hasFlame = enchants?.hasEnchantment("flame");
            if (!hasFlame) return;
        } catch { return; }

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

    // ── Fireball ──────────────────────────────────────────────────────────────
    world.afterEvents.projectileHitEntity.subscribe((event) => {
        if (event.projectile?.typeId !== "minecraft:fireball" &&
            event.projectile?.typeId !== "minecraft:ghast_fireball" &&
            event.projectile?.typeId !== "minecraft:small_fireball") return;
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