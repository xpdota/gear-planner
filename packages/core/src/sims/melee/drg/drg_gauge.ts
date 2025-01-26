import {DRGGaugeState} from "./drg_types";

class DRGGauge {
    constructor() {
        this._FirstmindsFocus = 0;
    }

    private _FirstmindsFocus: number;
    get FirstmindsFocus() {
        return this._FirstmindsFocus;
    }

    spendFirstmindsFocus(): void {
        this._FirstmindsFocus = 0;
    }

    addFirstmindsFocus(): void {
        if (this._FirstmindsFocus < 2)
            this._FirstmindsFocus += 1;
    }

    getGaugeState(): DRGGaugeState {
        return {
            FirstmindsFocus: this.FirstmindsFocus,
        };
    }
}
export default DRGGauge;
