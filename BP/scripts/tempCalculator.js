// ── tempCalculator.js ─────────────────────────────────────────────────────────
// Core temperature calculation. Takes current player state and returns the
// new target temperature and lerp rate after applying all modifiers:
// biome, altitude, sun/UV, hazards, indoors, water, campfire, snow contact.
// Imported by: main.js
// ─────────────────────────────────────────────────────────────────────────────

import { world } from "@minecraft/server";
import { BIOME_DATA } from "./biomeData.js";
import { getBiomeKey } from "./biomeDetection.js";
import { getDistanceToGround } from "./blockUtils.js";
import {
    isInLava, isNearLava, isOnFire, isOnMagma,
    isIndoors, getSnowContact, getCampfireProximity,
    getWaterTemp, getNearbyIceCount
} from "./hazardDetection.js";
import { playerRespawnGrace, playerPreDeathTemp, playerFireSpike } from "./playerState.js";

// ── Unit helpers ──────────────────────────────────────────────────────────────

export function toFahrenheit(c) {
    return (c * 9 / 5) + 32;
}

export function roundToTenth(value) {
    return Math.round(value * 10) / 10;
}

// Full 24-hour sine curve.
// Returns +1 at midday (MC time 6000), -1 at midnight (MC time 18000).
// Gradual rise from sunrise, gradual fall through sunset into night.
export function getDailyTempCurve(time) {
    return Math.sin(((time - 6000) / 24000) * Math.PI * 2 * -1);
}

// ── Main calculation — produces ACTUAL TEMP ────────────────────────────────
// Call once per heavy-calc tick (every 20 ticks).
// This function computes Actual Temp only (env/ambient) — the first of the
// three-temp model. Body Temp (lags this) and Feels Like (derived display
// value) are computed downstream, not here.
// Returns everything the GUI needs: new temp, UV, biome key, and all flags.

export function calculateTemperature(player, current, uv, lastBiomeKey, time, worldWeather = "clear") {
    const biomeKey = getBiomeKey(player, lastBiomeKey);
    const biome = BIOME_DATA[biomeKey] ?? BIOME_DATA.plains;
    const isSpecialDim = biomeKey === "nether" || biomeKey === "end";

    // ── Base temperature from biome + daily curve ─────────────────────────────
    let target = biome.default;

    if (!isSpecialDim) {
        const tempCurve = getDailyTempCurve(time); // -1 to +1

        // ── Day intensity — varies each day, rarely hits true extremes ─────────
        const dayNumber = Math.floor(world.getAbsoluteTime() / 24000);
        const dayRng = ((dayNumber * 2654435761) >>> 0) / 4294967295;
        const dayIntensity = 0.3 + (dayRng * 0.7); // 0.30 to 1.0

        if (tempCurve >= 0) {
            target = biome.default + (tempCurve * (biome.max - biome.default) * dayIntensity);
        } else {
            target = biome.default + (tempCurve * (biome.default - biome.min) * dayIntensity);
        }
    }

    // ── UV accumulation ───────────────────────────────────────────────────────
    if (isSpecialDim) {
        uv = Math.max(0, uv - 0.1);
    } else {
        const sunStrength = Math.max(0, getDailyTempCurve(time));
        if (sunStrength === 0) {
            uv = Math.max(0, uv - 0.05);
        } else {
            uv = Math.min(10, uv + sunStrength * 0.03);
        }
        const isColdBiome = biome.default <= 0;
        const isBeach = biomeKey === "beach";
        target += isColdBiome ? uv * 0.2 : isBeach ? uv * 0.4 : uv * 0.5;
    }

    // ── Clamp to biome min/max ────────────────────────────────────────────────
    if (!isSpecialDim) {
        target = Math.max(biome.min - 10, Math.min(biome.max + 5, target));
    }

    // ── Altitude cooling — applied AFTER clamp so biome floor can't block it ──
    const playerY = player.location.y;
    if (!isSpecialDim) {
        const altitudeDrop = Math.max(0, (playerY - 300) * 0.234);
        target = Math.max(-89, target - altitudeDrop);
    }

    // ── Hazard overrides ──────────────────────────────────────────────────────
    const inLava = isInLava(player);
    const nearLava = isNearLava(player);
    const onFire = isOnFire(player);
    const onMagma = isOnMagma(player);
    const inWater = player.isInWater;
    const spike = playerFireSpike.get(player.id);

    if (inLava) target = Math.max(biome.default, 100);
    else if (nearLava) target = Math.max(target, 60);
    else if (onMagma) target = Math.max(target, 75);

    // ── Weather modifier — passed in from main.js, tracked via the
    // weatherChange event since getWeather() isn't callable on this version.
    let weather = null;
    if (!isSpecialDim && !inLava && !nearLava && !onFire) {
        weather = worldWeather === "clear" ? null : worldWeather;
        if (weather === "thunder") target -= 10;
        else if (weather === "rain") {
            target -= biome.default <= 0 ? 14 : 6;
        }
    }

    // ── Indoors moderates temperature toward biome-aware comfort ──────────────
    const indoors = isIndoors(player);
    if (indoors && !inLava && !nearLava && !onFire && !onMagma && !inWater) {
        const comfortTemp = 22;
        const indoorTarget = biome.default > comfortTemp
            ? Math.max(comfortTemp, biome.default * 0.75)
            : Math.min(comfortTemp, biome.default * 0.5 + comfortTemp * 0.5);
        const diff = indoorTarget - target;
        target += diff * Math.min(0.6, Math.abs(diff) / 60 + 0.2);
        uv = Math.max(0, uv - 0.1);
    }

    // ── Water overrides air temperature ───────────────────────────────────────
    if (inWater) target = getWaterTemp(player);

    // ── Campfire warmth ───────────────────────────────────────────────────────
    const campfire = !inWater ? getCampfireProximity(player) : null;
    if (campfire === "on") target += 35;
    else if (campfire === "close") target += 18;
    else if (campfire === "near") target += 8;

    // ── Global safety clamp ───────────────────────────────────────────────────
    target = Math.max(-273, Math.min(200, target));

    // ── Fire spike — applied AFTER clamp so it always wins ────────────────────
    if (spike && spike.ticks <= 0) {
        playerFireSpike.set(player.id, null);
    } else if (spike && spike.ticks > 0) {
        playerFireSpike.set(player.id, { cap: spike.cap, ticks: spike.ticks - 1 });
    }

    // ── Snow / ice contact — applied LAST so they always win ──────────────────
    const { inPowderSnow, buriedInSnow, onSnowLayer, onIce, onPackedIce, onBlueIce } = getSnowContact(player, isSpecialDim);

    // ── Solid snow/ice terrain — genuinely surrounding blocks, not brief
    // contact, so (unlike thin snow layer or a passing snowball) this IS
    // environmental, same as campfire blocks pushing ambient heat. Personal
    // contactCold/Body Temp effects in main.js still apply on top of this.
    if (onBlueIce) target = Math.min(target, -18);
    else if (onPackedIce) target = Math.min(target, -12);
    else if (onIce) target = Math.min(target, -6);
    else if (buriedInSnow) target = Math.min(target, -10);

    let lerpRate = 0.025;

    if (inLava) {
        lerpRate = 0.85;
    } else if (onMagma) {
        lerpRate = 0.15;
    } else if (onBlueIce || onPackedIce || onIce || inPowderSnow || buriedInSnow || onSnowLayer) {
        // Snow/ice contact REMOVED from Actual Temp — touching/being buried
        // in snow is personal contact, not ambient. It reaches Feels Like via
        // contactCold and Body Temp via a direct knock, both in main.js.
        // Lerp rate still reflects how quickly ambient responds while in contact.
        if (onBlueIce) lerpRate = 0.25;
        else if (onPackedIce) lerpRate = 0.22;
        else if (onIce) lerpRate = 0.20;
        else if (inPowderSnow) lerpRate = 0.35;
        else if (buriedInSnow) lerpRate = 0.25;
        else if (onSnowLayer) lerpRate = 0.20;
    } else {
        const lastBiomeData = BIOME_DATA[lastBiomeKey] ?? BIOME_DATA.plains;
        const biomeDelta = Math.abs(biome.default - lastBiomeData.default);
        if (biomeDelta >= 20) lerpRate = 0.08;
        if (onFire) lerpRate = 0.20;
        else if (campfire === "on") lerpRate = 0.15;
        if (inWater && getNearbyIceCount(player) >= 4) lerpRate = 0.15;

        // Airborne — faster since no ground insulation
        const isAirborne = !inWater && !inLava && !nearLava &&
            !onFire && !onMagma && !indoors;
        if (isAirborne) {
            const dist = getDistanceToGround(player);
            if (dist >= 10) lerpRate = 0.10;
            else if (dist >= 4) lerpRate = 0.06;
        }

        // Spike overrides airborne
        if (spike && spike.ticks > 0) lerpRate = 0.25;
    }

    // ── Respawn grace — suppresses lerp so temp stays near spawn temp ─────────
    const grace = playerRespawnGrace.get(player.id) ?? 0;
    if (grace > 0) {
        playerRespawnGrace.set(player.id, grace - 1);
        lerpRate = 0.002;

        if (grace === 1) {
            const preDeath = playerPreDeathTemp.get(player.id);
            playerPreDeathTemp.set(player.id, null);

            if (preDeath !== null && preDeath !== undefined && preDeath.temp !== null) {

                const BIOME_FAMILIES = {
                    hot: ["desert", "badlands", "savanna", "jungle", "nether"],
                    warm: ["beach", "warmocean", "swamp", "cherry", "birch", "forest", "darkforest", "mushroom", "lush"],
                    neutral: ["plains", "ocean", "dripstone", "deepdark"],
                    cold: ["taiga", "hills", "pale"],
                    frozen: ["snowy", "frozen", "end"],
                };

                const getFamily = (key) => {
                    for (const [family, biomes] of Object.entries(BIOME_FAMILIES)) {
                        if (biomes.includes(key)) return family;
                    }
                    return "neutral";
                };

                const deathFamily = getFamily(preDeath.biome);
                const respawnFamily = getFamily(biomeKey);
                const sameFamily = deathFamily === respawnFamily;

                if (sameFamily) {
                    return {
                        newTemp: preDeath.temp,
                        newUV: uv,
                        biomeKey, biome,
                        inLava, nearLava, onFire, onMagma, inWater, campfire,
                        inPowderSnow, buriedInSnow, onSnowLayer,
                        onIce, onPackedIce, onBlueIce,
                        weather, indoors,
                    };
                } else {
                    const diff = preDeath.temp - current;
                    const nudge = Math.sign(diff) * Math.min(5, Math.abs(diff));
                    return {
                        newTemp: current + nudge,
                        newUV: uv,
                        biomeKey, biome,
                        inLava, nearLava, onFire, onMagma, inWater, campfire,
                        inPowderSnow, buriedInSnow, onSnowLayer,
                        onIce, onPackedIce, onBlueIce,
                        weather, indoors,
                    };
                }
            }
        }
    }

    const rawTemp = current + (target - current) * lerpRate;
    const newTemp = Math.max(-273, isSpecialDim ? rawTemp : Math.max(-89, rawTemp));
    // newTemp = Actual Temp (env/ambient). Body Temp will lerp toward this
    // (or toward Feels Like, once that's decided) in a separate step.

    return {
        newTemp,
        newUV: uv,
        biomeKey,
        biome,
        inLava, nearLava, onFire, onMagma, inWater, campfire,
        inPowderSnow, buriedInSnow, onSnowLayer,
        onIce, onPackedIce, onBlueIce,
        weather, indoors,
    };
}

// ── Body Temp target ─────────────────────────────────────────────────────────
// Converts raw Actual Temp (wide ambient scale, e.g. -89 to 200°C) into a
// physiologically meaningful target on the 32–43°C body temp scale. Deviation
// from a comfortable ambient baseline (20°C) scales down at 0.1 per degree —
// every 10°C of ambient swing shifts the body temp target by ~1°C.

export function getBodyTempTarget(actualTemp, comfortTemp = 20) {
    const deviation = actualTemp - comfortTemp;
    const DEAD_ZONE = 15;
    if (Math.abs(deviation) <= DEAD_ZONE) return 37;
    const excess = deviation > 0 ? deviation - DEAD_ZONE : deviation + DEAD_ZONE;
    const bodyShift = excess * 0.04;
    return Math.max(32, Math.min(43, 37 + bodyShift));
}

// ── Body Temperature lerp ────────────────────────────────────────────────────
// Call once per heavy-calc tick, after calculateTemperature(), passing its
// newTemp as `actualTemp`. Body Temp lags behind rather than snapping —
// this is what frostbite/heatstroke will check once step 8 switches over.

export function calculateBodyTemp(currentBodyTemp, bodyTempTarget, lerpRate) {
    const lerped = currentBodyTemp + (bodyTempTarget - currentBodyTemp) * lerpRate;
    return Math.max(32, Math.min(43, lerped)); // physiological range only
}

// ── Humidity target ──────────────────────────────────────────────────────────
// Computes the humidity a player's environment is currently "pulling toward."
// Called once per heavy-calc tick using result.weather/result.indoors from
// calculateTemperature(); the result feeds calculateHumidity() below, which
// lerps the stored value toward this target instead of snapping.

export function getHumidityTarget(biomeKey, inWater, weather, indoors) {
    if (inWater) return 100;

    const HUMID_BIOMES = ["jungle", "swamp", "mushroom", "lush", "warmocean", "ocean"];
    const DRY_BIOMES = ["desert", "badlands", "savanna", "nether"];

    const isDry = DRY_BIOMES.includes(biomeKey);

    let target = 50; // neutral baseline
    if (HUMID_BIOMES.includes(biomeKey)) target = 80;
    else if (isDry) target = 20;

    if (isDry) {
        if (weather === "rain") target = Math.max(target, 35);
        else if (weather === "thunder") target = Math.max(target, 40);
    } else {
        if (weather === "rain") target = Math.max(target, 85);
        else if (weather === "thunder") target = Math.max(target, 90);
    }

    if (indoors) target = 50 + (target - 50) * 0.4; // indoors moderates toward neutral

    return Math.max(0, Math.min(100, target));
}

// ── Humidity lerp ─────────────────────────────────────────────────────────────
// Same lag pattern as calculateBodyTemp() — drifts toward target, doesn't snap.
export function calculateHumidity(currentHumidity, target, lerpRate) {
    return currentHumidity + (target - currentHumidity) * lerpRate;
}

// ── Feels Like ────────────────────────────────────────────────────────────────
// Derived display-time value — NOT persistent state, no Map, recomputed
// fresh whenever needed. Takes Actual Temp plus humidity/wetness modifiers.
// humidity: 0–100 (%). wetness: 0–1 (0 = dry, 1 = fully soaked).
// Placeholder formula until step 5 wires in a real humidity calculation —
// humidity is currently passed in as a flat 50 from main.js.

export function calculateFeelsLike(actualTemp, humidity, wetness = 0, contactHeat = 0) {
    let feelsLike = actualTemp;
    const humidityOffset = (humidity - 50) / 50;
    if (actualTemp >= 25) {
        feelsLike += humidityOffset * 4;
    } else if (actualTemp <= 5) {
        feelsLike -= Math.max(0, -humidityOffset) * 2;
    }

    feelsLike -= wetness * 6;
    feelsLike += contactHeat;

    return Math.max(-273, Math.min(200, feelsLike));
}