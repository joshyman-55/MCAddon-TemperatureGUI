// ── playerState.js ────────────────────────────────────────────────────────────
// Central store for all per-player runtime state (Maps).
// Every other module that needs player state imports from here.
// Imported by: main.js, effectsHandler.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Actual Temperature (°C) ────────────────────────────────────────────────
// Raw environmental temp — biome + altitude + weather + hazards.
// One of three values in the 26.5 temp model: Actual → Body → Feels Like.
export const playerTemp = new Map();
// ── Body Temperature (°C) ──────────────────────────────────────────────────
// Persistent value that lags behind Actual Temp (later: Feels Like) via a
// slow lerp instead of snapping instantly. This is what frostbite/heatstroke
// should check once effectsHandler.js is switched over (checklist step 8).
export const playerBodyTemp = new Map();
// Accumulated UV index (0–10)
export const playerUV = new Map();
// Ambient humidity (0–100%), lerps toward a biome/weather-derived target
export const playerHumidity = new Map();
// Ticks spent in dangerous cold (counts toward frostbite)
export const playerColdTime = new Map();
// Ticks spent in dangerous heat (counts toward heatstroke)
export const playerHeatTime = new Map();
// Hydration charges (0–3); consumed while overheating
export const playerHydration = new Map();
// Thirst level (0–20, mirrors hunger bar scale — 2 points per droplet icon)
export const playerThirst = new Map();
// Exhaustion accumulator for thirst (mirrors hunger's exhaustion mechanic)
export const playerThirstExhaustion = new Map();
// Last detected biome key (used to compute lerp speed on biome transitions)
export const playerLastBiome = new Map();
// Display preference — false = °C, true = °F
export const playerUseFahrenheit = new Map();
// Display preference — "12" | "24" | "military"
export const playerTimeFormat = new Map();
// Respawn grace period (ticks) — suppresses lerp after death so temp stays near SPAWN_TEMP
export const playerRespawnGrace = new Map();
// Temperature saved just before death — restored after grace period ends (except fire/lava deaths)
export const playerPreDeathTemp = new Map();
// Fire Effects
export const playerFireSpike = new Map();
// Snowball cold spike — mirrors playerFireSpike, decays over a few ticks
export const playerSnowSpike = new Map();
// Ticks spent buried/in powder snow — escalates Feels Like the longer it lasts
export const playerBurialTime = new Map();
// Cooldown (heavy-calc ticks) before the next frost/heat screen overlay pulse
export const playerOverlayCooldown = new Map();
// Accumulated activity heat (0–1) from sprinting/exertion — nudges Body Temp up
export const playerActivityHeat = new Map();

// ── Thresholds ────────────────────────────────────────────────────────────────
export const FROSTBITE_THRESHOLD = 1000;
export const HEATSTROKE_THRESHOLD = 2000;
export const RESPAWN_GRACE_TICKS = 10; // 10 heavy-calc ticks = 10 seconds
export const BODY_TEMP_LERP_RATE = 0.02; // slower than ambient lerp — body catches up gradually
export const HUMIDITY_LERP_RATE = 0.03; // similar pace to Body Temp — humidity drifts, doesn't snap
export const THIRST_MAX = 20; // 20 points = 10 droplet icons
export const THIRST_EXHAUSTION_THRESHOLD = 4.0; // matches vanilla hunger's threshold
export const EXHAUSTION_SPRINT = 0.03;    // per tick while sprinting (~vanilla hunger pacing; was 0.1)
export const EXHAUSTION_JUMP = 0.2;
export const EXHAUSTION_SPRINT_JUMP = 0.8;
export const EXHAUSTION_MINE_BLOCK = 0.005;
export const EXHAUSTION_PER_DAMAGE = 0.1; // multiplied by damage amount
export const EXHAUSTION_DRY_AIR = 0.6;

// ── Comfortable spawn temperature ─────────────────────────────────────────────
export const SPAWN_TEMP = 18;

// ── Persistence keys ──────────────────────────────────────────────────────────
const PERSIST_KEY = "tempgui:persisted";

// ──  Save the persistent fields to a dynamic property ───────────────────────
export function savePersistedState(player) {
    try {
        const data = {
            temp: playerTemp.get(player.id) ?? SPAWN_TEMP,
            bodyTemp: playerBodyTemp.get(player.id) ?? 37,
            humidity: playerHumidity.get(player.id) ?? 50,
            useFahrenheit: playerUseFahrenheit.get(player.id) ?? false,
            timeFormat: playerTimeFormat.get(player.id) ?? "12",
            lastBiome: playerLastBiome.get(player.id) ?? "plains",
            thirst: playerThirst.get(player.id) ?? THIRST_MAX
        };
        player.setDynamicProperty(PERSIST_KEY, JSON.stringify(data));
    } catch { }
}

// ── Load the persistent fields from a dynamic property, if present ──────────

export function loadPersistedState(player) { 
    try {
        const raw = player.getDynamicProperty(PERSIST_KEY);
        if (typeof raw !== "string") return false;
        const data = JSON.parse(raw);
        if (typeof data.temp === "number") playerTemp.set(player.id, data.temp);
        if (typeof data.bodyTemp === "number") playerBodyTemp.set(player.id, Math.max(32, Math.min(43, data.bodyTemp)));
        if (typeof data.humidity === "number") playerHumidity.set(player.id, Math.max(0, Math.min(100, data.humidity)));
        if (typeof data.useFahrenheit === "boolean") playerUseFahrenheit.set(player.id, data.useFahrenheit);
        if (typeof data.timeFormat === "string") playerTimeFormat.set(player.id, data.timeFormat);
        if (typeof data.lastBiome === "string") playerLastBiome.set(player.id, data.lastBiome);
        if (typeof data.thirst === "number") playerThirst.set(player.id, data.thirst);
        return true;
    } catch { 
        return false;
    }
}

// ── Initialize state for a player if missing ──────────────────────────────────

export function ensurePlayerState(player) {
    if (!playerTemp.has(player.id)) playerTemp.set(player.id, SPAWN_TEMP);
    if (!playerBodyTemp.has(player.id)) playerBodyTemp.set(player.id, 37);
    if (!playerHumidity.has(player.id)) playerHumidity.set(player.id, 50);
    if (!playerUV.has(player.id)) playerUV.set(player.id, 0);
    if (!playerThirst.has(player.id)) playerThirst.set(player.id, THIRST_MAX);
    if (!playerThirstExhaustion.has(player.id)) playerThirstExhaustion.set(player.id, 0);
    if (!playerColdTime.has(player.id)) playerColdTime.set(player.id, 0);
    if (!playerHeatTime.has(player.id)) playerHeatTime.set(player.id, 0);
    if (!playerHydration.has(player.id)) playerHydration.set(player.id, 0);
    if (!playerLastBiome.has(player.id)) playerLastBiome.set(player.id, "plains");
    if (!playerRespawnGrace.has(player.id)) playerRespawnGrace.set(player.id, 0);
    if (!playerPreDeathTemp.has(player.id)) playerPreDeathTemp.set(player.id, null);
    if (!playerFireSpike.has(player.id)) playerFireSpike.set(player.id, null);
    if (!playerSnowSpike.has(player.id)) playerSnowSpike.set(player.id, null);
    if (!playerBurialTime.has(player.id)) playerBurialTime.set(player.id, 0);
    if (!playerOverlayCooldown.has(player.id)) playerOverlayCooldown.set(player.id, 0);
    if (!playerActivityHeat.has(player.id)) playerActivityHeat.set(player.id, 0);
    if (!playerUseFahrenheit.has(player.id)) {
        // Default °C — the saved preference (if any) is applied by loadPersistedState / tags
        playerUseFahrenheit.set(player.id, false);
    }
    if (!playerTimeFormat.has(player.id)) {
        playerTimeFormat.set(player.id, "12");
    }
}

// ── Clean up state when a player leaves ──────────────────────────────────────

export function clearPlayerState(playerId) {
    playerTemp.delete(playerId);
    playerBodyTemp.delete(playerId);
    playerHumidity.delete(playerId);
    playerUV.delete(playerId);
    playerThirst.delete(playerId);
    playerThirstExhaustion.delete(playerId);
    playerColdTime.delete(playerId);
    playerHeatTime.delete(playerId);
    playerHydration.delete(playerId);
    playerLastBiome.delete(playerId);
    playerUseFahrenheit.delete(playerId);
    playerTimeFormat.delete(playerId);
    playerRespawnGrace.delete(playerId);
    playerPreDeathTemp.delete(playerId);
    playerFireSpike.delete(playerId);
    playerSnowSpike.delete(playerId);
    playerBurialTime.delete(playerId);
    playerOverlayCooldown.delete(playerId);
    playerActivityHeat.delete(playerId);
}