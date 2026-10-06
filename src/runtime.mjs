export const RUNTIME_SOURCE = `let catalog = {};
let output = null;
const contexts = new Map();

export function configure(options = {}) {
    catalog = options.catalog ?? {};
    output = options.output ?? null;
}

export function translate(template, values) {
    const translated = catalog[template] ?? template;

    return translated.replace(/\\{(\\d+)\\}/g, (_, index) => String(values[index]));
}

export function println(value) {
    if (output === null) {
        throw new Error("Lango runtime output is not configured");
    }

    output(String(value));
    return null;
}

export function fromJson(text) {
    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error(\`JsonParseError: \${error.message}\`);
    }
}

export function toJson(value) {
    try {
        const result = JSON.stringify(value);
        if (result === undefined) throw new Error("unsupported value");
        return result;
    } catch (error) {
        throw new Error(\`JsonUnsupported: \${error.message}\`);
    }
}

export function getClass(value) {
    if (value === null) return null;
    if (typeof value === "number") return Number;
    if (typeof value === "string") return String;
    if (typeof value === "boolean") return Boolean;
    return Object.getPrototypeOf(value)?.constructor ?? Object;
}

export function isKindof(value, Class) {
    if (value === null) return false;
    if (typeof value === "object" || typeof value === "function") return value instanceof Class;
    return getClass(value) === Class;
}

export function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

export function isString(value) {
    return typeof value === "string";
}

export function isBool(value) {
    return typeof value === "boolean";
}

export function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isArray(value) {
    return Array.isArray(value);
}

export function requireBoolean(value) {
    if (typeof value !== "boolean") {
        throw new Error("BooleanRequired");
    }

    return value;
}

export function contextGet(name) {
    const stack = contexts.get(name);
    if (!stack || stack.length === 0) {
        throw new Error(\`Lango context is unavailable: \${name}\`);
    }

    return stack.at(-1);
}

export function contextSet(name, value) {
    const stack = contexts.get(name) ?? [];
    contexts.set(name, stack);
    stack.push(value);
    return name;
}

export function contextRestore(names) {
    for (const name of names.reverse()) {
        const stack = contexts.get(name);
        stack.pop();
        if (stack.length === 0) contexts.delete(name);
    }
}
`;
