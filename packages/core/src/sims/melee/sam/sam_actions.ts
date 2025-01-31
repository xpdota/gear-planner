import {Fugetsu, Fuka, MeikyoShisuiBuff} from "./sam_buffs";
import SAMGauge from "./sam_gauge";
import {KenkiAbility, SamGcdAbility, SamOgcdAbility} from "./sam_types";

/**
 * GCD Actions
 */
export const Gyofu: SamGcdAbility = {
    type: 'gcd',
    name: "Gyofu",
    id: 36963,
    attackType: "Weaponskill",
    potency: 240,
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: SAMGauge) => {
        gauge.kenkiGauge += 5;
    },
};

export const Yukikaze: SamGcdAbility = {
    type: 'gcd',
    name: "Yukikaze",
    id: 7480,
    attackType: "Weaponskill",
    potency: 340,
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: SAMGauge) => {
        gauge.kenkiGauge += 15;
        gauge.addSen("Setsu");
    },
};

export const Jinpu: SamGcdAbility = {
    type: 'gcd',
    name: "Jinpu",
    id: 7478,
    attackType: "Weaponskill",
    potency: 300,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [Fugetsu],
    updateGauge: (gauge: SAMGauge) => {
        gauge.kenkiGauge += 5;
    },
};

export const Shifu: SamGcdAbility = {
    type: 'gcd',
    name: "Shifu",
    id: 7479,
    attackType: "Weaponskill",
    potency: 300,
    gcd: 2.5,
    cast: 0,
    activatesBuffs: [Fuka],
    updateGauge: (gauge: SAMGauge) => {
        gauge.kenkiGauge += 5;
    },
};

export const Gekko: SamGcdAbility = {
    type: 'gcd',
    name: "Gekko",
    id: 7481,
    attackType: "Weaponskill",
    potency: 420,
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: SAMGauge) => {
        gauge.kenkiGauge += 10;
        gauge.addSen("Getsu");
    },
};

export const Kasha: SamGcdAbility = {
    type: 'gcd',
    name: "Kasha",
    id: 7482,
    attackType: "Weaponskill",
    potency: 420,
    gcd: 2.5,
    cast: 0,
    updateGauge: (gauge: SAMGauge) => {
        gauge.kenkiGauge += 10;
        gauge.addSen("Ka");
    },
};

export const MidareSetsugekka: SamGcdAbility = {
    type: 'gcd',
    name: "Midare Setsugekka",
    id: 7487,
    attackType: "Weaponskill",
    potency: 640,
    autoCrit: true,
    fixedCast: true,
    gcd: 2.5,
    cast: 1.3,
    updateGauge: (gauge: SAMGauge) => {
        gauge.meditation++;
        gauge.spendSen();
    },
};

export const KaeshiSetsugekka: SamGcdAbility = {
    type: 'gcd',
    name: "Kaeshi: Setsugekka",
    id: 16486,
    attackType: "Weaponskill",
    potency: 640,
    autoCrit: true,
    gcd: 2.5,
    cast: 0,
};

export const TendoSetsugekka: SamGcdAbility = {
    type: 'gcd',
    name: "Tendo Setsugekka",
    id: 36966,
    attackType: "Weaponskill",
    potency: 1020,
    autoCrit: true,
    fixedCast: true,
    gcd: 2.5,
    cast: 1.3,
    updateGauge: (gauge: SAMGauge) => {
        gauge.meditation++;
        gauge.spendSen();
    },
};

export const TendoKaeshiSetsugekka: SamGcdAbility = {
    type: 'gcd',
    name: "Tendo Kaeshi Setsugekka",
    id: 36968,
    attackType: "Weaponskill",
    potency: 1020,
    autoCrit: true,
    gcd: 2.5,
    cast: 0,
};

export const Higanbana: SamGcdAbility = {
    type: 'gcd',
    name: "Higanbana",
    id: 7489,
    attackType: "Weaponskill",
    potency: 200,
    dot: {
        id: 1228,
        duration: 60,
        tickPotency: 50,
    },
    fixedCast: true,
    gcd: 2.5,
    cast: 1.3,
    updateGauge: (gauge: SAMGauge) => {
        gauge.meditation++;
        gauge.spendSen();
    },
};

export const OgiNamikiri: SamGcdAbility = {
    type: 'gcd',
    name: "Ogi Namikiri",
    id: 25781,
    attackType: "Weaponskill",
    potency: 900,
    autoCrit: true,
    fixedCast: true,
    gcd: 2.5,
    cast: 1.3,
    updateGauge: gauge => gauge.meditation++,
};

export const KaeshiNamikiri: SamGcdAbility = {
    type: 'gcd',
    name: "Kaeshi: Namikiri",
    id: 25782,
    attackType: "Weaponskill",
    potency: 900,
    autoCrit: true,
    gcd: 2.5,
    cast: 0,
    updateGauge: gauge => gauge.meditation++,
};

export const Enpi: SamGcdAbility = {
    type: 'gcd',
    name: "Enpi",
    id: 7486,
    attackType: "Weaponskill",
    potency: 270,
    gcd: 2.5,
    cast: 0,
    updateGauge: gauge => gauge.kenkiGauge += 10,
};

/**
 * Off GCD Actions
 */
export const Shoha: SamOgcdAbility = {
    type: 'ogcd',
    name: "Shoha",
    id: 16487,
    attackType: "Ability",
    potency: 640,
    updateGauge: gauge => gauge.spendMeditation(),
};

export const Zanshin: KenkiAbility = {
    type: 'ogcd',
    name: "Zanshin",
    id: 36964,
    attackType: "Ability",
    potency: 900,
    updateGauge: gauge => gauge.kenkiGauge -= 50,
    kenkiCost: 50,
};

export const HissatsuShinten: KenkiAbility = {
    type: 'ogcd',
    name: "Hissatsu: Shinten",
    id: 7490,
    attackType: "Ability",
    potency: 250,
    updateGauge: gauge => gauge.kenkiGauge -= 25,
    kenkiCost: 25,
};

export const HissatsuSenei: KenkiAbility = {
    type: 'ogcd',
    name: "Hissatsu: Senei",
    id: 16481,
    attackType: "Ability",
    potency: 800,
    cooldown: {
        time: 60,
    },
    updateGauge: gauge => gauge.kenkiGauge -= 25,
    kenkiCost: 25,
};

export const HissatsuGyoten: KenkiAbility = {
    type: 'ogcd',
    name: "Hissatsu: Gyoten",
    id: 7492,
    attackType: "Ability",
    potency: 100,
    cooldown: {
        time: 5,
    },
    updateGauge: gauge => gauge.kenkiGauge -= 10,
    kenkiCost: 10,
};

export const HissatsuYaten: KenkiAbility = {
    type: 'ogcd',
    name: "Hissatsu: Yaten",
    id: 7493,
    attackType: "Ability",
    potency: 100,
    cooldown: {
        time: 10,
    },
    updateGauge: gauge => gauge.kenkiGauge -= 10,
    kenkiCost: 10,
};

export const Ikishoten: SamOgcdAbility = {
    type: 'ogcd',
    name: "Ikishoten",
    id: 16482,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 120,
    },
    updateGauge: gauge => gauge.kenkiGauge += 50,
    activatesBuffs: [],
};

export const MeikyoShisui: SamOgcdAbility = {
    type: 'ogcd',
    name: "Meikyo Shisui",
    id: 7499,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 55,
        charges: 2,
    },
    activatesBuffs: [MeikyoShisuiBuff],
};

export const Hagakure: SamOgcdAbility = {
    type: 'ogcd',
    name: "Hagakure",
    id: 7495,
    attackType: "Ability",
    potency: null,
    cooldown: {
        time: 5,
    },
    updateGauge: (gauge: SAMGauge) => {
        gauge.kenkiGauge += gauge.sen.size * 10;
        gauge.spendSen();
    },
};
