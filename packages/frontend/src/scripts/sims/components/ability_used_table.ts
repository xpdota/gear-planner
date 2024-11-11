import {CustomColumnSpec, CustomTable, HeaderRow} from "../../tables";
import {toRelPct} from "@xivgear/core/util/strutils";
import {AbilityIcon} from "../../components/abilities";
import {BuffListDisplay} from "./buff_list_display";
import {DisplayRecordFinalized, isFinalizedAbilityUse} from "@xivgear/core/sims/cycle_sim";
import {AutoAttack, Buff, CombinedBuffEffect, GcdAbility, OgcdAbility} from "@xivgear/core/sims/sim_types";
import {ItemIcon} from "../../components/item_icon";
import {quickElement} from "@xivgear/common-ui/components/util";

/**
 * Format a time into the format x:yy.zz
 *
 * @param time The time (in seconds). Supports positive and negative values.
 */
function formatTime(time: number) {
    const negative = time < 0;
    // noinspection AssignmentToFunctionParameterJS
    time = Math.abs(time);
    const minute = Math.floor(time / 60);
    const second = time % 60;
    return (`${negative ? '-' : ''}${minute}:${second.toFixed(2).padStart(5, '0')}`);
}


function roundTime(time: number): string {
    return time.toFixed(3);
}


export class AbilitiesUsedTable extends CustomTable<DisplayRecordFinalized> {

    constructor(abilitiesUsed: readonly DisplayRecordFinalized[], extraColumns: CustomColumnSpec<DisplayRecordFinalized, unknown, unknown>[] = []) {
        super();
        this.style.tableLayout = 'fixed';
        this.classList.add('abilities-used-table');
        this.columns = [
            {
                shortName: 'time',
                displayName: 'Time',
                getter: used => used,
                renderer: (used: DisplayRecordFinalized) => {
                    return document.createTextNode(formatTime(used.usedAt));
                },
                colStyler: (value: DisplayRecordFinalized, colElement, internalElement) => {
                    if ('original' in value) {
                        const original = value.original;
                        let title = `Used at: ${roundTime(value.usedAt)}s\n`;
                        // cast
                        if (value.original.castTimeFromStart) {
                            title += `Cast: ${roundTime(original.castTimeFromStart)}\n`;
                            title += `Snapshot At: ${roundTime(original.snapshotTimeFromStart)}\n`;
                            title += `Application Delay: ${roundTime(original.appDelay)}\n`;
                            title += `Cast Start to Application: ${roundTime(original.appDelayFromStart)}\n`;
                            title += `Effective Recast: ${roundTime(original.totalTimeTaken)}`;
                        }
                        else { // instant
                            title += `Application Delay: ${original.appDelayFromStart}\nAnimation Lock: ${original.totalTimeTaken}`;
                        }
                        colElement.title = title;
                    }
                },
            },
            {
                shortName: 'ability',
                displayName: 'Ability',
                getter: used => isFinalizedAbilityUse(used) ? used.ability : used.label,
                renderer: (ability: GcdAbility | OgcdAbility | AutoAttack | string) => {
                    if (ability instanceof Object) {
                        const out = document.createElement('div');
                        out.classList.add('ability-cell');
                        if (ability.type === 'autoattack') {
                            out.appendChild(document.createTextNode('* '));
                        }
                        else if (ability.type !== "gcd") {
                            out.appendChild(document.createTextNode(' ⤷ '));
                        }
                        if (!ability.noIcon) {
                            if (ability.itemId) {
                                out.appendChild(new ItemIcon(ability.itemId));
                            }
                            else if (ability.id) {
                                out.appendChild(new AbilityIcon(ability.id));
                            }
                        }
                        const abilityNameSpan = document.createElement('span');
                        abilityNameSpan.textContent = ability.name;
                        abilityNameSpan.classList.add('ability-name');
                        out.appendChild(abilityNameSpan);
                        return out;
                    }
                    else {
                        return document.createTextNode(ability);
                    }
                },
            },
            {
                shortName: 'unbuffed-pot',
                displayName: 'Pot',
                getter: used => {
                    return isFinalizedAbilityUse(used) ? used.totalPotency : null;
                },
                renderer: (value: number | null, rowValue: DisplayRecordFinalized) => {
                    if (value !== null && isFinalizedAbilityUse(rowValue)) {
                        if (rowValue.ability.type === 'autoattack') {
                            const text = quickElement('span', [], [value + '*']);
                            text.title = `${value} is the original potency, and does not reflect the weapon delay multiplier. However, the damage amount does reflect it.`;
                            return text;
                        }
                        else {
                            return document.createTextNode(value.toString());
                        }
                    }
                    else {
                        return document.createTextNode('--');
                    }
                },
            },
            {
                shortName: 'expected-damage',
                displayName: 'Damage',
                getter: used => used,
                renderer: (used: DisplayRecordFinalized) => {
                    if (isFinalizedAbilityUse(used)) {

                        if (!used.totalDamage) {
                            return document.createTextNode('--');
                        }
                        let text = used.totalDamage.toFixed(2);
                        if (used.partialRate !== null
                            || (used.dotInfo && used.dotInfo.fullDurationTicks !== "indefinite" && used.dotInfo.actualTickCount < used.dotInfo.fullDurationTicks)
                            || (used.channelInfo && used.channelInfo.actualTickCount < used.channelInfo.fullDurationTicks)) {
                            text += '*';
                        }
                        return document.createTextNode(text);
                    }
                    else {
                        return null;
                    }
                },
                colStyler: (value: DisplayRecordFinalized, colElement, internalElement) => {
                    if (isFinalizedAbilityUse(value)) {
                        const title: string[] = [];
                        if (value.partialRate !== null) {
                            title.push(`This ability would not have fit completely within the allotted time.\nIt has been pro-rated to ${Math.floor(value.partialRate * 100)}% of the original damage.\n`);
                        }
                        if (value.dotInfo) {
                            if (value.dotInfo.fullDurationTicks === 'indefinite') {
                                title.push(`This ability is an indefinite DoT. It dealt ${value.dotInfo.actualTickCount} ticks of ${value.dotInfo.damagePerTick.expected.toFixed(3)} each.\n`);
                            }
                            else {
                                title.push(`This ability is a DoT. It dealt ${value.dotInfo.actualTickCount}/${value.dotInfo.fullDurationTicks} ticks of ${value.dotInfo.damagePerTick.expected.toFixed(3)} each.\n`);
                            }
                        }
                        if (value.channelInfo) {
                            title.push(`This ability is a channel. It dealt ${value.channelInfo.actualTickCount}/${value.channelInfo.fullDurationTicks} ticks of ${value.channelInfo.damagePerTick.expected.toFixed(3)} each.\n`);
                        }
                        if (title.length > 0) {
                            colElement.title = title.join('\n');
                        }
                    }
                },
            },
            {
                shortName: 'Total Buffs',
                displayName: 'Total Buffs',
                getter: used => isFinalizedAbilityUse(used) ? used.combinedEffects : undefined,
                renderer: (effects: CombinedBuffEffect) => {
                    if (effects === undefined) {
                        return null;
                    }
                    const out: string[] = [];
                    if (effects.dmgMod !== 1) {
                        const dmgModRelative = effects.dmgMod - 1;
                        out.push(`${toRelPct(dmgModRelative, 1)}% dmg`);
                    }
                    if (effects.dhitChanceIncrease) {
                        out.push(`${toRelPct(effects.dhitChanceIncrease, 1)}% DHT`);
                    }
                    if (effects.critChanceIncrease) {
                        out.push(`${toRelPct(effects.critChanceIncrease, 1)}% CRT`);
                    }
                    if (effects.haste) {
                        out.push(`${effects.haste}% Haste`);
                    }
                    return document.createTextNode(out.join(', '));
                },
            },
            {
                shortName: 'buffs',
                displayName: 'Buffs Active',
                getter: (used: DisplayRecordFinalized) => used['buffs'] ?? [],
                renderer: (buffs: Buff[]) => {
                    return new BuffListDisplay(buffs);
                },
            },
            ...extraColumns,
        ];
        this.data = [new HeaderRow(), ...abilitiesUsed];
        // this.style.tableLayout = 'auto';
    }
}

customElements.define('abilities-used-table', AbilitiesUsedTable, {extends: 'table'});
