let catalog = {};
let output = null;

export function configure(options = {}) {
    catalog = options.catalog ?? {};
    output = options.output ?? null;
}

export function translate(template, values) {
    const translated = catalog[template] ?? template;

    return translated.replace(/\{(\d+)\}/g, (_, index) => String(values[index]));
}

export function println(value) {
    if (output === null) {
        throw new Error("Lango runtime output is not configured");
    }

    output(String(value));
    return null;
}
