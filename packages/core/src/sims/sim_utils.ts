import {ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {Ability, Buff, CombinedBuffEffect, ComputedDamage, DamageResult, DamagingAbility} from "./sim_types";
import {applyDhCritFull, baseDamageFull} from "@xivgear/xivmath/xivmath";
import {multiplyFixed} from "@xivgear/xivmath/deviation";
import {StatModification} from "@xivgear/xivmath/xivstats";

function dotPotencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const modifiedStats = stats.withModifications((stats, bonuses) => {
        bonuses.critChance += combinedBuffEffects.critChanceIncrease;
        bonuses.dhitChance += combinedBuffEffects.dhitChanceIncrease;
    });
    // TODO: are there any dots with auto-crit or auto-dh?
    const forceDhit = false;
    const forceCrit = false;
    const nonCritDmg = baseDamageFull(modifiedStats, potency, dmgAbility.attackType, forceDhit, true);
    const afterCritDh = applyDhCritFull(nonCritDmg, modifiedStats, forceCrit, forceDhit);
    return multiplyFixed(afterCritDh, combinedBuffEffects.dmgMod);
}

function potencyToDamage(stats: ComputedSetStats, potency: number, dmgAbility: DamagingAbility, combinedBuffEffects: CombinedBuffEffect): ComputedDamage {
    const forceDhit = dmgAbility.autoDh || combinedBuffEffects.forceDhit;
    const forceCrit = dmgAbility.autoCrit || combinedBuffEffects.forceCrit;
    const modifiedStats = stats.withModifications((stats, bonuses) => {
        bonuses.critChance += combinedBuffEffects.critChanceIncrease;
        bonuses.dhitChance += combinedBuffEffects.dhitChanceIncrease;
        if (forceCrit) {
            // These are capped at 100% anyway, so we can force crit/dh by just adding a massive value
            bonuses.forceCrit = true;
        }
        if (forceDhit) {
            bonuses.forceDh = true;
        }
    });
    const nonCritDmg = baseDamageFull(modifiedStats, potency, dmgAbility.attackType, forceDhit);
    const afterCritDh = applyDhCritFull(nonCritDmg, modifiedStats, forceCrit, forceDhit);
    return multiplyFixed(afterCritDh, combinedBuffEffects.dmgMod);
}

/**
 * Given stats, an ability, and combined buff effects, calculate the damage dealt.
 *
 * @param stats The stats
 * @param ability The ability
 * @param combinedBuffEffects The combined buff effects
 * @return if the ability is not damaging, returns a DamageResult with 'null' for both direct damage and DoT. If the
 * ability is damaging, returns a value representing the damage and variance. In addition, if the ability also has
 * DoT damage, returns predicted DoT damage information.
 */
export function abilityToDamageNew(stats: ComputedSetStats, ability: Ability, combinedBuffEffects: CombinedBuffEffect): DamageResult {
    if (!('potency' in ability)) {
        return {
            directDamage: null,
            dot: null,
            channel: null,
        };
    }
    // noinspection AssignmentToFunctionParameterJS
    stats = combinedBuffEffects.modifyStats(stats);
    // TODO: can we avoid having all of these separate stat modifications?
    return {
        directDamage: ability.potency ? potencyToDamage(stats, ability.potency, ability as DamagingAbility, combinedBuffEffects) : null,
        dot: 'dot' in ability ? {
            fullDurationTicks: ability.dot.duration === 'indefinite' ? 'indefinite' : (ability.dot.duration / 3),
            damagePerTick: dotPotencyToDamage(stats, ability.dot.tickPotency, ability, combinedBuffEffects),
        } : null,
        channel: 'channel' in ability ? {
            // channeled actions tick once on use, and once per second afterwards for the full duration
            fullDurationTicks: ability.channel.duration + 1,
            // channeled actions use the same damage formula as DoTs currently
            damagePerTick: dotPotencyToDamage(stats, ability.channel.tickPotency, ability, combinedBuffEffects),
        } : null,
    };
}

/**
 * Returns the "zero" CombinedBuffEffect object, which represents not having any offensive buffs.
 */
export function noBuffEffects(): CombinedBuffEffect {
    return {
        dmgMod: 1,
        critChanceIncrease: 0,
        dhitChanceIncrease: 0,
        forceCrit: false,
        forceDhit: false,
        haste: 0,
        modifyStats: stats => stats,
    };
}

/**
 * Given buffs, return a CombinedBuffEffect object that represents the total change of the combined buffs.
 *
 * @param buffs
 */
export function combineBuffEffects(buffs: Buff[]): CombinedBuffEffect {
    const combinedEffects: CombinedBuffEffect = noBuffEffects();
    const statModifications: StatModification[] = [];
    for (const buff of buffs) {
        const effects = buff.effects;
        if (effects.dmgIncrease) {
            combinedEffects.dmgMod *= (1 + effects.dmgIncrease);
        }
        if (effects.critChanceIncrease) {
            combinedEffects.critChanceIncrease += effects.critChanceIncrease;
        }
        if (effects.dhitChanceIncrease) {
            combinedEffects.dhitChanceIncrease += effects.dhitChanceIncrease;
        }
        if (effects.haste) {
            combinedEffects.haste += effects.haste;
        }
        if (effects.forceCrit) {
            combinedEffects.forceCrit = true;
        }
        if (effects.forceDhit) {
            combinedEffects.forceDhit = true;
        }
        if (effects.modifyStats) {
            statModifications.push(effects.modifyStats);
        }
    }
    combinedEffects.modifyStats = (stats) => {
        return stats.withModifications((stats, bonuses) => {
            statModifications.forEach(mod => {
                mod(stats, bonuses);
            });
        });
    };
    return combinedEffects;
}

