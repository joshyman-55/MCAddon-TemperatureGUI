// ── playerState.js ────────────────────────────────────────────────────────────
// Central store for all per-player runtime state (Maps).
// Every other module that needs player state imports from here.
// Imported by: main.js, effectsHandler.js
// ─────────────────────────────────────────────────────────────────────────────

// Current temperature (°C)
export const playerTemp = new Map();
// Accumulated UV index (0–10)
export const playerUV = new Map();
// Ticks spent in dangerous cold (counts toward frostbite)
export const playerColdTime = new Map();
// Ticks spent in dangerous heat (counts toward heatstroke)
export const playerHeatTime = new Map();
// Hydration charges (0–3); consumed while overheating
export const playerHydration = new Map();
// Last detected biome key (used to compute lerp speed on biome transitions)
export const playerLastBiome = new Map();
// Display preference — false = °C, true = °F
export const playerUseFahrenheit = new Map();
// Respawn grace period (ticks) — suppresses lerp after death so temp stays near SPAWN_TEMP
export const playerRespawnGrace = new Map();
// Temperature saved just before death — restored after grace period ends (except fire/lava deaths)
export const playerPreDeathTemp = new Map();
// Fire Effects
export const playerFireSpike = new Map();

// ── Thresholds ────────────────────────────────────────────────────────────────
export const FROSTBITE_THRESHOLD = 1000;
export const HEATSTROKE_THRESHOLD = 2000;
export const RESPAWN_GRACE_TICKS = 10; // 10 heavy-calc ticks = 10 seconds

// ── Comfortable spawn temperature ─────────────────────────────────────────────
export const SPAWN_TEMP = 18;

// ── Persistence keys ──────────────────────────────────────────────────────────
const PERSIST_KEY = "tempgui:persisted";

// ──  Save the 3 persistent fields to a dynamic property ───────────────────────
export function savePersistedState(player) {
    try {
        const data = {
            temp: playerTemp.get(player.id) ?? SPAWN_TEMP,
            useFahrenheit: playerUseFahrenheit.get(player.id) ?? false,
            lastBiome: playerLastBiome.get(player.id) ?? "plains"
        };
        player.setDynamicProperty(PERSIST_KEY, JSON.stringify(data));
    } catch { }
}

// ── Load the 3 persistent fields from a dynamic property, if present ──────────

export function loadPersistedState(player) { 
    try {
        const raw = player.getDynamicProperty(PERSIST_KEY);
        if (typeof raw !== "string") return;
        const data = JSON.parse(raw);
        if (typeof data.temp === "number") playerTemp.set(player.id, data.temp);
        if (typeof data.useFahrenheit === "boolean") playerUseFahrenheit.set(player.id, data.useFahrenheit);
        if (typeof data.lastBiome === "string") playerLastBiome.set(player.id, data.lastBiome);
        return true;
    } catch { 
        return false;
    }
}

// ── Initialize state for a player if missing ──────────────────────────────────

export function ensurePlayerState(player) {
    if (!playerTemp.has(player.id)) playerTemp.set(player.id, SPAWN_TEMP);
    if (!playerUV.has(player.id)) playerUV.set(player.id, 0);
    if (!playerColdTime.has(player.id)) playerColdTime.set(player.id, 0);
    if (!playerHeatTime.has(player.id)) playerHeatTime.set(player.id, 0);
    if (!playerHydration.has(player.id)) playerHydration.set(player.id, 0);
    if (!playerLastBiome.has(player.id)) playerLastBiome.set(player.id, "plains");
    if (!playerRespawnGrace.has(player.id)) playerRespawnGrace.set(player.id, 0);
    if (!playerPreDeathTemp.has(player.id)) playerPreDeathTemp.set(player.id, null);
    if (!playerFireSpike.has(player.id)) playerFireSpike.set(player.id, null);
    if (!playerUseFahrenheit.has(player.id)) {
        // Restore saved preference — persists through death and rejoining
        playerUseFahrenheit.set(player.id, false);
    }
}

// ── Clean up state when a player leaves ──────────────────────────────────────

export function clearPlayerState(playerId) {
    playerTemp.delete(playerId);
    playerUV.delete(playerId);
    playerColdTime.delete(playerId);
    playerHeatTime.delete(playerId);
    playerHydration.delete(playerId);
    playerLastBiome.delete(playerId);
    playerUseFahrenheit.delete(playerId);
    playerRespawnGrace.delete(playerId);
    playerPreDeathTemp.delete(playerId);
    playerFireSpike.delete(playerId);
}