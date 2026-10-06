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
