import {Ability, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import DRGGauge from "./drg_gauge";

/** Represents a Dragoon-specific Ability */
export type DrgAbility = Ability & Readonly<{
    /** Custom function to run to apply gauge updates relating to this ability */
    updateGauge?(gauge: DRGGauge): void,
}>;

/** Represents a Dragoon-specific GCD Ability */
export type DrgGcdAbility = GcdAbility & DrgAbility;

/** Represents a Dragoon-specific oGCD Ability */
export type DrgOgcdAbility = OgcdAbility & DrgAbility;

export type DRGGaugeState = {
    FirstmindsFocus: number
}

export type DRGExtraData = {
    gauge: DRGGaugeState,
};
