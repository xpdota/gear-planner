import {Ability, OgcdAbility, Buff, SimSettings, SimSpec} from "@xivgear/core/sims/sim_types";
import {CycleProcessor, CycleSimResult, ExternalCycleSettings, MultiCycleSettings, AbilityUseResult, Rotation, PreDmgAbilityUseRecordUnf} from "@xivgear/core/sims/cycle_sim";
import {potionMaxStr} from "@xivgear/core/sims/common/potion";
import DRGGauge from "./drg_gauge";
import {DrgAbility, DrgGcdAbility, DRGExtraData} from "./drg_types";
import * as Actions from './drg_actions';
import * as Buffs from './drg_buffs';
import {BaseMultiCycleSim} from "@xivgear/core/sims/processors/sim_processors";
import {CharacterGearSet} from "../../../gear";

export interface DRG90SimSettings extends SimSettings {

}

export interface DRG90SimResult extends CycleSimResult {

}

export interface DRG90SettingsExternal extends ExternalCycleSettings<DRG90SimSettings> {

}

export const drg90SimSpec: SimSpec<Drg90Sim, DRG90SettingsExternal> = {
    stub: "drg-top-sim",
    displayName: "DRG Ultimate LvL 90 Sim",
    makeNewSimInstance: function (): Drg90Sim {
        return new Drg90Sim();
    },
    loadSavedSimInstance: function (exported: DRG90SettingsExternal): Drg90Sim {
        return new Drg90Sim(exported);
    },
    supportedJobs: ["DRG"],
    supportedLevels: [90],
    isDefaultSim: false,
    maintainers: [{
        name: "WildWolf",
        contact: [{
            type: "discord",
            discordTag: "wildwolf",
            discordUid: "108974906472955904",
        }],
    }],
};

enum ComboState {
    None,
    VorpalThrust,
    HeavensThrust,
    FangAndClaw,
    Disembowel,
    ChaoticSpring,
    WheelingThrust,
    Drakesbane,
    RaidenThrust
}

class RotationState {
    private _combo: ComboState;
    get combo() {
        return this._combo;
    }
    set combo(value: ComboState) {
        this._combo = value;
    }
    private _lastCombo: ComboState;
    get lastCombo() {
        return this._lastCombo;
    }
    set lastCombo(value: ComboState) {
        this._lastCombo = value;
    }
}

export class DRG90CycleProcessor extends CycleProcessor {
    rotationState: RotationState;
    gauge: DRGGauge;

    constructor(settings: MultiCycleSettings) {
        super(settings);
        this.cycleLengthMode = 'full-duration';
        this.rotationState = new RotationState();
        this.rotationState.combo = ComboState.None;
        this.rotationState.lastCombo = ComboState.None;
        this.gauge = new DRGGauge();
    }

    getBuffIfActive(buff: Buff): Buff {
        return this.getActiveBuffs().find(b => buff.name === b.name);
    }

    override activateBuffWithDelay(buff: Buff, delay: number): void {
        if (buff.selfOnly && buff.stacks && this.getBuffIfActive(buff))
            return;

        super.activateBuffWithDelay(buff, delay);
    }

    protected override addAbilityUse(usedAbility: PreDmgAbilityUseRecordUnf): void {
        const extraData: DRGExtraData = {
            gauge: this.gauge.getGaugeState(),
        };

        const modified: PreDmgAbilityUseRecordUnf = {
            ...usedAbility,
            extraData,
        };

        super.addAbilityUse(modified);
    }

    override useOgcd(ability: OgcdAbility): AbilityUseResult {
        if (this.canUseWithoutClipping(ability)) {
            const readyAt = this.cdTracker.statusOf(ability).readyAt.absolute;
            if (this.totalTime > readyAt)
                this.advanceTo(readyAt);
        }
        return this.cdTracker.canUse(ability) ? super.useOgcd(ability) : null;
    }

    override use(ability: Ability): AbilityUseResult {
        const drgAbility = ability as DrgAbility;
        if (drgAbility.updateGauge !== undefined) {
            if (ability.type === 'gcd' && this.nextGcdTime > this.currentTime) {
                this.advanceTo(this.nextGcdTime);
            }
            drgAbility.updateGauge(this.gauge);
        }

        const result = super.use(ability);

        if (this.getBuffIfActive(Buffs.LifeSurge) && ability.attackType === 'Weaponskill')
            this.removeBuff(Buffs.LifeSurge);

        return result;
    }

    useCombo(): AbilityUseResult {
        let fillerAction: DrgGcdAbility;
        switch (this.rotationState.combo) {
            case ComboState.None:
                fillerAction = Actions.VorpalThrust;
                this.rotationState.lastCombo = ComboState.VorpalThrust;
                break;
            case ComboState.VorpalThrust:
                fillerAction = Actions.HeavensThrust;
                break;
            case ComboState.Disembowel:
                fillerAction = Actions.ChaoticSpring;
                break;
            case ComboState.HeavensThrust:
                fillerAction = Actions.FangAndClaw;
                break;
            case ComboState.ChaoticSpring:
                fillerAction = Actions.WheelingThrust;
                break;
            case ComboState.FangAndClaw:
                fillerAction = Actions.Drakesbane;
                this.rotationState.combo = ComboState.WheelingThrust;
                break;
            case ComboState.WheelingThrust:
                fillerAction = Actions.Drakesbane;
                break;
            case ComboState.Drakesbane:
                fillerAction = Actions.RaidenThrust;
                break;
            case ComboState.RaidenThrust:
                switch (this.rotationState.lastCombo) {
                    case ComboState.VorpalThrust:
                        fillerAction = Actions.Disembowel;
                        this.rotationState.lastCombo = ComboState.Disembowel;
                        this.rotationState.combo = ComboState.FangAndClaw;
                        break;
                    case ComboState.Disembowel:
                        fillerAction = Actions.VorpalThrust;
                        this.rotationState.lastCombo = ComboState.VorpalThrust;
                        this.rotationState.combo = ComboState.None;
                        break;
                }
                break;
            default:
                fillerAction = Actions.TrueThrust;
                break;
        }

        this.rotationState.combo = ((this.rotationState.combo as number) + 1) as ComboState;

        return this.useGcd(fillerAction);
    }

    useOgcdInOrder(order: OgcdAbility[], idx: number): number {
        this.useOgcd(order[idx]);
        return idx++;
    }

    useOpener(pot: boolean) {
        if (this.rotationState.combo === ComboState.None) {
            this.useGcd(Actions.TrueThrust);
        }
        else {
            this.useCombo();
        }

        this.useCombo();
        this.useOgcd(Actions.LanceChargeAction);
        if (pot)
            this.useOgcd(potionMaxStr);

        this.useCombo();
        this.useOgcd(Actions.BattleLitany);
        this.useOgcd(Actions.Geirskogul);

        this.useCombo();
        this.useOgcd(Actions.HighJump);
        this.useOgcd(Actions.LifeSurgeAction);

        this.useCombo();
        this.useOgcd(Actions.DragonfireDive);
        this.useOgcd(Actions.Nastrond);

        this.useCombo();
        this.useOgcd(Actions.Stardiver);

        this.useCombo();
        this.useOgcd(Actions.LifeSurgeAction);

        this.useCombo();
        this.useOgcd(Actions.Nastrond);

        this.useCombo();
        this.useOgcd(Actions.Nastrond);
        this.useOgcd(Actions.MirageDive);

        this.useCombo();

        this.useCombo();
        this.useOgcd(Actions.WyrmwindTrust);

        this.useCombo();
    }

    useOgcdCooldown() {
        if (this.rotationState.combo === ComboState.FangAndClaw || this.rotationState.combo === ComboState.WheelingThrust || this.rotationState.combo === ComboState.VorpalThrust && this.timeUntilReady(Actions.LifeSurgeAction) <= 0)
            this.useOgcd(Actions.LifeSurgeAction);
        else if (this.gauge.FirstmindsFocus === 2 && this.timeUntilReady(Actions.WyrmwindTrust) <= 0)
            this.useOgcd(Actions.WyrmwindTrust);
        else if (this.timeUntilReady(Actions.LanceChargeAction) <= 0)
            this.useOgcd(Actions.LanceChargeAction);
        else if (this.timeUntilReady(Actions.BattleLitany) <= 0)
            this.useOgcd(Actions.BattleLitany);
        else if (this.timeUntilReady(Actions.Geirskogul) <= 0)
            this.useOgcd(Actions.Geirskogul);
        else if (this.timeUntilReady(Actions.HighJump) <= 0)
            this.useOgcd(Actions.HighJump);
        else if (this.timeUntilReady(Actions.DragonfireDive) <= 0)
            this.useOgcd(Actions.DragonfireDive);
        else if (this.timeUntilReady(Actions.Nastrond) <= 0 && !!this.getBuffIfActive(Buffs.NastrondReady))
            this.useOgcd(Actions.Nastrond);
        else if (this.timeUntilReady(Actions.Stardiver) <= 0 && !!this.getBuffIfActive(Buffs.LifeOfTheDragon))
            this.useOgcd(Actions.Stardiver);
        else if (this.timeUntilReady(Actions.MirageDive) <= 0 && !!this.getBuffIfActive(Buffs.DiveReady))
            this.useOgcd(Actions.MirageDive);
    }
}

export class Drg90Sim extends BaseMultiCycleSim<DRG90SimResult, DRG90SimSettings, DRG90CycleProcessor> {
    displayName = drg90SimSpec.displayName;
    shortName = drg90SimSpec.stub;
    spec = drg90SimSpec;
    constructor(settings?: DRG90SettingsExternal) {
        super('DRG', settings);
    }
    makeDefaultSettings(): DRG90SimSettings {
        return {};
    }
    protected createCycleProcessor(settings: MultiCycleSettings): DRG90CycleProcessor {
        return new DRG90CycleProcessor({
            ...settings,
            hideCycleDividers: true,
        });
    }
    getRotationsToSimulate(set: CharacterGearSet): Rotation<DRG90CycleProcessor>[] {
        return [{
            cycleTime: 120,
            apply(cp: DRG90CycleProcessor) {
                const numPots = Math.ceil(cp.remainingTime / 360); // Force pots during 2mins
                const maxAllowableDelay = cp.remainingTime - ((numPots - 1) * 360);
                const potOpener = maxAllowableDelay <= 120;
                cp.useOpener(potOpener);

                cp.remainingCycles(() => {
                    cp.useCombo();

                    cp.useOgcdCooldown();
                    cp.useOgcdCooldown();
                });
            },
        }];
    }

}
