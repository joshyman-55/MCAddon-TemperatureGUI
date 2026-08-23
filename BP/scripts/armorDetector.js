import { EquipmentSlot } from "@minecraft/server";

export function getArmorTempModifier(player) {
    try {
        const container = player.getComponent("minecraft:equippable");
        if (!container) {
            return { coldBonus: 0, heatBonus: 0 };
        }
        const slots = [
            EquipmentSlot.Head,
            EquipmentSlot.Chest,
            EquipmentSlot.Legs,
            EquipmentSlot.Feet,
        ];
        let coldBonus = 0;
        let heatBonus = 0;

        for (const slot of slots) {
            const item = container.getEquipment(slot);
            if (!item) continue;
            const id = item.typeId;
            if (id.includes("diamond")) {
                coldBonus += 8;
                heatBonus += 6;
            }
            else if (id.includes("netherite")) {
                coldBonus += 6;
                heatBonus += 8;
            }
            else if (id.includes("iron")) {
                coldBonus += 4;
                heatBonus += 0;
            }
        }

        return { coldBonus, heatBonus };

    } catch {
        return { coldBonus: 0, heatBonus: 0 };
    }
}

const FP_LEVEL_CAP = { 1: 39.5, 2: 40.5, 3: 41.5, 4: 42.5 };

export function getFireProtectionCap(player) {
    try {
        const container = player.getComponent("minecraft:equippable");
        if (!container) return 0;
        const slots = [
            EquipmentSlot.Head,
            EquipmentSlot.Chest,
            EquipmentSlot.Legs,
            EquipmentSlot.Feet,
        ];
        let pieceCount = 0;
        let minLevel = 4;
        for (const slot of slots) {
            const item = container.getEquipment(slot);
            if (!item) continue;
            try {
                const enchants = item.getComponent("minecraft:enchantable");
                const level = enchants?.getEnchantment("fire_protection")?.level ?? 0;
                if (level >= 1) {
                    pieceCount++;
                    minLevel = Math.min(minLevel, level);
                }
            } catch { }
        }
        if (pieceCount < 4) return 0;
        return FP_LEVEL_CAP[minLevel] ?? 0;
    } catch {
        return 0;
    }
}

const FW_LEVEL_CAP = { 1: 34.0, 2: 33.0 };

export function getFrostWalkerCap(player) {
    try {
        const container = player.getComponent("minecraft:equippable");
        if (!container) return null;
        const allSlots = [
            EquipmentSlot.Head,
            EquipmentSlot.Chest,
            EquipmentSlot.Legs,
            EquipmentSlot.Feet,
        ];
        for (const slot of allSlots) {
            if (!container.getEquipment(slot)) return null;
        }
        try {
            const boots = container.getEquipment(EquipmentSlot.Feet);
            const enchants = boots.getComponent("minecraft:enchantable");
            const level = enchants?.getEnchantment("frost_walker")?.level ?? 0;
            if (level >= 1) return FW_LEVEL_CAP[level] ?? null;
        } catch { }
        return null;
    } catch {
        return null;
    }
}