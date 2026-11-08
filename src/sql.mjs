// SQL token boundaries shared by the compiler and generated runtime.
export function sqlBindings(sql) {
    const bindings = [];
    for (let i = 0; i < sql.length;) {
        if (sql.startsWith("--", i)) {
            const end = sql.indexOf("\n", i + 2);
            i = end < 0 ? sql.length : end + 1;
        } else if (sql.startsWith("/*", i)) {
            let depth = 1;
            i += 2;
            while (i < sql.length && depth) {
                if (sql.startsWith("/*", i)) { depth++; i += 2; }
                else if (sql.startsWith("*/", i)) { depth--; i += 2; }
                else i++;
            }
        } else if ("'\"`[".includes(sql[i])) {
            const start = sql[i];
            const end = start === "[" ? "]" : start;
            const escape = start === "'" && /[eE]/.test(sql[i - 1] ?? "") &&
                !/[\w$]/.test(sql[i - 2] ?? "");
            i++;
            while (i < sql.length) {
                if (escape && sql[i] === "\\") i += 2;
                else if (sql[i] === end) {
                    i++;
                    if (sql[i] !== end) break;
                    i++;
                } else i++;
            }
        } else if (sql[i] === "$" && !/[\w$]/.test(sql[i - 1] ?? "")) {
            const tag = /^\$(?:[A-Za-z_]\w*)?\$/.exec(sql.slice(i))?.[0];
            if (tag) {
                const end = sql.indexOf(tag, i + tag.length);
                i = end < 0 ? sql.length : end + tag.length;
            } else i++;
        } else if (sql[i] === ":" && sql[i - 1] !== ":" && /[A-Za-z_]/.test(sql[i + 1] ?? "")) {
            const start = i++;
            while (/\w/.test(sql[i] ?? "")) i++;
            bindings.push({ name: sql.slice(start + 1, i), start, end: i });
        } else i++;
    }
    return bindings;
}

export function postgresQuery(sql, parameters) {
    const positions = new Map();
    const values = [];
    let text = "";
    let at = 0;
    for (const binding of sqlBindings(sql)) {
        if (!Object.hasOwn(parameters, binding.name))
            throw new Error(`SqlParameterNotBound: ${binding.name}`);
        if (!positions.has(binding.name)) {
            values.push(parameters[binding.name]);
            positions.set(binding.name, values.length);
        }
        text += sql.slice(at, binding.start) + "$" + positions.get(binding.name);
        at = binding.end;
    }
    return { text: text + sql.slice(at), values };
}
