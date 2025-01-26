import {Buff, Ability, BuffController} from "@xivgear/core/sims/sim_types";

export const LifeSurge: Buff = {
    name: "Life Surge",
    selfOnly: true,
    effects: {
        critChanceIncrease: 1,
    },
    duration: 5,
    stacks: 1,
    statusId: 116,
};

export const LanceCharge: Buff = {
    name: "Lance Charge",
    selfOnly: true,
    effects: {
        dmgIncrease: 0.1,
    },
    duration: 20,
    statusId: 1864,
};

export const LifeOfTheDragon: Buff = {
    name: "Life of the Dragon",
    selfOnly: true,
    effects: {
        dmgIncrease: 0.15,
    },
    duration: 20,
    // No status ID due to being a hidden buff
};

export const NastrondReady: Buff = {
    name: "Nastrond Ready",
    selfOnly: true,
    effects: {

    },
    stacks: 3,
    duration: 20,
    statusId: 3844,
    beforeAbility: (controller: BuffController, ability: Ability) => {
        if (ability.name === "Nastrond") {
            controller.subtractStacksSelf(1);
        }
    },
};

export const DiveReady: Buff = {
    name: "Dive Ready",
    selfOnly: true,
    effects: {

    },
    stacks: 1,
    duration: 15,
    statusId: 1243,
    beforeAbility: (controller: BuffController, ability: Ability) => {
        if (ability.name === "Mirage Dive") {
            controller.removeSelf();
        }
    },
};

export const PowerSurge: Buff = {
    name: "Power Surge",
    selfOnly: true,
    effects: {
        dmgIncrease: 0.1,
    },
    duration: 30,
    statusId: 2720,
};
