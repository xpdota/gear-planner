/* eslint-disable @typescript-eslint/no-explicit-any */
import {CharacterGearSet} from "../gear";
import {JobName, SupportedLevel} from "@xivgear/xivmath/xivconstants";
import {AttackType, ComputedSetStats} from "@xivgear/xivmath/geartypes";
import {ValueWithDev} from "@xivgear/xivmath/deviation";
import {StatModification} from "@xivgear/xivmath/xivstats";

/**
 * Represents the final result of a simulation run. Sim implementors should extend this type with
 * whatever extra data is available.
 */
export interface SimResult {
    mainDpsResult: number;
}

/**
 * Represents simulation settings. Sim implementors should extend this type with any additional settings.
 */
export interface SimSettings {
    includeInExport?: boolean
}

/**
 * Represents a sim archetype which can produce the actual Simulation objects.
 */
export interface SimSpec<SimType extends Simulation<any, any, any>, SettingsExport> {
    /**
     * Unique stub used to reference this specific sim type. Should only use alphanumeric (but not
     * with a number as the first character) and hyphens. This effectively acts as the primary key
     * for the simulation, as it is used to represent the type of sim in serialized forms.
     */
    stub: string,
    /**
     * Display name for this sim type.
     */
    displayName: string,
    /**
     * Whether the sim should be added to applicable sheets by default
     */
    isDefaultSim?: boolean,

    /**
     * Make a new instance of the simulator without importing any saved settings.
     */
    makeNewSimInstance(): SimType;

    /**
     * Make an instance of the simulator from saved settings.
     *
     * @param exported The saved settings.
     */
    loadSavedSimInstance(exported: SettingsExport): SimType;

    /**
     * Optional: restrict this simulation to certain jobs.
     */
    supportedJobs?: JobName[] | undefined;
    /**
     * Optional: restrict this simulation to certain levels.
     */
    supportedLevels?: SupportedLevel[] | undefined;
    /**
     * Optional: a brief description to display when choosing a sim.
     */
    description?: string;
    /**
     * Optional: contact info for maintainers
     */
    maintainers?: MaintainerInfo[]
}

export type MaintainerInfo = {
    name: string,
    contact: ContactInfo[]
}

export type DiscordContactInfo = {
    type: 'discord',
    discordTag: string,
    discordUid: string
};

export type ContactInfo = DiscordContactInfo;

/**
 * Represents a configured simulation. Note that an instance of this object is re-used across multiple runs of the
 * same simulation (e.g. multiple sets, or multiple runs of one set). Thus, no mutable state should be kept at this
 * level. Rather, all mutable state should be scoped within the {@link simulate} method.
 *
 * @type ResultType: The type of result returned by the sim.
 * @type SettingType: The internal settings type.
 * @type SettingsExport: The externalized settings type (for saving and restoring of settings).
 */
export interface Simulation<ResultType extends SimResult, SettingsType extends SimSettings, SettingsExport> {

    /**
     * A short name for the sim, used for internal naming. Should be usable as a CSS class name or other
     * HTML-ish applications, i.e. start with a letter, then keep to alphanumeric and hyphen.
     *
     * A good choice is to simply use the spec's stub name.
     */
    readonly shortName: string;
    /**
     * The user-facing display name of the sim. This needs to be writable, as users can change the display
     * name of sims.
     */
    displayName: string;

    /**
     * Run a simulation. As mentioned in the class-level docs, all mutable state should be scoped to this
     * method.
     *
     * @param set
     */
    simulate(set: CharacterGearSet): Promise<ResultType>;

    /**
     * The internalized settings of the object.
     */
    settings: SettingsType;

    /**
     * The settings, flatted into a form that is fully JSON-ifiable.
     */
    exportSettings(): SettingsExport;

    /**
     * The original sim spec.
     */
    spec: SimSpec<typeof this, SettingsExport>

    /**
     * If true, do not automatically re-run the sim. Currently, this is only implemented for
     * the configuration - changing settings will not cause the sim to auto-re-run. Eventually, it
     * may also be implemented for changes to gear sets.
     */
    readonly manualRun?: boolean;

    /**
     * Notify the sim that settings have changed
     */
    settingsChanged(): void;
}

/**
 * Class which holds the current status of a simulation run. While some sims runs synchronously,
 * others, such as those which use an external service, run asynchronously, and so intermediate
 * states such as 'Running' need to be represented.
 */
export interface SimCurrentResult<X extends SimResult> {
    /**
     * The result. undefined unless {@link status} === 'Done'.
     */
    result: X | undefined;
    /**
     * The current status. 'Done' means the sim is complete, while 'Error' means the sim did
     * not successfully complete. These are the only two states that are used for synchronous sims.
     * For asynchronous sims, there is also the 'Running' state. Finally, for sims which do not
     * re-run automatically upon a gear set or settings change, the 'Not Run' state means that
     * the sim has not yet run since opening the app, while 'Stale' indicates that the current
     * result is stale and does not reflect current gear or sim settings.
     */
    status: 'Done' | 'Running' | 'Not Run' | 'Stale' | 'Error';
    /**
     * If {@link status} === 'Error', then this contains the error.
     */
    error: any | undefined;
    /**
     * Like {@link result}, but in the form of a Promise. This allows you to wait for the results.
     */
    resultPromise: Promise<X>;
}

/**
 * Represents a DoT
 */
export type DotInfo = Readonly<{
    duration: number | 'indefinite',
    tickPotency: number,
    id: number
}>;

/**
 * Represents combo-related data.
 *
 * comboFrom is a list of abilities that this ability can combo after. e.g. if we have a 1-2-3 combo,
 * then 1 would not have combo data, while 2 would list 1 as its comboFrom, and 3 would list 2 as its
 * comboFrom.
 *
 * These are keyed on their ID, so they must have an ID.
 *
 * The rest of the object is which fields of {@link DamagingAbility} you would like to override. Generally, this will
 * be potency, but you can include other changes if needed.
 */
export type ComboData = ({
    /**
     * Which combo this should start/break/ignore. Supports the special value 'all' to specify that all combos
     * should be broken or ignored.
     *
     * See {@link ComboKeyMatch}
     */
    comboKey?: ComboKeyMatch,
    /**
     * What should happen when this ability is used.
     *
     * start: starts the combo. May have inconsistent behavior if comboKey === 'all'.
     * break: interrupts the combo
     * nobreak: no interaction with this combo
     * continue: continues the combo (see the other part of this type)
     */
    comboBehavior: 'start' | 'break' | 'nobreak'
} | {
    /**
     * Which combo this should continue. Other combos will be broken.
     */
    comboKey?: ComboKey,
    comboBehavior: 'continue',
    /**
     * Which abilities this ability can combo from.
     */
    comboFrom: readonly Ability[],
}) & Partial<DamagingAbility>;

/**
 * Key used to uniquely identify a combo.
 */
export type ComboKey = 'default' | string;
/**
 * Key used to match a combo. Supports the special value 'all' to indicate that the behavior should be applied to all
 * combos.
 */
export type ComboKeyMatch = ComboKey | 'all';

/**
 * Represents a non-damaging action
 */
export type NonDamagingAbility = Readonly<{
    potency: null,
}>;

/**
 * Represents a damaging action
 */
export type DamagingAbility = Readonly<{
    potency: number,
    attackType: AttackType,
    autoCrit?: boolean,
    autoDh?: boolean,
    dot?: DotInfo,
    alternativeScalings?: AlternativeScaling[],
}>;

/**
 * Represents a set of ability attributes that should be applied
 * above a certain level. Can be used to express e.g. traits increasing
 * the potency of skills, or granting new buffs.
 */
export type LevelModifier = ({
    minLevel: number,
})
& Omit<Partial<BaseAbility>, 'levelModifiers'>;

/**
 * Combo mode:
 * start: starts a combo.
 * continue: continue (or finish) a combo. If there is no combo, then this is treated as 'break'.
 * break: cancel any current combo. Default for GCDs.
 * nobreak: no impact on any current combo. Default for non-GCDs.
 */
export type ComboBehavior = ComboData['comboBehavior'];

/**
 * Alternate scalings that can exist for abilities, e.g. Living
 * Shadow, Bunshin, SMN pet actions.
 */
export type AlternativeScaling = "Living Shadow Strength Scaling" | "Pet Action Weapon Damage";

export type BaseAbility = Readonly<{
    /**
     * Name of the ability.
     */
    name: string,
    /**
     * Status effects that are automatically activated by the ability
     */
    activatesBuffs?: readonly Buff[],
    /**
     * The ID of the ability. Used for equality checks, and for xivapi lookup.
     */
    id: number,
    /**
     * If the action comes from an item, list the item ID so that it can be used for the
     * icon.
     */
    itemId?: number,
    /**
     * Don't display an icon for this ability
     */
    noIcon?: boolean,
    /**
     * The type of action - Autoattack, Spell, Weaponskill, Ability (oGCD), etc
     */
    attackType: AttackType,
    /**
     * Optional - the cooldown.
     */
    cooldown?: Cooldown,
    /**
     * How this skill contributes to the combo system.
     *
     * By default, skills do not interact with the combo system at all. However, if you specify any combo information,
     * it will be considered to interrupt any other combos by default. You can change this behavior by supplying
     * a combo for the special 'all' combo key.
     */
    combos?: readonly ComboData[]
    /**
     * The time that it takes to cast. Do not include caster tax. Defaults to 0.5 (thus 0.6 after adding caster tax)
     * if not specified, i.e. normal animation lock.
     */
    cast?: number,
    /**
     * If the ability has a fixed cast and recast, rather than being reduced by sks/sps,
     * set to true.
     */
    fixedGcd?: boolean,
    /**
     * If the ability has a fixed cast _but_ a scaling recast, set to true.
     * The only current occurrence of this in game is the Iaijutsu and Ogi Namikiri weaponskills after
     * the level 74 talent.
     */
    fixedCast?: boolean,
    /**
     * Override the default animation lock
     */
    animationLock?: number,
    /**
     * Override the default application delay
     */
    appDelay?: number,
    /**
     * A list of level modifiers, that can override properties of the ability
     * at the specified level. An action will have its properties overriden for
     * the highest `minLevel` specified.
     */
    levelModifiers?: LevelModifier[],
    /**
    * If the ability uses alternate scalings, such as Living Shadow Strength
    * scaling or using the pet action Weapon Damage multiplier.
    */
    alternativeScalings?: AlternativeScaling[],
} & (NonDamagingAbility | DamagingAbility)>;


/**
 * Represents the cooldown of an ability
 */
export type BaseCooldown = Readonly<{
    /**
     * The cooldown duration, or the time to regain a single charge
     */
    time: number,
    /**
     * If the cooldown is reduced by sps or sks, indicate that here. Default is 'none'.
     */
    reducedBy?: 'none' | 'spellspeed' | 'skillspeed';
    /**
     * The number of charges of the ability.
     */
    charges?: number
}>

export type OriginCooldown = BaseCooldown & {
    sharesCooldownWith?: never;
}

export type SharedCooldown = BaseCooldown & {
    /**
     * If the ability shares a cooldown with another ability, specify that ability here.
     *
     * When using shared cooldowns, the reference should only be made in one direction. That is,
     * if A, B, and C share cooldowns, then B and C should set their shared cooldown to A, and A should not have a
     * shared cooldown.
     */
    sharesCooldownWith: Ability & {
        cooldown: OriginCooldown
    }
}

export type Cooldown = OriginCooldown | SharedCooldown;
export type OriginCdAbility = Ability & {
    cooldown: OriginCooldown;
}
export type SharedCdAbility = Ability & {
    cooldown: SharedCooldown;
}

export type CdAbility = OriginCdAbility | SharedCdAbility;

/**
 * Represents a GCD action
 */
export type GcdAbility = BaseAbility & Readonly<{
    type: 'gcd';
    /**
     * If the ability's GCD can be lowered by sps/sks, put it here.
     */
    gcd: number,
}>

/**
 * Represents an oGCD action
 */
export type OgcdAbility = BaseAbility & Readonly<{
    type: 'ogcd',
}>;

export type AutoAttack = BaseAbility & DamagingAbility & Readonly<{
    type: 'autoattack',
    // TODO
}>;

export type Ability = GcdAbility | OgcdAbility | AutoAttack;

export type DotDamageUnf = {
    fullDurationTicks: number | 'indefinite',
    damagePerTick: ComputedDamage,
    actualTickCount?: number
};

export type ComputedDamage = ValueWithDev;

/**
 * Represents an ability actually being used
 */
export type PreDmgUsedAbility = {
    /**
     * The ability that was used
     */
    ability: Ability,
    /**
     * The buffs that were active either when the ability started casting, or when it snapshotted, depending on what
     * bonuses the buff provides.
     *
     * TODO: consider adding buffsAtStart and buffsAtSnapshot to clearly delineate these.
     */
    buffs: Buff[],
    /**
     * The combined effects that were active when the ability snapshotted, with the exception that the 'haste' field
     * comes from the start of the cast, since that is when haste matters.
     */
    combinedEffects: CombinedBuffEffect,
    /**
     * When the ability was initiated.
     */
    usedAt: number,
    /**
     * The direct damage of the ability
     */
    //directDamage: ComputedDamage,
    /**
     * If a DoT, the DoT damage
     */
    dot?: DotDamageUnf,
    /**
     * The total cast time from usedAt
     */
    castTimeFromStart: number,
    /**
     * The total time between usedAt and snapshot
     */
    snapshotTimeFromStart: number,
    /**
     * The raw application delay from snapshot to application
     */
    appDelay: number,
    /**
     * The application delay from usedAt
     */
    appDelayFromStart: number,
    /**
     * The total time used by the ability. This doesn't mean *exclusive* use - e.g. for an instant GCD, this is
     * the total GCD time, not the total time you are unable to use other actions.
     */
    totalTimeTaken: number
    /**
     * The total time where you are unable to take other actions. For an instant, this is the animation lock. For
     * a cast, this is the cast time + caster tax.
     */
    lockTime: number
    /**
     * Extra data relating to the ability used. Useful for
     */
    extraData?: object
};

export type PostDmgUsedAbility = PreDmgUsedAbility & {
    directDamage: ComputedDamage,
    dot?: DotDamageUnf
}
/**
 * Represents a pseudo-ability used to round out a cycle to exactly 120s.
 *
 * e.g. If our last GCD of the 120s cycle would start at 118.9s, then we do not have enough time
 * remaining for an entire GCD. Thus, we would have a PartialAbility with portion = (1.1s / 2.5s)
 *
 */
export type PartiallyUsedAbility = PreDmgUsedAbility & {
    portion: number
};

export type FinalizedAbility = {
    usedAt: number,
    original: PreDmgUsedAbility,
    totalDamage: number,
    totalDamageFull: ComputedDamage
    totalPotency: number,
    partialRate: number | null,
    directDamage: number,
    directDamageFull: ComputedDamage,
    dotInfo: DotDamageUnf,
    combinedEffects: CombinedBuffEffect,
    ability: Ability,
    buffs: Buff[]
};

/**
 * Describes the effects of a buff
 */
export type BuffEffects = {
    /**
     * Damage increase. e.g. 0.2 = 20% increase
     */
    dmgIncrease?: number,
    /**
     * Crit chance increase, e.g. 0.2 = 20% increase
     */
    critChanceIncrease?: number,
    /**
     * Dhit chance increase, e.g. 0.2 = 20% increase
     */
    dhitChanceIncrease?: number,
    /**
     * Force a crit
     */
    forceCrit?: boolean,
    /**
     * Force a DH
     */
    forceDhit?: boolean,
    /**
     * Haste. Expressed as the percentage value, e.g. 20 = 20% faster GCD
     */
    haste?: number,
    /**
     * Modify stats directly
     */
    modifyStats?: StatModification;
};

export type BuffController = {
    removeStatus(buff: Buff): void;
    removeSelf(): void;
    /** Modify the number of stacks of a `buff` by `stacksDelta` amount. e.g. -1 = remove 1 stack. */
    modifyStacks(buff: Buff, stacksDelta: number): void;
    /** Modify the number of stacks of this buff by `stacksDelta` amount. e.g. -1 = remove 1 stack. */
    modifyStacksSelf(stacksDelta: number): void;
    /** Increase the number of stacks of a `buff` by `stacks` amount.*/
    addStacks(buff: Buff, stacks: number): void;
    /** Increase the number of stacks of this buff by `stacks` amount.*/
    addStacksSelf(stacks: number): void;
    /** Decrease the number of stacks of a `buff` by `stacks` amount.*/
    subtractStacks(buff: Buff, stacks: number): void;
    /** Decrease the number of stacks of this buff by `stacks` amount.*/
    subtractStacksSelf(stacks: number): void;
};

export type BaseBuff = Readonly<{
    /** Name of buff */
    name: string,
    /** Can only apply to self - not a party/targeted buff */
    selfOnly?: boolean,
    /** The effect(s) of the buff */
    effects: BuffEffects,
    /** For buffs whose duration can stack*/
    maxStackingDuration?: number;
    /**
     * Filter what abilities this buff applies to
     *
     * @param ability The ability that is being used
     * @returns whether this buff should apply to this ability
     */
    appliesTo?(ability: Ability): boolean,
    /**
     * Optional function to run before an ability is used. This can be used for buffs that have special
     * effects which trigger when using an ability, e.g. Swiftcast/Dualcast.
     *
     * @param controller A controller which lets you perform actions such as removing buffs.
     * @param ability The original ability, unless it has already been modified by other hooks, in which case it may
     * have already been modified.
     * @returns The ability, if the buff needs to modify some properties of the ability. Null if no modification.
     */
    beforeAbility?<X extends Ability>(controller: BuffController, ability: X): X | void,
    /**
     * Modify an ability before it snapshots. If the ability is instant, this is not much different from
     * beforeAbility.
     *
     * @param controller A controller which lets you perform actions such as removing buffs.
     * @param ability The original ability, unless it has already been modified by other hooks, in which case it may
     * have already been modified.
     * @returns The ability, if the buff needs to modify some properties of the ability. Null if no modification.
     */
    beforeSnapshot?<X extends Ability>(controller: BuffController, ability: X): X | void,
    /**
     * Modify the final damage dealt by an ability.
     *
     * @param controller A controller which lets you perform actions such as removing buffs.
     * @param damageResult The damage result. May have other status effect modifiers already applied. This is the
     * post-calculation damage, after gear, plain damage buffs has been considered.
     * @param ability The ability
     * @returns The modified damage, or null if it does not need to be modified
     */
    modifyDamage?(controller: BuffController, damageResult: DamageResult, ability: Ability): DamageResult | void,
    /**
     * Optional status effect ID. Used to provide an icon.
     */
    statusId?: number
    /**
     * Stack count of this buff. This should generally not be baked into the buff - it should be inserted at run time.
     */
    stacks?: number
    /**
     * Add a key for this buff for import/export functionality. If not specified, will use the name as the key.
     */
    saveKey?: string
} & ({
    descriptionExtras?: never,
    descriptionOverride?: never,
} | {
    /**
     * Override the auto-generated description which would normally describe the effects.
     *
     * Specify descriptionOverride, or descriptionExtras, or neither.
     */
    descriptionOverride: string,
    descriptionExtras?: never,
} | {
    /**
     * Additional descriptions of custom effects.
     *
     * Specify descriptionOverride, or descriptionExtras, or neither.
     */
    descriptionExtras: string[],
    descriptionOverride?: never,
})>;

export type PartyBuff = BaseBuff & Readonly<{
    /** Job of buff */
    job: JobName,
    /** Cooldown */
    cooldown: number,
    /** "Optional" would be things like DNC partner buffs, where merely having the job
     // in your comp does not mean you would necessarily get the buff. */
    optional?: boolean,

    selfOnly: false,
    /**
     * Time of usage - can be omitted for buffs that would only be used by self and never auto-activated
     */
    startTime?: number,

    /**
     * Duration. Required for party buffs
     */
    duration: number,
}>;

export type PersonalBuff = BaseBuff & Readonly<{
    /**
     * Duration. Optional for personal buffs - omit to signify an indefinite buff.
     */
    duration?: number | undefined;
}>;

export type Buff = PersonalBuff | PartyBuff;

export type DamageResult = {
    readonly directDamage: ComputedDamage | null,
    readonly dot: DotDamageUnf | null
}

/**
 * Represents the combined effects of multiple buffs
 */
export type CombinedBuffEffect = {
    /**
     * Overall damage modifier, e.g. 1.5 = 50% more damage
     */
    dmgMod: number,
    /**
     * Crit chance increase, e.g. 0.1 = 10% increased critical chance
     */
    critChanceIncrease: number,
    /**
     * Dhit chance increase, e.g. 0.1 = 10% increased direct hit chance
     */
    dhitChanceIncrease: number,
    /**
     * Auto-crit
     */
    forceCrit: boolean,
    /**
     * Auto-direct-hit
     */
    forceDhit: boolean,
    /**
     * Haste as an integer, e.g. 20 haste = 20% lower cast/gcd time.
     */
    haste: number,
    /**
     * Function for modifying a ComputedSetStats for any changes which cannot be expressed using the other fields.
     */
    modifyStats: (stats: ComputedSetStats) => ComputedSetStats,
}

/**
 * Represents different overrides to values used in calculating damage.
 * This can and should be extended for other things that are specially overriden
 * by abilities in the future.
 */
export type ScalingOverrides = {
    /**
     * Main stat multiplier. Overriden by abilities like Living Shadow and Bunshin.
     */
    mainStatMulti: number,
    /**
     * Weapon damage multiplier. Overriden by pet abilities and abilities with alternate
     * actors, e.g. Earthly Star, Living Shadow, Queen, SMN abilities.
     */
    wdMulti: number,
}
