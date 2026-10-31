// ── biomeDetection.js ─────────────────────────────────────────────────────────
// Detects which BIOME_DATA key applies to the player's current position.
// Primary method: Minecraft's native getBiome() API.
// Fallback: returns the last known biome key when the API is unavailable or the ID is unknown.
// Imported by: tempCalculator.js, main.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Native biome detection (primary) ─────────────────────────────────────────

export function getBiomeKey(player, lastBiomeKey = "plains") {
    const dimId = player.dimension.id;
    if (dimId === "minecraft:nether") return "nether";
    if (dimId === "minecraft:the_end") return "end";

    try {
        const biome = player.dimension.getBiome(player.location);
        const id = biome.id ?? "";

        // ── Frozen — includes legacy ice/spike variants + genuinely
        // snow-capped mountain peaks (was incorrectly bucketed as "hills") ─────
        if (["minecraft:frozen_river", "minecraft:frozen_ocean",
            "minecraft:deep_frozen_ocean", "minecraft:ice_spikes",
            "minecraft:ice_plains_spikes", "minecraft:jagged_peaks",
            "minecraft:frozen_peaks", "minecraft:ice_mountains"].includes(id)) return "frozen";

        // ── Snowy — includes legacy cold_taiga / ice_plains variants ───────────
        if (["minecraft:snowy_plains", "minecraft:snowy_taiga", "minecraft:snowy_beach",
            "minecraft:snowy_slopes", "minecraft:grove", "minecraft:ice_plains",
            "minecraft:cold_taiga", "minecraft:cold_taiga_hills",
            "minecraft:cold_taiga_mutated"].includes(id)) return "snowy";

        if (["minecraft:nether_wastes", "minecraft:soul_sand_valley", "minecraft:crimson_forest",
            "minecraft:warped_forest", "minecraft:basalt_deltas"].includes(id)) return "nether";

        if (["minecraft:the_end", "minecraft:small_end_islands", "minecraft:end_midlands",
            "minecraft:end_highlands", "minecraft:end_barrens"].includes(id)) return "end";

        if (id === "minecraft:desert" || id === "minecraft:desert_hills" ||
            id === "minecraft:desert_mutated") return "desert";

        // ── Badlands — includes legacy "mesa" naming ────────────────────────────
        if (["minecraft:badlands", "minecraft:wooded_badlands",
            "minecraft:eroded_badlands", "minecraft:mesa",
            "minecraft:mesa_plateau", "minecraft:mesa_plateau_stone",
            "minecraft:mesa_bryce", "minecraft:mesa_plateau_mutated",
            "minecraft:mesa_plateau_stone_mutated"].includes(id)) return "badlands";

        if (["minecraft:savanna", "minecraft:savanna_plateau",
            "minecraft:windswept_savanna", "minecraft:savanna_mutated"].includes(id)) return "savanna";

        if (["minecraft:jungle", "minecraft:sparse_jungle",
            "minecraft:bamboo_jungle", "minecraft:jungle_hills",
            "minecraft:jungle_mutated", "minecraft:jungle_edge",
            "minecraft:jungle_edge_mutated", "minecraft:bamboo_jungle_hills"].includes(id)) return "jungle";

        // ── Beach — includes legacy cold_beach / stone_beach naming ─────────────
        if (["minecraft:beach", "minecraft:stony_shore", "minecraft:cold_beach",
            "minecraft:stone_beach"].includes(id)) return "beach";

        if (["minecraft:warm_ocean", "minecraft:lukewarm_ocean",
            "minecraft:deep_lukewarm_ocean"].includes(id)) return "warmocean";

        if (["minecraft:ocean", "minecraft:deep_ocean", "minecraft:cold_ocean",
            "minecraft:deep_cold_ocean"].includes(id)) return "ocean";

        // ── Swamp — includes legacy "swampland" naming ──────────────────────────
        if (["minecraft:swamp", "minecraft:mangrove_swamp",
            "minecraft:swampland", "minecraft:swampland_mutated"].includes(id)) return "swamp";

        // ── Dark forest — includes legacy "roofed_forest" naming ────────────────
        if (["minecraft:dark_forest", "minecraft:roofed_forest",
            "minecraft:roofed_forest_mutated"].includes(id)) return "darkforest";

        if (["minecraft:birch_forest", "minecraft:old_growth_birch_forest",
            "minecraft:birch_forest_mutated", "minecraft:birch_forest_hills",
            "minecraft:birch_forest_hills_mutated"].includes(id)) return "birch";

        if (id === "minecraft:cherry_grove") return "cherry";
        if (id === "minecraft:pale_garden") return "pale";
        if (id === "minecraft:dappled_forest") return "dappled";

        // ── Forest — includes legacy extreme_hills_plus (windswept forest) ─────
        if (["minecraft:forest", "minecraft:flower_forest",
            "minecraft:windswept_forest", "minecraft:forest_hills",
            "minecraft:extreme_hills_plus", "minecraft:extreme_hills_plus_mutated"].includes(id)) return "forest";

        // ── Taiga — includes legacy redwood/mega taiga naming ───────────────────
        if (["minecraft:taiga", "minecraft:old_growth_pine_taiga",
            "minecraft:old_growth_spruce_taiga", "minecraft:taiga_hills",
            "minecraft:taiga_mutated", "minecraft:redwood_taiga",
            "minecraft:redwood_taiga_hills", "minecraft:redwood_taiga_mutated",
            "minecraft:mega_taiga", "minecraft:mega_taiga_hills",
            "minecraft:mega_spruce_taiga"].includes(id)) return "taiga";

        // ── Mushroom — includes legacy "mushroom_island" naming ─────────────────
        if (["minecraft:mushroom_fields", "minecraft:mushroom_island",
            "minecraft:mushroom_island_shore"].includes(id)) return "mushroom";

        if (id === "minecraft:deep_dark") return "deepdark";
        if (id === "minecraft:dripstone_caves") return "dripstone";
        if (id === "minecraft:lush_caves") return "lush";
        if (id === "minecraft:sulfur_caves") return "sulfur";

        // ── Hills — includes legacy extreme_hills naming. Rocky/temperate
        // highlands only — genuinely snow-capped peaks moved to "frozen" above ──
        if (["minecraft:windswept_hills", "minecraft:windswept_gravelly_hills",
            "minecraft:stony_peaks", "minecraft:extreme_hills",
            "minecraft:extreme_hills_mutated", "minecraft:extreme_hills_edge"].includes(id)) return "hills";

        if (["minecraft:plains", "minecraft:sunflower_plains", "minecraft:meadow",
            "minecraft:river"].includes(id)) return "plains"; // frozen_river is matched earlier as "frozen"

        // Unknown biome ID — keep the last known biome
        return lastBiomeKey;

    } catch {
        // getBiome() not available — keep the last known biome
        return lastBiomeKey;
    }
}