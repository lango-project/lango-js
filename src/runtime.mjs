export const RUNTIME_SOURCE = `let catalog = {};
let output = null;
const contexts = new Map();

export function configure(options = {}) {
    catalog = options.catalog ?? {};
    output = options.output ?? null;
    contexts.clear();
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
        return JSON.stringify(jsonValue(value));
    } catch (error) {
        if (error.message === "NonFiniteNumber" || error.message === "JsonCycle") {
            throw error;
        }
        throw new Error(\`JsonUnsupported: \${error.message}\`);
    }
}

function jsonValue(value, ancestors = new Set()) {
    if (value === undefined) return null;
    if (value === null || typeof value === "string" || typeof value === "boolean") {
        return value;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) throw new Error("NonFiniteNumber");
        return value;
    }
    if (typeof value === "function" || typeof value !== "object") {
        throw new Error("unsupported value");
    }
    if (ancestors.has(value)) throw new Error("JsonCycle");

    ancestors.add(value);
    try {
        if (Array.isArray(value)) return value.map((item) => jsonValue(item, ancestors));
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new Error("unsupported value");
        }
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [key, jsonValue(item, ancestors)]),
        );
    } finally {
        ancestors.delete(value);
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

export function assert(value, location) {
    if (!value) throw new Error(\`AssertionFailed at \${location}\`);
    return null;
}

export function normalize(value) {
    if (value === undefined) return null;
    if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error("NonFiniteNumber");
    }
    return value;
}

export function finite(value) {
    if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error("NonFiniteNumber");
    }
    return value;
}

export function call(value, ...arguments_) {
    if (typeof value !== "function") throw new Error("NotCallable");
    return normalize(value(...arguments_));
}

export function boundary(value) {
    return finite(normalize(value));
}

export function requireArity(actual, requiredPositions, name) {
    const missing = requiredPositions.find((position) => actual <= position);
    if (missing !== undefined) {
        throw new Error(\`ArityError: \${name} is missing required argument \${missing + 1}\`);
    }
    return null;
}

export function withArity(callback, requiredPositions, name) {
    return function (...arguments_) {
        requireArity(arguments_.length, requiredPositions, name);
        return callback(...arguments_);
    };
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
