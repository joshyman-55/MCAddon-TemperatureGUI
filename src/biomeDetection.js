// ── biomeDetection.js ─────────────────────────────────────────────────────────
// Detects which BIOME_DATA key applies to the player's current position.
// Primary method: Minecraft's native getBiome() API.
// Fallback: block-vote scan when API is unavailable or returns an unknown ID.
// Imported by: tempCalculator.js, temperatureGUI.js
// ─────────────────────────────────────────────────────────────────────────────

import { getNearestGroundBlocks } from "./blockUtils.js";

// ── Block-vote fallback ───────────────────────────────────────────────────────
// Scans blocks around the player and votes for the most likely biome.

function getBiomeKeyFromBlocks(player) {
    const { foundIds, groundY } = getNearestGroundBlocks(player, 8, 50);
    const has = (...ids) => ids.some(id => foundIds.has(id));

    // Hard overrides — unique enough to always win
    if (has("minecraft:blue_ice", "minecraft:packed_ice", "minecraft:ice")) return "frozen";
    if (has("minecraft:snow_block")) return "snowy";

    const hasSnowLayer = has("minecraft:snow_layer");
    const hasWarmConflict = has(
        "minecraft:sand", "minecraft:red_sand",
        "minecraft:jungle_log", "minecraft:jungle_leaves",
        "minecraft:acacia_log", "minecraft:acacia_leaves",
        "minecraft:cactus", "minecraft:dead_bush"
    );
    if (hasSnowLayer && !hasWarmConflict) return "snowy";
    if (has("minecraft:grass_block") && has(
        "minecraft:snow_layer", "minecraft:snow_block",
        "minecraft:ice", "minecraft:packed_ice", "minecraft:blue_ice"
    )) return "snowy";

    // Majority vote — each block type votes for its biome with a weight
    // reflecting how unique it is. The biome with the most votes wins,
    // provided it clears a minimum threshold.
    const px = Math.floor(player.location.x);
    const pz = Math.floor(player.location.z);
    const SCAN_RADIUS = 16;
    const SCAN_HEIGHT = 12; // above groundY — catches tall tree canopies

    const votes = {
        desert: 0, badlands: 0, jungle: 0, savanna: 0, swamp: 0,
        mushroom: 0, taiga: 0, birch: 0, darkforest: 0, cherry: 0,
        pale: 0, warmocean: 0, ocean: 0, forest: 0, deepdark: 0,
        dripstone: 0, lush: 0,
    };

    for (let dx = -SCAN_RADIUS; dx <= SCAN_RADIUS; dx++) {
        for (let dz = -SCAN_RADIUS; dz <= SCAN_RADIUS; dz++) {
            for (let dy = -1; dy <= SCAN_HEIGHT; dy++) {
                try {
                    const block = player.dimension.getBlock({
                        x: px + dx, y: groundY + dy, z: pz + dz
                    });
                    const id = block?.typeId;
                    if (!id || id === "minecraft:air" ||
                        id === "minecraft:cave_air" ||
                        id === "minecraft:void_air") continue;

                    switch (id) {
                        // Desert
                        case "minecraft:sand":
                        case "minecraft:sandstone": votes.desert += 1; break;
                        case "minecraft:dead_bush":
                        case "minecraft:cactus": votes.desert += 4; break;
                        // Badlands
                        case "minecraft:red_sand":
                        case "minecraft:red_sandstone": votes.badlands += 2; break;
                        case "minecraft:terracotta":
                        case "minecraft:orange_terracotta":
                        case "minecraft:yellow_terracotta":
                        case "minecraft:white_terracotta":
                        case "minecraft:red_terracotta":
                        case "minecraft:brown_terracotta": votes.badlands += 3; break;
                        // Jungle
                        case "minecraft:jungle_log":
                        case "minecraft:jungle_leaves": votes.jungle += 8; break;
                        case "minecraft:vine": votes.jungle += 3; break;
                        case "minecraft:melon_block":
                        case "minecraft:melon_stem": votes.jungle += 4; break;
                        case "minecraft:bamboo":
                        case "minecraft:cocoa":
                        case "minecraft:jungle_sapling": votes.jungle += 6; break;
                        // Savanna
                        case "minecraft:acacia_log": votes.savanna += 5; break;
                        case "minecraft:acacia_leaves": votes.savanna += 3; break;
                        case "minecraft:acacia_sapling": votes.savanna += 4; break;
                        // Swamp
                        case "minecraft:mud":
                        case "minecraft:mangrove_log":
                        case "minecraft:mangrove_leaves":
                        case "minecraft:mangrove_roots": votes.swamp += 4; break;
                        case "minecraft:lily_pad": votes.swamp += 3; break;
                        // Mushroom
                        case "minecraft:mycelium": votes.mushroom += 5; break;
                        case "minecraft:brown_mushroom_block":
                        case "minecraft:red_mushroom_block": votes.mushroom += 4; break;
                        // Taiga
                        case "minecraft:spruce_log":
                        case "minecraft:spruce_leaves": votes.taiga += 3; break;
                        case "minecraft:podzol": votes.taiga += 4; break;
                        case "minecraft:fern":
                        case "minecraft:large_fern": votes.taiga += 1; break;
                        case "minecraft:spruce_sapling": votes.taiga += 3; break;
                        // Birch
                        case "minecraft:birch_log":
                        case "minecraft:birch_leaves": votes.birch += 3; break;
                        case "minecraft:birch_sapling": votes.birch += 3; break;
                        // Dark forest
                        case "minecraft:dark_oak_log":
                        case "minecraft:dark_oak_leaves": votes.darkforest += 3; break;
                        case "minecraft:dark_oak_sapling": votes.darkforest += 3; break;
                        // Cherry grove
                        case "minecraft:cherry_log":
                        case "minecraft:cherry_leaves": votes.cherry += 3; break;
                        case "minecraft:pink_petals": votes.cherry += 4; break;
                        case "minecraft:cherry_sapling": votes.cherry += 3; break;
                        // Pale garden
                        case "minecraft:pale_oak_log":
                        case "minecraft:pale_oak_leaves": votes.pale += 3; break;
                        case "minecraft:pale_moss_block":
                        case "minecraft:pale_moss_carpet": votes.pale += 4; break;
                        case "minecraft:pale_oak_sapling": votes.pale += 3; break;
                        // Warm ocean
                        case "minecraft:brain_coral_block":
                        case "minecraft:bubble_coral_block":
                        case "minecraft:fire_coral_block":
                        case "minecraft:horn_coral_block":
                        case "minecraft:tube_coral_block": votes.warmocean += 5; break;
                        // Ocean
                        case "minecraft:kelp":
                        case "minecraft:seagrass":
                        case "minecraft:sea_pickle": votes.ocean += 3; break;
                        // Forest (low weight — oak appears many places)
                        case "minecraft:oak_log":
                        case "minecraft:oak_leaves": votes.forest += 2; break;
                        // Deep dark
                        case "minecraft:sculk": votes.deepdark += 3; break;
                        case "minecraft:sculk_catalyst":
                        case "minecraft:sculk_sensor":
                        case "minecraft:sculk_shrieker":
                        case "minecraft:sculk_vein": votes.deepdark += 4; break;
                        // Dripstone
                        case "minecraft:dripstone_block":
                        case "minecraft:pointed_dripstone": votes.dripstone += 3; break;
                        // Lush caves
                        case "minecraft:moss_block":
                        case "minecraft:moss_carpet": votes.lush += 3; break;
                        case "minecraft:azalea_leaves":
                        case "minecraft:spore_blossom":
                        case "minecraft:glow_lichen":
                        case "minecraft:azalea":
                        case "minecraft:flowering_azalea": votes.lush += 4; break;
                    }
                } catch { }
            }
        }
    }

    // Find winning biome
    let winner = null, winnerVotes = 0;
    for (const [biome, count] of Object.entries(votes)) {
        if (count > winnerVotes) { winnerVotes = count; winner = biome; }
    }

    if (winner && winnerVotes >= 6) {
        // Beach exception: sand votes for desert but water nearby = beach
        if (winner === "desert" && has(
            "minecraft:water", "minecraft:seagrass",
            "minecraft:kelp", "minecraft:sea_pickle")) return "beach";
        return winner;
    }

    // Fallbacks when no biome wins the vote
    if (has("minecraft:water", "minecraft:kelp",
        "minecraft:seagrass", "minecraft:sea_pickle")) return "ocean";
    if (has("minecraft:stone", "minecraft:gravel",
        "minecraft:calcite", "minecraft:tuff") &&
        !has("minecraft:grass_block", "minecraft:dirt")) return "hills";
    if (player.location.y >= 100) return "hills";
    return "plains";
}

// ── Native biome detection (primary) ─────────────────────────────────────────

export function getBiomeKey(player) {
    const dimId = player.dimension.id;
    if (dimId === "minecraft:nether") return "nether";
    if (dimId === "minecraft:the_end") return "end";

    try {
        const biome = player.dimension.getBiome(player.location);
        const id = biome.id ?? "";

        if (["minecraft:frozen_river", "minecraft:frozen_ocean",
            "minecraft:deep_frozen_ocean", "minecraft:ice_spikes"].includes(id)) return "frozen";

        if (["minecraft:snowy_plains", "minecraft:snowy_taiga", "minecraft:snowy_beach",
            "minecraft:snowy_slopes", "minecraft:grove"].includes(id)) return "snowy";

        if (["minecraft:nether_wastes", "minecraft:soul_sand_valley", "minecraft:crimson_forest",
            "minecraft:warped_forest", "minecraft:basalt_deltas"].includes(id)) return "nether";

        if (["minecraft:the_end", "minecraft:small_end_islands", "minecraft:end_midlands",
            "minecraft:end_highlands", "minecraft:end_barrens"].includes(id)) return "end";

        if (id === "minecraft:desert") return "desert";

        if (["minecraft:badlands", "minecraft:wooded_badlands",
            "minecraft:eroded_badlands"].includes(id)) return "badlands";

        if (["minecraft:savanna", "minecraft:savanna_plateau",
            "minecraft:windswept_savanna"].includes(id)) return "savanna";

        if (["minecraft:jungle", "minecraft:sparse_jungle",
            "minecraft:bamboo_jungle"].includes(id)) return "jungle";

        if (["minecraft:beach", "minecraft:stony_shore"].includes(id)) return "beach";

        if (["minecraft:warm_ocean", "minecraft:lukewarm_ocean",
            "minecraft:deep_lukewarm_ocean"].includes(id)) return "warmocean";

        if (["minecraft:ocean", "minecraft:deep_ocean", "minecraft:cold_ocean",
            "minecraft:deep_cold_ocean"].includes(id)) return "ocean";

        if (["minecraft:swamp", "minecraft:mangrove_swamp"].includes(id)) return "swamp";

        if (id === "minecraft:dark_forest") return "darkforest";
        if (["minecraft:birch_forest", "minecraft:old_growth_birch_forest"].includes(id)) return "birch";
        if (id === "minecraft:cherry_grove") return "cherry";
        if (id === "minecraft:pale_garden") return "pale";
        if (["minecraft:forest", "minecraft:flower_forest",
            "minecraft:windswept_forest"].includes(id)) return "forest";

        if (["minecraft:taiga", "minecraft:old_growth_pine_taiga",
            "minecraft:old_growth_spruce_taiga"].includes(id)) return "taiga";

        if (id === "minecraft:mushroom_fields") return "mushroom";
        if (id === "minecraft:deep_dark") return "deepdark";
        if (id === "minecraft:dripstone_caves") return "dripstone";
        if (id === "minecraft:lush_caves") return "lush";

        if (["minecraft:windswept_hills", "minecraft:windswept_gravelly_hills",
            "minecraft:stony_peaks", "minecraft:jagged_peaks",
            "minecraft:frozen_peaks"].includes(id)) return "hills";

        if (["minecraft:plains", "minecraft:sunflower_plains", "minecraft:meadow",
            "minecraft:river", "minecraft:frozen_river"].includes(id)) return "plains";

        // Unknown biome ID — fall back to block voting
        return getBiomeKeyFromBlocks(player);

    } catch {
        // getBiome() not available — fall back to block voting
        return getBiomeKeyFromBlocks(player);
    }
}