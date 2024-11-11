/* eslint-disable @typescript-eslint/no-explicit-any */
import 'global-jsdom/register';
import {describe, it} from "mocha";
import * as assert from "assert";
import {assertClose, makeFakeSet} from "@xivgear/core/test/test_utils";
import {assertSimAbilityResults, setPartyBuffEnabled, UseResult} from "./sim_test_utils";
import {JobMultipliers} from "@xivgear/xivmath/geartypes";
import {getClassJobStats, getLevelStats, STANDARD_APPLICATION_DELAY} from "@xivgear/xivmath/xivconstants";
import {CharacterGearSet} from "@xivgear/core/gear";
import {Divination, Litany, Dokumori} from "@xivgear/core/sims/buffs";
import {exampleGearSet} from "./common_values";
import {Swiftcast} from "@xivgear/core/sims/common/swiftcast";
import {removeSelf} from "@xivgear/core/sims/common/utils";
import {finalizeStats} from "@xivgear/xivmath/xivstats";
import {
    Ability,
    Buff,
    BuffController,
    DamageResult,
    FinalizedAbility,
    GcdAbility,
    OgcdAbility,
    SimSettings,
    SimSpec
} from "@xivgear/core/sims/sim_types";
import {
    CycleProcessor,
    CycleSimResult,
    ExternalCycleSettings,
    MultiCycleSettings,
    Rotation
} from "@xivgear/core/sims/cycle_sim";
import { BaseMultiCycleSim } from '@xivgear/core/sims/processors/sim_processors';
import {gemdraught1mind} from "../../sims/common/potion";
import {expect} from "chai";

// Example of end-to-end simulation
// This one is testing the simulation engine itself, so it copies the full simulation code rather than
// referencing it. If you wish to test an actual simulation, you would want to reference it directly.

// Set up a simulation
interface TestSimSettings extends SimSettings {
}

interface TestSimSettingsExternal extends ExternalCycleSettings<TestSimSettings> {
}

let fakeId = 0x100_0000;

const filler: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Glare",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
};

const weaponSkill: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "WepSkill",
    potency: 310,
    attackType: "Weaponskill",
    gcd: 2.5,
    cast: 1.5,
};

const nop: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "NOP",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 2.0,
};

const dia: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Dia",
    potency: 65,
    dot: {
        id: 1871,
        tickPotency: 65,
        duration: 30,
    },
    attackType: "Spell",
    gcd: 2.5,
};

const assize: OgcdAbility = {
    id: fakeId++,
    type: 'ogcd',
    name: "Assize",
    potency: 400,
    attackType: "Ability",
};

const pom: OgcdAbility = {
    id: fakeId++,
    type: 'ogcd',
    name: 'Presence of Mind',
    potency: null,
    activatesBuffs: [
        {
            name: "Presence of Mind",
            selfOnly: true,
            duration: 15,
            effects: {
                haste: 20,
            },
        },
    ],
    attackType: "Ability",
};

const misery: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Afflatus Misery",
    potency: 1240,
    attackType: "Spell",
    gcd: 2.5,
};

const lily: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Afflatus Rapture",
    potency: 0,
    attackType: "Spell",
    gcd: 2.5,
};

export const testSimSpec: SimSpec<TestMultiCycleSim, TestSimSettingsExternal> = {
    displayName: "Test WHM Sim",
    loadSavedSimInstance(exported: TestSimSettingsExternal) {
        return new TestMultiCycleSim(exported);
    },
    makeNewSimInstance(): TestMultiCycleSim {
        return new TestMultiCycleSim();
    },
    stub: "test-whm-sim",
    supportedJobs: ['WHM'],
    isDefaultSim: false,
};

export interface TestSimResult extends CycleSimResult {
}

class TestMultiCycleSim extends BaseMultiCycleSim<TestSimResult, TestSimSettings> {
    spec = testSimSpec;
    displayName = testSimSpec.displayName;
    shortName = "WHM-new-sheet-sim";

    constructor(settings?: TestSimSettingsExternal) {
        super('WHM', settings);
    }

    makeDefaultSettings(): TestSimSettings {
        return {};
    }

    getRotationsToSimulate(): Rotation[] {
        return [{
            cycleTime: 120,
            apply(cp: CycleProcessor) {
                // These should NOT start combat because their damage === null
                cp.use(nop);
                cp.use(nop);
                cp.use(nop);
                cp.use(filler);
                cp.remainingCycles(cycle => {
                    cycle.use(dia);
                    cycle.use(filler);
                    cycle.use(filler);
                    cycle.useOgcd(pom);
                    cycle.use(filler);
                    cycle.use(assize);
                    if (cycle.cycleNumber > 0) {
                        cycle.use(misery);
                    }
                    cycle.useUntil(filler, 30);
                    cycle.use(dia);
                    cycle.use(lily); //3 lilys out of buffs to make up for misery in buffs, actual placement isn't specific
                    cycle.use(lily);
                    cycle.use(lily);
                    cycle.useUntil(filler, 50);
                    cycle.use(assize);
                    cycle.useUntil(filler, 60);
                    cycle.use(dia);
                    cycle.useUntil(filler, 70);
                    cycle.use(misery);
                    cycle.useUntil(filler, 90);
                    cycle.use(dia);
                    cycle.use(assize);
                    if (cycle.cycleNumber > 1) {
                        cycle.use(lily);
                        cycle.use(lily);
                        cycle.use(lily);
                    }
                    cycle.useUntil(filler, 'end');
                });
            },

        }];
    }
}

// Replace data that would normally be loaded from xivapi with fixed data
const jobStatMultipliers: JobMultipliers = {
    dexterity: 105,
    hp: 105,
    intelligence: 105,
    mind: 115,
    strength: 55,
    vitality: 100,
};
// Stats from a set. These should be the stats WITH items and race bonus, but WITHOUT party bonus
const rawStats = {
    // From https://share.xivgear.app/share/74fb005d-086f-45d3-bee8-9a211559f7df
    crit: 2287,
    determination: 1806,
    dexterity: 409,
    dhit: 400,
    hp: 0,
    intelligence: 409,
    mind: 3376,
    piety: 535,
    skillspeed: 400,
    spellspeed: 1522,
    strength: 214,
    tenacity: 400,
    vitality: 3321,
    wdMag: 132,
    wdPhys: 132,
    weaponDelay: 3.44,
};
// Finalize the stats (add class modifiers, party bonus, etc)
const stats = finalizeStats(rawStats, {}, 90, getLevelStats(90), 'WHM', {
    ...getClassJobStats('WHM'),
    jobStatMultipliers: jobStatMultipliers,
}, 5);

// Turn the stats into a fake gear set. This object does not implement all of the methods that a CharacterGearSet
// should, only the ones that would commonly be used in a simulation.
const set: CharacterGearSet = makeFakeSet(stats);

// Expected sim outcome
const expectedAbilities: UseResult[] = [
    {
        time: -8.41,
        name: 'NOP',
        damage: 0,
    },
    {
        time: -6.10,
        name: 'NOP',
        damage: 0,
    },
    {
        time: -3.79,
        name: 'NOP',
        damage: 0,
    },
    {
        time: -1.48,
        name: 'Glare',
        damage: 15057.71,
    },
    {
        time: 0,
        name: 'Auto Attack',
        damage: 33.301,
    },
    {
        time: 0.83,
        name: 'Dia',
        damage: 37048.88,
    },
    {
        time: 3.14,
        name: 'Glare',
        damage: 15057.71,
    },
    {
        time: 4.32,
        name: 'Auto Attack',
        damage: 33.301,
    },
    {
        time: 5.45,
        name: 'Glare',
        damage: 16633.961,
    },
    {
        time: 6.93,
        name: 'Presence of Mind',
        damage: 0,
    },
    {
        time: 7.76,
        name: 'Glare',
        damage: 17631.999,
    },
    {
        time: 8.96,
        name: "Assize",
        damage: 22777.859,
    },
    {
        time: 9.24,
        name: "Auto Attack",
        damage: 38.994,
    },
    {
        time: 9.60,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 11.44,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 13.192,
        name: "Auto Attack",
        damage: 38.994,
    },
    {
        time: 13.28,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 15.12,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 16.96,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 17.744,
        name: "Auto Attack",
        damage: 38.994,
    },
    {
        time: 18.80,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 20.64,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 21.696,
        name: "Auto Attack",
        damage: 38.994,
    },
    {
        time: 22.48,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 24.32,
        name: "Glare",
        damage: 17631.999,
    },
    {
        time: 25.928,
        name: "Auto Attack",
        damage: 37.064,
    },
    {
        time: 26.63,
        name: "Glare",
        damage: 15057.71,
    },
    {
        time: 28.94,
        name: "Glare",
        damage: 6909.599,
    },
];


// The test
describe('Cycle sim processor', () => {
    // Test the simulation
    it('produces the correct results', async () => {
        // Initialize
        const inst: TestMultiCycleSim = testSimSpec.makeNewSimInstance();
        inst.cycleSettings.useAutos = true;
        inst.cycleSettings.totalTime = 30;
        // Enable buffs
        setPartyBuffEnabled(inst, Dokumori, true);
        setPartyBuffEnabled(inst, Litany, true);
        setPartyBuffEnabled(inst, Divination, true);
        // Run simulation
        const result = await inst.simulate(set);
        // Assert correct results
        assertClose(result.mainDpsResult, 10170.769, 0.01);
        assertSimAbilityResults(result, expectedAbilities);
    });
});

const instant: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Dia",
    potency: 65,
    dot: {
        id: 1871,
        tickPotency: 65,
        duration: 30,
    },
    attackType: "Spell",
    gcd: 2.5,
};

const long: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Raise",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 8,
};

const defaultSettings: MultiCycleSettings = {

    allBuffs: [],
    cycleTime: 30,
    stats: exampleGearSet.computedStats,
    totalTime: 120,
    useAutos: false,
    cutoffMode: 'prorate-gcd',

};

describe('Swiftcast', () => {
    it('should handle swiftcast correctly', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(Swiftcast);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].usedAt, -1.48);
        assertClose(actualAbilities[0].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[0].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[0].original.lockTime, 1.48);
        assertClose(actualAbilities[0].original.castTimeFromStart, 1.38);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Swiftcast");
        assertClose(actualAbilities[1].usedAt, 0.0);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[1].original.lockTime, 0.6);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].usedAt, 0.83); // 0.83 === -1.48 + 2.31
        assertClose(actualAbilities[2].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.lockTime, 0.6);
        assertClose(actualAbilities[2].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].usedAt, 3.14);
        assertClose(actualAbilities[3].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[3].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[3].original.lockTime, 1.48);
        assertClose(actualAbilities[3].original.castTimeFromStart, 1.38);

    });
    it('should not start combat', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(Swiftcast);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Swiftcast - should NOT start combat
        assert.equal(actualAbilities[0].ability.name, "Swiftcast");
        assertClose(actualAbilities[0].usedAt, -1.2);
        assertClose(actualAbilities[0].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[0].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[0].original.castTimeFromStart, 0);
        // Swifted - verifies that the 0.6 anim lock and 0.6 app delay don't cause an issue where swift 'misses' the
        // immediate next ability.
        assert.equal(actualAbilities[1].ability.name, "Glare");
        assertClose(actualAbilities[1].usedAt, -0.6);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].usedAt, 1.71);
        assertClose(actualAbilities[2].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.castTimeFromStart, 1.38);

    });
    it('should not be consumed by an instant skill', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(Swiftcast);
        cp.use(instant);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].usedAt, -1.48);
        assertClose(actualAbilities[0].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[0].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[0].original.castTimeFromStart, 1.38);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Swiftcast");
        assertClose(actualAbilities[1].usedAt, 0.0);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Dia");
        assertClose(actualAbilities[2].usedAt, 0.83); // 0.83 === -1.48 + 2.31
        assertClose(actualAbilities[2].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].usedAt, 3.14);
        assertClose(actualAbilities[3].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[3].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[3].original.castTimeFromStart, 0);

    });
    it('should work correctly with a long cast', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(Swiftcast);
        cp.use(long);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].usedAt, -1.48);
        assertClose(actualAbilities[0].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[0].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[0].original.lockTime, 1.48);
        assertClose(actualAbilities[0].original.castTimeFromStart, 1.38);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Swiftcast");
        assertClose(actualAbilities[1].usedAt, 0.0);
        assertClose(actualAbilities[1].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[1].original.totalTimeTaken, 0.6);
        assertClose(actualAbilities[1].original.lockTime, 0.6);
        assertClose(actualAbilities[1].original.castTimeFromStart, 0);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Raise");
        assertClose(actualAbilities[2].usedAt, 0.83); // 0.83 === -1.48 + 2.31
        assertClose(actualAbilities[2].original.appDelayFromStart, 0.6);
        assertClose(actualAbilities[2].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[2].original.lockTime, 0.6);
        assertClose(actualAbilities[2].original.castTimeFromStart, 0);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].usedAt, 3.14);
        assertClose(actualAbilities[3].original.appDelayFromStart, 1.48);
        assertClose(actualAbilities[3].original.totalTimeTaken, 2.31);
        assertClose(actualAbilities[3].original.lockTime, 1.48);
        assertClose(actualAbilities[3].original.castTimeFromStart, 1.38);

    });
});

const potBuff: Buff = {
    cooldown: 60,
    duration: 10,
    effects: {},
    job: 'BLU',
    name: "Pot Buff Status",
    beforeSnapshot<X extends Ability>(controller: BuffController, ability: X): X {
        controller.removeStatus(potBuff);
        return {
            ...ability,
            potency: ability.potency + 100,
        };
    },
};

const potBuffAbility: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Pot Buff Ability",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.0,
    activatesBuffs: [potBuff],
};

describe('Potency Buff Ability', () => {
    it('should increase the damage once', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(potBuffAbility);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not swifted
        assert.equal(actualAbilities[0].ability.name, "Glare");
        const glareDmg = 15057.710352;
        assertClose(actualAbilities[0].directDamage, glareDmg, 1);
        // Swiftcast
        assert.equal(actualAbilities[1].ability.name, "Pot Buff Ability");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Swifted
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].directDamage, glareDmg * (310 + 100) / 310, 6);
        // Not swifted
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, glareDmg, 1);
    });
});

function multiplyDamage(damageResult: DamageResult, multiplier: number, multiplyDirectDamage: boolean = true, multiplyDot: boolean = true) {
    return {
        directDamage: (damageResult.directDamage === null || !multiplyDirectDamage) ? damageResult.directDamage : {
            expected: damageResult.directDamage.expected * multiplier,
            stdDev: 0,
        },
        dot: (damageResult.dot === null || !multiplyDot) ? damageResult.dot : {
            ...damageResult.dot,
            damagePerTick: {
                expected: damageResult.directDamage.expected * multiplier,
                stdDev: 0,
            },
        },
        channel: (damageResult.channel === null || !multiplyDot) ? damageResult.channel : {
            ...damageResult.channel,
            damagePerTick: {
                expected: damageResult.directDamage.expected * multiplier,
                stdDev: 0,
            },
        },
    };
}

// Demonstrates one way of doing a one-off damage increase
const bristleBuff: Buff = {
    // TODO
    cooldown: 60,
    duration: 10,
    effects: {
        dmgIncrease: 0.5,
    },
    job: 'BLU',
    name: "Bristle",
    beforeSnapshot: removeSelf,
    appliesTo: ability => ability.attackType === "Spell" && ability.potency !== null,
};

const bristle: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Bristle",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.0,
    activatesBuffs: [bristleBuff],
};

// Demonstrates the longer but more flexible way
const bristleBuff2: Buff = {
    // TODO
    cooldown: 60,
    duration: 10,
    effects: {},
    job: 'BLU',
    name: "Bristle",
    modifyDamage(buffController: BuffController, damageResult: DamageResult, ability: Ability): DamageResult | void {
        if (ability.attackType === 'Spell' && ability.potency !== null) {
            buffController.removeSelf();
            return multiplyDamage(damageResult, 1.5, true, true);
        }
    },
};

const bristle2: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Bristle2",
    potency: null,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.0,
    activatesBuffs: [bristleBuff2],
};

describe('Damage Buff Ability', () => {
    // TODO: test a DoT
    it('should increase the damage once', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(bristle);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].directDamage, 15057.71, 1);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Buffed
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].directDamage, 15057.71 * 1.5, 2);
        // Not buffed
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, 15057.71, 1);

    });
    it('should increase the damage once, other style', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(bristle2);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].directDamage, 15057.71, 2);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle2");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Buffed
        assert.equal(actualAbilities[2].ability.name, "Glare");
        assertClose(actualAbilities[2].directDamage, 15057.71 * 1.5, 2);
        // Not Buffed
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, 15057.71, 1);
    });
    it('should multiply direct damage and dots by default', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(dia);
        cp.advanceTo(27);
        cp.use(bristle);
        cp.advanceTo(30);
        cp.use(dia);
        cp.advanceTo(60);
        cp.use(dia);
        // Don't cut off the final dot
        cp.advanceTo(90);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        const dotDirect = 3150.95;
        const dotTotal = 37048.88;
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Dia");
        assertClose(actualAbilities[0].directDamage, dotDirect, 1);
        assertClose(actualAbilities[0].totalDamage, dotTotal, 1);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        assertClose(actualAbilities[1].totalDamage, 0, 1);
        // Buffed
        assert.equal(actualAbilities[2].ability.name, "Dia");
        assertClose(actualAbilities[2].directDamage, dotDirect * 1.5, 1);
        assertClose(actualAbilities[2].totalDamage, dotTotal * 1.5, 1);
        // Not Buffed
        assert.equal(actualAbilities[3].ability.name, "Dia");
        assertClose(actualAbilities[3].directDamage, dotDirect, 1);
        assertClose(actualAbilities[3].totalDamage, dotTotal, 1);
    });
    it('should filter abilities correctly', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(bristle);
        // Bristle does not apply to this
        cp.use(weaponSkill);
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Not buffed
        assert.equal(actualAbilities[0].ability.name, "Glare");
        assertClose(actualAbilities[0].directDamage, 15057.71, 1);
        // Buff
        assert.equal(actualAbilities[1].ability.name, "Bristle");
        assertClose(actualAbilities[1].directDamage, 0, 1);
        // Filtered, not buffed
        assert.equal(actualAbilities[2].ability.name, "WepSkill");
        assertClose(actualAbilities[2].directDamage, 15057.71, 1);
        // Buffed
        assert.equal(actualAbilities[3].ability.name, "Glare");
        assertClose(actualAbilities[3].directDamage, 15057.71 * 1.5, 2);
        // Not buffed
        assert.equal(actualAbilities[4].ability.name, "Glare");
        assertClose(actualAbilities[4].directDamage, 15057.71, 1);
    });
});

describe('Special record', () => {
    it('should be able to add and retrieve special records', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.use(filler);
        cp.use(Swiftcast);
        cp.use(filler);
        cp.addSpecialRow('Foo!');
        cp.use(filler);
        cp.addSpecialRow('Bar!', 60);
        // Hacky lazy workaround
        const displayRecords: readonly any[] = cp.finalizedRecords;
        // Not swifted
        assert.equal(displayRecords[0].ability.name, "Glare");
        assertClose(displayRecords[0].usedAt, -1.48);
        assertClose(displayRecords[0].original.appDelayFromStart, 1.48);
        assertClose(displayRecords[0].original.totalTimeTaken, 2.31);
        assertClose(displayRecords[0].original.lockTime, 1.48);
        assertClose(displayRecords[0].original.castTimeFromStart, 1.38);
        // Swiftcast
        assert.equal(displayRecords[1].ability.name, "Swiftcast");
        assertClose(displayRecords[1].usedAt, 0.0);
        assertClose(displayRecords[1].original.appDelayFromStart, 0.6);
        assertClose(displayRecords[1].original.totalTimeTaken, 0.6);
        assertClose(displayRecords[1].original.lockTime, 0.6);
        assertClose(displayRecords[1].original.castTimeFromStart, 0);
        // Swifted
        assert.equal(displayRecords[2].ability.name, "Glare");
        assertClose(displayRecords[2].usedAt, 0.83); // 0.83 === -1.48 + 2.31
        assertClose(displayRecords[2].original.appDelayFromStart, 0.6);
        assertClose(displayRecords[2].original.totalTimeTaken, 2.31);
        assertClose(displayRecords[2].original.lockTime, 0.6);
        assertClose(displayRecords[2].original.castTimeFromStart, 0);
        // SpecialRecord
        assert.equal(displayRecords[3].label, "Foo!");
        assertClose(displayRecords[3].usedAt, 1.43); // 1.43 === 0.83 + 0.6
        // Not swifted
        assert.equal(displayRecords[4].ability.name, "Glare");
        assertClose(displayRecords[4].usedAt, 3.14);
        assertClose(displayRecords[4].original.appDelayFromStart, 1.48);
        assertClose(displayRecords[4].original.totalTimeTaken, 2.31);
        assertClose(displayRecords[4].original.lockTime, 1.48);
        assertClose(displayRecords[4].original.castTimeFromStart, 1.38);
        // SpecialRecord
        assert.equal(displayRecords[5].label, "Bar!");
        assertClose(displayRecords[5].usedAt, 60);

    });
});

// TODO: another set of test, but with a GCD that doesn't evenly divide the cycle time, so that re-alignment
// can be checked.
const fixed: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Fixed",
    potency: 310,
    attackType: "Spell",
    gcd: 15,
    cast: 10,
    fixedGcd: true,
};
const fixedLonger: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Fixed Longer",
    potency: 310,
    attackType: "Spell",
    gcd: 20,
    cast: 16,
    fixedGcd: true,
};
describe('Cycle processor alignment options', () => {
    it('full alignment with non-cycle pre-pull', () => {
        // In this test, the CycleProcessor should start the first cycle post-combat-start, thus the first cycle should
        // be shorter so that it can end on the 30-second mark, but the rest of the cycles should be perfectly aligned
        // on 30-second increments.
        const cp = new CycleProcessor(defaultSettings);
        cp.use(fixed);
        cp.use(fixed);
        cp.remainingCycles(cp => {
            cp.useUntil(fixed, 'end');
        });
        // Hacky lazy workaround
        const displayRecords: readonly any[] = cp.finalizedRecords;
        assert.equal(displayRecords[0].ability.name, "Fixed");
        assertClose(displayRecords[0].usedAt, -10.1);
        assert.equal(displayRecords[1].ability.name, "Fixed");
        assertClose(displayRecords[1].usedAt, 4.9);

        assert.equal(displayRecords[2].label, "-- Start of Cycle --");
        assertClose(displayRecords[2].usedAt, 15);
        assert.equal(displayRecords[3].ability.name, "Fixed");
        assertClose(displayRecords[3].usedAt, 19.9);
        assert.equal(displayRecords[4].label, "-- End of Cycle --");
        assertClose(displayRecords[4].usedAt, 30);

        for (let i = 0; i < 3; i++) {
            const base = 5 + i * 4;
            assert.equal(displayRecords[base].label, "-- Start of Cycle --");
            assertClose(displayRecords[base].usedAt, 30 + 30 * i);
            assert.equal(displayRecords[base + 1].ability.name, "Fixed");
            assertClose(displayRecords[base + 1].usedAt, 34.9 + 30 * i);
            assert.equal(displayRecords[base + 2].ability.name, "Fixed");
            assertClose(displayRecords[base + 2].usedAt, 49.9 + 30 * i);
            assert.equal(displayRecords[base + 3].label, "-- End of Cycle --");
            assertClose(displayRecords[base + 3].usedAt, 60 + 30 * i);
        }
    });
    // In this test, the CycleProcessor should start the first cycle pre-combat-start, thus the first cycle should
    // be longer so that the first cycle can end on the 30-second mark, but the rest of the cycles should be perfectly
    // aligned on 30-second increments.
    it('full alignment with in-cycle pre-pull', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.remainingCycles(cp => {
            cp.useUntil(fixed, 'end');
        });
        // Hacky lazy workaround
        const displayRecords: readonly any[] = cp.finalizedRecords;
        assert.equal(displayRecords[0].label, "-- Start of Cycle --");
        assertClose(displayRecords[0].usedAt, -10.1);
        assert.equal(displayRecords[1].ability.name, "Fixed");
        assertClose(displayRecords[1].usedAt, -10.1);
        assert.equal(displayRecords[2].ability.name, "Fixed");
        assertClose(displayRecords[2].usedAt, 4.9);

        assert.equal(displayRecords[3].ability.name, "Fixed");
        assertClose(displayRecords[3].usedAt, 19.9);
        assert.equal(displayRecords[4].label, "-- End of Cycle --");
        assertClose(displayRecords[4].usedAt, 30);

        for (let i = 0; i < 3; i++) {
            const base = 5 + i * 4;
            assert.equal(displayRecords[base].label, "-- Start of Cycle --");
            assertClose(displayRecords[base].usedAt, 30 + 30 * i);
            assert.equal(displayRecords[base + 1].ability.name, "Fixed");
            assertClose(displayRecords[base + 1].usedAt, 34.9 + 30 * i);
            assert.equal(displayRecords[base + 2].ability.name, "Fixed");
            assertClose(displayRecords[base + 2].usedAt, 49.9 + 30 * i);
            assert.equal(displayRecords[base + 3].label, "-- End of Cycle --");
            assertClose(displayRecords[base + 3].usedAt, 60 + 30 * i);
        }
    });
    it('first-cycle alignment with out-of-cycle pre-pull', () => {
        // In this test, the CycleProcessor should start the first cycle post-combat-start, thus the first cycle should
        // be shorter so that it can end on the 30-second mark, but the rest of the cycles should be perfectly aligned
        // on 30-second increments.
        const cp = new CycleProcessor(defaultSettings);
        cp.cycleLengthMode = 'align-to-first';
        cp.use(fixed);
        cp.use(fixed);
        cp.remainingCycles(cp => {
            cp.useUntil(fixed, 'end');
        });
        // Hacky lazy workaround
        const displayRecords: readonly any[] = cp.finalizedRecords;
        assert.equal(displayRecords[0].ability.name, "Fixed");
        assertClose(displayRecords[0].usedAt, -10.1);
        assert.equal(displayRecords[1].ability.name, "Fixed");
        assertClose(displayRecords[1].usedAt, 4.9);

        for (let i = 0; i < 3; i++) {
            const base = 2 + i * 4;
            assert.equal(displayRecords[base].label, "-- Start of Cycle --");
            assertClose(displayRecords[base].usedAt, 15 + 30 * i);
            assert.equal(displayRecords[base + 1].ability.name, "Fixed");
            assertClose(displayRecords[base + 1].usedAt, 19.9 + 30 * i);
            assert.equal(displayRecords[base + 2].ability.name, "Fixed");
            assertClose(displayRecords[base + 2].usedAt, 34.9 + 30 * i);
            assert.equal(displayRecords[base + 3].label, "-- End of Cycle --");
            assertClose(displayRecords[base + 3].usedAt, 45 + 30 * i);
        }

        assert.equal(displayRecords[14].label, "-- Start of Cycle --");
        assertClose(displayRecords[14].usedAt, 105);
        assert.equal(displayRecords[15].ability.name, "Fixed");
        assertClose(displayRecords[15].usedAt, 109.9);
        assert.equal(displayRecords[16].label, "-- End of Cycle --");
        assertClose(displayRecords[16].usedAt, 120);
    });
    it('first-cycle alignment with in-cycle pre-pull', () => {
        // In this test, the CycleProcessor should start the first cycle post-combat-start, thus the first cycle should
        // be shorter so that it can end on the 30-second mark, but the rest of the cycles should be perfectly aligned
        // on 30-second increments.
        const cp = new CycleProcessor(defaultSettings);
        cp.cycleLengthMode = 'align-to-first';
        cp.oneCycle(cp => {
            // Longer GCD to make sure this actually takes up the full cycle time
            cp.use(fixedLonger);
            cp.useUntil(fixed, 'end');
        });
        cp.remainingCycles(cp => {
            cp.useUntil(fixed, 'end');
        });
        // Hacky lazy workaround
        const displayRecords: readonly any[] = cp.finalizedRecords;
        assert.equal(displayRecords[0].label, "-- Start of Cycle --");
        assertClose(displayRecords[0].usedAt, -16.1);
        assert.equal(displayRecords[1].ability.name, "Fixed Longer");
        assertClose(displayRecords[1].usedAt, -16.1);
        assert.equal(displayRecords[2].ability.name, "Fixed");
        assertClose(displayRecords[2].usedAt, 3.90);
        assert.equal(displayRecords[3].label, "-- End of Cycle --");
        assertClose(displayRecords[3].usedAt, 14.00);

        for (let i = 0; i < 3; i++) {
            const base = 4 + i * 4;
            assert.equal(displayRecords[base].label, "-- Start of Cycle --");
            assertClose(displayRecords[base].usedAt, 14 + 30 * i);
            assert.equal(displayRecords[base + 1].ability.name, "Fixed");
            assertClose(displayRecords[base + 1].usedAt, 18.9 + 30 * i);
            assert.equal(displayRecords[base + 2].ability.name, "Fixed");
            assertClose(displayRecords[base + 2].usedAt, 33.9 + 30 * i);
            assert.equal(displayRecords[base + 3].label, "-- End of Cycle --");
            assertClose(displayRecords[base + 3].usedAt, 44 + 30 * i);
        }

        assert.equal(displayRecords[16].label, "-- Start of Cycle --");
        assertClose(displayRecords[16].usedAt, 104);
        assert.equal(displayRecords[17].ability.name, "Fixed");
        assertClose(displayRecords[17].usedAt, 108.9);
        assert.equal(displayRecords[18].label, "-- End of Cycle --");
        assertClose(displayRecords[18].usedAt, 119);
    });
    it('full duration with non-cycle pre-pull', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.cycleLengthMode = 'full-duration';
        cp.use(fixed);
        cp.use(fixed);
        cp.remainingCycles(cp => {
            cp.useUntil(fixed, 'end');
        });
        // Hacky lazy workaround
        const displayRecords: readonly any[] = cp.finalizedRecords;
        assert.equal(displayRecords[0].ability.name, "Fixed");
        assertClose(displayRecords[0].usedAt, -10.1);
        assert.equal(displayRecords[1].ability.name, "Fixed");
        assertClose(displayRecords[1].usedAt, 4.9);

        for (let i = 0; i < 3; i++) {
            const base = 2 + i * 4;
            assert.equal(displayRecords[base].label, "-- Start of Cycle --");
            assertClose(displayRecords[base].usedAt, 15 + 30 * i);
            assert.equal(displayRecords[base + 1].ability.name, "Fixed");
            assertClose(displayRecords[base + 1].usedAt, 19.9 + 30 * i);
            assert.equal(displayRecords[base + 2].ability.name, "Fixed");
            assertClose(displayRecords[base + 2].usedAt, 34.9 + 30 * i);
            assert.equal(displayRecords[base + 3].label, "-- End of Cycle --");
            assertClose(displayRecords[base + 3].usedAt, 45 + 30 * i);
        }
        assert.equal(displayRecords[14].label, "-- Start of Cycle --");
        assertClose(displayRecords[14].usedAt, 105);
        assert.equal(displayRecords[15].ability.name, "Fixed");
        assertClose(displayRecords[15].usedAt, 109.9);
        assert.equal(displayRecords[16].label, "-- End of Cycle --");
        assertClose(displayRecords[16].usedAt, 120);

    });
    it('full duration with in-cycle pre-pull', () => {
        const cp = new CycleProcessor(defaultSettings);
        cp.cycleLengthMode = 'full-duration';
        cp.remainingCycles(cp => {
            cp.useUntil(fixed, 'end');
        });
        // Hacky lazy workaround
        const displayRecords: readonly any[] = cp.finalizedRecords;
        // This seems wrong (intuitively, the 'fixed' cycle should be exactly 30s), but in reality, it is correct,
        // since it has to end on an even GCD amount
        assert.equal(displayRecords[0].label, "-- Start of Cycle --");
        assertClose(displayRecords[0].usedAt, -10.1);
        assert.equal(displayRecords[1].ability.name, "Fixed");
        assertClose(displayRecords[1].usedAt, -10.1);
        assert.equal(displayRecords[2].ability.name, "Fixed");
        assertClose(displayRecords[2].usedAt, 4.9);

        assert.equal(displayRecords[3].ability.name, "Fixed");
        assertClose(displayRecords[3].usedAt, 19.9);
        assert.equal(displayRecords[4].label, "-- End of Cycle --");
        assertClose(displayRecords[4].usedAt, 30);

        for (let i = 0; i < 3; i++) {
            const base = 5 + i * 4;
            assert.equal(displayRecords[base].label, "-- Start of Cycle --");
            assertClose(displayRecords[base].usedAt, 30 + 30 * i);
            assert.equal(displayRecords[base + 1].ability.name, "Fixed");
            assertClose(displayRecords[base + 1].usedAt, 34.9 + 30 * i);
            assert.equal(displayRecords[base + 2].ability.name, "Fixed");
            assertClose(displayRecords[base + 2].usedAt, 49.9 + 30 * i);
            assert.equal(displayRecords[base + 3].label, "-- End of Cycle --");
            assertClose(displayRecords[base + 3].usedAt, 60 + 30 * i);
        }
    });
});

// GCD that doesn't evenly divide into a 30 second cycle time so that we can test drift behavior
const fixedOdd: GcdAbility = {
    id: fakeId++,
    type: 'gcd',
    name: "Fixed Odd",
    potency: 310,
    attackType: "Spell",
    gcd: 7,
    cast: 4,
    fixedGcd: true,
};

describe('Cycle processor re-alignment', () => {
    it('full alignment with non-cycle pre-pull', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 139,
        });
        cp.use(fixedOdd);
        cp.use(fixedOdd);
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const cycleRecords = cp.cycleRecords;
        // First cycle starts late due to pre-cycle GCDs
        assert.equal(cycleRecords[0].start, 7);
        assert.equal(cycleRecords[0].end, 35);

        // Drifts back since we started so late (28 second cycle)
        assert.equal(cycleRecords[1].start, 35);
        assert.equal(cycleRecords[1].end, 63);

        // Drift back again - 28 second cycle
        assert.equal(cycleRecords[2].start, 63);
        assert.equal(cycleRecords[2].end, 91);

        // Drift forward - 35 second cycle
        assert.equal(cycleRecords[3].start, 91);
        assert.equal(cycleRecords[3].end, 126);

        // Final cycle is cut off by total time
        assert.equal(cycleRecords[4].start, 126);
        assert.equal(cycleRecords[4].end, 140);

    });
    it('full alignment with in-cycle pre-pull', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 170,
        });
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const cycleRecords = cp.cycleRecords;
        // First cycle starts early due to pre-pull GCDs being in the cycle
        assert.equal(cycleRecords[0].start, -4.1);
        assert.equal(cycleRecords[0].end, 28);

        // Drifts forward (35 seconds)
        assert.equal(cycleRecords[1].start, 28);
        assert.equal(cycleRecords[1].end, 63);

        // Drift back - 28 second cycle
        assert.equal(cycleRecords[2].start, 63);
        assert.equal(cycleRecords[2].end, 91);

        // Drift forward - 35 second cycle
        assert.equal(cycleRecords[3].start, 91);
        assert.equal(cycleRecords[3].end, 126);

        // Drift back - 28 second cycle
        assert.equal(cycleRecords[4].start, 126);
        assert.equal(cycleRecords[4].end, 154);

        // Final cycle - cut off at 168 (170 end time) because it can't start another GCD in those two seconds
        assert.equal(cycleRecords[5].start, 154);
        assert.equal(cycleRecords[5].end, 168);
    });
    it('first-cycle alignment with out-of-cycle pre-pull', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 145,
        });
        cp.cycleLengthMode = 'align-to-first';
        cp.use(fixedOdd);
        cp.use(fixedOdd);
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const cycleRecords = cp.cycleRecords;
        // First cycle starts late due to pre-cycle GCDs
        // Unlike the first test, this one doesn't drift back - it uses 7 as the basis for itself and all future cycles,
        // rather than 0.
        assert.equal(cycleRecords[0].start, 7);
        // Notice how every value past this point is 7 higher than the values in the first test
        assert.equal(cycleRecords[0].end, 42);

        // Drifts back since we started so late (28 second cycle)
        assert.equal(cycleRecords[1].start, 42);
        assert.equal(cycleRecords[1].end, 70);

        // Drift back again - 28 second cycle
        assert.equal(cycleRecords[2].start, 70);
        assert.equal(cycleRecords[2].end, 98);

        // Drift forward - 35 second cycle
        assert.equal(cycleRecords[3].start, 98);
        assert.equal(cycleRecords[3].end, 133);

        // Final cycle is cut off by total time
        assert.equal(cycleRecords[4].start, 133);
        assert.equal(cycleRecords[4].end, 147);
    });
    it('first-cycle alignment with in-cycle pre-pull', () => {
        // In this test, the CycleProcessor should start the first cycle post-combat-start, thus the first cycle should
        // be shorter so that it can end on the 30-second mark, but the rest of the cycles should be perfectly aligned
        // on 30-second increments.
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 160,
        });
        cp.cycleLengthMode = 'align-to-first';
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const cycleRecords = cp.cycleRecords;
        // First cycle includes pre-pull
        // -4.1 is used as the basis for all future cycles
        assert.equal(cycleRecords[0].start, -4.1);
        assert.equal(cycleRecords[0].end, 28);

        // Drifts back since we started so late (28 second cycle)
        assert.equal(cycleRecords[1].start, 28);
        assert.equal(cycleRecords[1].end, 56);

        // Drift back again - 28 second cycle
        assert.equal(cycleRecords[2].start, 56);
        assert.equal(cycleRecords[2].end, 91);

        // Drift forward - 35 second cycle
        assert.equal(cycleRecords[3].start, 91);
        assert.equal(cycleRecords[3].end, 119);

        // Final cycle is cut off by total time
        assert.equal(cycleRecords[4].start, 119);
        assert.equal(cycleRecords[4].end, 147);

        // Cut off early
        assert.equal(cycleRecords[5].start, 147);
        assert.equal(cycleRecords[5].end, 161);
    });
    it('full duration with non-cycle pre-pull', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 300,
        });
        cp.cycleLengthMode = 'full-duration';
        cp.use(fixedOdd);
        cp.use(fixedOdd);
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const cycleRecords = cp.cycleRecords;
        // This one is simple. Every cycle is exactly 35 seconds, regardless of overall drift, except for the very
        // last cycle, which cuts early.
        for (let i = 0; i < 8; i++) {
            assert.equal(cycleRecords[i].start, 7 + 35 * i);
            assert.equal(cycleRecords[i].end, 7 + 35 * (i + 1));
        }
        assert.equal(cycleRecords[8].start, 287);
        assert.equal(cycleRecords[8].end, 301);
    });
    it('full duration with in-cycle pre-pull', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 295,
        });
        cp.cycleLengthMode = 'full-duration';
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const cycleRecords = cp.cycleRecords;
        // This one is simple. Every cycle is exactly 35 seconds, regardless of overall drift, except for the very
        // first cycle, and the last cycle, which cuts early.
        assert.equal(cycleRecords[0].start, -4.1);
        assert.equal(cycleRecords[0].end, 28);
        for (let i = 1; i < 8; i++) {
            assert.equal(cycleRecords[i].start, -7 + 35 * i);
            assert.equal(cycleRecords[i].end, -7 + 35 * (i + 1));
        }
        assert.equal(cycleRecords[8].start, 273);
        assert.equal(cycleRecords[8].end, 294);
    });
});


const indefBuff: Buff = {
    name: "Indefinite Buff",
    selfOnly: true,
    effects: {
        dmgIncrease: 4,
    },
    statusId: 2125,
};

const indefAb: Ability = {
    id: fakeId++,
    type: 'gcd',
    name: "Ability that applies Indefinite Buff",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    activatesBuffs: [indefBuff],

};

describe('indefinite buff handling', () => {
    it('can handle a manually applied indefinite buff', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 295,
        });
        cp.activateBuff(indefBuff);
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        for (let i = 0; i < actualAbilities.length; i++) {
            assert.equal(actualAbilities[i].combinedEffects.dmgMod, 5, `Index ${i}`);
        }
    });
    it('can handle an automatically applied indefinite buff', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            totalTime: 295,
        });
        cp.oneCycle(cp => {
            cp.use(filler);
            cp.use(indefAb);
            cp.useUntil(fixedOdd, 'end');

        });
        cp.remainingCycles(cp => {
            cp.useUntil(fixedOdd, 'end');
        });
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        assert.equal(actualAbilities[0].combinedEffects.dmgMod, 1);
        assert.equal(actualAbilities[1].combinedEffects.dmgMod, 1);
        for (let i = 2; i < actualAbilities.length; i++) {
            assert.equal(actualAbilities[i].combinedEffects.dmgMod, 5, `Index ${i}`);
        }
    });
});

const longDelay: GcdAbility = {
    type: 'gcd',
    name: "Glare",
    potency: 310,
    attackType: "Spell",
    gcd: 2.5,
    cast: 1.5,
    appDelay: 1.2,
    id: fakeId++,
};


describe('application delay', () => {
    it('should default if not specified', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 120,
            totalTime: 120,
        });
        cp.use(filler);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        assert.equal(actualAbilities[0].original.appDelay, STANDARD_APPLICATION_DELAY);
        assert.equal(actualAbilities[0].original.appDelayFromStart, STANDARD_APPLICATION_DELAY + actualAbilities[0].original.snapshotTimeFromStart);
        // Test that application delay correctly affects pre-pull timing
        assert.equal(actualAbilities[0].original.usedAt, -1 * (STANDARD_APPLICATION_DELAY + actualAbilities[0].original.snapshotTimeFromStart));

        assert.equal(actualAbilities[1].original.appDelay, STANDARD_APPLICATION_DELAY);
        assert.equal(actualAbilities[1].original.appDelayFromStart, STANDARD_APPLICATION_DELAY + actualAbilities[0].original.snapshotTimeFromStart);
        assert.equal(actualAbilities[1].original.usedAt, actualAbilities[0].original.usedAt + actualAbilities[0].original.totalTimeTaken);
    });
    it('should respect an override', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 120,
            totalTime: 120,
        });
        cp.use(longDelay);
        cp.use(longDelay);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        const delay = longDelay.appDelay;
        assert.equal(actualAbilities[0].original.appDelay, delay);
        assert.equal(actualAbilities[0].original.appDelayFromStart, delay + actualAbilities[0].original.snapshotTimeFromStart);
        // Test that application delay correctly affects pre-pull timing
        assert.equal(actualAbilities[0].original.usedAt, -1 * (delay + actualAbilities[0].original.snapshotTimeFromStart));

        assert.equal(actualAbilities[1].original.appDelay, delay);
        assert.equal(actualAbilities[1].original.appDelayFromStart, delay + actualAbilities[0].original.snapshotTimeFromStart);
        assert.equal(actualAbilities[1].original.usedAt, actualAbilities[0].original.usedAt + actualAbilities[0].original.totalTimeTaken);
    });
});

describe('gcd clipping check', () => {
    it('can check if an ogcd ability can be used without clipping', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 120,
            totalTime: 120,
        });
        cp.use(filler);
        let canUse = cp.canUseWithoutClipping(assize);
        assert.equal(canUse, true);

        cp.use(assize);
        canUse = cp.canUseWithoutClipping(pom);
        assert.equal(canUse, false);
    });
});

describe('potion logic', () => {
    it('reflects potions', () => {
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 120,
            totalTime: 120,
        });
        cp.use(filler);
        cp.use(gemdraught1mind);
        cp.use(filler);
        cp.advanceTo(100);
        cp.use(filler);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // console.log(actualAbilities);
        // Unbuffed skill
        assertClose(actualAbilities[0].directDamage, 15057.71, 0.01);
        // Buffed skill
        assertClose(actualAbilities[2].directDamage, 16627.44, 0.01);
        // Unbuffed skill after it falls off
        assertClose(actualAbilities[3].directDamage, 15057.71, 0.01);
    });

});

describe('cutoff modes', () => {
    it('supports default prorate-gcd mode', () => {
        // For this mode, the fight duration should be treated as 30 seconds, but the final GCD will be prorated
        // based on how much of the full GCD time (regardless of the cast time) would have fit.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'prorate-gcd',
        });
        cp.useUntil(filler, 50);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Should take up full time
        expect(cp.finalizedTimeBasis).to.equal(30);
        expect(actualAbilities).to.have.length(14);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // Final action should get prorated
        const finalAction = actualAbilities[13];
        expect(finalAction.usedAt).to.be.closeTo(28.55, 0.01);
        expect(finalAction.original.totalTimeTaken).to.be.closeTo(2.31, 0.01);
        // 0.6277 ~= (30 - 28.55) / 2.31
        expect(finalAction.partialRate).to.be.closeTo(0.6277, 0.01);
        expect(finalAction.directDamage).to.be.closeTo(9451.81, 0.1);
    });
    it('supports prorate-application mode', () => {
        // For this mode, the fight duration should be treated as 30 seconds, but the final GCD will be prorated
        // based on how much of the time between GCD start and application time would have fit into the remaining
        // fight duration.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'prorate-application',
        });
        cp.useUntil(filler, 50);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Should take up full time
        expect(cp.finalizedTimeBasis).to.equal(30);
        expect(actualAbilities).to.have.length(14);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // Final action should get prorated
        const finalAction = actualAbilities[13];
        expect(finalAction.usedAt).to.be.closeTo(28.55, 0.01);
        expect(finalAction.original.appDelayFromStart).to.be.closeTo(1.48, 0.01);
        // 0.9797 ~= (30 - 28.55) / 1.48
        expect(finalAction.partialRate).to.be.closeTo(0.9797, 0.01);
        expect(finalAction.directDamage).to.be.closeTo(14752.4865, 0.1);
    });
    it('supports lax-gcd mode', () => {
        // For this mode, the fight duration will be extended to fit the final GCD.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'lax-gcd',
        });
        cp.useUntil(filler, 50);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Fight length is extended to hold the final GCD
        expect(cp.finalizedTimeBasis).to.be.closeTo(30.8599, 0.01);
        expect(actualAbilities).to.have.length(14);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // Not prorated
        const finalAction = actualAbilities[13];
        expect(finalAction.usedAt).to.be.closeTo(28.55, 0.01);
        // Gets the full damage
        expect(finalAction.partialRate).to.be.null;
        expect(finalAction.directDamage).to.be.closeTo(15057.71, 0.1);
    });
    it('supports lax-gcd mode, with many oGCDs padding out the fight length', () => {
        // For this mode, the fight duration will be extended to fit the final GCD.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'lax-gcd',
        });
        cp.useUntil(filler, 50);
        cp.use(assize);
        cp.use(assize);
        cp.use(assize);
        cp.use(assize);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Fight length is extended to hold the final GCD and the clipping oGCDs
        expect(cp.finalizedTimeBasis).to.be.closeTo(31.23, 0.01);
        expect(actualAbilities).to.have.length(16);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // Final GCD should be full
        const finalGcd = actualAbilities[13];
        expect(finalGcd.usedAt).to.be.closeTo(28.55, 0.01);
        // Gets the full damage
        expect(finalGcd.partialRate).to.be.null;
        expect(finalGcd.directDamage).to.be.closeTo(15057.71, 0.1);
        // Final oGCD should be full
        const finalOGcd = actualAbilities[15];
        // We're still allowed to squeeze in more oGCDs because it's still weaved into a valid GCD
        expect(finalOGcd.usedAt).to.be.closeTo(30.63, 0.01);
        // Gets the full damage
        expect(finalOGcd.partialRate).to.be.null;
        expect(finalOGcd.directDamage).to.be.closeTo(19452.27, 0.1);
    });
    it('supports lax-gcd mode, with long casts', () => {
        // For this mode, the fight duration will be extended to fit the final GCD.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'lax-gcd',
        });
        cp.use(filler);
        cp.use(filler);
        cp.advanceTo(20);
        // This should fit entirely
        // Due to SpS, it gets a ~7.5s cast time
        cp.use(long);
        // This should also fit, but goes over time
        cp.use(long);
        // This should not fit, as it goes beyond where the previous GCD should have ended
        cp.use(assize);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Fight length is increased so that there it fits what would otherwise be a partial GCD at the end
        expect(cp.finalizedTimeBasis).to.be.closeTo(34.98, 0.01);
        expect(actualAbilities).to.have.length(4);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // full damage
        const finalAction = actualAbilities[3];
        expect(finalAction.usedAt).to.be.closeTo(27.49, 0.01);
        // Gets the full damage
        expect(finalAction.partialRate).to.be.null;
        expect(finalAction.directDamage).to.be.closeTo(15057.71, 0.1);
    });
    it('supports strict-gcd mode', () => {
        // In this mode, GCDs will be dropped entirely if they would not fit into the fight duration.
        // The fight duration is the time where that GCD would have started.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'strict-gcd',
        });
        cp.useUntil(filler, 50);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Fight length is reduced so that there is no partial GCD at the end
        expect(cp.finalizedTimeBasis).to.be.closeTo(28.55, 0.01);
        expect(actualAbilities).to.have.length(13);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // full damage
        const finalAction = actualAbilities[12];
        expect(finalAction.usedAt).to.be.closeTo(26.24, 0.01);
        // Gets the full damage
        expect(finalAction.partialRate).to.be.null;
        expect(finalAction.directDamage).to.be.closeTo(15057.71, 0.1);
    });
    it('supports strict-gcd mode, with oGCDs padding fight length', () => {
        // In this mode, GCDs will be dropped entirely if they would not fit into the fight duration.
        // The fight duration is the time where that GCD would have started.
        // This test checks behavior for when we drop more oGCDs than expected at the end (i.e. we would
        // be hard clipping the next GCD).
        // The current implementation allows a single over-time oGCD to count.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'strict-gcd',
        });
        cp.use(filler);
        cp.use(filler);
        cp.advanceTo(26);
        // This should fit entirely
        cp.use(filler);
        // But not all of these should fit
        cp.use(assize);
        cp.use(assize);
        cp.use(assize);
        cp.use(assize);
        cp.use(assize);
        cp.use(assize);
        // These should all be ignored completely
        cp.use(filler);
        cp.use(assize);
        cp.use(assize);
        cp.use(assize);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Fight length is reduced so that there is no partial GCD at the end
        expect(cp.finalizedTimeBasis).to.be.closeTo(30.480, 0.01);
        expect(actualAbilities).to.have.length(8);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // full damage
        const finalAction = actualAbilities[7];
        expect(finalAction.usedAt).to.be.closeTo(29.88, 0.01);
        // Gets the full damage
        expect(finalAction.partialRate).to.be.null;
        expect(finalAction.directDamage).to.be.closeTo(19452.27, 0.1);
    });
    it('supports strict-gcd mode, and does not allow long-cast GCDs to violate the time limit', () => {
        // In this mode, GCDs will be dropped entirely if they would not fit into the fight duration.
        // The fight duration is the time where that GCD would have started.
        // This test checks that cast time, in addition to recast (GCD) time, is factored in to this decision.
        const cp = new CycleProcessor({
            ...defaultSettings,
            cycleTime: 30,
            totalTime: 30,
            cutoffMode: 'strict-gcd',
        });
        cp.use(filler);
        cp.use(filler);
        cp.advanceTo(20);
        // This should fit entirely
        // Due to SpS, it gets a ~7.5s cast time
        cp.use(long);
        // This should not fit at all
        cp.use(long);
        cp.use(assize);
        const displayRecords = cp.finalizedRecords;
        const actualAbilities: FinalizedAbility[] = displayRecords.filter<FinalizedAbility>((record): record is FinalizedAbility => {
            return 'ability' in record;
        });
        // Fight length is reduced so that there is no partial GCD at the end
        expect(cp.finalizedTimeBasis).to.be.closeTo(27.49, 0.01);
        expect(actualAbilities).to.have.length(3);
        const firstAction = actualAbilities[0];
        expect(firstAction.partialRate).to.be.null;
        expect(firstAction.directDamage).to.be.closeTo(15057.71, 0.1);
        // full damage
        const finalAction = actualAbilities[2];
        expect(finalAction.usedAt).to.be.closeTo(20, 0.01);
        // Gets the full damage
        expect(finalAction.partialRate).to.be.null;
        expect(finalAction.directDamage).to.be.closeTo(15057.71, 0.1);
    });
});
