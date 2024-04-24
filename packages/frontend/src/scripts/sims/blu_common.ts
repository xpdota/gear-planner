import { SimSettings } from "../simulation";
import {
    AbilityUseResult,
    BaseMultiCycleSim,
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "./sim_processors";
import { Ability, Buff, BuffController, GcdAbility, OgcdAbility } from "./sim_types"
import { BuffSettingsArea } from "./party_comp_settings";
import { cycleSettingsGui } from "./components/cycle_settings_components";
import { writeProxy } from "../util/proxies";
import { FieldBoundCheckBox, labeledCheckbox } from "../components/util";
import { OffGuardBuff } from "./buffs";
import { removeSelf } from "./common/utils";
import { CASTER_TAX } from "@xivgear/xivmath/xivconstants";

/**
 * BLU spells that apply Bleeding
 */
const BLU_BLEED_SPELLS = [
    "Nightbloom",
    "Song of Torment",
    "Aetherial Spark"
] as const as readonly string[];

/**
 * BLU spells that deal physical damage
 */
const BLU_PHYSICAL_SPELLS = [
    "Flying Frenzy",
    "Drill Cannons",
    "Final Sting",
    "Sharpened Knife",
    "Flying Sardine",
    "4-tonze Weight",
    "Sticky Tongue",
    "Fire Angon",
    "Kaltstrahl",
    "Abyssal Transfixion",
    "Revenge Blast",
    "Triple Trident",
    "Peripheral Synthesis",
    "Goblin Punch",
    "Right Round",
    "Wild Rage",
    "Deep Clean",
    "Ruby Dynamics",
    "Winged Reprobation"
] as const as readonly string[];

/**
 * BLU abilities that are channeled attacks
 */
const BLU_CHANNELED_ABILITIES = [
    "Phantom Flurry",
    "Apokalypsis",
] as const as readonly string[];

/**
 * BLU personal buffs (limited subset)
 */

const Boost: Buff = {
    name: "Boost",
    duration: 30,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.5 // only applies to damage spells
    },
    appliesTo: ability => ability.attackType === "Spell" && ability.potency !== null,
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        // mutually exclusive with Harmonized
        buffController.removeStatus(Harmonized);
        buffController.removeSelf();
        return null;
    },
    statusId: 1716
}

const WaxingNocturne: Buff = {
    name: "Waxing Nocturne",
    duration: 15,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.50
    },
    statusId: 1718
}

const MightyGuard: Buff = {
    name: "Mighty Guard",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    selfOnly: true,
    effects: { // also changes the effects of certain BLU spells
        dmgIncrease: -0.4
    },
    statusId: 1719
}

const WaningNocturne: Buff = {
    name: "Waning Nocturne",
    duration: 15,
    selfOnly: true,
    effects: {
        dmgIncrease: -1 // can't use any actions during Waning
    },
    statusId: 1727
}

const Harmonized: Buff = {
    name: "Harmonized",
    duration: 30,
    selfOnly: true,
    effects: {
        dmgIncrease: 0.8 // only applies to physical damage spells
    },
    appliesTo: ability => ability.attackType === "Spell" && BLU_PHYSICAL_SPELLS.includes(ability.name),
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        // mutually exclusive with Boost
        buffController.removeStatus(Boost);
        buffController.removeSelf();
        return null;
    },
    statusId: 2118
}

const TankMimicry: Buff = {
    name: "Aetheric Mimicry: Tank",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    selfOnly: true,
    effects: {}, // changes the effects of certain BLU spells
    statusId: 2124
}

const DpsMimicry: Buff = {
    name: "Aetheric Mimicry: DPS",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    selfOnly: true,
    effects: { // also changes the effects of certain BLU spells
        dhitChanceIncrease: 0.20,
        critChanceIncrease: 0.20
    },
    statusId: 2125
}

const HealerMimicry: Buff = {
    name: "Aetheric Mimicry: Healer",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    selfOnly: true,
    effects: {}, // changes the effects of certain BLU spells
    statusId: 2126
}

const BrushWithDeath: Buff = {
    name: "Brush with Death",
    duration: 600,
    selfOnly: true,
    effects: {}, // prevents certain BLU spells from being used
    statusId: 2127
}

const SurpanakhaBuff: Buff = {
    name: "Surpanakha's Fury",
    duration: 3,
    selfOnly: true,
    effects: {
        // only applies to Surpanakha
        // dmgIncrease: 0.5, 1 stack
        // dmgIncrease: 1.0, 2 stacks
        // dmgIncrease: 1.5, 3 stacks
    },
    beforeSnapshot: removeSelf,
    appliesTo: ability => ability.name === "Surpanakha",
    statusId: 2130
}

const Tingling: Buff = {
    name: "Tingling",
    duration: 15,
    selfOnly: true,
    effects: {
       // increases base potency of physical damage spells by 100 per hit
    },
    beforeSnapshot<X extends Ability>(buffController: BuffController, ability: X): X {
        if (ability.attackType === "Spell" && BLU_PHYSICAL_SPELLS.includes(ability.name)) {
            buffController.removeSelf();

            // Triple Trident hits 3 times, each hit gets bonus potency
            const bonusPotency: number = (ability.name === "Triple Trident") ? 300 : 100;

            // TODO: revisit if physical damage dot ability is added
            return {
                ...ability,
                potency: ability.potency + bonusPotency,
            }
        }
        return null;
    },
    statusId: 2492
}

const BasicInstinct: Buff = {
    name: "Basic Instinct",
    duration: Number.MAX_VALUE, // toggled stance, infinte duration
    selfOnly: true,
    effects: {
        dmgIncrease: 1.0
    },
    statusId: 2498
}

/**
 * BLU spells and abilities (limited subset)
 */

export const SongOfTorment: GcdAbility = {
    name: "Song of Torment",
    type: "gcd",
    attackType: "Spell",
    potency: 50,
    dot: {
        tickPotency: 50,
        duration: 30,
        id: 1714 // same effect as Nightbloom and Aetherial Spark (overwrites)
    },
    gcd: 2.5,
    cast: 2.0,
    id: 11386
}

export const Bristle: GcdAbility = {
    name: "Bristle",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    activatesBuffs: [Boost],
    gcd: 2.5,
    cast: 1.0,
    id: 11393
}

export const FinalSting: GcdAbility = {
    name: "Final Sting",
    type: "gcd",
    attackType: "Spell",
    potency: 2000,
    activatesBuffs: [BrushWithDeath],
    gcd: 2.5,
    cast: 2.0,
    id: 11407
}

export const OffGuard: OgcdAbility = {
    name: "Off-guard",
    type: "ogcd",
    attackType: "Spell", // TODO: cast and cooldown are reduced by spell speed
    potency: null,
    activatesBuffs: [OffGuardBuff],
    animationLock: 1.0, // TODO: should be cast time
    cooldown: {
        time: 60,
        reducedBy: "spellspeed"
    },
    id: 11411
}

export const MoonFlute: GcdAbility = {
    name: "Moon Flute",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    activatesBuffs: [WaxingNocturne],
    gcd: 2.5,
    cast: 2.0,
    id: 11415
}

export const FeatherRain: OgcdAbility = {
    name: "Feather Rain",
    type: "ogcd",
    attackType: "Ability",
    potency: 220,
    dot: {
        tickPotency: 40,
        duration: 6,
        id: 1723
    },
    animationLock: 0.6,
    cooldown: {
        time: 30
    },
    id: 11426
}

export const ShockStrike: OgcdAbility = {
    name: "Shock Strike",
    type: "ogcd",
    attackType: "Ability",
    potency: 400,
    animationLock: 0.6,
    cooldown: {
        time: 60
    },
    id: 11429
}

export const GlassDance: OgcdAbility = {
    name: "Glass Dance",
    type: "ogcd",
    attackType: "Ability",
    potency: 350,
    animationLock: 0.6,
    cooldown: {
        time: 90
    },
    id: 11430
}

export const SonicBoom: GcdAbility = {
    name: "Sonic Boom",
    type: "gcd",
    attackType: "Spell",
    potency: 210,
    gcd: 2.5,
    cast: 1.0,
    id: 18308
}

export const Whistle: GcdAbility = {
    name: "Whistle",
    type: "gcd",
    attackType: "Spell",
    potency: null,
    activatesBuffs: [Harmonized],
    gcd: 2.5,
    cast: 1.0,
    id: 18309
}

export const Surpanakha: OgcdAbility = {
    name: "Surpanakha",
    type: "ogcd",
    attackType: "Ability",
    potency: 200,
    activatesBuffs: [SurpanakhaBuff],
    animationLock: 0.6,
    cooldown: {
        time: 30,
        charges: 4
    },
    id: 18323
}

export const Quasar: OgcdAbility = {
    name: "Quasar",
    type: "ogcd",
    attackType: "Ability",
    potency: 300,
    animationLock: 0.6,
    cooldown: {
        time: 60 // shared with J Kick
    },
    id: 18324
}

export const JKick: OgcdAbility = {
    name: "J Kick",
    type: "ogcd",
    attackType: "Ability",
    potency: 300,
    animationLock: 0.9,
    cooldown: {
        time: 60 // shared with Quasar
    },
    id: 18325
}

export const TripleTrident: GcdAbility = {
    name: "Triple Trident",
    type: "gcd",
    attackType: "Spell",
    potency: 450, // 3 hits @ 150 ea, 250 ea under Tingling
    gcd: 2.5,
    cast: 2.0,
    cooldown: {
        time: 90,
        reducedBy: "spellspeed"
    },
    id: 23264
}

export const Tingle: GcdAbility = {
    name: "Tingle",
    type: "gcd",
    attackType: "Spell",
    potency: 100,
    activatesBuffs: [Tingling],
    gcd: 2.5,
    cast: 2.0,
    id: 23265
}

export const FeculentFlood: GcdAbility = {
    name: "Feculent Flood",
    type: "gcd",
    attackType: "Spell",
    potency: 220,
    gcd: 2.5,
    cast: 2.0,
    id: 23271
}

export const RoseOfDestruction: GcdAbility = {
    name: "The Rose of Destruction",
    type: "gcd",
    attackType: "Spell",
    potency: 400,
    gcd: 2.5,
    cast: 2.0,
    cooldown: {
        time: 30,
        reducedBy: "spellspeed"
    },
    id: 23275
}

export const MatraMagic: GcdAbility = {
    name: "Matra Magic",
    type: "gcd",
    attackType: "Spell",
    potency: 400, // 8 hits @ 50 ea, 100 ea under Aetheric Mimicry: DPS
    gcd: 2.5,
    cast: 2.0,
    cooldown: {
        time: 120,
        reducedBy: "spellspeed"
    },
    id: 23285
}

export const PhantomFlurry: OgcdAbility = {
    name: "Phantom Flurry",
    type: "ogcd",
    attackType: "Ability",
    potency: 0,
    dot: {
        tickPotency: 200,
        duration: 18, // TODO: ticks once on use, and 1 tick per second afterwards for 6 total ticks over 5s
        id: 2502
    },
    animationLock: 0, // TODO: 5s channeled attack, prevents autos for duration
    cooldown: {
        time: 120
    },
    id: 23288
}

export const Nightbloom: OgcdAbility = {
    name: "Nightbloom",
    type: "ogcd",
    attackType: "Ability",
    potency: 400,
    dot: {
        tickPotency: 75,
        duration: 60,
        id: 1714 // same effect as Song of Torment and Aetherial Spark (overwrites)
    },
    animationLock: 0.6,
    cooldown: {
        time: 120
    },
    id: 23290
}

export const BreathofMagic: GcdAbility = {
    name: "Breath of Magic",
    type: "gcd",
    attackType: "Spell",
    potency: 0,
    dot: {
        tickPotency: 120,
        duration: 60,
        id: 3712
    },
    gcd: 2.5,
    cast: 2.0,
    id: 34567
}

export const WingedReprobation: GcdAbility = {
    name: "Winged Reprobation",
    type: "gcd",
    attackType: "Spell",
    potency: 300, // 400 with 3 "stacks"
    gcd: 2.5,
    cast: 1.0,
    cooldown: {
        time: 90, // 90s cooldown after 3rd "stack" is consumed
        reducedBy: "spellspeed"
    },
    id: 34576
}

export const MortalFlame: GcdAbility = {
    name: "Mortal Flame",
    type: "gcd",
    attackType: "Spell",
    potency: 0,
    dot: {
        tickPotency: 40,
        duration: Number.MAX_VALUE, // infinite duration
        id: 3643
    },
    gcd: 2.5,
    cast: 2.0,
    id: 34579
}

export const SeaShanty: OgcdAbility = {
    name: "Sea Shanty",
    type: "ogcd",
    attackType: "Ability",
    potency: 500, // TODO: 1000 if weather is Rain, Showers, or Thunderstorms
    animationLock: 0.6,
    cooldown: {
        time: 120
    },
    id: 34580
}

export const Apokalypsis: OgcdAbility = {
    name: "Apokalypsis",
    type: "ogcd",
    attackType: "Ability",
    potency: 0,
    dot: {
        tickPotency: 140,
        duration: 33, // TODO: ticks once on use, and 1 tick per second afterwards for 11 total ticks over 10s
        id: 3644
    },
    animationLock: 0, // TODO: 10s channeled attack, prevents autos for duration
    cooldown: {
        time: 120 // shared with Being Mortal
    },
    id: 34581
}

export const BeingMortal: OgcdAbility = {
    name: "Being Mortal",
    type: "ogcd",
    attackType: "Ability",
    potency: 800,
    animationLock: 0.6,
    cooldown: {
        time: 120 // shared with Apokalypsis
    },
    id: 34582
}

/**
 * BLU sim settings
 */
export interface BluSimSettings extends SimSettings {
    dpsMimicryEnabled: boolean;
    mightyGuardEnabled: boolean;
    basicInstinctEnabled: boolean;
}

/**
 * BLU Cycle Processor
 */
export class BLUCycleProcessor extends CycleProcessor {
    // current gcd (2.5s base) recast time
    private _gcdRecast: number = 0;
    get gcdRecast() {
        return this._gcdRecast;
    }
    // current short (1.0s base) gcd cast, including caster tax
    private _shortGcdCast: number = 0;
    get shortGcdCast() {
        return this._shortGcdCast;
    }
    // current long (2.0s base) gcd cast, including caster tax
    private _longGcdCast: number = 0;
    get longGcdCast() {
        return this._longGcdCast;
    }
    // start of Moon Flute window
    private _fluteStart: number = 0;
    // end of current Bleed effect
    private _bleedEnd: number = 0;
    get bleedEnd() {
        return this._bleedEnd;
    }
    // Surpanakha stacks
    private _surpanakhaCounter: number = 0;
    get surpanakhaCounter() {
        return this._surpanakhaCounter;
    }
    set surpanakhaCounter(newSurpanakha) {
        this._surpanakhaCounter = newSurpanakha % 4;
    }
    // Winged Reprobation stacks
    private _wingedCounter: number = 0;
    get wingedCounter() {
        return this._wingedCounter;
    }
    set wingedCounter(newWinged) {
        this._wingedCounter = newWinged % 4;
    }

    constructor(settings?: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = "full-duration";
        this._gcdRecast = this.stats.gcdMag(this.gcdBase);
        this._shortGcdCast = this.stats.gcdMag(1.0) + CASTER_TAX;
        this._longGcdCast = this.stats.gcdMag(2.0) + CASTER_TAX;
    }

    use(ability: Ability): AbilityUseResult {

        // Moonflute
        if (ability === MoonFlute) {
            const out = super.use(MoonFlute);
            this._fluteStart = this.currentTime;
            const waningStart = this._fluteStart + WaxingNocturne.duration;
            this.setBuffStartTime(WaningNocturne, waningStart);
            return out;
        }

        // abilities that apply Bleeding
        if ("dot" in ability && BLU_BLEED_SPELLS.includes(ability.name)) {
            const out = super.use(ability);
            this._bleedEnd = this.currentTime + ability.dot.duration;
            return out;
        }

        // channeled abilities
        // TODO: implement proper channeled ability support in sim processor
        if (BLU_CHANNELED_ABILITIES.includes(ability.name)) {
            let end: number = 0;
            const out = super.use(ability);
            switch (ability.name) {
                case "Phantom Flurry": {
                    end = this.currentTime + 5; // 5s channel time
                    this.addSpecialRow("-- Flurry End --", end);
                    break;
                }
                case "Apokalypsis": {
                    end = this.currentTime + 10;  // 10s channel time
                    this.addSpecialRow("-- Apokalypsis End --", end);
                    break;
                }
                default: {
                    console.error(`Ability ${ability.name} does not have channel time information. This is a bug.`);
                    break;
                }
            }
            // advance to the end of the channel time
            this.advanceTo(Math.max(this.currentTime, Math.min(end, this.totalTime)), true);
            // set next gcd time to end of the channel time
            if (this.currentTime > this.nextGcdTime) {
                this.nextGcdTime = this.currentTime;
            }
            return out;
        }

        // Matra Magic
        if (ability === MatraMagic) {
            this.advanceTo(this.nextGcdTime);
            const buffs = this.getActiveBuffs();
            const modified: Ability = {
                ...MatraMagic,
                potency: buffs.includes(DpsMimicry) ? 800 : 400,
            }
            const out = super.use(modified);
            return out;
        }

        // Winged Reprobation
        if (ability === WingedReprobation) {
            const modified: Ability = {
                ...WingedReprobation,
                potency: this.wingedCounter < 3 ? 300 : 400,
                cooldown: {
                    ...WingedReprobation.cooldown,
                    time: this.wingedCounter < 3 ? 0 : 90, // TODO: this doesn't work as expected
                }
            }
            const out = super.use(modified);
            this.wingedCounter++;
            return out;
        }

        // Surpanakha
        if (ability === Surpanakha) {
            const multiplier = (this.surpanakhaCounter + 1) * 0.5;
            const buff: Buff = {
                ...SurpanakhaBuff,
                effects: {
                    dmgIncrease: multiplier,
                },
            }
            const modified: Ability = {
                ...Surpanakha,
                activatesBuffs: [buff],
                // animation lock becomes internal cooldown for back-to-back uses
                animationLock: this.surpanakhaCounter < 3 ? 1.0 : 0.6,
            }
            const out = super.use(modified);
            this.surpanakhaCounter++;
            return out;
        }

        // default, reset Surpanakha stacks if any
        this.surpanakhaCounter = 0;
        const out = super.use(ability);
        return out;
    }

    doWaning() {
        const waningEnd = this._fluteStart + WaxingNocturne.duration + WaningNocturne.duration;
        this.addSpecialRow("-- Waning End --", waningEnd);

        // advance to end of Waning window
        this.advanceTo(Math.max(this.currentTime, Math.min(waningEnd, this.totalTime)), true);

        // set next gcd time to end of Waning window
        if (this.currentTime > this.nextGcdTime) {
            this.nextGcdTime = this.currentTime;
        }
    }
}

/**
 * BLU sim functions
 */
export abstract class BluSim<_BluCycleSimResult, _BluSimSettings> 
    extends BaseMultiCycleSim<CycleSimResult, BluSimSettings, BLUCycleProcessor> {

    constructor(settings?: ExternalCycleSettings<BluSimSettings>) {
        super("BLU", settings);
    }

    makeDefaultSettings(): BluSimSettings {
        return {
            dpsMimicryEnabled: true,
            mightyGuardEnabled: false,
            basicInstinctEnabled: false,
        };
    }

    makeConfigInterface(settings: BluSimSettings, updateCallback: () => void): HTMLElement {
        const configDiv = document.createElement("div");
        configDiv.appendChild(cycleSettingsGui(writeProxy(this.cycleSettings, updateCallback)));

        // insert BLU stance toggles
        const stancesDiv = document.createElement("div");
        const dpsMimicryCb = new FieldBoundCheckBox(settings, "dpsMimicryEnabled");
        stancesDiv.appendChild(labeledCheckbox("Aetheric Mimicry: DPS", dpsMimicryCb));
        const mightyGuardCb = new FieldBoundCheckBox(settings, "mightyGuardEnabled");
        stancesDiv.appendChild(labeledCheckbox("Mighty Guard", mightyGuardCb));
        const basicInstinctCb = new FieldBoundCheckBox(settings, "basicInstinctEnabled");
        stancesDiv.appendChild(labeledCheckbox("Basic Instinct", basicInstinctCb));
        
        configDiv.appendChild(stancesDiv);
        configDiv.appendChild(new BuffSettingsArea(this.buffManager, updateCallback));
        return configDiv;
    }

    protected createCycleProcessor(settings: MultiCycleSettings): BLUCycleProcessor {
        return new BLUCycleProcessor(settings);
    }

    abstract getRotationsToSimulate(): Rotation<BLUCycleProcessor>[];

    protected abstract useOgcdFiller(cp: CycleProcessor): void;

    protected applyStances(cp: CycleProcessor) {
        if (this.settings.dpsMimicryEnabled) {
            cp.activateBuff(DpsMimicry);
        }

        // Basic Instinct overrides the damage penalty of Mighty Guard
        if (this.settings.mightyGuardEnabled) {
            const buff: Buff = {
                ...MightyGuard,
                effects: {
                    ...MightyGuard.effects,
                    dmgIncrease: this.settings.basicInstinctEnabled ? 0 : -0.4,
                }
            }
            cp.activateBuff(buff);
        }

        if (this.settings.basicInstinctEnabled) {
            cp.activateBuff(BasicInstinct);
        }
    }

    useStingCombo(cp: CycleProcessor) {
        cp.use(Whistle);
        this.useOgcdFiller(cp);
        cp.use(Tingle);
        cp.use(MoonFlute);
        cp.advanceTo(cp.nextGcdTime);
        const buffs = cp.getActiveBuffs();
        // if Brush with Death is active, cannot use Final Sting
        if (buffs.includes(BrushWithDeath)) {
            console.warn(`Ability ${FinalSting.name} cannot be used while ${BrushWithDeath.name} is active.`);
        }
        cp.use(FinalSting);
        cp.addSpecialRow("-- Death --");
    }
}
