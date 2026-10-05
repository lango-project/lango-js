import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import { RUNTIME_SOURCE } from "./runtime.mjs";

export class LangoError extends Error {
    constructor(code, line, message) {
        super(`${code} at line ${line}: ${message}`);
        this.code = code;
        this.line = line;
    }
}

export async function buildFile(inputPath, outputPath) {
    const source = await readFile(inputPath, "utf8");
    const output = compile(source, inputPath);
    const outputDir = path.dirname(outputPath);
    const runtimeDir = path.join(outputDir, ".lango");

    await mkdir(runtimeDir, { recursive: true });
    await writeFile(outputPath, output.javascript, "utf8");
    await writeFile(`${outputPath}.map`, JSON.stringify({
        version: 3,
        file: path.basename(outputPath),
        sources: [path.basename(inputPath)],
        names: [],
        mappings: "",
    }, null, 2) + "\n", "utf8");
    await writeFile(path.join(runtimeDir, "runtime.mjs"), RUNTIME_SOURCE, "utf8");
}

export function compile(source, sourceName = "<source>") {
    if (source.includes("\t")) {
        throw new LangoError("LNG1001", 1, "TAB characters are not allowed");
    }

    const lines = source.split(/\r?\n/).map((text, index) => ({
        text,
        number: index + 1,
    }));
    const parser = new Parser(lines, sourceName);
    const program = parser.parseProgram();
    const emitter = new Emitter();

    return { javascript: emitter.emitProgram(program) };
}

class Parser {
    constructor(lines, sourceName) {
        this.lines = lines;
        this.sourceName = sourceName;
        this.index = 0;
    }

    parseProgram() {
        this.skipBlank();
        const header = this.take();

        if (header?.text !== "export main(args)") {
            this.fail(header, "LNG1101", "Faz 1 requires `export main(args)`");
        }

        const body = this.parseBlock(4);
        this.skipBlank();
        if (this.index !== this.lines.length) {
            this.fail(this.peek(), "LNG1102", "unexpected source after main");
        }

        return { type: "main", body };
    }

    parseBlock(indent) {
        const statements = [];

        while (true) {
            this.skipBlank();
            const line = this.peek();
            if (!line || indentation(line.text) < indent) {
                break;
            }
            if (indentation(line.text) !== indent) {
                this.fail(line, "LNG1103", `expected ${indent} spaces of indentation`);
            }

            const content = line.text.slice(indent);
            if (content.startsWith("if ")) {
                statements.push(this.parseIf(indent));
                continue;
            }
            if (content === "else") {
                break;
            }

            this.index += 1;
            statements.push(this.parseStatement(content, line));
        }

        if (statements.length === 0) {
            const line = this.peek() ?? this.lines[this.lines.length - 1];
            this.fail(line, "LNG1104", "expected a statement");
        }

        return statements;
    }

    parseIf(indent) {
        const header = this.take();
        const condition = header.text.slice(indent + 3);
        const thenBody = this.parseBlock(indent + 4);
        this.skipBlank();
        const elseLine = this.peek();
        let elseBody = null;

        if (elseLine?.text === `${" ".repeat(indent + 2)}else`) {
            this.index += 1;
            elseBody = this.parseBlock(indent + 6);
        }

        return { type: "if", condition: this.parseExpression(condition, header), thenBody, elseBody };
    }

    parseStatement(content, line) {
        const assignment = /^([A-Za-z_][A-Za-z0-9_]*) = (.+)$/.exec(content);
        if (assignment) {
            return {
                type: "assignment",
                name: assignment[1],
                value: this.parseExpression(assignment[2], line),
            };
        }

        const println = /^println\((.*)\)$/.exec(content);
        if (println) {
            return { type: "println", value: this.parseExpression(println[1], line) };
        }

        this.fail(line, "LNG1105", `unsupported Faz 1 statement: ${content}`);
    }

    parseExpression(source, line) {
        const text = source.trim();
        const greaterThan = /^(.+) > (.+)$/.exec(text);
        if (greaterThan) {
            return {
                type: "greaterThan",
                left: this.parseExpression(greaterThan[1], line),
                right: this.parseExpression(greaterThan[2], line),
            };
        }
        const translation = /^_\((.*)\)$/.exec(text);
        if (translation) {
            return { type: "translate", literal: this.parseString(translation[1], line) };
        }
        if (isStringLiteral(text)) {
            return { type: "string", literal: this.parseString(text, line) };
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*\.length$/.test(text)) {
            return { type: "length", value: text.slice(0, -7) };
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*\[\d+\]$/.test(text)) {
            const bracket = text.indexOf("[");
            return { type: "index", value: text.slice(0, bracket), index: Number(text.slice(bracket + 1, -1)) };
        }
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
            return { type: "name", value: text };
        }
        if (/^\d+$/.test(text)) {
            return { type: "number", value: Number(text) };
        }
        this.fail(line, "LNG1106", `unsupported Faz 1 expression: ${text}`);
    }

    parseString(source, line) {
        if (!isStringLiteral(source)) {
            this.fail(line, "LNG1107", "_() requires a string literal");
        }
        const quote = source[0];
        const inner = source.slice(1, -1);
        const decoded = decodeString(inner, quote, line, this);
        const parts = [];
        let cursor = 0;
        const interpolation = /\$\{([A-Za-z_][A-Za-z0-9_]*(?:\.length|\[\d+\])?)\}/g;
        let match;

        while ((match = interpolation.exec(decoded)) !== null) {
            parts.push({ text: decoded.slice(cursor, match.index), expression: match[1] });
            cursor = match.index + match[0].length;
        }
        parts.push({ text: decoded.slice(cursor), expression: null });
        return { parts };
    }

    skipBlank() {
        while (this.peek()?.text.trim() === "") {
            this.index += 1;
        }
    }

    take() {
        const line = this.peek();
        this.index += 1;
        return line;
    }

    peek() {
        return this.lines[this.index];
    }

    fail(line, code, message) {
        throw new LangoError(code, line?.number ?? 1, `${this.sourceName}: ${message}`);
    }
}

class Emitter {
    constructor() {
        this.needsPrintln = false;
        this.needsTranslate = false;
        this.declared = new Set();
    }

    emitProgram(program) {
        const body = this.emitBlock(program.body, 1);
        const imports = [];
        if (this.needsPrintln) imports.push("println as __println");
        if (this.needsTranslate) imports.push("translate as __translate");
        const importBlock = imports.length === 0 ? "" : `import {\n${imports.map((name) => `    ${name},`).join("\n")}\n} from \"./.lango/runtime.mjs\";\n\n`;

        return `${importBlock}export function main(args) {\n${body}    return null;\n}\n//# sourceMappingURL=main.mjs.map\n`;
    }

    emitBlock(statements, depth) {
        return statements.map((statement) => this.emitStatement(statement, depth)).join("");
    }

    emitStatement(statement, depth) {
        const indent = "    ".repeat(depth);
        if (statement.type === "assignment") {
            const keyword = this.declared.has(statement.name) ? "" : "let ";
            this.declared.add(statement.name);
            return `${indent}${keyword}${statement.name} = ${this.emitExpression(statement.value)};\n`;
        }
        if (statement.type === "println") {
            this.needsPrintln = true;
            return `${indent}__println(${this.emitExpression(statement.value)});\n`;
        }
        if (statement.type === "if") {
            let result = `${indent}if (${this.emitExpression(statement.condition)}) {\n`;
            result += this.emitBlock(statement.thenBody, depth + 1);
            result += `${indent}}`;
            if (statement.elseBody !== null) {
                result += " else {\n";
                result += this.emitBlock(statement.elseBody, depth + 1);
                result += `${indent}}`;
            }
            return `${result}\n`;
        }
        throw new Error(`Unhandled statement ${statement.type}`);
    }

    emitExpression(expression) {
        if (expression.type === "greaterThan") {
            return `${this.emitExpression(expression.left)} > ${this.emitExpression(expression.right)}`;
        }
        if (expression.type === "name") return expression.value;
        if (expression.type === "number") return String(expression.value);
        if (expression.type === "length") return `${expression.value}.length`;
        if (expression.type === "index") return `${expression.value}[${expression.index}]`;
        if (expression.type === "string") return this.emitString(expression.literal);
        if (expression.type === "translate") {
            this.needsTranslate = true;
            const template = expression.literal.parts.map((part, index) => `${part.text}${part.expression === null ? "" : `{${index}}`}`).join("");
            const values = expression.literal.parts.filter((part) => part.expression !== null).map((part) => this.emitInterpolation(part.expression));
            return `__translate(${JSON.stringify(template)}, [${values.join(", ")}])`;
        }
        throw new Error(`Unhandled expression ${expression.type}`);
    }

    emitString(literal) {
        if (literal.parts.length === 1) return JSON.stringify(literal.parts[0].text);
        return `\`${literal.parts.map((part) => `${escapeTemplate(part.text)}${part.expression === null ? "" : `\${${this.emitInterpolation(part.expression)}}`}`).join("")}\``;
    }

    emitInterpolation(source) {
        if (source.endsWith(".length")) return source;
        return source;
    }
}

function isStringLiteral(source) {
    return source.length >= 2 && ((source.startsWith("'") && source.endsWith("'")) || (source.startsWith('"') && source.endsWith('"')));
}

function decodeString(inner, quote, line, parser) {
    let result = "";
    for (let index = 0; index < inner.length; index += 1) {
        const character = inner[index];
        if (character !== "\\") {
            result += character;
            continue;
        }
        const escaped = inner[index + 1];
        index += 1;
        if (escaped === "n") result += "\n";
        else if (escaped === "t") result += "\t";
        else if (escaped === "r") result += "\r";
        else if (escaped === "\\" || escaped === quote || escaped === '"' || escaped === "'") result += escaped;
        else parser.fail(line, "LNG1108", `unsupported string escape \\${escaped ?? ""}`);
    }
    return result;
}

function escapeTemplate(value) {
    return value.replaceAll("`", "\\`").replaceAll("${", "\\${");
}

function indentation(line) {
    return line.length - line.trimStart().length;
}
