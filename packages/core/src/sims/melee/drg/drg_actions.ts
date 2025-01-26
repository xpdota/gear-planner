import {DiveReady, LanceCharge, LifeOfTheDragon, LifeSurge, NastrondReady, PowerSurge} from './drg_buffs';
import {Litany} from '@xivgear/core/sims/buffs';
import DRGGauge from './drg_gauge';
import {DrgGcdAbility, DrgOgcdAbility} from './drg_types';

export const TrueThrust: DrgGcdAbility = {
    type: 'gcd',
    name: "True Thrust",
    id: 75,
    attackType: "Weaponskill",
    potency: 230,
    gcd: 2.5,
    cast: 0,
};

export const VorpalThrust: DrgGcdAbility = {
    type: 'gcd',
    name: "Vorpal Thrust",
    id: 78,
    attackType: "Weaponskill",
    potency: 280,
    gcd: 2.5,
    cast: 0,
};

export const HeavensThrust: DrgGcdAbility = {
    type: 'gcd',
    name: "Heavens' Thrust",
    id: 25771,
    attackType: "Weaponskill",
    potency: 400,
    gcd: 2.5,
    cast: 0,
};

export const FangAndClaw: DrgGcdAbility = {
    type: 'gcd',
    name: "Fang and Claw",
    id: 3554,
    attackType: "Weaponskill",
    potency: 300,
    gcd: 2.5,
    cast: 0,
};

export const Drakesbane: DrgGcdAbility = {
    type: 'gcd',
    name: "Drakesbane",
    id: 36952,
    attackType: "Weaponskill",
    potency: 400,
    gcd: 2.5,
    cast: 0,
};

export const RaidenThrust: DrgGcdAbility = {
    type: 'gcd',
    name: "Raiden Thrust",
    id: 16479,
    attackType: "Weaponskill",
    potency: 280,
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: DRGGauge) => {
        gauge.addFirstmindsFocus();
    },
};

export const Disembowel: DrgGcdAbility = {
    type: 'gcd',
    name: "Disembowel",
    id: 87,
    attackType: "Weaponskill",
    potency: 250,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [PowerSurge],
};

export const ChaoticSpring: DrgGcdAbility = {
    type: 'gcd',
    name: "Chaotic Spring",
    id: 25772,
    attackType: "Weaponskill",
    potency: 300,
    gcd: 2.5,
    cast: 0,
    dot: {
        tickPotency: 45,
        duration: 24,
        id: 0,
    },
};

export const WheelingThrust: DrgGcdAbility = {
    type: 'gcd',
    name: "Wheeling Thrust",
    id: 3556,
    attackType: "Weaponskill",
    potency: 300,
    gcd: 2.5,
    cast: 0,
};

export const LifeSurgeAction: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Life Surge",
    id: 83,
    potency: 0,
    cooldown: {
        time: 40,
        charges: 2,
    },
    attackType: 'Ability',
    activatesBuffs: [LifeSurge],
};

export const LanceChargeAction: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Lance Charge",
    id: 85,
    potency: 0,
    cooldown: {
        time: 60,
    },
    attackType: 'Ability',
    activatesBuffs: [LanceCharge],
};

export const DragonfireDive: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Dragonfire Dive",
    id: 96,
    potency: 500,
    cooldown: {
        time: 120,
    },
    attackType: 'Ability',
};

export const BattleLitany: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Battle Litany",
    id: 3557,
    potency: 0,
    cooldown: {
        time: 120,
    },
    attackType: 'Ability',
    activatesBuffs: [Litany],
};

export const Geirskogul: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Geirskogul",
    id: 3555,
    potency: 280,
    cooldown: {
        time: 60,
    },
    attackType: 'Ability',
    activatesBuffs: [NastrondReady, LifeOfTheDragon],
};

export const Nastrond: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Nastrond",
    id: 7400,
    potency: 360,
    attackType: 'Ability',
    cooldown: {
        time: 2,
    },
};

export const MirageDive: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Mirage Dive",
    id: 7399,
    potency: 200,
    attackType: 'Ability',
};

export const HighJump: DrgOgcdAbility = {
    type: 'ogcd',
    name: "High Jump",
    id: 16478,
    potency: 400,
    attackType: 'Ability',
    cooldown: {
        time: 30,
    },
    activatesBuffs: [DiveReady],
};

export const Stardiver: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Stardiver",
    id: 18780,
    potency: 620,
    attackType: 'Ability',
    cooldown: {
        time: 30,
    },
};

export const WyrmwindTrust: DrgOgcdAbility = {
    type: 'ogcd',
    name: "Wyrmwind Trust",
    id: 25773,
    potency: 420,
    attackType: 'Ability',
    cooldown: {
        time: 10,
    },
    updateGauge: gauge => gauge.spendFirstmindsFocus(),
};
