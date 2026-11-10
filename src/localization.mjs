import i18next from "./vendor/i18next.mjs";

function record(value, label) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new TypeError(`${label} must be a map`);
    return value;
}

function language(value) {
    if (typeof value !== "string" || value === "") throw new TypeError("locale must be a language tag");
    return Intl.getCanonicalLocales(value)[0];
}

function numeric(value) {
    // Decimal instances from independently generated runtimes share this backend marker.
    if (value?._isBigNumber === true && typeof value.toFixed === "function") {
        if (!value.isFinite()) throw new TypeError("formatNumber requires a finite value");
        return value.toFixed();
    }
    if (typeof value === "bigint") return value;
    if (typeof value !== "number" || !Number.isFinite(value))
        throw new TypeError("formatNumber requires a finite number or Decimal");
    return value;
}

function dateValue(value) {
    if (typeof value === "string") {
        const parts = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);
        if (!parts) throw new TypeError("formatDate requires an ISO date or an instant with a time-zone offset");
        const calendar = new Date(0);
        calendar.setUTCFullYear(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
        if (calendar.getUTCMonth() !== Number(parts[2]) - 1 || calendar.getUTCDate() !== Number(parts[3]))
            throw new TypeError("formatDate requires a valid date");
    }
    if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number")
        throw new TypeError("formatDate requires a Date, ISO string or epoch milliseconds");
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError("formatDate requires a valid date");
    return date;
}

/** Create an immutable, synchronous translator; catalogs are application-owned data. */
export function createI18n(options = {}) {
    record(options, "i18n options");
    const locale = language(options.locale ?? "en");
    const fallbackLocale = language(options.fallbackLocale ?? "en");
    const timeZone = new Intl.DateTimeFormat("en", { timeZone: options.timeZone ?? "UTC" }).resolvedOptions().timeZone;
    const currency = options.currency == null ? null : options.currency;
    if (currency !== null) new Intl.NumberFormat("en", { style: "currency", currency });
    const resources = Object.create(null);
    const catalogs = { ...record(options.catalogs ?? {}, "catalogs") };
    if (options.catalog != null) catalogs[locale] = { ...catalogs[locale], ...record(options.catalog, "catalog") };
    for (const [tag, catalog] of Object.entries(catalogs)) {
        const messages = record(catalog, "translation catalog");
        if (Object.values(messages).some(value => typeof value !== "string"))
            throw new TypeError("translation catalog entries must be strings");
        resources[language(tag)] = { translation: { ...messages } };
    }
    const engine = i18next.createInstance();
    // All resources are in memory: no async backend, network lookup, or global language mutation.
    engine.init({
        lng: locale, fallbackLng: fallbackLocale, resources, initAsync: false,
        keySeparator: false, nsSeparator: false, returnNull: false,
        interpolation: { escapeValue: false },
    });
    const fixed = engine.getFixedT(locale);
    const formatNumber = (value, options = null) => {
        const settings = { ...record(options ?? {}, "number format options") };
        if (settings.style === "currency" && settings.currency == null && currency !== null)
            settings.currency = currency;
        return new Intl.NumberFormat(locale, settings).format(numeric(value));
    };
    const formatDate = (value, options = null) => {
        const settings = { timeZone, ...record(options ?? {}, "date format options") };
        return new Intl.DateTimeFormat(locale, settings).format(dateValue(value));
    };
    const translate = (template, values = [], options = null) => {
        if (typeof template !== "string" || !Array.isArray(values))
            throw new TypeError("translation requires a template and a values array");
        const settings = record(options ?? {}, "translation options");
        if (settings.count != null && (typeof settings.count !== "number" || !Number.isFinite(settings.count)))
            throw new TypeError("translation count must be a finite number");
        if (settings.context != null && typeof settings.context !== "string")
            throw new TypeError("translation context must be a string");
        const params = record(settings.formatParams ?? {}, "formatParams");
        const message = fixed(template, {
            defaultValue: template, skipInterpolation: true,
            ...(settings.count == null ? {} : { count: settings.count }),
            ...(settings.context == null ? {} : { context: settings.context }),
        });
        // Render once: values are data and can never introduce further placeholders or code.
        return message.replace(/{{|}}|{(\d+)(?:,\s*(number|currency|percent|date|datetime))?}/g, (token, index, format) => {
            if (token === "{{") return "{";
            if (token === "}}") return "}";
            if (Number(index) >= values.length) throw new RangeError(`missing translation parameter {${index}}`);
            const value = values[index];
            const options = record(params[index] ?? {}, "parameter format options");
            switch (format) {
                case "number": return formatNumber(value, options);
                case "currency": return formatNumber(value, { ...options, style: "currency" });
                case "percent": return formatNumber(value, { ...options, style: "percent" });
                case "date": case "datetime": return formatDate(value, options);
                default: return String(value);
            }
        });
    };
    return Object.freeze({ locale, fallbackLocale, timeZone, currency, translate, formatNumber, formatDate });
}
