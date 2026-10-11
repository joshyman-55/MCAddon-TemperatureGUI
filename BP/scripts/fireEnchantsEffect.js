import { world, EquipmentSlot } from "@minecraft/server";
import { playerFireSpike, playerBodyTemp } from "./playerState.js";

const FIRE_SPIKE_CAPS = {
    flame_1: 38.5,
    fire_aspect_1: 38.0,
    fire_aspect_2: 39.5,
    ghast_fireball: 39.0,
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

        const currentBodyTemp = playerBodyTemp.get(entity.id) ?? 37;
        if (currentBodyTemp < spikeCap) {
            playerBodyTemp.set(entity.id, spikeCap);
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

        // Is this arrow actually burning? Check the arrow itself first (accurate even if
        // the shooter switched items or dropped the bow), then fall back to the
        // shooter's bow enchantment so behaviour never gets worse than before.
        let isFlaming = false;
        try {
            isFlaming = event.projectile.getComponent("minecraft:onfire") !== undefined;
        } catch { }
        if (!isFlaming) {
            try {
                const equip = event.source?.getComponent("minecraft:equippable");
                const bow = equip?.getEquipment(EquipmentSlot.Mainhand);
                const enchants = bow?.getComponent("minecraft:enchantable");
                isFlaming = enchants?.hasEnchantment("flame") === true;
            } catch { }
        }
        if (!isFlaming) return;

        const currentBodyTemp = playerBodyTemp.get(hit.id) ?? 37;
        const jumpTarget = FIRE_SPIKE_CAPS.flame_1;
        if (currentBodyTemp < jumpTarget) {
            playerBodyTemp.set(hit.id, jumpTarget);
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

        const currentBodyTemp = playerBodyTemp.get(hit.id) ?? 37;
        const jumpTarget = FIRE_SPIKE_CAPS.ghast_fireball;
        if (currentBodyTemp < jumpTarget) {
            playerBodyTemp.set(hit.id, jumpTarget);
        }

        const existing = playerFireSpike.get(hit.id);
        if (!existing || FIRE_SPIKE_CAPS.ghast_fireball >= existing.cap) {
            playerFireSpike.set(hit.id, { cap: FIRE_SPIKE_CAPS.ghast_fireball, ticks: SPIKE_DURATION });
        }
    });
}