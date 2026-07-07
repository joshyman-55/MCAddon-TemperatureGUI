// ── biomeData.js ──────────────────────────────────────────────────────────────
// All biome temperature ranges (°C).
// Imported by: biomeDetection.js, tempCalculator.js
// ─────────────────────────────────────────────────────────────────────────────

export const BIOME_DATA = {
    frozen: { default: -18, min: -30, max: -10 },
    snowy: { default: -10, min: -20, max: -2 },
    desert: { default: 42, min: 38, max: 56 },
    badlands: { default: 35, min: 26, max: 44 },
    beach: { default: 22, min: 16, max: 30 },
    jungle: { default: 28, min: 20, max: 36 },
    savanna: { default: 33, min: 24, max: 40 },
    swamp: { default: 20, min: 12, max: 28 },
    mushroom: { default: 16, min: 8, max: 22 },
    taiga: { default: 5, min: -8, max: 12 },
    birch: { default: 16, min: 6, max: 22 },
    darkforest: { default: 14, min: 4, max: 20 },
    cherry: { default: 20, min: 10, max: 26 },
    pale: { default: 10, min: 0, max: 16 },
    deepdark: { default: 13, min: 6, max: 18 },
    dripstone: { default: 14, min: 5, max: 20 },
    lush: { default: 18, min: 10, max: 24 },
    warmocean: { default: 26, min: 16, max: 32 },
    ocean: { default: 10, min: 2, max: 16 },
    nether: { default: 75, min: 55, max: 100 },
    end: { default: -120, min: -150, max: -90 },
    forest: { default: 13, min: 4, max: 20 },
    hills: { default: 8, min: -2, max: 16 },
    plains: { default: 12, min: 5, max: 22 },
};