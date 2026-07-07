// ── blockUtils.js ─────────────────────────────────────────────────────────────
// Low-level block scanning utilities shared by all other modules.
// Imported by: biomeDetection.js, hazardDetection.js, tempCalculator.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if any block matching `ids` exists within a flat XZ radius
 * and ±1 Y of the player's feet.
 */
export function checkBlocks(player, ids, radius) {
    const loc = player.location;
    const dim = player.dimension;
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dy = -1; dy <= 1; dy++) {
                try {
                    const block = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
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
    const loc = player.location;
    const dim = player.dimension;
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    let count = 0;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dy = -2; dy <= 2; dy++) {
                try {
                    const block = dim.getBlock({ x: x + dx, y: y + dy, z: z + dz });
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
    const px = Math.floor(player.location.x);
    const py = Math.floor(player.location.y);
    const pz = Math.floor(player.location.z);
    for (let dy = 0; dy <= 30; dy++) {
        try {
            const block = player.dimension.getBlock({ x: px, y: py - dy, z: pz });
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
 * near ground level. Used by the block-vote biome fallback.
 * Returns { foundIds: Set<string>, groundY: number }
 */
export function getNearestGroundBlocks(player, radius, depthSearch = 50) {
    const loc = player.location;
    const dim = player.dimension;
    const px = Math.floor(loc.x);
    const py = Math.floor(loc.y);
    const pz = Math.floor(loc.z);

    const heightAboveGround = Math.max(0, py - 64);
    const scanRadius = Math.min(20, radius + Math.floor(heightAboveGround / 15));

    let groundY = py;
    for (let dy = 0; dy <= depthSearch; dy++) {
        try {
            const block = dim.getBlock({ x: px, y: py - dy, z: pz });
            if (block &&
                block.typeId !== "minecraft:air" &&
                block.typeId !== "minecraft:cave_air" &&
                block.typeId !== "minecraft:void_air") {
                groundY = py - dy;
                break;
            }
        } catch { }
    }

    const foundIds = new Set();
    for (let dx = -scanRadius; dx <= scanRadius; dx++) {
        for (let dz = -scanRadius; dz <= scanRadius; dz++) {
            for (let dy = -1; dy <= 3; dy++) {
                try {
                    const block = dim.getBlock({ x: px + dx, y: groundY + dy, z: pz + dz });
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