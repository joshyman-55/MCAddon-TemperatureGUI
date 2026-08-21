// ── biomeDetection.js ─────────────────────────────────────────────────────────
// Detects which BIOME_DATA key applies to the player's current position.
// Primary method: Minecraft's native getBiome() API.
// Fallback: block-vote scan when API is unavailable or returns an unknown ID.
// Imported by: tempCalculator.js, temperatureGUI.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Native biome detection (primary) ─────────────────────────────────────────

export function getBiomeKey(player, lastBiomeKey = "plains") {
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
        return lastBiomeKey;

    } catch {
        // getBiome() not available — fall back to block voting
        return lastBiomeKey;
    }
}