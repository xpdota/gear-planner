function setCellProps(cell: HTMLTableCellElement, colDef: CustomColumn<any, any>) {
    cell.setAttribute("col-id", colDef.shortName);
    if (colDef.initialWidth !== undefined) {
        cell.style.width = cell.style.minWidth = cell.style.maxWidth = colDef.initialWidth + "px";
    }
    if (colDef.fixedWidth !== undefined) {
        // Do the same thing but consider it non-resizable
        cell.style.width = cell.style.minWidth = cell.style.maxWidth = colDef.fixedWidth + "px";
    }
}

export class CustomTableHeaderCell<X, Y, Z> extends HTMLTableCellElement implements SelectionRefresh {
    private _colDef: CustomColumn<X, Y, Z>;
    private _selected: boolean = false;
    private table: CustomTable<X, any>;

    constructor(table: CustomTable<X, any>, columnDef: CustomColumn<X, Y, Z>) {
        super();
        this.table = table;
        this._colDef = columnDef;
        this.setName();
        setCellProps(this, columnDef);
        this.refreshSelection();
    }

    get colDef() {
        return this._colDef;
    }

    setName() {
        this.textContent = this.colDef.displayName;
    }

    refreshFull() {
        this.setName();
    }

    refreshSelection() {
        this.selected = this.table.selectionModel.isColumnHeaderSelected(this._colDef as CustomColumn<X>);
    }

    set selected(selected) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", String(selected));
    }

    get selected() {
        return this._selected;
    }
}

export class CustomTableHeaderRow<X> extends HTMLTableRowElement implements SelectionRefresh, RefreshableRow<X> {
    _cells: CustomTableHeaderCell<X, any, any>[] = [];

    constructor(table: CustomTable<X, any>) {
        super();
        for (let column of table.columns) {
            const headerCell = new CustomTableHeaderCell(table, column);
            this.appendChild(headerCell);
            this._cells.push(headerCell);
        }
    }

    refreshFull() {
        this._cells.forEach(cell => cell.refreshFull());
    }

    refreshColumn(colDef: CustomColumn<X>) {
        this._cells.find(cell => cell.colDef == colDef)?.refreshFull();
    }

    refreshSelection() {
        this._cells.forEach(cell => cell.refreshSelection());
    }
}

export class CustomTableTitleRow extends HTMLTableRowElement {
    constructor(table: CustomTable<any, any>, title: (string | Node)) {
        super();
        let node;
        if (title instanceof Node) {
            node = title;
        }
        else {
            node = document.createTextNode(title);
        }
        const cell = document.createElement("th");
        cell.colSpan = 9999;
        cell.appendChild(node);
        this.appendChild(cell);
    }
}

export interface SelectionModel<X, Y> {
    getSelection(): Y;

    clickCell(cell: CustomCell<X, Y>);

    clickColumnHeader(col: CustomColumn<X>);

    clickRow(row: CustomRow<X>);

    isCellSelectedDirectly(cell: CustomCell<X, Y>);

    isRowSelected(row: CustomRow<X>);

    isColumnHeaderSelected(col: CustomColumn<X>);

    clearSelection(): void;
}

export const noopSelectionModel: SelectionModel<any, undefined> = {
    isCellSelectedDirectly(cell: CustomCell<any, any>) {
        return false;
    },
    clickCell(cell: CustomCell<any, any>) {
    },
    clickColumnHeader(col: CustomColumn<any>) {
    },
    clickRow(cell: CustomRow<any>) {
    },
    getSelection(): undefined {
        return undefined;
    },
    isColumnHeaderSelected(col: CustomColumn<any>) {
        return false;
    },
    isRowSelected(item: any) {
        return false;
    },
    clearSelection() {
    }
}

export interface SelectionListener<Y> {
    onNewSelection(newSelection: Y);
}

export type SingleCellRowOrHeaderSelect<X> = CustomColumn<X> | CustomCell<X, any> | CustomRow<X> | undefined;

export class SingleSelectionModel<X, Y = never> implements SelectionModel<X, SingleCellRowOrHeaderSelect<X> | Y> {

    private _selection: Y | SingleCellRowOrHeaderSelect<X> = undefined;
    private _listeners: SelectionListener<Y | SingleCellRowOrHeaderSelect<X>>[] = [];

    private notifyListeners() {
        for (let listener of this._listeners) {
            listener.onNewSelection(this.getSelection());
        }
    }

    addListener(listener: SelectionListener<SingleCellRowOrHeaderSelect<X> | Y>) {
        this._listeners.push(listener);
    }

    getSelection(): Y | SingleCellRowOrHeaderSelect<X> {
        return this._selection;
    }

    clickCell(cell: CustomCell<X, Y>) {
        this._selection = cell;
        this.notifyListeners();
    }

    clickColumnHeader(col: CustomColumn<X>) {
        this._selection = col;
        this.notifyListeners();
    }

    clickRow(row: CustomRow<X>) {
        this._selection = row;
        this.notifyListeners();
    }

    isCellSelectedDirectly(cell: CustomCell<X, Y>) {
        return cell === this._selection;
    }

    isRowSelected(row: CustomRow<X>) {
        return row === this._selection;
    }

    isColumnHeaderSelected(col: CustomColumn<X>) {
        return col === this._selection;
    }

    clearSelection() {
        this._selection = undefined;
        this.notifyListeners();
    }

    // TODO
    // removeListener(listener: SimpleSelectionListener<X>) {
    //     this._listeners.
    // }
}

export class HeaderRow {

}

export class TitleRow {
    title: string;

    constructor(title: string) {
        this.title = title;
    }
}

export class SpecialRow<X, Y> {

    creator: (table: CustomTable<X, Y>) => Node

    constructor(creator) {
        this.creator = creator;
    }
}

export interface SelectionRefresh {
    refreshSelection(): void;
}

export interface RefreshableRow<X> {
    refreshFull(),

    refreshColumn(colDef: CustomColumn<X>),
}

export class CustomTable<X, Y = never> extends HTMLTableElement {
    _data: (X | HeaderRow | TitleRow)[] = [];
    dataRowMap: Map<X, CustomRow<X>> = new Map<X, CustomRow<X>>();
    selectionRefreshables: SelectionRefresh[] = [];
    _rows: RefreshableRow<X>[] = [];
    _columns: CustomColumn<X, any>[];
    // TODO
    // selectionEnabled: boolean;
    selectionModel: SelectionModel<X, Y> = noopSelectionModel;
    curSelection: Y = null;

    constructor() {
        super();
        this.appendChild(this.createTHead());
        this.appendChild(this.createTBody());
        this.addEventListener('mousedown', ev => {
            this.handleClick(ev);
        })
    }

    get columns() {
        return this._columns;
    }

    set columns(cols: CustomColumnSpec<X, any, any>[]) {
        this._columns = cols.flatMap(colDefPartial => {
            const out = new CustomColumn(colDefPartial);
            Object.assign(out, colDefPartial);
            if (out.condition()) {
                return [out];
            }
            else {
                return []
            }
        })
        // TODO: see if successive refreshFull calls can be coalesced
        this._onDataChanged();
        this.refreshFull();
    }

    set data(newData: (X | HeaderRow | TitleRow)[]) {
        // TODO
        this._data = newData;
        this._onDataChanged();
    }

    /**
     * To be called when rows or columns are added, removed, or rearranged, but not
     * when only the data within cells is changed.
     *
     * @private
     */
    private _onDataChanged() {
        const newRowElements: Node[] = [];
        for (let item of this._data) {
            if (item instanceof HeaderRow) {
                const header = new CustomTableHeaderRow(this);
                newRowElements.push(header);
            }
            else if (item instanceof TitleRow) {
                newRowElements.push(new CustomTableTitleRow(this, item.title));
            }
            else if (item instanceof SpecialRow) {
                newRowElements.push(new CustomTableTitleRow(this, item.creator(this)));
            }
            else {
                if (this.dataRowMap.has(item)) {
                    newRowElements.push(this.dataRowMap.get(item));
                }
                else {
                    const newRow = new CustomRow<X>(item, this);
                    this.dataRowMap.set(item, newRow);
                    newRow.refreshFull();
                    newRowElements.push(newRow);
                }
            }
        }
        this.tBodies[0].replaceChildren(...newRowElements);
        this.selectionRefreshables = [];
        for (let value of newRowElements.values()) {
            if (value instanceof CustomRow) {
                this.selectionRefreshables.push(value);
                this._rows.push(value);
            }
            else if (value instanceof CustomTableHeaderRow) {
                this.selectionRefreshables.push(value);
                this._rows.push(value);
            }
        }
        this.refreshSelection();
    }

    refreshFull() {
        for (let row of this._rows) {
            row.refreshFull();
        }
    }

    refreshSelection() {
        for (let value of this.selectionRefreshables) {
            value.refreshSelection();
        }
    }

    refreshRowData(item: CustomRow<X> | X) {
        if (item instanceof CustomRow) {
            item.refreshFull();
        }
        else {
            const row = this.dataRowMap.get(item);
            if (row) {
                row.refreshFull();
            }
        }
    }

    refreshColumn(item: CustomColumn<X> | any) {
        if (item instanceof CustomColumn) {
            for (let row of this._rows) {
                row.refreshColumn(item);
            }
        }
        else {
            const col = this._columns.find(col => col.dataValue === item);
            if (col) {
                for (let row of this._rows) {
                    row.refreshColumn(col);
                }
            }
        }
    }

    refreshColHeaders() {
        for (let row of this._rows) {
            if (row instanceof CustomTableHeaderRow) {
                row.refreshFull();
            }
        }
    }

    handleClick(ev: MouseEvent) {
        this._handleClick(ev.target);
    }

    _handleClick(target) {
        if (target instanceof CustomRow) {
            this.selectionModel.clickRow(target);
            this.refreshSelection();
            target.scrollIntoView({
                behavior: 'instant',
                block: 'nearest'
            })
        }
        else if (target instanceof CustomCell) {
            if (target.colDef.allowCellSelection) {
                this.selectionModel.clickCell(target);
            }
            else {
                this.selectionModel.clickRow(target.row);
            }
            target.scrollIntoView({
                behavior: 'instant',
                block: 'nearest'
            })
            this.refreshSelection();
        }
        else if (target instanceof CustomTableHeaderCell) {
            if (target.colDef.allowHeaderSelection) {
                this.selectionModel.clickColumnHeader(target.colDef);
                this.refreshSelection();
            }
        }
        else if (target instanceof HTMLButtonElement) {
            // Assume buttons will handle themselves
        }
        else if (target === undefined || target === null) {
            return;
        }
        else {
            this._handleClick(target.parentElement);
        }
    }
}

export interface CustomColumnSpec<X, Y = string, Z = any> {
    shortName: string;
    displayName: string;
    allowHeaderSelection?: boolean;
    allowCellSelection?: boolean;
    getter: (item: X) => Y;
    renderer?: (value: Y) => Node;
    colStyler?: (value: Y, colElement: CustomCell<X, Y>, internalElement: Node) => void;
    condition?: () => boolean;
    initialWidth?: number | undefined;
    fixedWidth?: number | undefined;
    dataValue?: Z;
}

export class CustomColumn<X, Y = string, Z = any> {
    private _original?: CustomColumnSpec<X, Y, Z>;

    constructor(colDefPartial: CustomColumnSpec<X, Y, Z>) {
        Object.assign(this, colDefPartial);
        this._original = colDefPartial;
    }

    shortName: string;

    get displayName() {
        // Name can change after the fact, so query the original spec
        return this._original.displayName;
    };

    set displayName(ignored) {
    };

    allowHeaderSelection?: boolean = false;
    allowCellSelection?: boolean = false;
    getter: (item: X) => Y;
    renderer?: (value: Y) => Node = (value) => document.createTextNode(value.toString());
    colStyler?: (value: Y, colElement: CustomCell<X, Y>, internalElement: Node) => void = (value, colElement, internalElement) => {
        if (value) {
            colElement.classList.add("value-truthy")
        }
        else {
            colElement.classList.add("value-falsey")
        }
    };
    condition?: () => boolean = () => true;
    initialWidth?: number | undefined = undefined;
    fixedWidth?: number | undefined = undefined;
    dataValue?: Z;
}

export class CustomRow<X> extends HTMLTableRowElement implements RefreshableRow<X> {
    dataItem: X;
    table: CustomTable<X, any>;
    dataColMap: Map<CustomColumn<X>, CustomCell<X, any>> = new Map<CustomColumn<X>, CustomCell<X, any>>();
    private _selected: boolean = false;

    constructor(dataItem: X, table: CustomTable<X, any>) {
        super();
        this.dataItem = dataItem;
        this.table = table;
        this.refreshFull();
    }

    refreshColumn(colDef: CustomColumn<X, string, any>) {
        this.dataColMap.get(colDef)?.refreshFull();
    }

    refreshFull() {
        const newColElements: CustomCell<X, any>[] = [];
        for (let col of this.table.columns) {
            if (this.dataColMap.has(col)) {
                newColElements.push(this.dataColMap.get(col));
            }
            else {
                const newCell = new CustomCell<X, any>(this.dataItem, col, this);
                this.dataColMap.set(col, newCell);
                newColElements.push(newCell);
            }
        }
        // @ts-ignore
        this.replaceChildren(...newColElements);
        for (let value of this.dataColMap.values()) {
            value.refreshFull();
        }
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = this.table.selectionModel.isRowSelected(this);
        for (let value of this.dataColMap.values()) {
            value.refreshSelection();
        }
    }

    set selected(selected: boolean) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", String(selected));
    }
}

export class CustomCell<X, Y> extends HTMLTableCellElement {

    dataItem: X;
    colDef: CustomColumn<X, Y>;
    row: CustomRow<X>;
    _value: Y;
    private _selected: boolean = false;

    constructor(dataItem: X, colDef: CustomColumn<X, Y>, row: CustomRow<X>) {
        super();
        this.dataItem = dataItem;
        this.colDef = colDef;
        this.row = row;
        this.setAttribute("col-id", colDef.shortName);
        this.refreshFull();
        setCellProps(this, colDef);
    }

    refreshFull() {
        let node: Node;
        try {
            this._value = this.colDef.getter(this.dataItem);
            node = this.colDef.renderer(this._value);
            this.colDef.colStyler(this._value, this, node);
        } catch (e) {
            console.error(e);
            node = document.createTextNode("Error");
        }
        this.replaceChildren(node);
        this.refreshSelection();
    }

    refreshSelection() {
        this.selected = (this.row.table.selectionModel.isCellSelectedDirectly(this));
    }

    get value() {
        return this._value;
    }

    set selected(selected) {
        if (this._selected === selected) {
            return;
        }
        this._selected = selected;
        this.setAttribute("is-selected", String(selected));
    }

    get selected() {
        return this._selected;
    }

}

customElements.define("custom-table-row", CustomRow, {extends: "tr"})
customElements.define("custom-table", CustomTable, {extends: "table"})
customElements.define("custom-table-cell", CustomCell, {extends: "td"})
customElements.define("custom-table-header-row", CustomTableHeaderRow, {extends: "tr"})
customElements.define("custom-table-title-row", CustomTableTitleRow, {extends: "tr"})
customElements.define("custom-table-header-cell", CustomTableHeaderCell, {extends: "th"})
