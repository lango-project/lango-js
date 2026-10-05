import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { RUNTIME_SOURCE } from "./runtime.mjs";

export class LangoError extends Error {
    constructor(code, line, message) { super(`${code} at line ${line}: ${message}`); this.code = code; }
}

export async function buildFile(inputPath, outputPath) {
    const output = compile(await readFile(inputPath, "utf8"), inputPath).javascript;
    const directory = path.dirname(outputPath);
    await mkdir(path.join(directory, ".lango"), { recursive: true });
    await writeFile(outputPath, output, "utf8");
    await writeFile(`${outputPath}.map`, JSON.stringify({ version: 3, file: path.basename(outputPath), sources: [path.basename(inputPath)], names: [], mappings: "" }) + "\n");
    await writeFile(path.join(directory, ".lango/runtime.mjs"), RUNTIME_SOURCE);
}

export function compile(source, sourceName = "<source>") {
    if (source.includes("\t")) throw new LangoError("LNG1001", 1, "TAB characters are not allowed");
    const parser = new Parser(source, sourceName);
    const program = parser.parse();
    validate(program);
    return { javascript: emit(program) };
}

class Parser {
    constructor(source, name) { this.lines = source.split(/\r?\n/); this.name = name; this.i = 0; }
    parse() {
        const functions = [];
        const exports = [];
        this.blank();
        while (this.i < this.lines.length) {
            const line = this.line();
            const exportHeader = /^export ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
            if (exportHeader) {
                exports.push({ name: exportHeader[1], parameters: exportHeader[2] ? exportHeader[2].split(", ") : [], line: line.number });
                this.blank();
                continue;
            }
            const header = /^(export )?([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
            if (!header) this.fail(line, "LNG1101", "expected a function declaration");
            const parameters = header[3] ? header[3].split(", ") : [];
            if (parameters.some((item) => !/^[A-Za-z_]\w*$/.test(item))) this.fail(line, "LNG1102", "invalid parameter list");
            if (header[1] && header[2] !== "main") this.fail(line, "LNG1103", "Faz 2 exports only main(args)");
            functions.push({ name: header[2], parameters, exported: false, line: line.number, body: this.block(4) });
            this.blank();
        }
        for (const exported of exports) {
            const target = functions.find((item) => item.name === exported.name && item.parameters.join("\0") === exported.parameters.join("\0"));
            if (!target) throw new LangoError("LNG1104", exported.line, `${this.name}: export does not match a function declaration`);
            target.exported = true;
        }
        if (functions.filter((item) => item.exported && item.name === "main" && item.parameters.join() === "args").length !== 1) throw new LangoError("LNG1105", 1, `${this.name}: exactly one export main(args) is required`);
        return { functions };
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
            } else if (text.startsWith("loop while ")) {
                body.push({ type: "loop", condition: expr(text.slice(11), line, this), body: this.block(indent + 4) });
            } else if (/^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*): ([A-Za-z_]\w*)$/.test(text)) {
                const [, collection, key, value] = /^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*): ([A-Za-z_]\w*)$/.exec(text);
                body.push({ type: "forObject", collection, key, value, body: this.block(indent + 4) });
            } else if (/^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*)$/.test(text)) {
                const [, collection, item] = /^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*)$/.exec(text);
                body.push({ type: "for", collection, item, body: this.block(indent + 4) });
            } else if (text.startsWith("return ")) body.push({ type: "return", value: expr(text.slice(7), line, this) });
            else if (text === "break" || text === "continue") body.push({ type: text });
            else if (/^[A-Za-z_]\w*\+\+$/.test(text)) body.push({ type: "increment", name: text.slice(0, -2) });
            else if (/^([A-Za-z_]\w*)\.add\((.+)\)$/.test(text)) { const [, target, value] = /^([A-Za-z_]\w*)\.add\((.+)\)$/.exec(text); body.push({ type: "add", target, value: expr(value, line, this) }); }
            else if (/^println\((.*)\)$/.test(text)) body.push({ type: "println", value: expr(text.slice(8, -1), line, this) });
            else if (/^([A-Za-z_]\w*) = \{$/.test(text)) {
                const [, name] = /^([A-Za-z_]\w*) = \{$/.exec(text);
                body.push({ type: "assign", name, value: this.object(indent) });
            } else {
                const assignment = /^([A-Za-z_]\w*) = (.+)$/.exec(text);
                if (!assignment) this.fail(line, "LNG1106", `unsupported Faz 2 statement: ${text}`);
                body.push({ type: "assign", name: assignment[1], value: expr(assignment[2], line, this) });
            }
        }
        if (!body.length) this.fail({ text: "", number: this.i + 1 }, "LNG1107", "expected a statement");
        return body;
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
    const call = /^([A-Za-z_]\w*)\((.*)\)$/.exec(text);
    if (call) return { type: "call", name: call[1], arguments: call[2] ? call[2].split(", ").map((item) => expr(item, line, parser)) : [], line: line.number };
    if (/^['"].*['"]$/.test(text)) return { type: "string", literal: literal(text, line, parser) };
    if (/^\d+$/.test(text)) return { type: "raw", value: text };
    if (/^(true|false|null)$/.test(text)) return { type: "raw", value: text };
    if (/^[A-Za-z_]\w*\.[A-Za-z_]\w*$/.test(text)) return { type: "raw", value: text };
    if (/^[A-Za-z_]\w*\[\d+\]$/.test(text)) return { type: "raw", value: text };
    if (/^[A-Za-z_]\w*$/.test(text)) return { type: "raw", value: text };
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

function validate(program) {
    const names = new Map(program.functions.map((item) => [item.name, item]));
    if (names.size !== program.functions.length) throw new LangoError("LNG1201", 1, "duplicate function name");
    const walk = (value) => { if (!value || typeof value !== "object") return; if (value.type === "call") { const target = names.get(value.name); if (!target) throw new LangoError("LNG1202", value.line, `unknown Lango function ${value.name}`); if (target.parameters.length !== value.arguments.length) throw new LangoError("LNG1203", value.line, `${value.name} expects ${target.parameters.length} arguments, got ${value.arguments.length}`); } Object.values(value).forEach((item) => Array.isArray(item) ? item.forEach(walk) : walk(item)); };
    program.functions.forEach(walk);
}

function emit(program) {
    const flags = { print: false, translate: false };
    const functions = program.functions.map((fn) => emitFunction(fn, flags)).join("\n");
    const helpers = [flags.print && "println as __println", flags.translate && "translate as __translate"].filter(Boolean);
    const imports = helpers.length ? `import {\n${helpers.map((item) => `    ${item},`).join("\n")}\n} from \"./.lango/runtime.mjs\";\n\n` : "";
    return `${imports}${functions}//# sourceMappingURL=main.mjs.map\n`;
}
function emitFunction(fn, flags) { const declared = new Set(fn.parameters); return `${fn.exported ? "export " : ""}function ${fn.name}(${fn.parameters.join(", ")}) {\n${fn.body.map((item) => emitStatement(item, 1, declared, flags)).join("")}    return null;\n}\n`; }
function emitStatement(node, depth, declared, flags) { const pad = "    ".repeat(depth); if (node.type === "assign") { const prefix = declared.has(node.name) ? "" : "let "; declared.add(node.name); return `${pad}${prefix}${node.name} = ${emitExpr(node.value, flags)};\n`; } if (node.type === "increment") return `${pad}${node.name} += 1;\n`; if (node.type === "add") return `${pad}${node.target}.push(${emitExpr(node.value, flags)});\n`; if (node.type === "return") return `${pad}return ${emitExpr(node.value, flags)};\n`; if (node.type === "println") { flags.print = true; return `${pad}__println(${emitExpr(node.value, flags)});\n`; } if (node.type === "break" || node.type === "continue") return `${pad}${node.type};\n`; if (node.type === "loop") return `${pad}while (${emitExpr(node.condition, flags)}) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`; if (node.type === "for") return `${pad}for (const ${node.item} of ${node.collection}) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`; if (node.type === "forObject") return `${pad}for (const [${node.key}, ${node.value}] of Object.entries(${node.collection})) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`; let out = `${pad}if (${emitExpr(node.condition, flags)}) {\n${node.thenBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`; if (node.elseBody) out += ` else {\n${node.elseBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`; return `${out}\n`; }
function emitExpr(node, flags) { if (node.type === "raw") return node.value; if (node.type === "array") return `[${node.values.map((item) => emitExpr(item, flags)).join(", ")}]`; if (node.type === "object") return `{ ${node.fields.map((field) => `${field.key}: ${emitExpr(field.value, flags)}`).join(", ")} }`; if (node.type === "binary") return `${emitExpr(node.left, flags)} ${node.operator} ${emitExpr(node.right, flags)}`; if (node.type === "call") return `${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`; if (node.type === "string") return emitString(node.literal, flags); flags.translate = true; const template = node.literal.map((item, index) => `${item.text}${item.value === null ? "" : `{${index}}`}`).join(""); const values = node.literal.filter((item) => item.value).map((item) => item.value); return `__translate(${JSON.stringify(template)}, [${values.join(", ")}])`; }
function emitString(parts) { if (parts.length === 1) return JSON.stringify(parts[0].text); return `\`${parts.map((item) => `${item.text.replaceAll("`", "\\`")}${item.value === null ? "" : `\${${item.value}}`}`).join("")}\``; }
function spaces(line) { return line.length - line.trimStart().length; }
