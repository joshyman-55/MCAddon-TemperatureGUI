// ── hazardDetection.js ────────────────────────────────────────────────────────
// Detects environmental hazards and modifiers around the player:
// lava, fire, magma, indoors, snow/ice contact, campfire proximity, water temp.
// Imported by: tempCalculator.js
// ─────────────────────────────────────────────────────────────────────────────

import { checkBlocks, countBlocks } from "./blockUtils.js";

// ── Lava ──────────────────────────────────────────────────────────────────────

export function isInLava(player) {
    try {
        const block = player.dimension.getBlock({
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y),
            z: Math.floor(player.location.z)
        });
        return block?.typeId === "minecraft:lava" ||
            block?.typeId === "minecraft:flowing_lava";
    } catch { return false; }
}

export function isNearLava(player) {
    return checkBlocks(player, ["minecraft:lava", "minecraft:flowing_lava"], 2);
}

// ── Player's own burning status (NOT nearby blocks) ────────────────────────────
// Detects whether the player themselves is ablaze (fire ticks active),
// regardless of whether any fire blocks exist nearby. This is what should
// bump Body Temp directly — a personal event, separate from isOnFire()
// below, which detects real fire BLOCKS near the player's feet (environmental).

export function isPlayerBurning(player) {
    try {
        return player.getComponent("minecraft:onfire") !== undefined;
    } catch { return false; }
}

// ── Fire ──────────────────────────────────────────────────────────────────────

export function isOnFire(player) {
    try {
        const x = Math.floor(player.location.x);
        const y = Math.floor(player.location.y);
        const z = Math.floor(player.location.z);
        for (let dy = -1; dy <= 1; dy++) {
            const block = player.dimension.getBlock({ x, y: y + dy, z });
            if (block?.typeId === "minecraft:fire" ||
                block?.typeId === "minecraft:soul_fire") return true;
        }
        return false;
    } catch { return false; }
}

// ── Magma ─────────────────────────────────────────────────────────────────────

export function isOnMagma(player) {
    try {
        const block = player.dimension.getBlock({
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y) - 1,
            z: Math.floor(player.location.z)
        });
        return block?.typeId === "minecraft:magma";
    } catch { return false; }
}

// ── Indoors ───────────────────────────────────────────────────────────────────
// Returns true if there is a solid block (not air/leaves/glass) within 8
// blocks above the player — indicating a roof/shelter overhead.

export function isIndoors(player) {
    const dimId = player.dimension.id;
    if (dimId === "minecraft:nether" || dimId === "minecraft:the_end") return false;
    const loc = player.location;
    const dim = player.dimension;
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    for (let dy = 1; dy <= 8; dy++) {
        try {
            const block = dim.getBlock({ x, y: y + dy, z });
            if (!block) continue;
            const id = block.typeId;
            if (id === "minecraft:air" ||
                id === "minecraft:cave_air" ||
                id === "minecraft:void_air" ||
                id.includes("leaves") ||
                id.includes("glass")) continue;
            return true;
        } catch { }
    }
    return false;
}

// ── Snow / ice contact ────────────────────────────────────────────────────────
// Returns flags for snow and ice contact states (applied last in temp calc).
// Ice hierarchy: blue ice > packed ice > regular ice > snow block > snow layer > powder snow

export function getSnowContact(player, isSpecialDim) {
    if (isSpecialDim) {
        return {
            inPowderSnow: false, buriedInSnow: false,
            onSnowLayer: false, onIce: false,
            onPackedIce: false, onBlueIce: false
        };
    }

    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);

    const getBlock = (y) => {
        try { return player.dimension.getBlock({ x: px, y, z: pz }); }
        catch { return null; }
    };

    const blockAt = getBlock(py);
    const blockBelow = getBlock(py - 1);

    // ── Ice contact — check block below feet ──────────────────────────────────
    const belowId = blockBelow?.typeId ?? "";
    const onBlueIce = belowId === "minecraft:blue_ice";
    const onPackedIce = !onBlueIce && belowId === "minecraft:packed_ice";
    const onIce = !onBlueIce && !onPackedIce && belowId === "minecraft:ice";

    // ── Powder snow — player is inside the block ──────────────────────────────
    const inPowderSnow = blockAt?.typeId === "minecraft:powder_snow";

    // ── Buried in snow blocks ─────────────────────────────────────────────────
    const buriedInSnow = !inPowderSnow && !onIce && !onPackedIce && !onBlueIce &&
        countBlocks(player, ["minecraft:snow_block"], 2) >= 4;

    // ── Standing on snow layer ────────────────────────────────────────────────
    const onSnowLayer = !inPowderSnow && !onIce && !onPackedIce && !onBlueIce && (() => {
        return blockAt?.typeId === "minecraft:snow_layer" ||
            blockBelow?.typeId === "minecraft:snow_layer";
    })();

    return { inPowderSnow, buriedInSnow, onSnowLayer, onIce, onPackedIce, onBlueIce };
}

// ── Campfire proximity ────────────────────────────────────────────────────────
// Returns "on" | "close" | "near" | null based on distance to the nearest
// lit campfire or soul campfire within 4 blocks.

export function getCampfireProximity(player) {
    const loc = player.location;
    const dim = player.dimension;
    const px = Math.floor(loc.x);
    const py = Math.floor(loc.y);
    const pz = Math.floor(loc.z);
    let nearestDist = Infinity;
    for (let dx = -4; dx <= 4; dx++) {
        for (let dy = -1; dy <= 2; dy++) {
            for (let dz = -4; dz <= 4; dz++) {
                try {
                    const block = dim.getBlock({ x: px + dx, y: py + dy, z: pz + dz });
                    if (block?.typeId === "minecraft:campfire" ||
                        block?.typeId === "minecraft:soul_campfire") {
                        const states = block.permutation.getAllStates();
                        if (states["extinguished"] === false) {
                            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                            if (dist < nearestDist) nearestDist = dist;
                        }
                    }
                } catch { }
            }
        }
    }
    if (nearestDist === Infinity) return null;
    if (nearestDist <= 1.5) return "on";
    if (nearestDist <= 3.5) return "close";
    return "near";
}

// ── Water temperature ─────────────────────────────────────────────────────────
// Returns the temperature (°C) of the water the player is currently in,
// based on surrounding blocks (ice, coral, sand, jungle, etc.).

export function getWaterTemp(player) {
    const iceBlocks = [
        "minecraft:blue_ice", "minecraft:packed_ice", "minecraft:ice",
        "minecraft:snow_block", "minecraft:powder_snow"
    ];
    const iceCount = countBlocks(player, iceBlocks, 6);
    if (iceCount >= 10) return -8;
    if (iceCount >= 4) return -3;
    if (iceCount >= 1) return 1;
    if (checkBlocks(player, ["minecraft:snow_layer"], 4)) return 2;
    if (checkBlocks(player, ["minecraft:sand", "minecraft:sandstone"], 5) &&
        checkBlocks(player, ["minecraft:dead_bush", "minecraft:cactus"], 5)) return 32;
    if (checkBlocks(player, ["minecraft:sand", "minecraft:sandstone"], 5)) return 26;
    if (checkBlocks(player, [
        "minecraft:brain_coral_block", "minecraft:bubble_coral_block",
        "minecraft:fire_coral_block", "minecraft:horn_coral_block",
        "minecraft:tube_coral_block"], 5)) return 28;
    if (checkBlocks(player, [
        "minecraft:jungle_log", "minecraft:jungle_leaves",
        "minecraft:bamboo"], 5)) return 24;
    return 10;
}

// ── Ice count (used by tempCalculator for lerp speed in water) ────────────────

export function getNearbyIceCount(player) {
    return countBlocks(player, [
        "minecraft:blue_ice", "minecraft:packed_ice",
        "minecraft:ice", "minecraft:snow_block", "minecraft:powder_snow"
    ], 6);
}