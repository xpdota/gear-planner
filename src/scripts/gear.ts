import {
    EMPTY_STATS,
    getJobStats,
    getLevelStats,
    getRaceStats,
    JobName,
    MATERIA_LEVEL_MAX_NORMAL,
    MATERIA_LEVEL_MAX_OVERMELD,
    MATERIA_LEVEL_MIN_RELEVANT,
    MATERIA_SLOTS_MAX,
    RaceName,
} from "./xivconstants";
import {
    autoDhBonusDmg,
    critChance,
    critDmg,
    detDmg,
    dhitChance,
    dhitDmg,
    mainStatMulti,
    sksToGcd,
    spsToGcd,
    wdMulti
} from "./xivmath";
import {
    ComputedSetStats,
    EquipmentSet,
    FAKE_MAIN_STATS,
    FoodItem,
    GearItem,
    GearSlot,
    GearSlots,
    Materia,
    MateriaSlot,
    MeldableMateriaSlot,
    RawStatKey,
    RawStats,
    REAL_MAIN_STATS,
    SPECIAL_SUB_STATS,
    StatBonus,
    XivApiStat,
    xivApiStatToRawStatKey,
    XivCombatItem
} from "./geartypes";
import {DataManager} from "./datamanager";


export class EquippedItem {
    constructor(gearItem: GearItem, melds: MeldableMateriaSlot[] | undefined = undefined) {
        this.gearItem = gearItem;
        if (melds === undefined) {
            this.melds = [];
            for (let materiaSlot of gearItem.materiaSlots) {
                this.melds.push({
                    materiaSlot: materiaSlot,
                    equippedMatiera: null
                })
            }
        }
        else {
            this.melds = [...melds];
        }
    }

    gearItem: GearItem;
    melds: MeldableMateriaSlot[];
}

export class CharacterGearSet {
    _name: string;
    equipment: EquipmentSet;
    listeners: (() => void)[] = [];
    private _dirtyComp: boolean = true;
    private _updateKey: number = 0;
    private _computedStats: ComputedSetStats;
    private _jobOverride: JobName;
    private _raceOverride: RaceName;
    private _dataManager: DataManager;
    private _food: FoodItem;

    constructor(dataManager: DataManager) {
        this._dataManager = dataManager;
        this.name = ""
        this.equipment = new EquipmentSet();
    }

    get updateKey() {
        return this._updateKey;
    }

    set name(name) {
        this._name = name;
        this.notifyListeners();
    }

    get name() {
        return this._name;
    }

    get food(): FoodItem | undefined {
        return this._food;
    }

    private invalidate() {
        this._dirtyComp = true;
        this._updateKey++;
    }

    set food(food: FoodItem | undefined) {
        this.invalidate();
        this._food = food;
        console.log(`Set ${this.name}: food => ${food.name}`);
        this.notifyListeners();
    }

    setEquip(slot: string, item: GearItem) {
        this.invalidate();
        this.equipment[slot] = new EquippedItem(item);
        console.log(`Set ${this.name}: slot ${slot} => ${item.name}`);
        this.notifyListeners()
    }

    private notifyListeners() {
        for (let listener of this.listeners) {
            listener();
        }
    }


    notifyMateriaChange() {
        this.invalidate();
        this.notifyListeners();
    }

    addListener(listener: () => void) {
        this.listeners.push(listener);
    }

    getItemInSlot(slot: string): GearItem | null {
        const inSlot = this.equipment[slot];
        if (inSlot === null || inSlot === undefined) {
            return null;
        }

        return inSlot.gearItem;
    }

    get allStatPieces(): XivCombatItem[] {
        return Object.values(this.equipment)
            .filter(slotEquipment => slotEquipment && slotEquipment.gearItem)
            .flatMap((slotEquipment: EquippedItem) => [slotEquipment.gearItem, ...slotEquipment.melds.map(meldSlot => meldSlot.equippedMatiera).filter(item => item)]);
    }

    get computedStats(): ComputedSetStats {
        if (!this._dirtyComp) {
            return this._computedStats;
        }
        const all = this.allStatPieces;
        const combinedStats = new RawStats(EMPTY_STATS);
        const classJob = this._jobOverride ?? this._dataManager.classJob;
        const jobStats = getJobStats(classJob);
        const raceStats = getRaceStats(this._raceOverride ?? this._dataManager.race)
        const level = this._dataManager.level;
        const levelStats = getLevelStats(level);

        // Base stats based on job and level
        for (let statKey of REAL_MAIN_STATS) {
            combinedStats[statKey] = Math.floor(levelStats.baseMainStat * jobStats.jobStatMulipliers[statKey] / 100);
        }
        for (let statKey of FAKE_MAIN_STATS) {
            combinedStats[statKey] = Math.floor(levelStats.baseMainStat);
        }
        for (let statKey of SPECIAL_SUB_STATS) {
            combinedStats[statKey] = Math.floor(levelStats.baseSubStat);
        }

        // Add race stats
        addStats(combinedStats, raceStats);

        // Item stats
        for (let item of all) {
            addStats(combinedStats, item.stats);
        }
        // Food stats
        if (this._food) {
            for (let stat in this._food.bonuses) {
                const bonus: StatBonus = this._food.bonuses[stat];
                const startingValue = combinedStats[stat];
                const extraValue = Math.min(bonus.max, Math.floor(startingValue * (bonus.percentage / 100)));
                combinedStats[stat] = startingValue + extraValue;
            }
        }
        const mainStat = combinedStats[jobStats.mainStat];
        this._computedStats = {
            ...combinedStats,
            level: level,
            levelStats: levelStats,
            job: classJob,
            jobStats: jobStats,
            gcdPhys: sksToGcd(combinedStats.skillspeed),
            gcdMag: spsToGcd(2.5, levelStats, combinedStats.spellspeed),
            critChance: critChance(levelStats, combinedStats.crit),
            critMulti: critDmg(levelStats, combinedStats.crit),
            dhitChance: dhitChance(levelStats, combinedStats.dhit),
            dhitMulti: dhitDmg(levelStats, combinedStats.dhit),
            detMulti: detDmg(levelStats, combinedStats.determination),
            // TODO: does this need to be phys/magic split?
            wdMulti: wdMulti(levelStats, jobStats, Math.max(combinedStats.wdMag, combinedStats.wdPhys)),
            mainStatMulti: mainStatMulti(levelStats, jobStats, mainStat),
            traitMulti: jobStats.traitMulti ? jobStats.traitMulti(level) : 1,
            autoDhBonus: autoDhBonusDmg(levelStats, combinedStats.dhit),
        }
        if (jobStats.traits) {
            jobStats.traits.forEach(trait => {
                if (trait.minLevel && trait.minLevel > level) {
                    return;
                }
                if (trait.maxLevel && trait.maxLevel < level) {
                    return;
                }
                trait.apply(this._computedStats);
            });
        }
        this._dirtyComp = false;
        console.log("Recomputed stats");
        return this._computedStats;
    }

    clone(): CharacterGearSet {
        const out = new CharacterGearSet(this._dataManager);
        for (let slot in this.equipment) {
            const equip: EquippedItem = this.equipment[slot];
            if (!equip) {
                continue;
            }
            out.equipment[slot] = new EquippedItem(equip.gearItem, equip.melds);
        }
        out.name = this.name + ' copy';
        return out;
    }
}

/**
 * Adds the stats of 'addedStats' into 'baseStats'.
 *
 * Modifies 'baseStats' in-place.
 *
 * @param baseStats  The base stat sheet. Will be modified.
 * @param addedStats The stats to add.
 */
function addStats(baseStats: RawStats, addedStats: RawStats): void {
    for (let entry of Object.entries(baseStats)) {
        const stat = entry[0] as keyof RawStats;
        baseStats[stat] = addedStats[stat] + (baseStats[stat] ?? 0);
    }
}


export class XivApiGearInfo implements GearItem {
    id: number;
    name: string;
    Stats: Object;
    iconUrl: URL;
    ilvl: number;
    gearSlot: GearSlot;
    stats: RawStats;
    primarySubstat: keyof RawStats | null;
    secondarySubstat: keyof RawStats | null;
    substatCap: number;
    materiaSlots: MateriaSlot[];

    constructor(data: Object) {
        this.id = data['ID'];
        this.name = data['Name'];
        this.ilvl = data['LevelItem'];
        this.iconUrl = new URL(`https://xivapi.com/${data['IconHD']}`);
        this.Stats = data['Stats'];
        var eqs = data['EquipSlotCategory'];
        if (eqs['MainHand']) {
            this.gearSlot = GearSlots.Weapon;
        }
        else if (eqs['Head']) {
            this.gearSlot = GearSlots.Head;
        }
        else if (eqs['Body']) {
            this.gearSlot = GearSlots.Body;
        }
        else if (eqs['Gloves']) {
            this.gearSlot = GearSlots.Hand;
        }
        else if (eqs['Legs']) {
            this.gearSlot = GearSlots.Legs;
        }
        else if (eqs['Feet']) {
            this.gearSlot = GearSlots.Feet;
        }
        else if (eqs['Ears']) {
            this.gearSlot = GearSlots.Ears;
        }
        else if (eqs['Neck']) {
            this.gearSlot = GearSlots.Neck;
        }
        else if (eqs['Wrists']) {
            this.gearSlot = GearSlots.Wrist;
        }
        else if (eqs['FingerL'] || eqs['FingerR']) {
            this.gearSlot = GearSlots.Ring;
        }
        else {
            console.error("Unknown slot data!")
            console.error(eqs);
        }

        this.stats = {
            vitality: this.getStatRaw("Vitality"),
            strength: this.getStatRaw("Strength"),
            dexterity: this.getStatRaw("Dexterity"),
            intelligence: this.getStatRaw("Intelligence"),
            mind: this.getStatRaw("Mind"),
            piety: this.getStatRaw("Piety"),
            crit: this.getStatRaw("CriticalHit"),
            dhit: this.getStatRaw("DirectHitRate"),
            determination: this.getStatRaw("Determination"),
            tenacity: this.getStatRaw("Tenacity"),
            spellspeed: this.getStatRaw("SpellSpeed"),
            skillspeed: this.getStatRaw("SkillSpeed"),
            wdPhys: data['DamagePhys'],
            wdMag: data['DamageMag'],
            hp: 0
        }
        const sortedStats = Object.entries({
            crit: this.stats.crit,
            dhit: this.stats.dhit,
            determination: this.stats.determination,
            spellspeed: this.stats.spellspeed,
            skillspeed: this.stats.skillspeed,
            piety: this.stats.piety,
            tenacity: this.stats.tenacity,
        })
            .sort((left, right) => {
                if (left[1] > right[1]) {
                    return 1;
                }
                else if (left[1] < right[1]) {
                    return -1;
                }
                return 0;
            })
            .filter(item => item[1])
            .reverse();
        if (sortedStats.length < 2) {
            this.primarySubstat = null;
            this.secondarySubstat = null;
            // TODO idk
            this.substatCap = 1000;
        }
        else {
            this.primarySubstat = sortedStats[0][0] as keyof RawStats;
            this.secondarySubstat = sortedStats[1][0] as keyof RawStats;
            this.substatCap = sortedStats[0][1];
        }
        this.materiaSlots = [];
        const baseMatCount: number = data['MateriaSlotCount'];
        const overmeld: boolean = data['IsAdvancedMeldingPermitted'] as boolean;
        for (let i = 0; i < baseMatCount; i++) {
            // TODO: figure out grade automatically
            this.materiaSlots.push({maxGrade: MATERIA_LEVEL_MAX_NORMAL});
        }
        if (overmeld) {
            this.materiaSlots.push({maxGrade: MATERIA_LEVEL_MAX_NORMAL})
            for (let i = this.materiaSlots.length; i < MATERIA_SLOTS_MAX; i++) {
                this.materiaSlots.push({maxGrade: MATERIA_LEVEL_MAX_OVERMELD});
            }
        }
    }

    private getStatRaw(stat: XivApiStat) {
        const statValues = this.Stats[stat];
        if (statValues === undefined) {
            return 0;
        }
        if (statValues['HQ'] !== undefined) {
            return statValues['HQ'];
        }
        else {
            return statValues['NQ'];
        }
    }
}

export class XivApiFoodInfo implements FoodItem {
    bonuses: { [K in keyof RawStats]?: { percentage: number; max: number } } = {};
    iconUrl: URL;
    id: number;
    name: string;
    ilvl: number;
    primarySubStat: RawStatKey | undefined;
    secondarySubStat: RawStatKey | undefined;

    constructor(data: Object) {
        this.id = data['ID'];
        this.name = data['Name'];
        this.iconUrl = new URL("https://xivapi.com/" + data['IconHD']);
        this.ilvl = data['LevelItem'];
        for (let key in data['Bonuses']) {
            const bonusData = data['Bonuses'][key];
            this.bonuses[xivApiStatToRawStatKey[key as RawStatKey]] = {
                percentage: bonusData['ValueHQ'] ?? bonusData['Value'],
                max: bonusData['MaxHQ'] ?? bonusData['Max']
            }
        }
        const sortedStats = Object.entries(this.bonuses).sort((entryA, entryB) => entryB[1].max - entryA[1].max).map(entry => entry[0] as RawStatKey).filter(stat => stat !== 'vitality');
        console.log(`Food ${this.name}: sorted: ${sortedStats}`)
        if (sortedStats.length >= 1) {
            this.primarySubStat = sortedStats[0];
        }
        if (sortedStats.length >= 2) {
            this.secondarySubStat = sortedStats[1];
        }
    }

}

export function processRawMateriaInfo(data: Object): Materia[] {
    const out: Materia[] = []
    for (let i = MATERIA_LEVEL_MIN_RELEVANT - 1; i < MATERIA_LEVEL_MAX_NORMAL; i++) {
        const itemData = data['Item' + i];
        const itemName = itemData["Name"];
        const stats = new RawStats();
        const stat = statById(data['BaseParam']['ID']);
        if (!stat || !itemName) {
            continue;
        }
        stats[stat] = data['Value' + i];
        out.push({
            name: itemName,
            id: itemData["ID"],
            iconUrl: itemData["IconHD"],
            stats: stats,
        })
    }
    return out;
}

// TODO: move to constants
export function statById(id: number): keyof RawStats {
    switch (id) {
        case 6:
            return "piety";
        case 19:
            return "tenacity";
        case 22:
            return "dhit";
        case 27:
            return "crit";
        case 45:
            return "skillspeed";
        case 46:
            return "spellspeed";
        default:
            return undefined;
    }
}

