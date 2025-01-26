import {CycleSimResult, DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {PreDmgUsedAbility} from "@xivgear/core/sims/sim_types";
import {CustomColumnSpec} from "../../../tables";
import {AbilitiesUsedTable} from "../../components/ability_used_table";
import {BaseMultiCycleSimGui} from "../../multicyclesim_ui";
import {DRG90SimResult, DRG90SimSettings} from "@xivgear/core/sims/melee/drg/drg_90_sim";
import {DRGExtraData} from "@xivgear/core/sims/melee/drg/drg_types";

class DRGGaugeGui {

    static generateResultColumns(result: CycleSimResult): CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] {
        return [{
            shortName: 'firstmindsFocus',
            displayName: 'Firstminds Focus',
            getter: used => isFinalizedAbilityUse(used) ? used.original : null,
            renderer: (usedAbility?: PreDmgUsedAbility) => {
                if (usedAbility?.extraData !== undefined) {
                    const firstmindsFocus = (usedAbility.extraData as DRGExtraData).gauge.FirstmindsFocus;

                    const div = document.createElement('div');
                    div.style.height = '100%';
                    div.style.display = 'flex';
                    div.style.alignItems = 'center';
                    div.style.gap = '6px';
                    div.style.padding = '2px 0 2px 0';
                    div.style.boxSizing = 'border-box';

                    const span = document.createElement('span');
                    span.textContent = `${firstmindsFocus}`;

                    const barOuter = document.createElement('div');
                    barOuter.style.borderRadius = '20px';
                    barOuter.style.background = '#00000033';
                    barOuter.style.width = '120px';
                    barOuter.style.height = 'calc(100% - 3px)';
                    barOuter.style.display = 'inline-block';
                    barOuter.style.overflow = 'hidden';
                    barOuter.style.border = '1px solid black';

                    const barInner = document.createElement('div');
                    barInner.style.backgroundColor = '#DB5858';
                    barInner.style.width = `${firstmindsFocus * 50}%`;
                    barInner.style.height = '100%';
                    barOuter.appendChild(barInner);

                    div.appendChild(barOuter);
                    div.appendChild(span);

                    return div;
                }
                return document.createTextNode("");
            },
        }];
    }
}

export class DRG90SimGui extends BaseMultiCycleSimGui<DRG90SimResult, DRG90SimSettings> {

    override makeAbilityUsedTable(result: DRG90SimResult): AbilitiesUsedTable {
        const extraColumns = DRGGaugeGui.generateResultColumns(result);
        const table = super.makeAbilityUsedTable(result);
        const newColumns = [...table.columns];
        newColumns.splice(newColumns.findIndex(col => col.shortName === 'expected-damage') + 1, 0, ...extraColumns);
        table.columns = newColumns;
        return table;
    }
}
