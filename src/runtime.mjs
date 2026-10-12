export const Decimal = Object.freeze({
    Rounding: Object.freeze({
        Up: "up", Down: "down", Ceil: "ceil", Floor: "floor",
        HalfUp: "half_up", HalfDown: "half_down", HalfEven: "half_even",
        HalfCeil: "half_ceil", HalfFloor: "half_floor",
    }),
});

const ROUNDING_MODES = Object.freeze({
    [Decimal.Rounding.Up]: "ROUND_UP", [Decimal.Rounding.Down]: "ROUND_DOWN",
    [Decimal.Rounding.Ceil]: "ROUND_CEIL", [Decimal.Rounding.Floor]: "ROUND_FLOOR",
    [Decimal.Rounding.HalfUp]: "ROUND_HALF_UP", [Decimal.Rounding.HalfDown]: "ROUND_HALF_DOWN",
    [Decimal.Rounding.HalfEven]: "ROUND_HALF_EVEN", [Decimal.Rounding.HalfCeil]: "ROUND_HALF_CEIL",
    [Decimal.Rounding.HalfFloor]: "ROUND_HALF_FLOOR",
});

export function runtimeSource(profile = {}) {
    const scale = profile.decimal_division_scale ?? 6;
    const rounding = profile.decimal_division_rounding ?? Decimal.Rounding.HalfEven;
    if (!Number.isInteger(scale) || scale < 0)
        throw new Error("decimal_division_scale must be a non-negative integer");
    if (!(rounding in ROUNDING_MODES))
        throw new Error(`unknown decimal_division_rounding ${rounding}`);
    return `import BigNumber from "./bignumber.mjs";

const Decimal = BigNumber.clone({
    DECIMAL_PLACES: ${scale},
    ROUNDING_MODE: BigNumber.${ROUNDING_MODES[rounding]},
});
Decimal.Rounding = Object.freeze(${JSON.stringify(Decimal.Rounding)});
export { Decimal };

export function decimal(value) {
    let result;
    try {
        result = new Decimal(value);
    } catch {
        throw new TypeError("Decimal value must be finite");
    }
    if (!result.isFinite())
        throw new TypeError("Decimal value must be finite");
    return result;
}

export function isDecimal(value) {
    return value instanceof Decimal;
}

export function toJsNumber(value) {
    return new Decimal(value).toNumber();
}

let catalog = {};
let output = null;
let database = null;
let failedTransaction = false;
export const DB = Object.freeze({ Active: "active", RollbackOnly: "rollback_only", Failed: "failed" });
const contexts = new Map();

export class RuntimeConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = "RuntimeConfigurationError";
    }
}

export function configure(options = {}) {
    if (options === null || typeof options !== "object" || Array.isArray(options))
        throw new RuntimeConfigurationError("runtime configuration must be an object");
    const nextCatalog = options.catalog ?? {};
    const nextOutput = options.output ?? null;
    const nextDatabase = options.database_adapter ?? null;
    if (nextCatalog === null || typeof nextCatalog !== "object" || Array.isArray(nextCatalog))
        throw new RuntimeConfigurationError("runtime catalog must be an object");
    if (nextOutput !== null && typeof nextOutput !== "function")
        throw new RuntimeConfigurationError("runtime output must be a function or null");
    if (nextDatabase !== null && (typeof nextDatabase !== "object" && typeof nextDatabase !== "function"))
        throw new RuntimeConfigurationError("runtime database_adapter must be an object or null");
    catalog = nextCatalog;
    output = nextOutput;
    database = nextDatabase;
    failedTransaction = false;
    contexts.clear();
    return null;
}

function requireDatabase() {
    if (database === null) throw new Error("DatabaseNotConfigured");
    return database;
}

export function startTrans() {
    if (failedTransaction) throw new Error("TransactionFailed");
    requireDatabase().begin();
    return null;
}
export function commitTrans() {
    if (failedTransaction) throw new Error("TransactionFailed");
    requireDatabase().commit();
    return null;
}
export function rollbackTrans() {
    const adapter = requireDatabase();
    adapter.rollback();
    if (adapter.transactionState() === null) failedTransaction = false;
    return null;
}
export function transState() {
    const state = requireDatabase().transactionState();
    return failedTransaction && state !== null ? DB.Failed : state;
}

export class SqlError extends Error {
    constructor(cause, query) {
        super(cause?.message ?? "Database error");
        this.name = "SqlError";
        this.code = typeof cause?.code === "string" ? cause.code : null;
        this.query = query;
        this.position = Number.isInteger(cause?.position) ? cause.position : null;
    }
}

export function query(sql, parameterNames) {
    const parameters = Object.create(null);
    let rows = [];
    let cursor = -1;
    let result = { changes: null, lastInsertRowid: null };
    const api = {
        execute() {
            const adapter = requireDatabase();
            const boundParameters = Object.fromEntries(
                Object.entries(parameters).map(([name, value]) => [
                    name,
                    isDecimal(value) ? value.toFixed() : value,
                ]),
            );
            try {
                result = adapter.execute(sql, boundParameters);
            } catch (error) {
                if (error?.transactionUnusable === true && adapter.transactionState() !== null)
                    failedTransaction = true;
                throw new SqlError(error, sql);
            }
            rows = result.rows;
            cursor = -1;
            return proxy;
        },
        next() {
            if (cursor + 1 >= rows.length) {
                cursor = rows.length;
                return false;
            }
            cursor += 1;
            return true;
        },
        next_result() { return false; },
    };
    const proxy = new Proxy(api, {
        get(target, name) {
            if (name === "affected_rows") return result.changes;
            if (name === "generated_key") return result.lastInsertRowid;
            if (name in target) return target[name];
            if (cursor < 0 || cursor >= rows.length) throw new Error("SqlNoCurrentRow");
            return rows[cursor][name] ?? null;
        },
        set(target, name, value) {
            if (!parameterNames.includes(name)) throw new Error("SqlUnknownParameter");
            parameters[name] = value;
            return true;
        },
    });
    return proxy;
}

export function translate(template, values) {
    const translated = catalog[template] ?? template;

    return translated.replace(/\\{(\\d+)\\}/g, (_, index) => String(values[index]));
}

export function xmlEscape(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
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
        return decimalJson(JSON.parse(text));
    } catch (error) {
        throw new Error(\`JsonParseError: \${error.message}\`);
    }
}

function decimalJson(value) {
    if (Array.isArray(value)) return value.map(decimalJson);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        key.startsWith("$") && typeof item === "number" ? decimal(item) : decimalJson(item),
    ]));
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
    if (isDecimal(value)) return JSON.rawJSON(value.toFixed());
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

export function includes(value, collection) {
    if (Array.isArray(collection)) return collection.includes(value);
    if (collection instanceof Set) return collection.has(value);
    if (collection instanceof Map) return collection.has(value);
    if (typeof collection === "string" && typeof value === "string") {
        return collection.includes(value);
    }
    if (collection !== null && typeof collection === "object" && typeof value === "string") {
        return Object.hasOwn(collection, value);
    }
    throw new Error("MembershipTarget");
}

export function entries(collection) {
    if (collection instanceof Map) return collection.entries();
    if (collection instanceof Set) return collection.entries();
    if (Array.isArray(collection)) return collection.entries();
    if (typeof collection === "string") return Array.from(collection).entries();
    if (collection !== null && typeof collection?.[Symbol.iterator] === "function") {
        return Array.from(collection).entries();
    }
    if (collection !== null && typeof collection === "object") {
        return Object.entries(collection);
    }
    throw new Error("EntriesTarget");
}

export function* range(start, end, step = 1) {
    if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        !Number.isSafeInteger(step) ||
        step === 0
    ) {
        throw new Error("RangeBounds");
    }
    for (
        let value = start;
        step > 0 ? value < end : value > end;
        value += step
    ) yield value;
}

export function add(value, ...items) {
    if (Array.isArray(value)) return value.push(...items);
    if (value !== null && typeof value?.add === "function") {
        return normalize(value.add(...items));
    }
    throw new Error("NotAddable");
}

export function remove(value, item) {
    if (Array.isArray(value)) {
        const index = value.indexOf(item);
        if (index < 0) return false;
        value.splice(index, 1);
        return true;
    }
    if (value !== null && typeof value?.remove === "function") {
        return normalize(value.remove(item));
    }
    throw new Error("NotRemovable");
}

export function remove_all(value, item) {
    if (Array.isArray(value)) {
        let removed = 0;
        for (let index = value.length - 1; index >= 0; index -= 1) {
            if (value[index] !== item) continue;
            value.splice(index, 1);
            removed += 1;
        }
        return removed;
    }
    if (value !== null && typeof value?.remove_all === "function") {
        return normalize(value.remove_all(item));
    }
    throw new Error("NotRemovable");
}

export function clear(value) {
    if (Array.isArray(value)) {
        value.length = 0;
        return null;
    }
    if (value !== null && typeof value?.clear === "function") {
        return normalize(value.clear());
    }
    throw new Error("NotClearable");
}

export function remove_at(value, index) {
    if (Array.isArray(value)) {
        if (!Number.isSafeInteger(index) || index < 0 || index >= value.length)
            return false;
        value.splice(index, 1);
        return true;
    }
    if (value !== null && typeof value?.remove_at === "function") {
        return normalize(value.remove_at(index));
    }
    throw new Error("NotRemovable");
}

export function insert_at(value, index, item) {
    if (Array.isArray(value)) {
        if (!Number.isSafeInteger(index) || index < 0 || index > value.length)
            return false;
        value.splice(index, 0, item);
        return true;
    }
    if (value !== null && typeof value?.insert_at === "function") {
        return normalize(value.insert_at(index, item));
    }
    throw new Error("NotInsertable");
}

export function optional(value, callback) {
    return value === null || value === undefined ? null : callback(value);
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

export function requireNumber(value) {
    if (typeof value !== "number") throw new Error("NumberRequired");
    return finite(value);
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
}

export const RUNTIME_SOURCE = runtimeSource();
