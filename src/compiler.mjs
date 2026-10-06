import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { RUNTIME_SOURCE } from "./runtime.mjs";

export class LangoError extends Error {
  constructor(code, line, message) {
    super(`${code} at line ${line}: ${message}`);
    this.code = code;
  }
}

export async function buildFile(inputPath, outputPath, seen = new Set()) {
  if (seen.has(inputPath)) return;
  seen.add(inputPath);

  const source = await readFile(inputPath, "utf8");
  const imports = collectImports(source, inputPath, outputPath);
  for (const item of imports)
    await buildFile(item.sourcePath, item.outputPath, seen);

  const output = compile(source, inputPath, imports).javascript;
  const directory = path.dirname(outputPath);

  await mkdir(path.join(directory, ".lango"), { recursive: true });
  await writeFile(outputPath, output, "utf8");
  await writeFile(
    `${outputPath}.map`,
    JSON.stringify({
      version: 3,
      file: path.basename(outputPath),
      sources: [path.basename(inputPath)],
      names: [],
      mappings: "",
    }) + "\n",
  );
  await writeFile(path.join(directory, ".lango/runtime.mjs"), RUNTIME_SOURCE);
}

export function compile(source, sourceName = "<source>", imports = []) {
  if (source.includes("\t"))
    throw new LangoError("LNG1001", 1, "TAB characters are not allowed");
  const parser = new Parser(source, sourceName);
  const program = parser.parse();
  validate(program, imports);
  return { javascript: emit(program, imports) };
}

class Parser {
  constructor(source, name) {
    this.lines = source.split(/\r?\n/);
    this.name = name;
    this.i = 0;
  }
  parse() {
    const functions = [];
    const classes = [];
    const exports = [];
    const globals = [];
    let declarationSeen = false;
    let exportedClassSeen = false;
    this.blank();
    while (this.i < this.lines.length) {
      const line = this.line();
      if (/^import "\.[^"]+"$/.test(line.text)) {
        while (this.peek()?.startsWith("    ")) this.i += 1;
        this.blank();
        continue;
      }
      const globalDeclaration = /^global ([A-Za-z_]\w*) = (.+)$/.exec(
        line.text,
      );
      if (globalDeclaration) {
        if (declarationSeen)
          this.fail(line, "LNG1119", "globals must precede class and function declarations");
        globals.push({
          name: globalDeclaration[1],
          value: expr(globalDeclaration[2], line, this),
          line: line.number,
        });
        this.blank();
        continue;
      }
      const classHeader =
        /^(export )?class ([A-Za-z_]\w*)(?: : ([A-Za-z_]\w*))?$/.exec(
          line.text,
        );
      if (classHeader) {
        declarationSeen = true;
        if (classHeader[1] && exportedClassSeen)
          this.fail(line, "LNG1114", "a file may export one class");
        exportedClassSeen ||= Boolean(classHeader[1]);
        const classNode = {
          name: classHeader[2],
          ancestor: classHeader[3] ?? null,
          exported: Boolean(classHeader[1]),
          methods: [],
          publicMethods: [],
          publicProperties: [],
          staticValues: [],
          enumValues: [],
          line: line.number,
        };
        classes.push(classNode);
        while (
          this.peek() === "    properties" ||
          this.peek() === "    methods" ||
          this.peek() === "    static" ||
          this.peek() === "    enum"
        ) {
          const section = this.line().text.trim();
          if (section === "properties") {
            while (/^        [A-Za-z_]\w*$/.test(this.peek() ?? ""))
              classNode.publicProperties.push(this.lines[this.i++].trim());
          } else if (section === "methods") {
            while (true) {
              const methodLine = this.peek() ?? "";
              const method = /^        ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(
                methodLine,
              );
              const staticMethod = /^        ::([A-Za-z_]\w*)\(([^)]*)\)$/.exec(
                methodLine,
              );
              if (!method && !staticMethod) break;
              const declaration = method ?? staticMethod;
              classNode.publicMethods.push({
                name: declaration[1],
                static: Boolean(staticMethod),
                parameters: this.parameters(declaration[2], {
                  number: this.i + 1,
                }),
              });
              this.i += 1;
            }
          } else {
            while (/^        [A-Za-z_]\w* = .+$/.test(this.peek() ?? "")) {
              const valueLine = this.line();
              const [, name, value] = /^        ([A-Za-z_]\w*) = (.+)$/.exec(
                valueLine.text,
              );
              classNode[
                section === "enum" ? "enumValues" : "staticValues"
              ].push({ name, value: expr(value, valueLine, this) });
            }
          }
        }
        this.blank();
        continue;
      }
      const exportHeader = /^export ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
      if (exportHeader) {
        if (declarationSeen)
          this.fail(
            line,
            "LNG1113",
            "exports must precede class and function declarations",
          );
        exports.push({
          name: exportHeader[1],
          parameters: this.parameters(exportHeader[2], line),
          line: line.number,
        });
        this.blank();
        continue;
      }
      const staticMethodHeader =
        /^([A-Za-z_]\w*)::([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
      const methodHeader = /^([A-Za-z_]\w*):([A-Za-z_]\w*)\(([^)]*)\)$/.exec(
        line.text,
      );
      const header =
        staticMethodHeader ??
        methodHeader ??
        /^(export )?([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
      if (!header)
        this.fail(line, "LNG1101", "expected a function declaration");
      declarationSeen = true;
      const parameters = this.parameters(
        (staticMethodHeader ?? methodHeader) ? header[3] : header[3],
        line,
      );
      if (
        !staticMethodHeader &&
        !methodHeader &&
        header[1] &&
        header[2] !== "main"
      )
        this.fail(line, "LNG1103", "Faz 2 exports only main(args)");
      const owner =
        (staticMethodHeader ?? methodHeader)
          ? classes.find((item) => item.name === header[1])
          : classes.find((item) => item.name === header[2]);
      const body = this.block(4);
      if (owner) {
        const isStatic = Boolean(staticMethodHeader);
        const name =
          (staticMethodHeader ?? methodHeader) ? header[2] : "constructor";
        owner.methods.push({
          name,
          static: isStatic,
          public: owner.publicMethods.some(
            (item) => item.name === name && item.static === isStatic,
          ),
          parameters,
          line: line.number,
          body,
        });
      } else
        functions.push({
          name: header[2],
          parameters,
          exported: false,
          line: line.number,
          body,
        });
      this.blank();
    }
    for (const exported of exports) {
      const target = functions.find(
        (item) =>
          item.name === exported.name &&
          item.parameters.map((p) => p.name).join("\0") ===
            exported.parameters.map((p) => p.name).join("\0"),
      );
      if (!target)
        throw new LangoError(
          "LNG1104",
          exported.line,
          `${this.name}: export does not match a function declaration`,
        );
      target.exported = true;
    }
    const mains = functions.filter(
      (item) =>
        item.exported &&
        item.name === "main" &&
        item.parameters.length === 1 &&
        item.parameters[0].name === "args",
    );
    if (mains.length > 1)
      throw new LangoError(
        "LNG1105",
        1,
        `${this.name}: main(args) may be exported once`,
      );
    return { functions, classes, globals };
  }
  block(indent) {
    const body = [];
    while (true) {
      this.blank();
      const next = this.peek();
      if (!next || spaces(next) < indent) break;
      if (spaces(next) !== indent)
        this.fail(
          { text: next, number: this.i + 1 },
          "LNG1105",
          `expected ${indent} spaces`,
        );
      const line = this.line();
      const text = line.text.slice(indent);
      if (/^global ([A-Za-z_]\w*)$/.test(text)) {
        const [, name] = /^global ([A-Za-z_]\w*)$/.exec(text);
        body.push({ type: "globalDeclare", name, line: line.number });
      } else if (/^context ([A-Za-z_]\w*) = (.+)$/.test(text)) {
        const [, name, value] = /^context ([A-Za-z_]\w*) = (.+)$/.exec(text);
        body.push({ type: "contextSet", name, value: expr(value, line, this) });
      } else if (/^context ([A-Za-z_]\w*)$/.test(text)) {
        const [, name] = /^context ([A-Za-z_]\w*)$/.exec(text);
        body.push({ type: "contextDeclare", name, line: line.number });
      } else if (text.startsWith("if ")) {
        const thenBody = this.block(indent + 4);
        this.blank();
        let elseBody = null;
        if (this.peek() === `${" ".repeat(indent + 2)}else`) {
          this.i += 1;
          elseBody = this.block(indent + 6);
        }
        body.push({
          type: "if",
          condition: expr(text.slice(3), line, this),
          thenBody,
          elseBody,
        });
      } else if (text === "switch" || text.startsWith("switch ")) {
        const value =
          text === "switch" ? null : expr(text.slice(7), line, this);
        const cases = [];
        let elseBody = null;
        while (true) {
          this.blank();
          const label = this.peek();
          if (!label || spaces(label) !== indent + 2) break;
          const labelText = label.trim();
          if (labelText === "else") {
            this.i += 1;
            elseBody = this.block(indent + 6);
            break;
          }
          if (!labelText.startsWith("case "))
            this.fail(
              { text: label, number: this.i + 1 },
              "LNG1116",
              "expected case or else",
            );
          const tests = [];
          while (
            spaces(this.peek() ?? "") === indent + 2 &&
            (this.peek() ?? "").trim().startsWith("case ")
          ) {
            const caseLine = this.line();
            tests.push(expr(caseLine.text.trim().slice(5), caseLine, this));
            this.blank();
          }
          cases.push({ tests, body: this.block(indent + 6) });
        }
        if (!cases.length) this.fail(line, "LNG1116", "switch requires a case");
        body.push({ type: "switch", value, cases, elseBody });
      } else if (text === "try") {
        const tryBody = this.block(indent + 4);
        this.blank();
        let catchName = null;
        let catchBody = null;
        let finallyBody = null;
        const caught = /^catch ([A-Za-z_]\w*)$/.exec(
          (this.peek() ?? "").trimStart(),
        );
        if (caught) {
          this.i += 1;
          catchName = caught[1];
          catchBody = this.block(indent + 4);
          this.blank();
        }
        if ((this.peek() ?? "").trimStart() === "finally") {
          this.i += 1;
          finallyBody = this.block(indent + 4);
        }
        if (!catchBody && !finallyBody)
          this.fail(line, "LNG1112", "try requires catch or finally");
        body.push({ type: "try", tryBody, catchName, catchBody, finallyBody });
      } else if (text.startsWith("loop while ")) {
        body.push({
          type: "loop",
          condition: expr(text.slice(11), line, this),
          body: this.block(indent + 4),
        });
      } else if (
        /^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*): ([A-Za-z_]\w*)$/.test(text)
      ) {
        const [, collection, key, value] =
          /^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*): ([A-Za-z_]\w*)$/.exec(text);
        body.push({
          type: "forObject",
          collection,
          key,
          value,
          body: this.block(indent + 4),
        });
      } else if (/^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*)$/.test(text)) {
        const [, collection, item] =
          /^for ([A-Za-z_]\w*) as ([A-Za-z_]\w*)$/.exec(text);
        body.push({
          type: "for",
          collection,
          item,
          body: this.block(indent + 4),
        });
      } else if (text === "return") body.push({ type: "return", value: null });
      else if (/^return \(([^)]*)\)$/.test(text)) {
        const [, rawParameters] = /^return \(([^)]*)\)$/.exec(text);
        body.push({
          type: "return",
          value: {
            type: "closure",
            parameters: this.parameters(rawParameters, line),
            captures: this.captures(),
            line: line.number,
            body: this.block(indent + 4),
          },
        });
      } else if (text.startsWith("return "))
        body.push({ type: "return", value: expr(text.slice(7), line, this) });
      else if (text.startsWith("throw "))
        body.push({ type: "throw", value: expr(text.slice(6), line, this) });
      else if (/^super\((.*)\)$/.test(text)) {
        const [, argumentsText] = /^super\((.*)\)$/.exec(text);
        body.push({
          type: "superConstructor",
          arguments: argumentsText
            ? argumentsText.split(", ").map((item) => expr(item, line, this))
            : [],
        });
      } else if (text === "break" || text === "continue")
        body.push({ type: text });
      else if (/^[A-Za-z_]\w*\+\+$/.test(text))
        body.push({ type: "increment", name: text.slice(0, -2) });
      else if (/^([A-Za-z_]\w*)\.add\((.+)\)$/.test(text)) {
        const [, target, value] = /^([A-Za-z_]\w*)\.add\((.+)\)$/.exec(text);
        body.push({ type: "add", target, value: expr(value, line, this) });
      } else if (/^println\((.*)\)$/.test(text))
        body.push({
          type: "println",
          value: expr(text.slice(8, -1), line, this),
        });
      else if (/^[A-Za-z_]\w*\.[A-Za-z_]\w*\(.*\)$/.test(text))
        body.push({ type: "expression", value: expr(text, line, this) });
      else if (/^[A-Za-z_]\w*\(.*\)$/.test(text))
        body.push({ type: "expression", value: expr(text, line, this) });
      else if (/^([A-Za-z_]\w*) = \(([^)]*)\)$/.test(text)) {
        const [, name, rawParameters] = /^([A-Za-z_]\w*) = \(([^)]*)\)$/.exec(
          text,
        );
        body.push({
          type: "closureAssign",
          name,
          parameters: this.parameters(rawParameters, line),
          captures: this.captures(),
          line: line.number,
          body: this.block(indent + 4),
        });
      } else if (/^([A-Za-z_]\w*) = \{$/.test(text)) {
        const [, name] = /^([A-Za-z_]\w*) = \{$/.exec(text);
        body.push({ type: "assign", name, value: this.object(indent) });
      } else {
        const assignment = /^(@{0,2}[A-Za-z_]\w*) = (.+)$/.exec(text);
        if (!assignment)
          this.fail(line, "LNG1106", `unsupported Faz 2 statement: ${text}`);
        body.push({
          type: "assign",
          name: assignment[1],
          value: expr(assignment[2], line, this),
        });
      }
    }
    if (!body.length)
      this.fail(
        { text: "", number: this.i + 1 },
        "LNG1107",
        "expected a statement",
      );
    return body;
  }
  parameters(raw, line) {
    if (raw === "") return [];
    return raw.split(", ").map((item) => {
      const match = /^([A-Za-z_]\w*)(?: = (.+))?$/.exec(item);
      if (!match) this.fail(line, "LNG1102", "invalid parameter list");
      return {
        name: match[1],
        defaultValue:
          match[2] === undefined ? null : expr(match[2], line, this),
      };
    });
  }
  captures() {
    if (!(this.peek() ?? "").trimStart().startsWith("capture ")) return [];
    const line = this.line();
    const names = line.text.trim().slice(8).split(", ");
    if (
      names.some(
        (name) =>
          !/^(?:@{1,2}[A-Za-z_]\w*|[A-Za-z_]\w*)$/.test(name) ||
          name.startsWith("@@_"),
      )
    )
      this.fail(line, "LNG1117", "invalid capture list");
    if (new Set(names).size !== names.length)
      this.fail(line, "LNG1118", "duplicate capture name");
    return names;
  }
  object(indent) {
    const fields = [];
    while (true) {
      this.blank();
      if (this.peek() === `${" ".repeat(indent)}}`) {
        this.i += 1;
        break;
      }
      if (!this.peek() || spaces(this.peek()) !== indent + 4)
        this.fail(
          { number: this.i + 1 },
          "LNG1110",
          "expected an object field or closing brace",
        );
      const line = this.line();
      const match = /^([A-Za-z_]\w*): (.+)$/.exec(line.text.slice(indent + 4));
      if (!match) this.fail(line, "LNG1111", "expected `key: value`");
      fields.push({
        key: match[1],
        value:
          match[2] === "{"
            ? this.object(indent + 4)
            : expr(match[2], line, this),
      });
    }
    return { type: "object", fields };
  }
  blank() {
    while (this.peek()?.trim() === "") this.i += 1;
  }

  peek() {
    return this.lines[this.i];
  }

  line() {
    return { text: this.lines[this.i++], number: this.i };
  }

  fail(line, code, message) {
    throw new LangoError(code, line.number, `${this.name}: ${message}`);
  }
}

function expr(source, line, parser) {
  const text = source.trim();
  if (text.startsWith("[") && text.endsWith("]"))
    return {
      type: "array",
      values:
        text.slice(1, -1) === ""
          ? []
          : text
              .slice(1, -1)
              .split(", ")
              .map((item) => expr(item, line, parser)),
    };
  for (const operator of [
    "or",
    "||",
    "and",
    "&&",
    "==",
    ">",
    "<",
    "+",
    "-",
    "*",
    "/",
  ]) {
    const index = text.indexOf(` ${operator} `);
    if (index > -1)
      return {
        type: "binary",
        operator,
        left: expr(text.slice(0, index), line, parser),
        right: expr(text.slice(index + operator.length + 2), line, parser),
      };
  }
  if (text.startsWith("not "))
    return {
      type: "unary",
      operator: "not",
      value: expr(text.slice(4), line, parser),
    };
  if (text.startsWith("!"))
    return {
      type: "unary",
      operator: "not",
      value: expr(text.slice(1), line, parser),
    };
  const localize = /^_\((.*)\)$/.exec(text);
  if (localize)
    return { type: "translate", literal: literal(localize[1], line, parser) };
  const construct = /^new ([A-Za-z_]\w*)\((.*)\)$/.exec(text);
  if (construct)
    return {
      type: "new",
      name: construct[1],
      arguments: construct[2]
        ? construct[2].split(", ").map((item) => expr(item, line, parser))
        : [],
    };
  const superMethodCall = /^super\.([A-Za-z_]\w*)\((.*)\)$/.exec(text);
  if (superMethodCall)
    return {
      type: "superMethodCall",
      name: superMethodCall[1],
      arguments: superMethodCall[2]
        ? superMethodCall[2].split(", ").map((item) => expr(item, line, parser))
        : [],
    };
  const methodCall = /^([A-Za-z_]\w*)\.([A-Za-z_]\w*)\((.*)\)$/.exec(text);
  if (methodCall)
    return {
      type: "methodCall",
      receiver: methodCall[1],
      name: methodCall[2],
      arguments: methodCall[3]
        ? methodCall[3].split(", ").map((item) => expr(item, line, parser))
        : [],
    };
  const call = /^([A-Za-z_]\w*)\((.*)\)$/.exec(text);
  if (call)
    return {
      type: "call",
      name: call[1],
      arguments: call[2]
        ? call[2].split(", ").map((item) => expr(item, line, parser))
        : [],
      line: line.number,
    };
  if (/^['"].*['"]$/.test(text))
    return { type: "string", literal: literal(text, line, parser) };
  if (
    /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
    /^0[xX][0-9a-fA-F]+$/.test(text)
  )
    return { type: "raw", value: text };
  if (/^(true|false|null)$/.test(text)) return { type: "raw", value: text };
  if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\._[A-Za-z_]\w*$/.test(text))
    parser.fail(
      line,
      "LNG1115",
      "protected properties are not accessible outside a class",
    );
  if (/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+$/.test(text))
    return { type: "raw", value: text };
  if (/^[A-Za-z_]\w*\[(?:\d+|[A-Za-z_]\w*|['"][^'"]*['"])\]$/.test(text))
    return { type: "raw", value: text };
  if (/^@{0,2}[A-Za-z_]\w*$/.test(text)) return { type: "raw", value: text };
  parser.fail(line, "LNG1108", `unsupported Faz 2 expression: ${text}`);
}

function literal(value, line, parser) {
  const quote = value[0];
  if (!((quote === "'" || quote === '"') && value.at(-1) === quote))
    parser.fail(line, "LNG1109", "expected a string literal");
  const decoded = value
    .slice(1, -1)
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\(['"\\])/g, "$1");
  const parts = [];
  let at = 0;
  const regex = /\$\{([A-Za-z_]\w*(?:\.[A-Za-z_]\w*|\[\d+\])?)\}/g;
  let match;
  while ((match = regex.exec(decoded))) {
    parts.push({ text: decoded.slice(at, match.index), value: match[1] });
    at = match.index + match[0].length;
  }
  parts.push({ text: decoded.slice(at), value: null });
  return parts;
}

function validate(program, imports = []) {
  const names = new Map(program.functions.map((item) => [item.name, item]));
  const globals = new Set(program.globals.map((item) => item.name));
  const imported = new Set(imports.flatMap((item) => item.names));
  if (names.size !== program.functions.length)
    throw new LangoError("LNG1201", 1, "duplicate function name");
  if (globals.size !== program.globals.length)
    throw new LangoError("LNG1216", 1, "duplicate global name");
  const closureNames = (body, result = new Set()) => {
    for (const node of body) {
      if (node.type === "closureAssign") result.add(node.name);
      if (
        node.type === "assign" &&
        (node.value.type === "call" || node.value.type === "methodCall")
      )
        result.add(node.name);
      [
        node.body,
        node.thenBody,
        node.elseBody,
        node.tryBody,
        node.catchBody,
        node.finallyBody,
      ]
        .filter(Boolean)
        .forEach((child) => closureNames(child, result));
    }
    return result;
  };
  const walk = (value, localCallables) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "call") {
      const target = names.get(value.name);
      if (
        !target &&
        !imported.has(value.name) &&
        !localCallables.has(value.name)
      )
        throw new LangoError(
          "LNG1202",
          value.line,
          `unknown Lango function ${value.name}`,
        );
      if (target) {
        const required = target.parameters.filter(
          (p) => p.defaultValue === null,
        ).length;
        if (
          value.arguments.length < required ||
          value.arguments.length > target.parameters.length
        )
          throw new LangoError(
            "LNG1203",
            value.line,
            `${value.name} expects ${required}-${target.parameters.length} arguments, got ${value.arguments.length}`,
          );
      }
    }
    Object.values(value).forEach((item) =>
      Array.isArray(item)
        ? item.forEach((child) => walk(child, localCallables))
        : walk(item, localCallables),
    );
  };
  program.functions.forEach((fn) => walk(fn, closureNames(fn.body)));

  const expressionReferences = (node, references) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "raw") {
      const match = /^(@{0,2}[A-Za-z_]\w*)/.exec(node.value);
      if (match) references.add(match[1]);
      return;
    }
    if (node.type === "closure") return;
    if (node.type === "call") {
      if (!names.has(node.name) && !imported.has(node.name))
        references.add(node.name);
      node.arguments.forEach((argument) =>
        expressionReferences(argument, references),
      );
      return;
    }
    if (node.type === "methodCall") {
      if (node.receiver !== "this") references.add(node.receiver);
      node.arguments.forEach((argument) =>
        expressionReferences(argument, references),
      );
      return;
    }
    if (node.type === "string" || node.type === "translate") {
      node.literal
        .filter((part) => part.value)
        .forEach((part) => {
          const match = /^(@{0,2}[A-Za-z_]\w*)/.exec(part.value);
          if (match) references.add(match[1]);
        });
      return;
    }
    Object.values(node).forEach((value) => {
      if (Array.isArray(value))
        value.forEach((item) => expressionReferences(item, references));
      else expressionReferences(value, references);
    });
  };

  const nestedBodies = (node) => [
    node.thenBody,
    node.elseBody,
    node.tryBody,
    node.catchBody,
    node.finallyBody,
    node.body,
    ...(node.cases?.map((item) => item.body) ?? []),
  ].filter(Boolean);

  const contextDeclarations = (body, names = new Set()) => {
    for (const node of body) {
      if (node.type === "contextDeclare") names.add(node.name);
      if (node.type !== "closureAssign")
        nestedBodies(node).forEach((child) => contextDeclarations(child, names));
    }
    return names;
  };

  const globalDeclarations = (body, names = new Set()) => {
    for (const node of body) {
      if (node.type === "globalDeclare") names.add(node.name);
      if (node.type !== "closureAssign")
        nestedBodies(node).forEach((child) => globalDeclarations(child, names));
    }
    return names;
  };

  const directBindings = (body, bindings = new Set()) => {
    for (const node of body) {
      if (node.type === "closureAssign") {
        bindings.add(node.name);
        continue;
      }
      if (node.type === "assign" && !node.name.startsWith("@"))
        bindings.add(node.name);
      if (node.type === "for") bindings.add(node.item);
      if (node.type === "forObject") {
        bindings.add(node.key);
        bindings.add(node.value);
      }
      nestedBodies(node).forEach((child) => directBindings(child, bindings));
    }
    return bindings;
  };

  const directReferences = (body, references = new Set()) => {
    for (const node of body) {
      if (node.type === "closureAssign" || node.type === "closure") continue;
      if (node.type === "increment" || node.type === "add")
        references.add(node.name ?? node.target);
      if (node.type === "for" || node.type === "forObject")
        references.add(node.collection);
      [node.value, node.condition, node.arguments, node.tests].forEach((value) => {
        if (Array.isArray(value))
          value.forEach((item) => expressionReferences(item, references));
        else expressionReferences(value, references);
      });
      nestedBodies(node).forEach((child) => directReferences(child, references));
    }
    return references;
  };

  const validateClosures = (body, outerBindings, classScope = null) => {
    const available = new Set(outerBindings);
    for (const node of body) {
      const closure =
        node.type === "closureAssign"
          ? node
          : node.type === "return" && node.value?.type === "closure"
            ? node.value
            : null;
      if (closure) {
        const localBindings = new Set([
          ...closure.parameters.map((parameter) => parameter.name),
          ...directBindings(closure.body),
        ]);
        if (classScope)
          [...localBindings]
            .filter((name) => name.startsWith("_"))
            .forEach((name) => localBindings.delete(name));
        closure.captures
          .filter((name) => !name.startsWith("@") && !name.startsWith("_"))
          .forEach((name) => localBindings.delete(name));
        const contextNames = contextDeclarations(closure.body);
        const globalNames = globalDeclarations(closure.body);
        const needed = [...directReferences(closure.body)].filter(
          (name) =>
            !localBindings.has(name) &&
            !contextNames.has(name) &&
            !globalNames.has(name),
        );
        const captures = new Set(closure.captures);
        for (const name of needed)
          if (!captures.has(name))
            throw new LangoError(
              "LNG1210",
              closure.line,
              `MissingCapture: ${name}; add capture ${name}`,
            );
        for (const name of captures) {
          if (!needed.includes(name))
            throw new LangoError(
              "LNG1211",
              closure.line,
              `unused capture ${name}`,
            );
          const protectedMember = Boolean(classScope && name.startsWith("_"));
          const propertyCapture = name.startsWith("@") || protectedMember;
          if (!propertyCapture && !available.has(name))
            throw new LangoError(
              "LNG1212",
              closure.line,
              `capture ${name} is not assigned before this closure`,
            );
          if (propertyCapture) {
            const staticMember = name.startsWith("@@");
            const property = name.startsWith("@")
              ? name.slice(staticMember ? 2 : 1)
              : name;
            const members = staticMember
              ? classScope?.staticMembers
              : classScope?.instanceMembers;
            if (!members)
              throw new LangoError(
                "LNG1213",
                closure.line,
                `${name} is only valid in a class method`,
              );
            if (!members.has(property))
              throw new LangoError(
                "LNG1214",
                closure.line,
                `unknown captured property ${name}`,
              );
          }
        }
        validateClosures(
          closure.body,
          new Set([...available, ...localBindings]),
          classScope,
        );
        if (node.type === "closureAssign") available.add(node.name);
        continue;
      }
      if (node.type === "assign" && !node.name.startsWith("@"))
        available.add(node.name);
      if (node.type === "for") available.add(node.item);
      if (node.type === "forObject") {
        available.add(node.key);
        available.add(node.value);
      }
    }
  };

  program.functions.forEach((fn) =>
    validateClosures(
      fn.body,
      new Set(fn.parameters.map((parameter) => parameter.name)),
    ),
  );
  const validateContextAssignments = (body, contextNames) => {
    for (const node of body) {
      if (node.type === "assign" && contextNames.has(node.name))
        throw new LangoError(
          "LNG1215",
          1,
          `${node.name} is a context binding; use context ${node.name} = ...`,
        );
      if (node.type !== "closureAssign")
        nestedBodies(node).forEach((child) =>
          validateContextAssignments(child, contextNames),
        );
    }
  };
  const validateGlobalAccess = (body, declarations = new Set()) => {
    for (const node of body) {
      if (node.type === "globalDeclare") {
        if (!globals.has(node.name))
          throw new LangoError(
            "LNG1217",
            node.line,
            `unknown global ${node.name}`,
          );
        declarations.add(node.name);
      }
      if (node.type === "assign" && globals.has(node.name) && !declarations.has(node.name))
        throw new LangoError(
          "LNG1218",
          1,
          `${node.name} is a global; declare global ${node.name} first`,
        );
      if (node.type === "closureAssign") {
        validateGlobalAccess(node.body);
        continue;
      }
      if (node.type === "return" && node.value?.type === "closure") {
        validateGlobalAccess(node.value.body);
        continue;
      }
      if (node.type !== "closureAssign")
        nestedBodies(node).forEach((child) =>
          validateGlobalAccess(child, declarations),
        );
    }
    for (const name of directReferences(body))
      if (globals.has(name) && !declarations.has(name))
        throw new LangoError(
          "LNG1218",
          1,
          `${name} is a global; declare global ${name} first`,
        );
  };
  program.functions.forEach((fn) =>
    validateContextAssignments(fn.body, contextDeclarations(fn.body)),
  );
  program.functions.forEach((fn) => validateGlobalAccess(fn.body));
  const classes = new Map(program.classes.map((item) => [item.name, item]));
  if (classes.size !== program.classes.length)
    throw new LangoError("LNG1205", 1, "duplicate class name");
  for (const classNode of program.classes) {
    if (classNode.ancestor && !classes.has(classNode.ancestor))
      throw new LangoError(
        "LNG1206",
        classNode.line,
        `${classNode.name}: unknown ancestor ${classNode.ancestor}`,
      );
    for (const method of classNode.publicMethods)
      if (
        !classNode.methods.some(
          (item) => item.name === method.name && item.static === method.static,
        )
      )
        throw new LangoError(
          "LNG1209",
          classNode.line,
          `${classNode.name}: public method ${method.static ? "::" : ""}${method.name} has no implementation`,
        );
    const readonly = new Set(classNode.enumValues.map((item) => item.name));
    const superCalls = [];
    const hasSuperMethodCall = (value) =>
      value &&
      typeof value === "object" &&
      (value.type === "superMethodCall" ||
        Object.values(value).some((item) =>
          Array.isArray(item)
            ? item.some(hasSuperMethodCall)
            : hasSuperMethodCall(item),
        ));
    const validateMethod = (body) =>
      body.forEach((node) => {
        if (
          node.type === "assign" &&
          node.name.startsWith("@@") &&
          readonly.has(node.name.slice(2))
        )
          throw new LangoError(
            "LNG1204",
            classNode.line,
            `${classNode.name}: enum value ${node.name.slice(2)} is readonly`,
          );
        if (node.type === "superConstructor") superCalls.push(node);
        [
          node.thenBody,
          node.elseBody,
          node.tryBody,
          node.catchBody,
          node.finallyBody,
          node.body,
        ]
          .filter(Boolean)
          .forEach(validateMethod);
      });
    const instanceMembers = new Set(classNode.publicProperties);
    const collectInstanceMembers = (body) => {
      for (const node of body) {
        if (node.type === "assign" && /^@[A-Za-z_]\w*$/.test(node.name))
          instanceMembers.add(node.name.slice(1));
        if (node.type === "assign" && /^_[A-Za-z_]\w*$/.test(node.name))
          instanceMembers.add(node.name);
        nestedBodies(node).forEach(collectInstanceMembers);
      }
    };
    classNode.methods.forEach((method) => collectInstanceMembers(method.body));
    const classScope = {
      instanceMembers,
      staticMembers: new Set([
        ...classNode.staticValues.map((item) => item.name),
        ...classNode.enumValues.map((item) => item.name),
      ]),
    };
    classNode.methods.forEach((method) => {
      validateClosures(
        method.body,
        new Set(method.parameters.map((parameter) => parameter.name)),
        classScope,
      );
      validateContextAssignments(
        method.body,
        contextDeclarations(method.body),
      );
      validateGlobalAccess(method.body);
      superCalls.length = 0;
      validateMethod(method.body);
      if (
        method.name === "constructor" &&
        classNode.ancestor &&
        (method.body[0]?.type !== "superConstructor" || superCalls.length !== 1)
      )
        throw new LangoError(
          "LNG1207",
          method.line,
          `${classNode.name}: constructor must call super(...) once as its first statement`,
        );
      if (
        (method.name !== "constructor" || !classNode.ancestor) &&
        superCalls.length
      )
        throw new LangoError(
          "LNG1208",
          method.line,
          `${classNode.name}: super(...) is only valid as the first child-constructor statement`,
        );
      if (!classNode.ancestor && hasSuperMethodCall(method.body))
        throw new LangoError(
          "LNG1208",
          method.line,
          `${classNode.name}: super.method(...) requires an ancestor`,
        );
    });
  }
}

function emit(program, moduleImports = []) {
  const flags = { print: false, translate: false, context: false };
  const classes = program.classes
    .map((item) => emitClass(item, flags))
    .join("\n");
  const functions = program.functions
    .map((fn) => emitFunction(fn, flags))
    .join("\n");
  const helpers = [
    flags.print && "println as __println",
    flags.translate && "translate as __translate",
    flags.context && "contextGet as __contextGet",
    flags.context && "contextSet as __contextSet",
    flags.context && "contextRestore as __contextRestore",
  ].filter(Boolean);
  const imports = helpers.length
    ? `import {\n${helpers.map((item) => `    ${item},`).join("\n")}\n} from \"./.lango/runtime.mjs\";\n\n`
    : "";
  const modules = moduleImports
    .map(
      (item) =>
        `import { ${item.names.join(", ")} } from ${JSON.stringify(item.specifier)};\n`,
    )
    .join("");
  const globals = program.globals
    .map((item) => `let ${item.name} = ${emitExpr(item.value, flags)};\n`)
    .join("");
  return `${modules}${imports}${globals}${classes}${functions}//# sourceMappingURL=main.mjs.map\n`;
}
function collectGlobalNames(body, names = new Set()) {
  for (const node of body) {
    if (node.type === "globalDeclare") names.add(node.name);
    if (node.type === "closureAssign") continue;
    [
      node.thenBody,
      node.elseBody,
      node.tryBody,
      node.catchBody,
      node.finallyBody,
      node.body,
      ...(node.cases?.map((item) => item.body) ?? []),
    ]
      .filter(Boolean)
      .forEach((child) => collectGlobalNames(child, names));
  }
  return names;
}
function collectContextNames(body, names = new Set()) {
  for (const node of body) {
    if (node.type === "contextDeclare" || node.type === "contextSet")
      names.add(node.name);
    if (node.type === "closureAssign") continue;
    [
      node.thenBody,
      node.elseBody,
      node.tryBody,
      node.catchBody,
      node.finallyBody,
      node.body,
      ...(node.cases?.map((item) => item.body) ?? []),
    ]
      .filter(Boolean)
      .forEach((child) => collectContextNames(child, names));
  }
  return names;
}
function emitClass(item, flags) {
  const prior = {
    publicProperties: flags.publicProperties,
    className: flags.className,
    methods: flags.methods,
    staticMethod: flags.staticMethod,
  };
  flags.publicProperties = new Set(item.publicProperties);
  flags.className = item.name;
  flags.methods = new Map(
    item.methods.map((method) => [
      `${method.static ? "static" : "instance"}:${method.name}`,
      method.public,
    ]),
  );
  const fields = [
    ...new Set(
      item.methods
        .flatMap(
          (method) =>
            JSON.stringify(method.body).match(/@@?[A-Za-z_]\w*/g) ?? [],
        )
        .filter((name) => !name.startsWith("@@"))
        .map((name) => name.slice(1)),
    ),
  ].filter((field) => !flags.publicProperties.has(field));
  const implicitConstructor =
    item.ancestor &&
    !item.methods.some((method) => method.name === "constructor")
      ? `    constructor(...args) {\n        super(...args);\n    }\n`
      : "";
  const body = item.methods
    .map((method) => {
      flags.staticMethod = method.static;
      const declared = new Set(method.parameters.map((p) => p.name));
      const priorGlobalNames = flags.globalNames;
      flags.globalNames = collectGlobalNames(method.body);
      const priorContextNames = flags.contextNames;
      const contextNames = collectContextNames(method.body);
      flags.contextNames = contextNames;
      const parameters = method.parameters
        .map((p) =>
          p.defaultValue === null
            ? p.name
            : `${p.name} = ${emitExpr(p.defaultValue, flags)}`,
        )
        .join(", ");
      const suffix = method.name === "constructor" ? "" : "    return null;\n";
      const name =
        method.name === "constructor" || method.public
          ? method.name
          : `#${method.name}`;
      const methodBody = method.body
        .map((node) =>
          emitStatement(node, contextNames.size ? 3 : 2, declared, flags),
        )
        .join("");
      flags.contextNames = priorContextNames;
      flags.globalNames = priorGlobalNames;
      if (!contextNames.size)
        return `    ${method.static ? "static " : ""}${name}(${parameters}) {\n${methodBody}${suffix}    }\n`;
      flags.context = true;
      const returnNull = method.name === "constructor" ? "" : "            return null;\n";
      return `    ${method.static ? "static " : ""}${name}(${parameters}) {\n        const __contextScope = [];\n        try {\n${methodBody}${returnNull}        } finally {\n            __contextRestore(__contextScope);\n        }\n    }\n`;
    })
    .join("");
  const statics = [...item.staticValues, ...item.enumValues]
    .map(
      (value) =>
        `    static ${value.name} = ${emitExpr(value.value, flags)};\n`,
    )
    .join("");
  flags.publicProperties = prior.publicProperties;
  flags.className = prior.className;
  flags.methods = prior.methods;
  flags.staticMethod = prior.staticMethod;
  return `${item.exported ? "export " : ""}class ${item.name}${item.ancestor ? ` extends ${item.ancestor}` : ""} {\n${item.publicProperties.map((field) => `    ${field};\n`).join("")}${statics}${fields.map((field) => `    #${field};\n`).join("")}${implicitConstructor}${body}}\n`;
}
function emitFunction(fn, flags) {
  const declared = new Set(fn.parameters.map((p) => p.name));
  const priorContextNames = flags.contextNames;
  const priorGlobalNames = flags.globalNames;
  const contextNames = collectContextNames(fn.body);
  flags.contextNames = contextNames;
  flags.globalNames = collectGlobalNames(fn.body);
  const parameters = fn.parameters
    .map((p) =>
      p.defaultValue === null
        ? p.name
        : `${p.name} = ${emitExpr(p.defaultValue, flags)}`,
    )
    .join(", ");
  const body = fn.body
    .map((item) => emitStatement(item, contextNames.size ? 2 : 1, declared, flags))
    .join("");
  flags.contextNames = priorContextNames;
  flags.globalNames = priorGlobalNames;
  if (!contextNames.size)
    return `${fn.exported ? "export " : ""}function ${fn.name}(${parameters}) {\n${body}    return null;\n}\n`;
  flags.context = true;
  return `${fn.exported ? "export " : ""}function ${fn.name}(${parameters}) {\n    const __contextScope = [];\n    try {\n${body}        return null;\n    } finally {\n        __contextRestore(__contextScope);\n    }\n}\n`;
}
function emitStatement(node, depth, declared, flags) {
  const pad = "    ".repeat(depth);
  if (node.type === "globalDeclare") return "";
  if (node.type === "contextDeclare") return "";
  if (node.type === "contextSet") {
    flags.context = true;
    return `${pad}__contextScope.push(__contextSet(${JSON.stringify(node.name)}, ${emitExpr(node.value, flags)}));\n`;
  }
  if (node.type === "assign") {
    const property = node.name.slice(node.name.startsWith("@@") ? 2 : 1);
    const target = node.name.startsWith("@@")
      ? `${flags.className}.${property}`
      : node.name.startsWith("@")
        ? flags.publicProperties?.has(property)
          ? `this.${property}`
          : `this.#${property}`
        : flags.className && node.name.startsWith("_")
          ? `this.${node.name}`
          : node.name;
    const prefix =
      node.name.startsWith("@") ||
      (flags.className && node.name.startsWith("_")) ||
      declared.has(node.name) || flags.globalNames?.has(node.name)
        ? ""
        : "let ";
    declared.add(node.name);
    return `${pad}${prefix}${target} = ${emitExpr(node.value, flags)};\n`;
  }
  if (node.type === "expression")
    return `${pad}${emitExpr(node.value, flags)};\n`;
  if (node.type === "closureAssign") {
    declared.add(node.name);
    return `${pad}let ${node.name} = ${emitClosure(node, depth, flags)};\n`;
  }
  if (node.type === "superConstructor")
    return `${pad}super(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")});\n`;
  if (node.type === "increment") return `${pad}${node.name} += 1;\n`;
  if (node.type === "add")
    return `${pad}${node.target}.push(${emitExpr(node.value, flags)});\n`;
  if (node.type === "return")
    return `${pad}return${node.value === null ? "" : node.value.type === "closure" ? ` ${emitClosure(node.value, depth, flags)}` : ` ${emitExpr(node.value, flags)}`};\n`;
  if (node.type === "throw")
    return `${pad}throw ${emitExpr(node.value, flags)};\n`;
  if (node.type === "println") {
    flags.print = true;
    return `${pad}__println(${emitExpr(node.value, flags)});\n`;
  }
  if (node.type === "break" || node.type === "continue")
    return `${pad}${node.type};\n`;
  if (node.type === "try") {
    let out = `${pad}try {\n${node.tryBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
    if (node.catchBody)
      out += ` catch (${node.catchName}) {\n${node.catchBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
    if (node.finallyBody)
      out += ` finally {\n${node.finallyBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
    return `${out}\n`;
  }
  if (node.type === "loop")
    return `${pad}while (${emitExpr(node.condition, flags)}) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`;
  if (node.type === "for")
    return `${pad}for (const ${node.item} of ${node.collection}) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`;
  if (node.type === "forObject")
    return `${pad}for (const [${node.key}, ${node.value}] of Object.entries(${node.collection})) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`;
  if (node.type === "switch") {
    const conditions = node.cases.map((item) =>
      item.tests
        .map((test) =>
          node.value
            ? `${emitExpr(node.value, flags)} === ${emitExpr(test, flags)}`
            : emitExpr(test, flags),
        )
        .join(" || "),
    );
    let out = node.cases
      .map(
        (item, index) =>
          `${pad}${index ? "else " : ""}if (${conditions[index]}) {\n${item.body.map((child) => emitStatement(child, depth + 1, declared, flags)).join("")}${pad}}`,
      )
      .join(" ");
    if (node.elseBody)
      out += ` else {\n${node.elseBody.map((child) => emitStatement(child, depth + 1, declared, flags)).join("")}${pad}}`;
    return `${out}\n`;
  }
  let out = `${pad}if (${emitExpr(node.condition, flags)}) {\n${node.thenBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
  if (node.elseBody)
    out += ` else {\n${node.elseBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
  return `${out}\n`;
}
function emitClosure(node, depth, flags) {
  const parameters = node.parameters.map((item) => item.name).join(", ");
  const declared = new Set([
    ...node.parameters.map((parameter) => parameter.name),
    ...node.captures.filter((name) => !name.startsWith("@") && !name.startsWith("_")),
  ]);
  const pad = "    ".repeat(depth);
  const priorContextNames = flags.contextNames;
  const priorGlobalNames = flags.globalNames;
  const contextNames = collectContextNames(node.body);
  flags.contextNames = contextNames;
  flags.globalNames = collectGlobalNames(node.body);
  const body = node.body
    .map((item) =>
      emitStatement(item, depth + (contextNames.size ? 2 : 1), declared, flags),
    )
    .join("");
  flags.contextNames = priorContextNames;
  flags.globalNames = priorGlobalNames;
  if (!contextNames.size) return `(${parameters}) => {\n${body}${pad}}`;
  flags.context = true;
  return `(${parameters}) => {\n${pad}    const __contextScope = [];\n${pad}    try {\n${body}${pad}    } finally {\n${pad}        __contextRestore(__contextScope);\n${pad}    }\n${pad}}`;
}
function emitExpr(node, flags) {
  if (node.type === "raw")
    if (flags.contextNames?.has(node.value)) {
      flags.context = true;
      return `__contextGet(${JSON.stringify(node.value)})`;
    }
  if (node.type === "raw")
    return node.value.startsWith("@@")
      ? `${flags.className}.${node.value.slice(2)}`
      : node.value.startsWith("@")
        ? flags.publicProperties?.has(node.value.slice(1))
          ? `this.${node.value.slice(1)}`
          : `this.#${node.value.slice(1)}`
        : flags.className && node.value.startsWith("_")
          ? `this.${node.value}`
          : node.value;
  if (node.type === "unary") return `!${emitExpr(node.value, flags)}`;
  if (node.type === "new")
    return `new ${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
  if (node.type === "superMethodCall")
    return `super.${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
  if (node.type === "methodCall") {
    const type =
      node.receiver === flags.className ||
      (node.receiver === "this" && flags.staticMethod)
        ? "static"
        : "instance";
    const visibility = flags.methods?.get(`${type}:${node.name}`);
    const receiver =
      node.receiver === "this" && flags.staticMethod && visibility === false
        ? flags.className
        : node.receiver;
    return `${receiver}${visibility === false ? ".#" : "."}${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
  }
  if (node.type === "array")
    return `[${node.values.map((item) => emitExpr(item, flags)).join(", ")}]`;
  if (node.type === "object")
    return `{ ${node.fields.map((item) => `${item.key}: ${emitExpr(item.value, flags)}`).join(", ")} }`;
  if (node.type === "binary") {
    const operators = { "==": "===", and: "&&", or: "||" };
    return `${emitExpr(node.left, flags)} ${operators[node.operator] ?? node.operator} ${emitExpr(node.right, flags)}`;
  }
  if (node.type === "call")
    return `${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
  if (node.type === "string") return emitString(node.literal, flags);
  flags.translate = true;
  const template = node.literal
    .map(
      (item, index) => `${item.text}${item.value === null ? "" : `{${index}}`}`,
    )
    .join("");
  const values = node.literal
    .filter((item) => item.value)
    .map((item) => item.value);
  return `__translate(${JSON.stringify(template)}, [${values.join(", ")}])`;
}
function emitString(parts) {
  if (parts.length === 1) return JSON.stringify(parts[0].text);
  return `\`${parts.map((item) => `${item.text.replaceAll("`", "\\`")}${item.value === null ? "" : `\${${item.value}}`}`).join("")}\``;
}
function spaces(line) {
  return line.length - line.trimStart().length;
}
function collectImports(source, inputPath, outputPath) {
  const lines = source.split(/\r?\n/);
  const items = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^import "(\.[^"]+)"$/.exec(lines[index]);
    if (!match) continue;
    const names = [];
    while (true) {
      const item = lines[index + 1] ?? "";
      const functionImport = /^    ([A-Za-z_]\w*)\([^)]*\)$/.exec(item);
      const classImport = /^    class ([A-Za-z_]\w*)$/.exec(item);
      const classAlias =
        /^    alias ([A-Za-z_]\w*) = class ([A-Za-z_]\w*)$/.exec(item);
      if (!functionImport && !classImport && !classAlias) break;
      names.push(
        classAlias
          ? `${classAlias[2]} as ${classAlias[1]}`
          : (functionImport ?? classImport)[1],
      );
      index += 1;
    }
    const sourcePath = path.resolve(
      path.dirname(inputPath),
      `${match[1]}.lango`,
    );
    const outputPathForImport = path.resolve(
      path.dirname(outputPath),
      `${match[1]}.mjs`,
    );
    items.push({
      names,
      sourcePath,
      outputPath: outputPathForImport,
      specifier: `./${path.basename(outputPathForImport)}`,
    });
  }
  return items;
}
