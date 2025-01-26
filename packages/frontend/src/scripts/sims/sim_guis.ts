import {ExportSettingsTypeOfSim, ResultTypeOfSim, SettingsTypeOfSim, SimulationGui} from "./simulation_gui";
import {SimResult, SimSpec, Simulation} from "@xivgear/core/sims/sim_types";

import {PotencyRatioSimGui} from "./common/potency_ratio_ui";
import {BaseUsageCountSimGui} from "./count_sim_gui";
import {WhmSheetSimGui} from "./healer/whm_sheet_sim_ui";
import {SgeSheetSimGui} from "./healer/sge_sheet_sim_mk2_ui";
import {AstSheetSimGui} from "./healer/ast_sheet_sim_ui";
import {SchSimGui} from "./healer/sch_sheet_sim_ui";
import {WhmSimGui} from "./healer/whm_new_sheet_sim_ui";
import {RprSheetSimGui} from "./melee/rpr/rpr_sheet_sim_ui";
import {VprSimGui} from "./melee/vpr/vpr_sheet_sim_ui";
import {DRG90SimGui} from "./melee/drg/drg_90_sim_ui";
import {NinSheetSimGui} from "./melee/nin/nin_lvl100_sim_ui";
import {MnkSimGui} from "./melee/mnk/mnk_sim_ui";
import {SamSimGui} from "./melee/sam/sam_lvl100_sim_ui";
import {SgeSimGui} from "./healer/sge_sheet_sim_ui";
import {BluSimGui} from "./blu/blu_common_ui";
import {DrkSimGui} from "./tank/drk_sheet_sim_ui";
import {WarSimGui} from "./tank/war_sheet_sim_ui";
import {GnbSimGui} from "./tank/gnb_sheet_sim_ui";
import {PldSimGui} from "./tank/pld_sheet_sim_ui";
import {pldSKSSimGui} from "./tank/pldsks_sheet_sim_ui";
import {MPSimGui} from "./healer/healer_mp_sim_ui";

import {astNewSheetSpec} from "@xivgear/core/sims/healer/ast_sheet_sim";
import {schNewSheetSpec} from "@xivgear/core/sims/healer/sch_sheet_sim";
import {sgeSheetSpec} from "@xivgear/core/sims/healer/sge_sheet_sim";
import {sgeNewSheetSpec} from "@xivgear/core/sims/healer/sge_sheet_sim_mk2";
import {whmNewSheetSpec} from "@xivgear/core/sims/healer/whm_new_sheet_sim";
import {whmSheetSpec} from "@xivgear/core/sims/healer/whm_sheet_sim";
import {ninSpec} from "@xivgear/core/sims/melee/nin/nin_lv100_sim";
import {mnkSpec} from "@xivgear/core/sims/melee/mnk/mnk_sim";
import {drg90SimSpec} from "@xivgear/core/sims/melee/drg/drg_90_sim";
import {rprSheetSpec} from "@xivgear/core/sims/melee/rpr/rpr_sheet_sim";
import {samSpec} from "@xivgear/core/sims/melee/sam/sam_lv100_sim";
import {vprSheetSpec} from "@xivgear/core/sims/melee/vpr/vpr_sheet_sim";
import {dncDtSheetSpec} from "@xivgear/core/sims/ranged/dnc_sim";
import {pldUsageSimSpec} from "@xivgear/core/sims/tank/pld/pld_usage_sim_no_sks";
import {warSpec} from "@xivgear/core/sims/tank/war/war_sheet_sim";
import {drkSpec} from "@xivgear/core/sims/tank/drk/drk_sheet_sim";
import {gnbSpec} from "@xivgear/core/sims/tank/gnb/gnb_sheet_sim";
import {pldSpec} from "@xivgear/core/sims/tank/pld/pld_sheet_sim";
import {pldSKSSheetSpec} from "@xivgear/core/sims/tank/pld/pldsks_sim";
import {BluBreath60Spec} from "@xivgear/core/sims/blu/blu_breath60";
import {BluFlame120Spec} from "@xivgear/core/sims/blu/blu_flame120";
import {BluFlame60Spec} from "@xivgear/core/sims/blu/blu_flame60";
import {BluF2PSpec} from "@xivgear/core/sims/blu/blu_free_trial";
import {BluWinged120Spec} from "@xivgear/core/sims/blu/blu_winged120";
import {BluWinged60Spec} from "@xivgear/core/sims/blu/blu_winged60";
import {potRatioSimSpec} from "@xivgear/core/sims/common/potency_ratio";
import {mpSimSpec} from "@xivgear/core/sims/healer/healer_mp";


type SimGuiCtor<X extends Simulation<SimResult, unknown, unknown>> = {
    new(sim: X): SimulationGui<ResultTypeOfSim<X>, SettingsTypeOfSim<X>, ExportSettingsTypeOfSim<X>>;
}

function registerGui<X extends Simulation<SimResult, unknown, unknown>>(simSpec: SimSpec<X, unknown>, guiCtor: SimGuiCtor<X>) {
    simGuiMap.set(simSpec as SimSpec<never, never>, guiCtor as SimGuiCtor<never>);
}

function getGuiCtor<X extends Simulation<never, never, never>>(simSpec: SimSpec<X, never>): SimGuiCtor<X> {
    return simGuiMap.get(simSpec as SimSpec<never, never>);
}

/**
 * Given a simulation, construct a {@link SimulationGui} instance most appropriate for that sim.
 *
 * @param sim The simulation
 */
export function makeGui<X extends Simulation<SimResult, unknown, unknown>>(sim: X): SimulationGui<ResultTypeOfSim<X>, SettingsTypeOfSim<X>, ExportSettingsTypeOfSim<X>> {
    const ctor: SimGuiCtor<X> = getGuiCtor(sim.spec);
    return new ctor(sim);
}

export const simGuiMap: Map<SimSpec<never, never>, SimGuiCtor<never>> = new Map;

// General
registerGui(potRatioSimSpec, PotencyRatioSimGui);
// Tanks
registerGui(pldUsageSimSpec, BaseUsageCountSimGui);
registerGui(pldSKSSheetSpec, pldSKSSimGui);
registerGui(drkSpec, DrkSimGui);
registerGui(warSpec, WarSimGui);
registerGui(gnbSpec, GnbSimGui);
registerGui(pldSpec, PldSimGui);
// Healers
registerGui(whmSheetSpec, WhmSheetSimGui);
registerGui(sgeSheetSpec, SgeSimGui);
registerGui(sgeNewSheetSpec, SgeSheetSimGui);
registerGui(astNewSheetSpec, AstSheetSimGui);
registerGui(schNewSheetSpec, SchSimGui);
registerGui(whmNewSheetSpec, WhmSimGui);
registerGui(mpSimSpec, MPSimGui);
// Melee
registerGui(drg90SimSpec, DRG90SimGui);
registerGui(rprSheetSpec, RprSheetSimGui);
registerGui(vprSheetSpec, VprSimGui);
registerGui(ninSpec, NinSheetSimGui);
registerGui(mnkSpec, MnkSimGui);
registerGui(samSpec, SamSimGui);
// Ranged
registerGui(dncDtSheetSpec, BaseUsageCountSimGui);
// Caster
registerGui(BluWinged120Spec, BluSimGui);
registerGui(BluFlame120Spec, BluSimGui);
registerGui(BluBreath60Spec, BluSimGui);
registerGui(BluWinged60Spec, BluSimGui);
registerGui(BluFlame60Spec, BluSimGui);
registerGui(BluF2PSpec, BluSimGui);
