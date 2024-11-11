import {
    Ability,
    CombinedBuffEffect,
    PartyBuff,
    SimResult,
    SimSettings,
    SimSpec,
    Simulation
} from "@xivgear/core/sims/sim_types";
import { BuffSettingsExport, BuffSettingsManager } from "@xivgear/core/sims/common/party_comp_settings";
import { defaultResultSettings, ResultSettings } from "@xivgear/core/sims/cycle_sim";
import { addValues, applyStdDev, multiplyFixed, multiplyIndependent, ValueWithDev } from "@xivgear/xivmath/deviation";
import { JobName } from "@xivgear/xivmath/xivconstants";
import { CharacterGearSet } from "@xivgear/core/gear";
import { abilityEquals } from "@xivgear/core/sims/ability_helpers";
import { abilityToDamageNew, combineBuffEffects, noBuffEffects } from "@xivgear/core/sims/sim_utils";

export type ExternalCountSettings<InternalSettingsType extends SimSettings> = {
    customSettings: InternalSettingsType,
    buffConfig: BuffSettingsExport,
    resultSettings: ResultSettings,
}

export interface CountSimResult extends SimResult {
    unbuffedPps: number,
    totalDamage: ValueWithDev,
    mainDpsFull: ValueWithDev,
    cycleTime: number,
    buffBuckets: BuffWindowUsages[]
}

export type BuffWindowUsages = {
    maxDuration: number | null,
    minDuration: number | null,
    skills: SkillCount[],
    buffs: PartyBuff[],
    buffEffects: CombinedBuffEffect
}

export type SkillCount = [ability: Ability, count: number];

export abstract class BaseUsageCountSim<ResultType extends CountSimResult, InternalSettingsType extends SimSettings>
implements Simulation<ResultType, InternalSettingsType, ExternalCountSettings<InternalSettingsType>> {

    abstract displayName: string;
    abstract shortName: string;
    abstract spec: SimSpec<Simulation<ResultType, InternalSettingsType, ExternalCountSettings<InternalSettingsType>>, ExternalCountSettings<InternalSettingsType>>;
    readonly manuallyActivatedBuffs?: PartyBuff[];
    settings: InternalSettingsType;
    readonly buffManager: BuffSettingsManager;
    readonly resultSettings: ResultSettings;
    readonly manualRun = false;

    protected constructor(public readonly job: JobName, settings?: ExternalCountSettings<InternalSettingsType>) {
        this.settings = this.makeDefaultSettings();
        if (settings !== undefined) {
            Object.assign(this.settings, settings.customSettings ?? settings);
            this.buffManager = BuffSettingsManager.fromSaved(settings.buffConfig);
            this.resultSettings = settings.resultSettings ?? defaultResultSettings();
        }
        else {
            this.buffManager = BuffSettingsManager.defaultForJob(job);
            this.resultSettings = defaultResultSettings();
        }
    }

    abstract makeDefaultSettings(): InternalSettingsType;

    async simulate(set: CharacterGearSet): Promise<ResultType> {
        // Get enabled buffs
        const enabledBuffs = this.buffManager.enabledBuffs;
        // Map from duration to list of enabled party buffs with that duration
        // e.g. 15 -> [Chain, Litany], 20 -> [Embolden]
        const durationMap: Map<number, PartyBuff[]> = new Map();
        enabledBuffs.forEach(buff => {
            const duration = buff.duration;
            const newValue = durationMap.get(duration) ?? [];
            newValue.push(buff);
            durationMap.set(duration, newValue);
        });
        // Total skills used over one cycle
        const totals = [...this.skillsInBuffDuration(set, null)];
        // The end state of this map is to be a map from a duration to the skills that can be used in that duration
        // but **not** the next shorter duration.
        // e.g. if 3 of skill X fit in 15 seconds, and two additional fit in 20 seconds, then it would be
        // 15 -> [[x, 3]], 20 -> [[x, 2]]
        const skillsDurationMap: Map<number, SkillCount[]> = new Map();
        // Set of relevant buff durations
        const durationKeys: number[] = Array.from(durationMap.keys()).filter(dur => dur);
        // Skills used out of buffs. This is modified in place, so whatever the longest buff duration is, it will
        // subtract from this. e.g. if we have 10 total, and 3 fit in 30s buffs, then this leaves 7.
        const outOfBuffs = [...totals];
        // Keep track of next largest window (starting with the totals), so that we can "carve out" the usages that
        // would fit into a smaller window.
        let previous = outOfBuffs;
        // Start with longest duration
        durationKeys.sort((a, b) => b - a);
        for (const duration of durationKeys) {
            // skillsInBuffDuration returns the cumulative count of skills that fit within a particular buff window.
            // However, we want the delta between this buff window and the next tightest window.
            // The math works by starting with the previous bucket (thus larger), and subtracting the
            // next (thus smaller) bucket from it.
            const thisDurationCumulative = this.skillsInBuffDuration(set, duration);
            console.debug(`Duration before ${duration} - raw ${JSON.stringify(thisDurationCumulative)}`);
            for (const skillCount of thisDurationCumulative) {
                const matchingSkill = previous.find(val => abilityEquals(val[0], skillCount[0]));
                if (matchingSkill) {
                    console.debug(`Skill ${skillCount[0].name} (${duration}) = ${matchingSkill[1]} - ${skillCount[1]}`);
                    matchingSkill[1] -= skillCount[1];
                }
            }
            skillsDurationMap.set(duration, thisDurationCumulative);
            console.debug(`Duration after ${duration} - raw ${JSON.stringify(thisDurationCumulative)}`);
            previous = thisDurationCumulative;
        }
        // Organize into buckets
        const resultBuckets: BuffWindowUsages[] = [];
        // no buffs bucket
        resultBuckets.push({
            maxDuration: null,
            minDuration: durationKeys.length > 0 ? durationKeys[0] : null,
            skills: [...outOfBuffs],
            buffs: [],
            buffEffects: noBuffEffects(),
        });
        // One bucket per buff duration
        for (let i = 0; i < durationKeys.length; i++) {
            const duration = durationKeys[i];
            const minDuration = (i + 1) in durationKeys ? durationKeys[i + 1] : null;
            const buffs = durationMap.get(duration) ?? [];
            resultBuckets.push({
                maxDuration: duration,
                minDuration: minDuration,
                skills: skillsDurationMap.get(duration),
                buffs: buffs,
                buffEffects: combineBuffEffects(buffs),
            });
        }
        // Sum damage
        // TODO: autoattacks
        let totalPotency = 0;
        const bucketTotals = resultBuckets.map(bucket => {
            const buffEffects = bucket.buffEffects;
            return addValues(...bucket.skills.flatMap(sc => {
                const skill = sc[0];
                const count = sc[1];
                totalPotency += skill.potency * count;
                const dmg = abilityToDamageNew(set.computedStats, skill, buffEffects);
                const result = [];
                if (dmg.directDamage) {
                    const valueWithDev = multiplyIndependent(dmg.directDamage, count);
                    console.debug(`Skill ${skill.name}, count ${count}, duration ${bucket.maxDuration}, total ${valueWithDev.expected}`);
                    result.push(valueWithDev);
                }
                // TODO handle indefinite dots? only one I can think of is blu so maybe not worth
                if (dmg.dot && dmg.dot.fullDurationTicks !== 'indefinite') {
                    const valueWithDev = multiplyIndependent(dmg.dot.damagePerTick, dmg.dot.fullDurationTicks * count);
                    console.debug(`Skill ${skill.name}, count ${count}, duration ${bucket.maxDuration}, total ${valueWithDev.expected}`);
                    result.push(valueWithDev);
                }
                if (dmg.channel) {
                    const valueWithDev = multiplyIndependent(dmg.channel.damagePerTick, dmg.channel.fullDurationTicks * count);
                    console.debug(`Skill ${skill.name}, count ${count}, duration ${bucket.maxDuration}, total ${valueWithDev.expected}`);
                    result.push(valueWithDev);
                }
                return result;
            }));
        });
        const totalDamage: ValueWithDev = addValues(
            ...bucketTotals
        );
        const cycleTime = this.totalCycleTime(set);
        const dps = multiplyFixed(totalDamage, 1.0 / cycleTime);
        const pps = totalPotency / cycleTime;
        return {
            cycleTime: cycleTime,
            mainDpsFull: dps,
            mainDpsResult: applyStdDev(dps, this.resultSettings.stdDevs ?? 0),
            totalDamage: totalDamage,
            unbuffedPps: pps,
            buffBuckets: resultBuckets,
        } satisfies CountSimResult as unknown as ResultType;
    }

    /**
     * Returns the total cycle time to be used as a basis for the sim. Typically around 120s.
     *
     * @param set
     */
    abstract totalCycleTime(set: CharacterGearSet): number;

    /**
     * Returns the number of skills that fit in a buff duration, or total if the buff duration is null.
     *
     * This should be cumulative - e.g. the count for 'null' should be the total skills used. The count for '20' should
     * be the count of skills used in 20 second buffs, including 15 and 10 second buffs.
     *
     * @param set
     * @param buffDuration
     */
    abstract skillsInBuffDuration(set: CharacterGearSet, buffDuration: number | null): SkillCount[];

    exportSettings(): ExternalCountSettings<InternalSettingsType> {
        return {
            customSettings: this.settings,
            buffConfig: this.buffManager.exportSetting(),
            resultSettings: this.resultSettings,
        };
    }
}
