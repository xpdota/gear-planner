import {Language} from "@xivgear/core/i18n/translation";


export type PersistentSettings = {
    get lightMode(): boolean | undefined;
    set lightMode(lightMode: boolean);
    get modernTheme(): boolean | undefined;
    set modernTheme(lightMode: boolean);
    get viewDetailedStats(): boolean | undefined;
    set viewDetailedStats(detailedStats: boolean);
    get languageOverride(): Language | undefined;
    set languageOverride(value: Language);
    hideWelcomeMessage: boolean;
}

const LIGHT_MODE_KEY = 'light-mode';
const MODERN_THEME_KEY = 'modern-theme';
const DETAILED_STATS_KEY = 'detailed-stats';
const HIDE_WELCOME_KEY = 'hide-welcome-area';
const LANGUAGE_OVERRIDE_KEY = 'language-override';
export const SETTINGS: PersistentSettings = {
    get lightMode(): boolean | undefined {
        return getBool(LIGHT_MODE_KEY);
    },
    set lightMode(value: boolean) {
        setBool(LIGHT_MODE_KEY, value);
    },
    get modernTheme(): boolean | undefined {
        return getBool(MODERN_THEME_KEY);
    },
    set modernTheme(value: boolean) {
        setBool(MODERN_THEME_KEY, value);
    },
    get viewDetailedStats(): boolean | undefined {
        return getBool(DETAILED_STATS_KEY);
    },
    set viewDetailedStats(value: boolean) {
        setBool(DETAILED_STATS_KEY, value);
    },
    get hideWelcomeMessage() {
        return getBool(HIDE_WELCOME_KEY) ?? false;
    },
    set hideWelcomeMessage(value: boolean) {
        setBool(HIDE_WELCOME_KEY, value);
    },
    get languageOverride(): Language {
        const value = localStorage.getItem(LANGUAGE_OVERRIDE_KEY);
        // Previous versions had a bug where `languageOverride = undefined` would cause the setting to be the
        // string "undefined" instead of an actual null.
        if (!value || value === 'undefined') {
            return undefined;
        }
        return value as Language;
    },
    set languageOverride(value: Language) {
        if (value) {
            localStorage.setItem(LANGUAGE_OVERRIDE_KEY, value);
        }
        else {
            localStorage.removeItem(LANGUAGE_OVERRIDE_KEY);
        }
    },
};

function getBool(key: string): boolean | undefined {
    const raw = localStorage.getItem(key);
    if (raw === undefined || raw === null) {
        return undefined;
    }
    else {
        return raw === 'true';
    }
}

function setBool(key: string, value: boolean) {
    localStorage.setItem(key, String(value));
}
