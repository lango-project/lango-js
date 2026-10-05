import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { RUNTIME_SOURCE } from "./runtime.mjs";

export class LangoError extends Error {
    constructor(code, line, message) { super(`${code} at line ${line}: ${message}`); this.code = code; }
}

export async function buildFile(inputPath, outputPath, seen = new Set()) {
    if (seen.has(inputPath)) return;
    seen.add(inputPath);
    const source = await readFile(inputPath, "utf8");
    const imports = collectImports(source, inputPath, outputPath);
    for (const item of imports) await buildFile(item.sourcePath, item.outputPath, seen);
    const output = compile(source, inputPath, imports).javascript;
    const directory = path.dirname(outputPath);
    await mkdir(path.join(directory, ".lango"), { recursive: true });
    await writeFile(outputPath, output, "utf8");
    await writeFile(`${outputPath}.map`, JSON.stringify({ version: 3, file: path.basename(outputPath), sources: [path.basename(inputPath)], names: [], mappings: "" }) + "\n");
    await writeFile(path.join(directory, ".lango/runtime.mjs"), RUNTIME_SOURCE);
}

export function compile(source, sourceName = "<source>", imports = []) {
    if (source.includes("\t")) throw new LangoError("LNG1001", 1, "TAB characters are not allowed");
    const parser = new Parser(source, sourceName);
    const program = parser.parse();
    validate(program, imports);
    return { javascript: emit(program, imports) };
}

class Parser {
    constructor(source, name) { this.lines = source.split(/\r?\n/); this.name = name; this.i = 0; }
    parse() {
        const functions = [];
        const classes = [];
        const exports = [];
        this.blank();
        while (this.i < this.lines.length) {
            const line = this.line();
            if (/^import "\.[^"]+"$/.test(line.text)) {
                while (this.peek()?.startsWith("    ")) this.i += 1;
                this.blank();
                continue;
            }
            const classHeader = /^class ([A-Za-z_]\w*)$/.exec(line.text);
            if (classHeader) {
                const classNode = { name: classHeader[1], methods: [], publicProperties: [], line: line.number };
                classes.push(classNode);
                if (this.peek() === "    properties") {
                    this.i += 1;
                    while (/^        [A-Za-z_]\w*$/.test(this.peek() ?? "")) classNode.publicProperties.push(this.lines[this.i++].trim());
                }
                this.blank();
                continue;
            }
            const exportHeader = /^export ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
            if (exportHeader) {
                exports.push({ name: exportHeader[1], parameters: this.parameters(exportHeader[2], line), line: line.number });
                this.blank();
                continue;
            }
            const methodHeader = /^([A-Za-z_]\w*):([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
            const header = methodHeader ?? /^(export )?([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
            if (!header) this.fail(line, "LNG1101", "expected a function declaration");
            const parameters = this.parameters(methodHeader ? methodHeader[3] : header[3], line);
            if (!methodHeader && header[1] && header[2] !== "main") this.fail(line, "LNG1103", "Faz 2 exports only main(args)");
            const owner = methodHeader ? classes.find((item) => item.name === methodHeader[1]) : classes.find((item) => item.name === header[2]);
            const body = this.block(4);
            if (owner) owner.methods.push({ name: methodHeader ? methodHeader[2] : "constructor", parameters, line: line.number, body });
            else functions.push({ name: header[2], parameters, exported: false, line: line.number, body });
            this.blank();
        }
        for (const exported of exports) {
            const target = functions.find((item) => item.name === exported.name && item.parameters.map((p) => p.name).join("\0") === exported.parameters.map((p) => p.name).join("\0"));
            if (!target) throw new LangoError("LNG1104", exported.line, `${this.name}: export does not match a function declaration`);
            target.exported = true;
        }
        const mains = functions.filter((item) => item.exported && item.name === "main" && item.parameters.length === 1 && item.parameters[0].name === "args");
        if (mains.length > 1) throw new LangoError("LNG1105", 1, `${this.name}: main(args) may be exported once`);
        return { functions, classes };
    }
    block(indent) {
        const body = [];
        while (true) {
            this.blank();
            const next = this.peek();
            if (!next || spaces(next) < indent) break;
            if (spaces(next) !== indent) this.fail({ text: next, number: this.i + 1 }, "LNG1105", `expected ${indent} spaces`);
            const line = this.line(); const text = line.text.slice(indent);
            if (text.startsWith("if ")) {
                const thenBody = this.block(indent + 4); this.blank(); let elseBody = null;
                if (this.peek() === `${" ".repeat(indent + 2)}else`) { this.i += 1; elseBody = this.block(indent + 6); }
                body.push({ type: "if", condition: expr(text.slice(3), line, this), thenBody, elseBody });
            } else if (text === "try") {
                const tryBody = this.block(indent + 4); this.blank(); let catchName = null; let catchBody = null; let finallyBody = null;
                const caught = /^catch ([A-Za-z_]\w*)$/.exec((this.peek() ?? "").trimStart());
                if (caught) { this.i += 1; catchName = caught[1]; catchBody = this.block(indent + 4); this.blank(); }
                if ((this.peek() ?? "").trimStart() === "finally") { this.i += 1; finallyBody = this.block(indent + 4); }
                if (!catchBody && !finallyBody) this.fail(line, "LNG1112", "try requires catch or finally");
                body.push({ type: "try", tryBody, catchName, catchBody, finallyBody });
            } else if (text.startsWith("loop while ")) {
                body.push({ type: "loop", condition: expr(text.slice(11), line, this), body: this.block(indent + 4) });
            } else if (/^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*): ([A-Za-z_]\w*)$/.test(text)) {
                const [, collection, key, value] = /^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*): ([A-Za-z_]\w*)$/.exec(text);
                body.push({ type: "forObject", collection, key, value, body: this.block(indent + 4) });
            } else if (/^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*)$/.test(text)) {
                const [, collection, item] = /^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*)$/.exec(text);
                body.push({ type: "for", collection, item, body: this.block(indent + 4) });
            } else if (text.startsWith("return ")) body.push({ type: "return", value: expr(text.slice(7), line, this) });
            else if (text.startsWith("throw ")) body.push({ type: "throw", value: expr(text.slice(6), line, this) });
            else if (text === "break" || text === "continue") body.push({ type: text });
            else if (/^[A-Za-z_]\w*\+\+$/.test(text)) body.push({ type: "increment", name: text.slice(0, -2) });
            else if (/^([A-Za-z_]\w*)\.add\((.+)\)$/.test(text)) { const [, target, value] = /^([A-Za-z_]\w*)\.add\((.+)\)$/.exec(text); body.push({ type: "add", target, value: expr(value, line, this) }); }
            else if (/^println\((.*)\)$/.test(text)) body.push({ type: "println", value: expr(text.slice(8, -1), line, this) });
            else if (/^([A-Za-z_]\w*) = \{$/.test(text)) {
                const [, name] = /^([A-Za-z_]\w*) = \{$/.exec(text);
                body.push({ type: "assign", name, value: this.object(indent) });
            } else {
                const assignment = /^(@?[A-Za-z_]\w*) = (.+)$/.exec(text);
                if (!assignment) this.fail(line, "LNG1106", `unsupported Faz 2 statement: ${text}`);
                body.push({ type: "assign", name: assignment[1], value: expr(assignment[2], line, this) });
            }
        }
        if (!body.length) this.fail({ text: "", number: this.i + 1 }, "LNG1107", "expected a statement");
        return body;
    }
    parameters(raw, line) {
        if (raw === "") return [];
        return raw.split(", ").map((item) => {
            const match = /^([A-Za-z_]\w*)(?: = (.+))?$/.exec(item);
            if (!match) this.fail(line, "LNG1102", "invalid parameter list");
            return { name: match[1], defaultValue: match[2] === undefined ? null : expr(match[2], line, this) };
        });
    }
    object(indent) {
        const fields = [];
        while (true) {
            this.blank();
            if (this.peek() === `${" ".repeat(indent)}}`) { this.i += 1; break; }
            if (!this.peek() || spaces(this.peek()) !== indent + 4) this.fail({ number: this.i + 1 }, "LNG1110", "expected an object field or closing brace");
            const line = this.line();
            const match = /^([A-Za-z_]\w*): (.+)$/.exec(line.text.slice(indent + 4));
            if (!match) this.fail(line, "LNG1111", "expected `key: value`");
            fields.push({ key: match[1], value: expr(match[2], line, this) });
        }
        return { type: "object", fields };
    }
    blank() { while (this.peek()?.trim() === "") this.i += 1; }
    peek() { return this.lines[this.i]; }
    line() { return { text: this.lines[this.i++], number: this.i }; }
    fail(line, code, message) { throw new LangoError(code, line.number, `${this.name}: ${message}`); }
}

function expr(source, line, parser) {
    const text = source.trim();
    if (text.startsWith("[") && text.endsWith("]")) return { type: "array", values: text.slice(1, -1) === "" ? [] : text.slice(1, -1).split(", ").map((item) => expr(item, line, parser)) };
    for (const operator of ["==", ">", "<", "+", "-", "*", "/"]) {
        const index = text.indexOf(` ${operator} `);
        if (index > -1) return { type: "binary", operator, left: expr(text.slice(0, index), line, parser), right: expr(text.slice(index + operator.length + 2), line, parser) };
    }
    const localize = /^_\((.*)\)$/.exec(text);
    if (localize) return { type: "translate", literal: literal(localize[1], line, parser) };
    const construct = /^new ([A-Za-z_]\w*)\((.*)\)$/.exec(text);
    if (construct) return { type: "new", name: construct[1], arguments: construct[2] ? construct[2].split(", ").map((item) => expr(item, line, parser)) : [] };
    const methodCall = /^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\((.*)\)$/.exec(text);
    if (methodCall) return { type: "methodCall", receiver: methodCall[1], name: methodCall[2], arguments: methodCall[3] ? methodCall[3].split(", ").map((item) => expr(item, line, parser)) : [] };
    const call = /^([A-Za-z_]\w*)\((.*)\)$/.exec(text);
    if (call) return { type: "call", name: call[1], arguments: call[2] ? call[2].split(", ").map((item) => expr(item, line, parser)) : [], line: line.number };
    if (/^['"].*['"]$/.test(text)) return { type: "string", literal: literal(text, line, parser) };
    if (/^\d+$/.test(text)) return { type: "raw", value: text };
    if (/^(true|false|null)$/.test(text)) return { type: "raw", value: text };
    if (/^[A-Za-z_]\w*\.[A-Za-z_]\w*$/.test(text)) return { type: "raw", value: text };
    if (/^[A-Za-z_]\w*\[\d+\]$/.test(text)) return { type: "raw", value: text };
    if (/^@?[A-Za-z_]\w*$/.test(text)) return { type: "raw", value: text };
    parser.fail(line, "LNG1108", `unsupported Faz 2 expression: ${text}`);
}

function literal(value, line, parser) {
    const quote = value[0];
    if (!((quote === "'" || quote === '"') && value.at(-1) === quote)) parser.fail(line, "LNG1109", "expected a string literal");
    const decoded = value.slice(1, -1).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\(['"\\])/g, "$1");
    const parts = []; let at = 0; const regex = /\$\{([A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\[\d+\])?)\}/g; let match;
    while ((match = regex.exec(decoded))) { parts.push({ text: decoded.slice(at, match.index), value: match[1] }); at = match.index + match[0].length; }
    parts.push({ text: decoded.slice(at), value: null }); return parts;
}

function validate(program, imports = []) {
    const names = new Map(program.functions.map((item) => [item.name, item]));
    const imported = new Set(imports.flatMap((item) => item.names));
    if (names.size !== program.functions.length) throw new LangoError("LNG1201", 1, "duplicate function name");
    const walk = (value) => { if (!value || typeof value !== "object") return; if (value.type === "call") { const target = names.get(value.name); if (!target && !imported.has(value.name)) throw new LangoError("LNG1202", value.line, `unknown Lango function ${value.name}`); if (target) { const required = target.parameters.filter((p) => p.defaultValue === null).length; if (value.arguments.length < required || value.arguments.length > target.parameters.length) throw new LangoError("LNG1203", value.line, `${value.name} expects ${required}-${target.parameters.length} arguments, got ${value.arguments.length}`); } } Object.values(value).forEach((item) => Array.isArray(item) ? item.forEach(walk) : walk(item)); };
    program.functions.forEach(walk);
}

function emit(program, moduleImports = []) {
    const flags = { print: false, translate: false };
    const classes = program.classes.map((item) => emitClass(item, flags)).join("\n");
    const functions = program.functions.map((fn) => emitFunction(fn, flags)).join("\n");
    const helpers = [flags.print && "println as __println", flags.translate && "translate as __translate"].filter(Boolean);
    const imports = helpers.length ? `import {\n${helpers.map((item) => `    ${item},`).join("\n")}\n} from \"./.lango/runtime.mjs\";\n\n` : "";
    const modules = moduleImports.map((item) => `import { ${item.names.join(", ")} } from ${JSON.stringify(item.specifier)};\n`).join("");
    return `${modules}${imports}${classes}${functions}//# sourceMappingURL=main.mjs.map\n`;
}
function emitClass(item, flags) { const prior = flags.publicProperties; flags.publicProperties = new Set(item.publicProperties); const fields = [...new Set(item.methods.flatMap((method) => JSON.stringify(method.body).match(/@([A-Za-z_]\w*)/g) ?? []).map((name) => name.slice(1)))].filter((field) => !flags.publicProperties.has(field)); const body = item.methods.map((method) => { const declared = new Set(method.parameters.map((p) => p.name)); const parameters = method.parameters.map((p) => p.defaultValue === null ? p.name : `${p.name} = ${emitExpr(p.defaultValue, flags)}`).join(", "); const suffix = method.name === "constructor" ? "" : "    return null;\n"; return `    ${method.name}(${parameters}) {\n${method.body.map((node) => emitStatement(node, 2, declared, flags)).join("")}${suffix}    }\n`; }).join(""); flags.publicProperties = prior; return `class ${item.name} {\n${item.publicProperties.map((field) => `    ${field};\n`).join("")}${fields.map((field) => `    #${field};\n`).join("")}${body}}\n`; }
function emitFunction(fn, flags) { const declared = new Set(fn.parameters.map((p) => p.name)); const parameters = fn.parameters.map((p) => p.defaultValue === null ? p.name : `${p.name} = ${emitExpr(p.defaultValue, flags)}`).join(", "); return `${fn.exported ? "export " : ""}function ${fn.name}(${parameters}) {\n${fn.body.map((item) => emitStatement(item, 1, declared, flags)).join("")}    return null;\n}\n`; }
function emitStatement(node, depth, declared, flags) { const pad = "    ".repeat(depth); if (node.type === "assign") { const property = node.name.slice(1); const target = node.name.startsWith("@") ? flags.publicProperties?.has(property) ? `this.${property}` : `this.#${property}` : node.name; const prefix = node.name.startsWith("@") || declared.has(node.name) ? "" : "let "; declared.add(node.name); return `${pad}${prefix}${target} = ${emitExpr(node.value, flags)};\n`; } if (node.type === "increment") return `${pad}${node.name} += 1;\n`; if (node.type === "add") return `${pad}${node.target}.push(${emitExpr(node.value, flags)});\n`; if (node.type === "return") return `${pad}return ${emitExpr(node.value, flags)};\n`; if (node.type === "throw") return `${pad}throw ${emitExpr(node.value, flags)};\n`; if (node.type === "println") { flags.print = true; return `${pad}__println(${emitExpr(node.value, flags)});\n`; } if (node.type === "break" || node.type === "continue") return `${pad}${node.type};\n`; if (node.type === "try") { let out = `${pad}try {\n${node.tryBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`; if (node.catchBody) out += ` catch (${node.catchName}) {\n${node.catchBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`; if (node.finallyBody) out += ` finally {\n${node.finallyBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`; return `${out}\n`; } if (node.type === "loop") return `${pad}while (${emitExpr(node.condition, flags)}) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`; if (node.type === "for") return `${pad}for (const ${node.item} of ${node.collection}) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`; if (node.type === "forObject") return `${pad}for (const [${node.key}, ${node.value}] of Object.entries(${node.collection})) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`; let out = `${pad}if (${emitExpr(node.condition, flags)}) {\n${node.thenBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`; if (node.elseBody) out += ` else {\n${node.elseBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`; return `${out}\n`; }
function emitExpr(node, flags) { if (node.type === "raw") return node.value.startsWith("@") ? flags.publicProperties?.has(node.value.slice(1)) ? `this.${node.value.slice(1)}` : `this.#${node.value.slice(1)}` : node.value; if (node.type === "new") return `new ${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`; if (node.type === "methodCall") return `${node.receiver}.${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`; if (node.type === "array") return `[${node.values.map((item) => emitExpr(item, flags)).join(", ")}]`; if (node.type === "object") return `{ ${node.fields.map((item) => `${item.key}: ${emitExpr(item.value, flags)}`).join(", ")} }`; if (node.type === "binary") return `${emitExpr(node.left, flags)} ${node.operator} ${emitExpr(node.right, flags)}`; if (node.type === "call") return `${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`; if (node.type === "string") return emitString(node.literal, flags); flags.translate = true; const template = node.literal.map((item, index) => `${item.text}${item.value === null ? "" : `{${index}}`}`).join(""); const values = node.literal.filter((item) => item.value).map((item) => item.value); return `__translate(${JSON.stringify(template)}, [${values.join(", ")}])`; }
function emitString(parts) { if (parts.length === 1) return JSON.stringify(parts[0].text); return `\`${parts.map((item) => `${item.text.replaceAll("`", "\\`")}${item.value === null ? "" : `\${${item.value}}`}`).join("")}\``; }
function spaces(line) { return line.length - line.trimStart().length; }
function collectImports(source, inputPath, outputPath) {
    const lines = source.split(/\r?\n/); const items = [];
    for (let index = 0; index < lines.length; index += 1) {
        const match = /^import "(\.[^"]+)"$/.exec(lines[index]);
        if (!match) continue;
        const names = [];
        while (/^    ([A-Za-z_]\w*)\([^)]*\)$/.test(lines[index + 1] ?? "")) names.push(/^    ([A-Za-z_]\w*)/.exec(lines[++index])[1]);
        const sourcePath = path.resolve(path.dirname(inputPath), `${match[1]}.lango`);
        const outputPathForImport = path.resolve(path.dirname(outputPath), `${match[1]}.mjs`);
        items.push({ names, sourcePath, outputPath: outputPathForImport, specifier: `./${path.basename(outputPathForImport)}` });
    }
    return items;
}
