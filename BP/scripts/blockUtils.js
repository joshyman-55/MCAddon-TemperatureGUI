// ── blockUtils.js ─────────────────────────────────────────────────────────────
// Low-level block scanning utilities shared by all other modules.
// Imported by: hazardDetection.js, tempCalculator.js, main.js (debug stick)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if any block matching `ids` exists within a flat XZ radius
 * and ±1 Y of the player's feet.
 */
export function checkBlocks(player, ids, radius) {
    const dim = player.dimension;
    const origin = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
                const pos = { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
                try {
                    const block = dim.getBlock(pos);
                    if (ids.includes(block?.typeId)) return true;
                } catch { }
            }
        }
    }
    return false;
}

/**
 * Counts how many blocks matching `ids` exist within a flat XZ radius
 * and ±2 Y of the player's feet.
 */
export function countBlocks(player, ids, radius) {
    const dim = player.dimension;
    const origin = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };
    let count = 0;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dy = -2; dy <= 2; dy++) {
                const pos = { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
                try {
                    const block = dim.getBlock(pos);
                    if (ids.includes(block?.typeId)) count++;
                } catch { }
            }
        }
    }
    return count;
}

/**
 * Scans downward up to 30 blocks and returns how far below the player
 * the first solid (non-air) block is. Returns 31 if nothing is found.
 */
export function getDistanceToGround(player) {
    const origin = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };
    for (let dy = 0; dy <= 30; dy++) {
        const pos = { x: origin.x, y: origin.y - dy, z: origin.z };
        try {
            const block = player.dimension.getBlock(pos);
            if (block &&
                block.typeId !== "minecraft:air" &&
                block.typeId !== "minecraft:cave_air" &&
                block.typeId !== "minecraft:void_air") return dy;
        } catch { }
    }
    return 31;
}

/**
 * Scans a wide area around the player to build a set of block IDs
 * near ground level. Only used by the debug stick in main.js now.
 * Returns { foundIds: Set<string>, groundY: number }
 */
export function getNearestGroundBlocks(player, radius, depthSearch = 50) {
    const dim = player.dimension;
    const origin = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };

    const heightAboveGround = Math.max(0, origin.y - 64);
    const scanRadius = Math.min(20, radius + Math.floor(heightAboveGround / 15));

    let groundY = origin.y;
    for (let dy = 0; dy <= depthSearch; dy++) {
        const pos = { x: origin.x, y: origin.y - dy, z: origin.z };
        try {
            const block = dim.getBlock(pos);
            if (block &&
                block.typeId !== "minecraft:air" &&
                block.typeId !== "minecraft:cave_air" &&
                block.typeId !== "minecraft:void_air") {
                groundY = pos.y;
                break;
            }
        } catch { }
    }

    const foundIds = new Set();
    for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        for (let dz = -scanRadius; dz <= scanRadius; dz++) {
            for (let dy = -1; dy <= 3; dy++) {
                const pos = { x: origin.x + dx, y: groundY + dy, z: origin.z + dz };
                try {
                    const block = dim.getBlock(pos);
                    if (block &&
                        block.typeId !== "minecraft:air" &&
                        block.typeId !== "minecraft:cave_air" &&
                        block.typeId !== "minecraft:void_air") {
                        foundIds.add(block.typeId);
                    }
                } catch { }
            }
        }
    }
    return { foundIds, groundY };
}