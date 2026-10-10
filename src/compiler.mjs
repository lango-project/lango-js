import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { RUNTIME_SOURCE } from "./runtime.mjs";

export class LangoError extends Error {
  constructor(code, line, message) {
    super(`${code} at line ${line}: ${message}`);
    this.code = code;
  }
}

export async function buildFile(inputPath, outputPath, seen = new Set(), includeTests = false) {
  if (seen.size === 0)
    await validateModuleInitializerCycles(inputPath, outputPath);
  if (seen.has(inputPath)) return;
  seen.add(inputPath);

  const source = await readFile(inputPath, "utf8");
  const imports = collectImports(source, inputPath, outputPath);
  for (const item of imports)
    await buildFile(item.sourcePath, item.outputPath, seen, includeTests);
  for (const item of imports) {
    const importedProgram = new Parser(
      await readFile(item.sourcePath, "utf8"),
      item.sourcePath,
    ).parse();
    for (const selection of item.selections) {
      const target =
        selection.kind === "class"
          ? importedProgram.classes.find(
              (candidate) =>
                candidate.name === selection.sourceName && candidate.exported,
            )
          : selection.kind === "function"
            ? importedProgram.functions.find(
              (candidate) =>
                candidate.name === selection.sourceName && candidate.exported,
              )
            : importedProgram.globals.find(
                (candidate) =>
                  candidate.name === selection.sourceName && candidate.exported,
              );
      if (!target)
        throw new LangoError(
          "LNG1227",
          1,
          `${inputPath}: imported ${selection.kind} ${selection.sourceName} is not exported by ${item.sourcePath}`,
        );
      if (selection.kind === "function" && !sameParameters(selection.parameters, target.parameters))
        throw new LangoError(
          "LNG1230",
          1,
          `${inputPath}: import signature for ${selection.sourceName} does not match ${item.sourcePath}`,
        );
      if (selection.kind === "class")
        validateImportedClassInterface(
          selection,
          target,
          importedProgram,
          inputPath,
          item.sourcePath,
        );
    }
  }

  const output = compile(source, inputPath, imports, includeTests).javascript.replace(
    "//# sourceMappingURL=main.mjs.map",
    `//# sourceMappingURL=${path.basename(outputPath)}.map`,
  );
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
  await writeFile(
    path.join(directory, ".lango/bignumber.mjs"),
    await readFile(new URL("./vendor/bignumber.mjs", import.meta.url), "utf8"),
    "utf8",
  );
}

export function compile(source, sourceName = "<source>", imports = [], includeTests = false) {
  if (source.includes("\t"))
    throw new LangoError("LNG1001", 1, "TAB characters are not allowed");
  const parser = new Parser(source, sourceName);
  const program = parser.parse();
  validate(program, imports);
  return { javascript: emit(program, imports, includeTests) };
}

export function formatSource(source, sourceName = "<source>") {
  if (source.includes("\t"))
    throw new LangoError("LNG1001", 1, "TAB characters are not allowed");
  new Parser(source, sourceName).parse();
  const lines = source.split(/\r?\n/).map((line) => formatLine(line));
  while (lines[0] === "") lines.shift();
  while (lines.at(-1) === "") lines.pop();
  const formatted = [];
  for (const line of lines)
    if (line !== "" || formatted.at(-1) !== "") formatted.push(line);
  return formatted.length ? `${formatted.join("\n")}\n` : "";
}

function formatLine(line) {
  const trimmed = line.trimEnd();
  const code = stripComment(trimmed);
  if (code.length === trimmed.length || code.trim() === "") return trimmed;
  return `${code.trimEnd()} ${trimmed.slice(code.length).trim()}`;
}

class Parser {
  constructor(source, name) {
    this.lines = source.split(/\r?\n/).map((line) => stripComment(line).trimEnd());
    this.name = name;
    this.i = 0;
  }
  parse() {
    const functions = [];
    const classes = [];
    const exports = [];
    const globals = [];
    const tests = [];
    const jsImports = [];
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
      const jsImport = /^import js "([^"]+)" as ([A-Za-z_]\w*)$/.exec(line.text);
      if (jsImport) {
        if (declarationSeen)
          this.fail(line, "LNG1121", "imports must precede class and function declarations");
        if (jsImports.some((item) => item.name === jsImport[2]))
          this.fail(line, "LNG1122", `duplicate JavaScript import name ${jsImport[2]}`);
        jsImports.push({ specifier: jsImport[1], name: jsImport[2] });
        this.blank();
        continue;
      }
      const globalDeclaration = /^global (\$?[A-Za-z_]\w*) = (.+)$/.exec(
        line.text,
      );
      if (globalDeclaration) {
        if (declarationSeen)
          this.fail(line, "LNG1119", "globals must precede class and function declarations");
        globals.push({
          name: globalDeclaration[1],
          value: this.expression(globalDeclaration[2], line),
          exported: false,
          line: line.number,
        });
        this.blank();
        continue;
      }
      const testHeader = /^test(?: "([^"]*)")?$/.exec(line.text);
      if (testHeader) {
        tests.push({
          name: testHeader[1] ?? `${this.name}:${line.number}`,
          line: line.number,
          body: this.block(4),
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
            while (/^        \$?[A-Za-z_]\w*$/.test(this.peek() ?? ""))
              classNode.publicProperties.push(this.lines[this.i++].trim());
          } else if (section === "methods") {
            while (true) {
              const methodLine = this.peek() ?? "";
              const method = /^        ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(
                methodLine,
              );
              if (!method) break;
              classNode.publicMethods.push({
                name: method[1],
                static: false,
                parameters: this.parameters(method[2], {
                  number: this.i + 1,
                }),
              });
              this.i += 1;
            }
          } else if (section === "static") {
            while (true) {
              const valueLine = this.peek() ?? "";
              const value = /^        (\$?[A-Za-z_]\w*) = (.+)$/.exec(valueLine);
              const method = /^        ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(valueLine);
              if (!value && !method) break;
              if (value) {
                const line = this.line();
                classNode.staticValues.push({
                  name: value[1],
                  value: expr(value[2], line, this),
                  line: line.number,
                });
              } else {
                classNode.publicMethods.push({
                  name: method[1],
                  static: true,
                  parameters: this.parameters(method[2], { number: this.i + 1 }),
                });
                this.i += 1;
              }
            }
          } else {
            while(/^        \$?[A-Za-z_]\w* = .+$/.test(this.peek() ?? "")) {
              const valueLine = this.line();
              const [, name, value] = /^        (\$?[A-Za-z_]\w*) = (.+)$/.exec(
                valueLine.text,
              );
              classNode[
                section === "enum" ? "enumValues" : "staticValues"
              ].push({ name, value: expr(value, valueLine, this), line: valueLine.number });
            }
          }
        }
        this.blank();
        continue;
      }
      const exportHeader = /^export ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line.text);
      const exportGlobal = /^export global (\$?[A-Za-z_]\w*)$/.exec(line.text);
      if (exportGlobal) {
        if (declarationSeen)
          this.fail(
            line,
            "LNG1113",
            "exports must precede class and function declarations",
          );
        exports.push({ kind: "global", name: exportGlobal[1], line: line.number });
        this.blank();
        continue;
      }
      if (exportHeader) {
        if (declarationSeen)
          this.fail(
            line,
            "LNG1113",
            "exports must precede class and function declarations",
          );
        exports.push({
          kind: "function",
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
      if (exported.kind === "global") {
        const target = globals.find((item) => item.name === exported.name);
        if (!target)
          throw new LangoError(
            "LNG1104",
            exported.line,
            `${this.name}: export does not match a global declaration`,
          );
        target.exported = true;
        continue;
      }
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
    const declarations = new Set([
      ...functions.map((item) => item.name),
      ...classes.map((item) => item.name),
      ...globals.map((item) => item.name),
    ]);
    for (const jsImport of jsImports)
      if (declarations.has(jsImport.name))
        throw new LangoError(
          "LNG1123",
          1,
          `${this.name}: JavaScript import name ${jsImport.name} conflicts with a Lango declaration`,
        );
    return { functions, classes, globals, tests, jsImports };
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
      if (text.startsWith("assert ")) {
        body.push({
          type: "assert",
          value: expr(text.slice(7), line, this),
          line: line.number,
          source: text.slice(7),
        });
      } else if (/^global (\$?[A-Za-z_]\w*)$/.test(text)) {
        const [, name] = /^global (\$?[A-Za-z_]\w*)$/.exec(text);
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
      } else if (text === "loop") {
        body.push({ type: "loop", condition: null, body: this.block(indent + 4) });
      } else if (text.startsWith("loop while ")) {
        body.push({
          type: "loop",
          condition: expr(text.slice(11), line, this),
          body: this.block(indent + 4),
        });
      } else if (text.startsWith("loop until ")) {
        body.push({
          type: "loop",
          condition: expr(text.slice(11), line, this),
          until: true,
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
      } else if (text.startsWith("return ")) {
        const value = text.slice(7);
        const chain = /^(.+)\.([A-Za-z_]\w*)\(\(([^)]*)\)$/.exec(value);
        if (!chain) body.push({ type: "return", value: this.expression(value, line) });
        else {
          const steps = [];
          steps.push({
            name: chain[2],
            parameters: this.parameters(chain[3], line),
            captures: this.captures(),
            line: line.number,
            body: this.block(indent + 4),
          });
          this.blank();
          while (spaces(this.peek() ?? "") === indent) {
            const continuation = /^\)\.([A-Za-z_]\w*)\(\(([^)]*)\)$/.exec((this.peek() ?? "").slice(indent));
            if (!continuation) break;
            const continuationLine = this.line();
            steps.push({
              name: continuation[1],
              parameters: this.parameters(continuation[2], continuationLine),
              captures: this.captures(),
              line: continuationLine.number,
              body: this.block(indent + 4),
            });
            this.blank();
          }
          if (this.peek() !== `${" ".repeat(indent)})`)
            this.fail(line, "LNG1253", "Promise chain requires a closing parenthesis");
          this.i += 1;
          body.push({ type: "return", value: { type: "chain", base: expr(chain[1], line, this), steps } });
        }
      }
      else if (text.startsWith("throw "))
        body.push({ type: "throw", value: expr(text.slice(6), line, this) });
      else if (/^super\((.*)\)$/.test(text)) {
        const [, argumentsText] = /^super\((.*)\)$/.exec(text);
        body.push({
          type: "superConstructor",
          arguments: argumentsText
            ? splitTopLevel(argumentsText).map((item) => expr(item, line, this))
            : [],
          line: line.number,
        });
      } else if (/^(break|continue)(?: ([1-9]\d*))?$/.test(text)) {
        const [, type, rawLevel] = /^(break|continue)(?: ([1-9]\d*))?$/.exec(text);
        body.push({ type, level: Number(rawLevel ?? 1), line: line.number });
      }
      else if (/^[A-Za-z_]\w*\+\+$/.test(text))
        body.push({ type: "increment", name: text.slice(0, -2) });
      else if (/^(.+)\.([A-Za-z_]\w*)\(\(([^)]*)\)$/.test(text)) {
        const [, first, name, parameters] = /^(.+)\.([A-Za-z_]\w*)\(\(([^)]*)\)$/.exec(text);
        const steps = [];
        let step = { name, parameters: this.parameters(parameters, line), captures: this.captures(), line: line.number, body: this.block(indent + 4) };
        steps.push(step);
        this.blank();
        while (spaces(this.peek() ?? "") === indent) {
          const continuation = /^\)\.([A-Za-z_]\w*)\(\(([^)]*)\)$/.exec(
            (this.peek() ?? "").slice(indent),
          );
          if (!continuation) break;
          const continuationLine = this.line();
          step = {
            name: continuation[1],
            parameters: this.parameters(continuation[2], continuationLine),
            captures: this.captures(),
            line: continuationLine.number,
            body: this.block(indent + 4),
          };
          steps.push(step);
          this.blank();
        }
        if (this.peek() !== `${" ".repeat(indent)})`)
          this.fail(line, "LNG1253", "Promise chain requires a closing parenthesis");
        this.i += 1;
        body.push({ type: "chain", base: expr(first, line, this), steps });
      }
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
      else if (/^[A-Za-z_]\w*(?:\/[A-Za-z_]\w*)+\(.*\)$/.test(text))
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
      } else if (/^([A-Za-z_]\w*) = SQL$/.test(text)) {
        const [, name] = /^([A-Za-z_]\w*) = SQL$/.exec(text);
        const sql = [];
        while (this.i < this.lines.length) {
          const sqlLine = this.peek();
          if (sqlLine.trim() === "") { sql.push(""); this.i += 1; continue; }
          if (spaces(sqlLine) <= indent) break;
          if (spaces(sqlLine) < indent + 4)
            this.fail({ text: sqlLine, number: this.i + 1 }, "LNG1255", "SQL body must be indented");
          sql.push(sqlLine.slice(indent + 4));
          this.i += 1;
        }
        if (!sql.some((item) => item.trim()))
          this.fail(line, "LNG1255", "SQL body requires a statement");
        const sqlText = sql.join("\n");
        const parts = [];
        let at = 0;
        for (const match of sqlText.matchAll(/\$\{([^}]*)\}/g)) {
          if (match.index > at) parts.push({ type: "text", value: sqlText.slice(at, match.index) });
          const source = match[1].trim();
          if (!source) this.fail(line, "LNG1257", "SQL interpolation requires an expression");
          parts.push({ type: "expression", value: expr(source, line, this) });
          at = match.index + match[0].length;
        }
        if (at < sqlText.length || !parts.length)
          parts.push({ type: "text", value: sqlText.slice(at) });
        const parameters = [...new Set(
          parts
            .filter((part) => part.type === "text")
            .flatMap((part) => collectSqlParameters(part.value)),
        )];
        body.push({
          type: "assign",
          name,
          value: { type: "sql", text: sqlText, parts, parameters },
        });
      } else {
        const assignment = /^(\$[A-Za-z_]\w*|@{0,2}\$?[A-Za-z_]\w*|[A-Za-z_]\w*\.\$?[A-Za-z_]\w*) = (.+)$/.exec(text);
        if (!assignment)
          this.fail(line, "LNG1106", `unsupported Faz 2 statement: ${text}`);
        body.push({
          type: "assign",
          name: assignment[1],
          value: this.expression(assignment[2], line),
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
    return splitTopLevel(raw).map((item) => {
      const match = /^(\$?[A-Za-z_]\w*)(?: = (.+))?$/.exec(item);
      if (!match) this.fail(line, "LNG1102", "invalid parameter list");
      return {
        name: match[1],
        defaultValue:
          match[2] === undefined ? null : expr(match[2], line, this),
      };
    });
  }
  expression(source, line) {
    if (!source.trimStart().startsWith("<")) return expr(source, line, this);

    let xml = source;
    while (true) {
      const parsed = xmlLiteral(xml, line, this);
      if (parsed !== null) return parsed;
      if (this.i >= this.lines.length)
        this.fail(line, "LNG1247", "unterminated XML literal");
      xml += `\n${this.lines[this.i++]}`;
    }
  }
  captures() {
    if (!(this.peek() ?? "").trimStart().startsWith("capture ")) return [];
    const line = this.line();
    const names = splitTopLevel(line.text.trim().slice(8));
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
    const keys = new Set();
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
      const match = /^(\$?[A-Za-z_]\w*|['"][^'"]+['"]): (.+)$/.exec(line.text.slice(indent + 4));
      if (!match) this.fail(line, "LNG1111", "expected `key: value`");
      const key = match[1].startsWith("'") || match[1].startsWith('"')
        ? match[1].slice(1, -1).replace(/\\(['"\\])/g, "$1")
        : match[1];
      if (keys.has(key)) this.fail(line, "LNG1258", `duplicate object key ${key}`);
      keys.add(key);
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

function collectSqlParameters(sql) {
  const names = [];
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index];
    const next = sql[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote !== null) {
      if (character === quote) {
        if (next === quote) { index += 1; continue; }
        quote = null;
      }
      continue;
    }
    if (character === "-" && next === "-") { lineComment = true; index += 1; continue; }
    if (character === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character !== ":" || sql[index - 1] === ":" || !/[A-Za-z_]/.test(next ?? "")) continue;
    let end = index + 2;
    while (/\w/.test(sql[end] ?? "")) end += 1;
    names.push(sql.slice(index + 1, end));
    index = end - 1;
  }
  return [...new Set(names)];
}

function topLevelBinary(text, operators, rightAssociative = false) {
  let quote = null;
  let depth = 0;
  let match = null;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== null) {
      if (character === "\\") { index += 1; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if ("([{".includes(character)) { depth += 1; continue; }
    if (")]}".includes(character)) { depth -= 1; continue; }
    if (depth !== 0) continue;
    for (const operator of operators) {
      if (text.startsWith(` ${operator} `, index)) {
        if (match === null || !rightAssociative) match = { index, operator };
        index += operator.length + 1;
        break;
      }
    }
  }
  return match;
}

function splitTopLevel(text, separator = ", ") {
  const parts = [];
  let start = 0;
  let quote = null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== null) {
      if (character === "\\") { index += 1; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if ("([{".includes(character)) { depth += 1; continue; }
    if (")]}".includes(character)) { depth -= 1; continue; }
    if (depth === 0 && text.startsWith(separator, index)) {
      parts.push(text.slice(start, index));
      start = index + separator.length;
      index += separator.length - 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function parenthesizedExpression(text) {
  if (!text.startsWith("(") || !text.endsWith(")")) return null;
  let quote = null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote !== null) {
      if (character === "\\") { index += 1; continue; }
      if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"') { quote = character; continue; }
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth === 0 && index !== text.length - 1) return null;
    }
  }
  return depth === 0 ? text.slice(1, -1) : null;
}

function expr(source, line, parser) {
  const text = source.trim();
  const grouped = parenthesizedExpression(text);
  if (grouped !== null) return expr(grouped, line, parser);
  if (text.startsWith("<")) {
    const parsed = xmlLiteral(text, line, parser);
    if (parsed !== null) return parsed;
    parser.fail(line, "LNG1247", "unterminated XML literal");
  }
  if (text.startsWith("[") && text.endsWith("]"))
    return {
      type: "array",
      values:
        text.slice(1, -1) === ""
          ? []
          : splitTopLevel(text.slice(1, -1)).map((item) => expr(item, line, parser)),
    };
  if (text.startsWith("{") && text.endsWith("}")) {
    const fields = text.slice(1, -1).trim();
    if (fields === "") return { type: "object", fields: [] };
    const keys = new Set();
    return {
      type: "object",
      fields: splitTopLevel(fields).map((field) => {
        const match = /^(\$?[A-Za-z_]\w*|['"][^'"]+['"]): (.+)$/.exec(field);
        if (!match) parser.fail(line, "LNG1111", "expected `key: value`");
        const key = match[1].startsWith("'") || match[1].startsWith('"')
          ? match[1].slice(1, -1).replace(/\\(['"\\])/g, "$1")
          : match[1];
        if (keys.has(key)) parser.fail(line, "LNG1258", `duplicate object key ${key}`);
        keys.add(key);
        return { key: match[1], value: expr(match[2], line, parser) };
      }),
    };
  }
  for (const operators of [
    ["??"],
    ["or", "||"],
    ["and", "&&"],
    ["==", "!="],
    [">=", "<=", ">", "<", "not in", "in"],
    ["+", "-"],
    ["*", "/", "%"],
  ]) {
    const match = topLevelBinary(text, operators);
    if (match !== null)
      return {
        type: "binary",
        operator: match.operator,
        left: expr(text.slice(0, match.index), line, parser),
        right: expr(text.slice(match.index + match.operator.length + 2), line, parser),
      };
  }
  const exponent = topLevelBinary(text, ["**"], true);
  if (exponent !== null)
    return {
      type: "binary",
      operator: exponent.operator,
      left: expr(text.slice(0, exponent.index), line, parser),
      right: expr(text.slice(exponent.index + exponent.operator.length + 2), line, parser),
    };
  if (text.startsWith("not "))
    return {
      type: "unary",
      operator: "not",
      value: expr(text.slice(4), line, parser),
    };
  if (/^-[^\s]/.test(text))
    return {
      type: "unary",
      operator: "negate",
      value: expr(text.slice(1), line, parser),
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
  const construct =
    /^new ([A-Za-z_]\w*(?:[./][A-Za-z_]\w*)*)\((.*)\)$/.exec(text);
  if (construct)
    return {
      type: "new",
      name: construct[1],
      arguments: construct[2]
        ? splitTopLevel(construct[2]).map((item) => expr(item, line, parser))
        : [],
      line: line.number,
    };
  const superMethodCall = /^super\.([A-Za-z_]\w*)\((.*)\)$/.exec(text);
  if (superMethodCall)
    return {
      type: "superMethodCall",
      name: superMethodCall[1],
      arguments: superMethodCall[2]
        ? splitTopLevel(superMethodCall[2]).map((item) => expr(item, line, parser))
        : [],
      line: line.number,
    };
  const nestedIndex =
    /^([A-Za-z_]\w*(?:(?:\.|\?\.)[A-Za-z_]\w)*\[.+\])(\?\.)?\[(.+)\]$/.exec(
      text,
    );
  if (nestedIndex)
    return {
      type: "index",
      receiver: expr(nestedIndex[1], line, parser),
      optional: nestedIndex[2] === "?.",
      index: expr(nestedIndex[3], line, parser),
    };
  const computedIndex =
    /^([A-Za-z_]\w*(?:(?:\.|\?\.)[A-Za-z_]\w)*)(\?\.)?\[(.+)\]$/.exec(
      text,
    );
  if (
    computedIndex &&
    !/^(?:\d+|[A-Za-z_]\w*|['"][^'"]*['"])$/.test(computedIndex[3])
  )
    return {
      type: "index",
      receiver: computedIndex[1],
      optional: computedIndex[2] === "?.",
      index: expr(computedIndex[3], line, parser),
    };
  const methodCall =
    /^([A-Za-z_]\w*(?:(?:\.|\?\.)[A-Za-z_]\w*)*?)(\?\.|\.)([A-Za-z_]\w*)\((.*)\)$/.exec(
      text,
    );
  const namespaceMethodCall =
    /^([A-Za-z_]\w*(?:\/[A-Za-z_]\w*)*)\/([A-Za-z_]\w*)\((.*)\)$/.exec(
      text,
    );
  if (namespaceMethodCall)
    return {
      type: "namespaceMethodCall",
      receiver: namespaceMethodCall[1],
      name: namespaceMethodCall[2],
      arguments: namespaceMethodCall[3]
        ? splitTopLevel(namespaceMethodCall[3]).map((item) => expr(item, line, parser))
        : [],
      line: line.number,
    };
  if (methodCall)
    return {
      type: "methodCall",
      receiver: methodCall[1],
      optional: methodCall[2] === "?.",
      name: methodCall[3],
      arguments: methodCall[4]
        ? splitTopLevel(methodCall[4]).map((item) => expr(item, line, parser))
        : [],
      line: line.number,
    };
  const call = /^([A-Za-z_]\w*)\((.*)\)$/.exec(text);
  if (call)
    return {
      type: "call",
      name: call[1],
      arguments: call[2]
        ? splitTopLevel(call[2]).map((item) => expr(item, line, parser))
        : [],
      line: line.number,
    };
  if (/^['"].*['"]$/.test(text))
    return { type: "string", literal: literal(text, line, parser) };
  if (/^\$(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
    if (!Number.isFinite(Number(text.slice(1))))
      parser.fail(line, "LNG1120", "numeric literal must be finite");
    return { type: "raw", value: text };
  }
  if (
    /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
    /^0[xX][0-9a-fA-F]+$/.test(text)
  ) {
    if (!Number.isFinite(Number(text)))
      parser.fail(line, "LNG1120", "numeric literal must be finite");
    return { type: "raw", value: text };
  }
  if (/^(true|false|null)$/.test(text)) return { type: "raw", value: text };
  if (/^[A-Za-z_]\w*(?:(?:\.|\?\.)[A-Za-z_]\w*)*(?:\.|\?\.)_[A-Za-z_]\w*$/.test(text))
    parser.fail(
      line,
      "LNG1115",
      "protected properties are not accessible outside a class",
    );
  if (/^[A-Za-z_]\w*(?:(?:\.|\?\.)\$?[A-Za-z_]\w*|(?:\?\.)?\[(?:\d+|[A-Za-z_]\w*|['"][^'"]*['"])\])+$/.test(text))
    return { type: "raw", value: text };
  if (/^[A-Za-z_]\w*\[(?:\d+|[A-Za-z_]\w*|['"][^'"]*['"])\]$/.test(text))
    return { type: "raw", value: text };
  if (/^(?:\$[A-Za-z_]\w*|@{0,2}\$?[A-Za-z_]\w*)$/.test(text)) return { type: "raw", value: text };
  parser.fail(line, "LNG1108", `unsupported Faz 2 expression: ${text}`);
}

function xmlLiteral(source, line, parser) {
  const parts = [];
  const appendText = (text) => {
    if (text === "") return;
    const previous = parts.at(-1);
    if (previous?.type === "text") previous.value += text;
    else parts.push({ type: "text", value: text });
  };
  const appendInterpolations = (text, allowed) => {
    let at = 0;
    while (at < text.length) {
      const start = text.indexOf("${", at);
      if (start === -1) {
        appendText(text.slice(at));
        return true;
      }
      if (!allowed) parser.fail(line, "LNG1248", "XML interpolation is only valid in text or quoted attributes");
      const end = text.indexOf("}", start + 2);
      if (end === -1) return false;
      appendText(text.slice(at, start));
      const expression = text.slice(start + 2, end).trim();
      if (!expression)
        parser.fail(line, "LNG1248", "XML interpolation requires an expression");
      parts.push({ type: "expression", value: expr(expression, line, parser) });
      at = end + 1;
    }
    return true;
  };
  const validateEntities = (text) => {
    if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/.test(text))
      parser.fail(line, "LNG1249", "XML text and attributes must escape ampersands");
  };
  const appendOpenTag = (tag) => {
    if (tag.startsWith("<${"))
      parser.fail(line, "LNG1248", "XML interpolation is only valid in text or quoted attributes");
    const match = /^<([A-Za-z_][\w:.-]*)([\s\S]*)>$/.exec(tag);
    if (!match) parser.fail(line, "LNG1249", "invalid XML opening tag");
    let attributes = match[2];
    const selfClosing = /\/$/.test(attributes.trimEnd());
    if (selfClosing) attributes = attributes.trimEnd().slice(0, -1);
    let at = 0;
    const names = new Set();
    while (at < attributes.length) {
      const whitespace = /^[ \t\r\n]+/.exec(attributes.slice(at));
      if (!whitespace)
        parser.fail(line, "LNG1249", "XML attributes must be separated by whitespace");
      at += whitespace[0].length;
      if (at === attributes.length) break;
      const name = /^[A-Za-z_][\w:.-]*/.exec(attributes.slice(at));
      if (!name) parser.fail(line, "LNG1249", "invalid XML attribute name");
      if (names.has(name[0]))
        parser.fail(line, "LNG1249", `duplicate XML attribute ${name[0]}`);
      names.add(name[0]);
      at += name[0].length;
      if (attributes[at] !== "=")
        parser.fail(line, "LNG1249", "XML attributes require quoted values");
      at += 1;
      const quote = attributes[at];
      if (quote !== '"' && quote !== "'")
        parser.fail(line, "LNG1249", "XML attributes require quoted values");
      const end = attributes.indexOf(quote, at + 1);
      if (end === -1) return null;
      validateEntities(attributes.slice(at + 1, end).replace(/\$\{[^}]*\}/g, ""));
      at = end + 1;
    }
    let quote = null;
    let segmentStart = 0;
    for (let index = 0; index < tag.length; index += 1) {
      if (tag[index] === '"' || tag[index] === "'") {
        quote = quote === tag[index] ? null : quote ?? tag[index];
        continue;
      }
      if (tag.startsWith("${", index)) {
        if (!quote)
          parser.fail(line, "LNG1248", "XML interpolation is only valid in text or quoted attributes");
        const end = tag.indexOf("}", index + 2);
        if (end === -1) return null;
        appendText(tag.slice(segmentStart, index));
        const expression = tag.slice(index + 2, end).trim();
        if (!expression)
          parser.fail(line, "LNG1248", "XML interpolation requires an expression");
        parts.push({ type: "expression", value: expr(expression, line, parser) });
        index = end;
        segmentStart = end + 1;
      }
    }
    appendText(tag.slice(segmentStart));
    return { name: match[1], selfClosing };
  };

  const stack = [];
  let rootSeen = false;
  let rootClosed = false;
  let at = 0;
  while (at < source.length) {
    if (source[at] !== "<") {
      const end = source.indexOf("<", at);
      const text = source.slice(at, end === -1 ? source.length : end);
      if (rootClosed && text.trim())
        parser.fail(line, "LNG1249", "XML literal may contain one root element");
      validateEntities(text.replace(/\$\{[^}]*\}/g, ""));
      if (!appendInterpolations(text, true)) return null;
      at = end === -1 ? source.length : end;
      continue;
    }
    if (source.startsWith("<!--", at)) {
      const end = source.indexOf("-->", at + 4);
      if (end === -1) return null;
      appendText(source.slice(at, end + 3));
      at = end + 3;
      continue;
    }
    const end = xmlTagEnd(source, at);
    if (end === -1) return null;
    const tag = source.slice(at, end + 1);
    if (tag.startsWith("</")) {
      const match = /^<\/([A-Za-z_][\w:.-]*)\s*>$/.exec(tag);
      if (!match) parser.fail(line, "LNG1249", "invalid XML closing tag");
      if (stack.pop() !== match[1])
        parser.fail(line, "LNG1249", `XML closing tag ${match[1]} does not match its opening tag`);
      appendText(tag);
      if (stack.length === 0) rootClosed = true;
    } else {
      if (rootClosed) parser.fail(line, "LNG1249", "XML literal may contain one root element");
      const opening = appendOpenTag(tag);
      if (opening === null) return null;
      if (!rootSeen) rootSeen = true;
      if (!opening.selfClosing) stack.push(opening.name);
      else if (stack.length === 0) rootClosed = true;
    }
    at = end + 1;
  }
  if (!rootSeen || stack.length) return null;
  return { type: "xml", parts, line: line.number };
}

function xmlTagEnd(source, start) {
  let quote = null;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"' || character === "'") quote = quote === character ? null : quote ?? character;
    else if (character === ">" && !quote) return index;
  }
  return -1;
}

function stripComment(line) {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = quote === character ? null : quote ?? character;
      continue;
    }
    if (!quote && character === "#") return line.slice(0, index).trimEnd();
  }
  return line;
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
  const importNames = [
    ...imports.flatMap((item) =>
      item.names.map((name) => name.split(" as ").at(-1)),
    ),
    ...program.jsImports.map((item) => item.name),
  ];
  const imported = new Set(importNames);
  const importedGlobals = new Set(
    imports.flatMap((item) =>
      (item.selections ?? [])
        .filter((selection) => selection.kind === "global")
        .map((selection) => selection.localName),
    ),
  );
  const jsImportNames = new Set(program.jsImports.map((item) => item.name));
  const importedFunctions = new Map(
    imports.flatMap((item) =>
      (item.selections ?? [])
        .filter((selection) => selection.kind === "function")
        .map((selection) => [
          selection.localName,
          { parameters: selection.parameters },
        ]),
    ),
  );
  const importedClasses = new Map(
    imports.flatMap((item) =>
      (item.selections ?? [])
        .filter((selection) => selection.kind === "class")
        .map((selection) => [selection.localName, selection.interface]),
    ),
  );
  const standardFunctions = new Map([
    ["from_json", 1],
    ["to_json", 1],
    ["get_class", 1],
    ["is_kindof", 2],
    ["is_number", 1],
    ["is_string", 1],
    ["is_bool", 1],
    ["is_object", 1],
    ["is_array", 1],
    ["to_js_number", 1],
    ["start_trans", 0], ["commit_trans", 0], ["rollback_trans", 0], ["trans_state", 0],
  ]);
  const hostFunctions = new Set(["fetch"]);
  const isDecimalValue = (value) =>
    value &&
    ((value.type === "raw" && (value.value.startsWith("$") || value.value.includes(".$"))) ||
      (value.type === "unary" &&
        value.operator === "negate" &&
        isDecimalValue(value.value)) ||
      (value.type === "binary" &&
        ["+", "-", "*", "/", "%", "**"].includes(value.operator) &&
        (isDecimalValue(value.left) || isDecimalValue(value.right))) ||
      (value.type === "binary" &&
        value.operator === "??" &&
        ((value.left.type === "raw" && value.left.value === "null" && isDecimalValue(value.right)) ||
          (value.right.type === "raw" && value.right.value === "null" && isDecimalValue(value.left)) ||
          (isDecimalValue(value.left) && isDecimalValue(value.right)))));
  const returns = (body, result = []) => {
    for (const node of body) {
      if (node.type === "return") result.push(node.value);
      [node.thenBody, node.elseBody, node.tryBody, node.catchBody, node.finallyBody]
        .filter(Boolean)
        .forEach((child) => returns(child, result));
    }
    return result;
  };
  const decimalFunctions = new Set(
    program.functions
      .filter((fn) => returns(fn.body).some(isDecimalValue))
      .map((fn) => fn.name),
  );
  let decimalFunctionChanged = true;
  while (decimalFunctionChanged) {
    decimalFunctionChanged = false;
    for (const fn of program.functions)
      if (
        !decimalFunctions.has(fn.name) &&
        returns(fn.body).some(
          (value) => value?.type === "call" && decimalFunctions.has(value.name),
        )
      ) {
        decimalFunctions.add(fn.name);
        decimalFunctionChanged = true;
      }
  }
  for (const fn of program.functions) {
    const values = returns(fn.body);
    const decimalReturn = (value) =>
      isDecimalValue(value) ||
      (value?.type === "call" && decimalFunctions.has(value.name));
    if (values.some(decimalReturn) && values.some((value) => !decimalReturn(value)))
      throw new LangoError(
        "LNG1243",
        fn.line,
        `${fn.name}: Decimal-returning function has a non-Decimal return path`,
      );
  }
  const validateDecimalAssignments = (body) => {
    for (const node of body) {
      if (
        node.type === "assign" &&
        !node.name.startsWith("$") &&
        node.value.type === "call" &&
        decimalFunctions.has(node.value.name)
      )
        throw new LangoError(
          "LNG1244",
          1,
          `${node.value.name} returns Decimal; assign it to a $ binding or call to_js_number(...)`,
        );
      [node.thenBody, node.elseBody, node.tryBody, node.catchBody, node.finallyBody, node.body]
        .filter(Boolean)
        .forEach(validateDecimalAssignments);
    }
  };
  const validateSqlParameters = (body, bindings = new Map()) => {
    for (const node of body) {
      if (node.type === "assign" && node.value.type === "sql") {
        bindings.set(node.name, new Set(node.value.parameters));
        continue;
      }
      if (node.type === "assign") {
        const property = /^([A-Za-z_]\w*)\.([A-Za-z_]\w*)$/.exec(node.name);
        if (property && bindings.has(property[1]) && !bindings.get(property[1]).has(property[2]))
          throw new LangoError(
            "LNG1256",
            node.value.line ?? 1,
            `${property[1]}: unknown SQL parameter ${property[2]}`,
          );
        if (!property) bindings.delete(node.name);
      }
      [node.thenBody, node.elseBody, node.tryBody, node.catchBody, node.finallyBody]
        .filter(Boolean)
        .forEach((child) => validateSqlParameters(child, new Map(bindings)));
    }
  };
  program.functions.forEach((fn) => validateDecimalAssignments(fn.body));
  program.functions.forEach((fn) => validateSqlParameters(fn.body));
  program.tests.forEach((test) => validateSqlParameters(test.body));
  program.classes.forEach((classNode) =>
    classNode.methods.forEach((method) => validateSqlParameters(method.body)),
  );
  if (names.size !== program.functions.length)
    throw new LangoError("LNG1201", 1, "duplicate function name");
  if (globals.size !== program.globals.length)
    throw new LangoError("LNG1216", 1, "duplicate global name");
  if (imported.size !== importNames.length)
    throw new LangoError("LNG1228", 1, "duplicate imported local name");
  const declarationNames = new Set([
    ...program.functions.map((item) => item.name),
    ...program.classes.map((item) => item.name),
    ...program.globals.map((item) => item.name),
  ]);
  for (const name of imported)
    if (declarationNames.has(name))
      throw new LangoError(
        "LNG1229",
        1,
        `imported local name ${name} conflicts with a Lango declaration`,
      );
  const classes = new Map(program.classes.map((item) => [item.name, item]));
  if (classes.size !== program.classes.length)
    throw new LangoError("LNG1205", 1, "duplicate class name");
  const ancestorState = new Map();
  const visitAncestor = (classNode) => {
    const state = ancestorState.get(classNode.name);
    if (state === "visiting")
      throw new LangoError(
        "LNG1236",
        classNode.line,
        `${classNode.name}: cyclic class inheritance`,
      );
    if (state === "done") return;
    ancestorState.set(classNode.name, "visiting");
    const ancestor = classes.get(classNode.ancestor);
    if (ancestor) visitAncestor(ancestor);
    ancestorState.set(classNode.name, "done");
  };
  program.classes.forEach(visitAncestor);
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
  const dynamicBindingNames = (body, result = new Set()) => {
    for (const node of body) {
      if (node.type === "assign" && !node.name.startsWith("@"))
        result.add(node.name);
      if (node.type === "closureAssign") result.add(node.name);
      if (node.type === "for") result.add(node.item);
      if (node.type === "forObject") {
        result.add(node.key);
        result.add(node.value);
      }
      [
        node.body,
        node.thenBody,
        node.elseBody,
        node.tryBody,
        node.catchBody,
        node.finallyBody,
        ...(node.cases?.map((item) => item.body) ?? []),
      ]
        .filter(Boolean)
        .forEach((child) => dynamicBindingNames(child, result));
    }
    return result;
  };
  const validateRequiredArguments = (target, value, label) => {
    const missing = target.parameters.findIndex(
      (parameter, index) =>
        parameter.defaultValue === null && value.arguments.length <= index,
    );
    if (missing !== -1)
      throw new LangoError(
        "LNG1203",
        value.line,
        `${label} is missing required argument ${missing + 1}`,
      );
  };
  const validateJavaScriptArguments = (value, label) => {
    const decimalIndex = value.arguments.findIndex(isDecimalValue);
    if (decimalIndex !== -1)
      throw new LangoError(
        "LNG1252",
        value.line,
        `${label}: Decimal argument ${decimalIndex + 1} requires to_js_number(...) at a JavaScript boundary`,
      );
  };
  const findMethod = (classNode, name, staticMethod) => {
    let current = classNode;
    while (current) {
      const method = current.methods.find(
        (item) => item.name === name && item.static === staticMethod,
      );
      if (method) return method;
      current = current.ancestor ? classes.get(current.ancestor) : null;
    }
    return null;
  };
  const findMethodWithOwner = (classNode, name, staticMethod) => {
    let current = classNode;
    while (current) {
      const method = current.methods.find(
        (item) => item.name === name && item.static === staticMethod,
      );
      if (method) return { method, owner: current };
      current = current.ancestor ? classes.get(current.ancestor) : null;
    }
    return null;
  };
  const findConstructor = (classNode) =>
    findMethod(classNode, "constructor", false);
  const walk = (value, localCallables, classNode = null, staticMethod = false) => {
    if (!value || typeof value !== "object") return;
    if (value.type === "binary" && ["+", "-", "*", "/", "%", "**", ">", "<", ">=", "<="].includes(value.operator)) {
      const string = (item) => item.type === "string";
      const number = (item) => item.type === "raw" && /^\d/.test(item.value);
      const boolean = (item) => item.type === "raw" && /^(true|false)$/.test(item.value);
      const absent = (item) => item.type === "raw" && item.value === "null";
      const kind = (item) => string(item) ? "string" : number(item) ? "number" : boolean(item) ? "boolean" : absent(item) ? "null" : null;
      const leftKind = kind(value.left);
      const rightKind = kind(value.right);
      if (leftKind && rightKind &&
          (leftKind !== rightKind || leftKind === "boolean" || leftKind === "null" ||
           (leftKind === "string" && value.operator !== "+")))
        throw new LangoError("LNG1254", value.line ?? 1, "primitive values do not coerce in operators");
    }
    if (value.type === "call") {
      const target = names.get(value.name) ?? importedFunctions.get(value.name);
      if (
        !target &&
        !imported.has(value.name) &&
        !standardFunctions.has(value.name) &&
        !hostFunctions.has(value.name) &&
        !localCallables.has(value.name)
      )
        throw new LangoError(
          "LNG1202",
          value.line,
          `unknown Lango function ${value.name}`,
        );
      if (target) {
        validateRequiredArguments(target, value, value.name);
        value.arguments.forEach((argument, index) => {
          const parameter = target.parameters[index];
          if (
            parameter &&
            !parameter.name.startsWith("$") &&
            isDecimalValue(argument)
          )
            throw new LangoError(
              "LNG1245",
              value.line,
              `${value.name}: Decimal argument ${index + 1} requires a $ parameter`,
            );
        });
      }
      if (
        standardFunctions.has(value.name) &&
        value.arguments.length !== standardFunctions.get(value.name)
      )
        throw new LangoError(
          "LNG1219",
          value.line,
          `${value.name} expects ${standardFunctions.get(value.name)} arguments, got ${value.arguments.length}`,
        );
      if (hostFunctions.has(value.name)) validateJavaScriptArguments(value, value.name);
    }
    if (value.type === "new") {
      if (
        value.name.includes("/") &&
        !jsImportNames.has(value.name.split("/")[0])
      )
        throw new LangoError(
          "LNG1233",
          value.line,
          `${value.name.split("/")[0]} is not an imported JavaScript namespace`,
        );
      if (
        value.name.includes(".") &&
        jsImportNames.has(value.name.split(".")[0])
      )
        throw new LangoError(
          "LNG1232",
          value.line,
          `use / between JavaScript namespace segments in new ${value.name}(...)`,
        );
      if (value.name.includes("/")) validateJavaScriptArguments(value, value.name);
      const target = classes.get(value.name);
      const constructor = target && findConstructor(target);
      if (constructor) validateRequiredArguments(constructor, value, value.name);
    }
    if (value.type === "methodCall") {
      if (
        value.receiver.includes(".") &&
        jsImportNames.has(value.receiver.split(".")[0])
      )
        throw new LangoError(
          "LNG1232",
          value.line,
          `use / between JavaScript namespace segments in ${value.receiver}.${value.name}(...)`,
        );
      const targetClass =
        value.receiver === "this"
          ? classNode
          : classes.get(value.receiver) ?? null;
      const importedStaticMethod =
        !targetClass &&
        importedClasses
          .get(value.receiver)
          ?.staticMethods.find((item) => item.name === value.name);
      const importedClass = !targetClass && importedClasses.get(value.receiver);
      if (importedStaticMethod) {
        validateRequiredArguments(
          importedStaticMethod,
          value,
          `${value.receiver}.${value.name}`,
        );
      }
      if (importedClass?.staticListed && !importedStaticMethod)
        throw new LangoError(
          "LNG1241",
          value.line,
          `${value.receiver}: unknown static method ${value.name}`,
        );
      const target =
        targetClass &&
        findMethodWithOwner(
          targetClass,
          value.name,
          value.receiver === "this" ? staticMethod : true,
        );
      if (targetClass && !target)
        throw new LangoError(
          "LNG1241",
          value.line,
          `${targetClass.name}: unknown ${value.receiver === "this" ? "instance" : "static"} method ${value.name}`,
        );
      if (
        target &&
        !target.method.public &&
        target.owner !== classNode
      )
        throw new LangoError(
          "LNG1242",
          value.line,
          `${targetClass.name}: method ${value.name} is private`,
        );
      if (target)
        validateRequiredArguments(
          target.method,
          value,
          `${targetClass.name}${target.method.static ? "::" : ":"}${value.name}`,
        );
    }
    if (value.type === "namespaceMethodCall") {
      const root = value.receiver.split("/")[0];
      if (!jsImportNames.has(root))
        throw new LangoError(
          "LNG1233",
          value.line,
          `${root} is not an imported JavaScript namespace`,
        );
      validateJavaScriptArguments(value, `${value.receiver}/${value.name}`);
    }
    if (value.type === "superMethodCall" && classNode?.ancestor) {
      if (staticMethod)
        throw new LangoError(
          "LNG1239",
          value.line,
          "super.method(...) is only valid in an instance method",
        );
      let target = null;
      for (
        let ancestor = classes.get(classNode.ancestor);
        ancestor;
        ancestor = ancestor.ancestor ? classes.get(ancestor.ancestor) : null
      ) {
        const candidate = ancestor.methods.find(
          (item) => item.name === value.name && !item.static && item.public,
        );
        if (candidate) {
          target = candidate;
          break;
        }
      }
      if (!target)
        throw new LangoError(
          "LNG1240",
          value.line,
          `${classNode.name}: unknown or private ancestor method ${value.name}`,
        );
      validateRequiredArguments(target, value, `super.${value.name}`);
    }
    Object.values(value).forEach((item) =>
      Array.isArray(item)
        ? item.forEach((child) => walk(child, localCallables, classNode, staticMethod))
        : walk(item, localCallables, classNode, staticMethod),
    );
  };
  [...program.functions, ...program.tests].forEach((fn) =>
    walk(
      fn,
      new Set([
        ...dynamicBindingNames(fn.body),
        ...(fn.parameters ?? []).map((parameter) => parameter.name),
      ]),
    ),
  );
  program.classes.forEach((classNode) =>
    classNode.methods.forEach((method) =>
      walk(
        method,
        new Set([
          ...dynamicBindingNames(method.body),
          ...method.parameters.map((parameter) => parameter.name),
        ]),
        classNode,
        method.static,
      ),
    ),
  );

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
    if (node.type === "methodCall" || node.type === "namespaceMethodCall") {
      if (node.receiver !== "this")
        references.add(node.receiver.split(/[./]/)[0]);
      node.arguments.forEach((argument) =>
        expressionReferences(argument, references),
      );
      return;
    }
    if (node.type === "index") {
      if (typeof node.receiver === "string")
        references.add(node.receiver.split(/[./]/)[0]);
      else expressionReferences(node.receiver, references);
      expressionReferences(node.index, references);
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
      if (node.type === "if") {
        const left = validateClosures(node.thenBody, new Set(available), classScope);
        const right = node.elseBody
          ? validateClosures(node.elseBody, new Set(available), classScope)
          : available;
        for (const name of left) if (right.has(name)) available.add(name);
        continue;
      }
      if (node.type === "try") {
        const exits = [validateClosures(node.tryBody, new Set(available), classScope)];
        if (node.catchBody)
          exits.push(validateClosures(node.catchBody, new Set(available), classScope));
        const certain = new Set(exits[0]);
        for (const name of certain)
          if (!exits.every((exit) => exit.has(name))) certain.delete(name);
        const afterFinally = node.finallyBody
          ? validateClosures(node.finallyBody, certain, classScope)
          : certain;
        afterFinally.forEach((name) => available.add(name));
        continue;
      }
      const chain = node.type === "chain"
        ? node
        : node.type === "return" && node.value?.type === "chain"
          ? node.value
          : null;
      if (chain) {
        for (const step of chain.steps)
          validateClosures(
            [{ type: "return", value: { type: "closure", ...step } }],
            new Set(available),
            classScope,
          );
        continue;
      }
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
    return available;
  };
  const validateDefiniteAssignments = (body, initial = new Set()) => {
    const candidates = directBindings(body);
    const visit = (nodes, assigned) => {
      const current = new Set(assigned);
      for (const node of nodes) {
        const references = new Set();
        [node.value, node.condition, node.arguments, node.tests].forEach((value) => {
          if (Array.isArray(value)) value.forEach((item) => expressionReferences(item, references));
          else expressionReferences(value, references);
        });
        for (const name of references)
          if (candidates.has(name) && !current.has(name))
            throw new LangoError("LNG1246", node.line ?? 1, `${name} is not assigned on every path`);
        if (node.type === "if") {
          const left = visit(node.thenBody, current);
          const right = node.elseBody ? visit(node.elseBody, current) : current;
          for (const name of left) if (right.has(name)) current.add(name);
          continue;
        }
        if (node.type === "try") {
          const normalExits = [visit(node.tryBody, current)];
          if (node.catchBody) normalExits.push(visit(node.catchBody, current));
          const certain = new Set(normalExits[0]);
          for (const name of certain)
            if (!normalExits.every((exit) => exit.has(name))) certain.delete(name);
          if (node.finallyBody) {
            const afterFinally = visit(node.finallyBody, certain);
            afterFinally.forEach((name) => current.add(name));
          } else certain.forEach((name) => current.add(name));
          continue;
        }
        if (node.type === "loop" || node.type === "for" || node.type === "forObject") {
          const loopBindings = new Set(current);
          if (node.type === "for") loopBindings.add(node.item);
          if (node.type === "forObject") {
            loopBindings.add(node.key);
            loopBindings.add(node.value);
          }
          visit(node.body, loopBindings);
          continue;
        }
        if (node.type === "assign" || node.type === "closureAssign") current.add(node.name);
      }
      return current;
    };
    visit(body, initial);
  };
  program.functions.forEach((fn) =>
    validateDefiniteAssignments(
      fn.body,
      new Set([...fn.parameters.map((item) => item.name), ...globals]),
    ),
  );

  program.functions.forEach((fn) =>
    validateClosures(
      fn.body,
      new Set([
        ...fn.parameters.map((parameter) => parameter.name),
        ...imported,
      ]),
    ),
  );
  program.tests.forEach((test) =>
    validateClosures(test.body, new Set(imported)),
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
      if (node.type === "assign" && importedGlobals.has(node.name))
        throw new LangoError(
          "LNG1250",
          node.line ?? 1,
          `${node.name} is an imported global and cannot be assigned here`,
        );
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
  program.tests.forEach((test) =>
    validateContextAssignments(test.body, contextDeclarations(test.body)),
  );
  program.functions.forEach((fn) => validateGlobalAccess(fn.body));
  program.tests.forEach((test) => validateGlobalAccess(test.body));
  const validateLoopLevels = (body, depth = 0) => {
    for (const node of body) {
      if (
        (node.type === "break" || node.type === "continue") &&
        node.level > depth
      )
        throw new LangoError(
          "LNG1220",
          node.line,
          `${node.type} ${node.level} exceeds enclosing loop depth ${depth}`,
        );
      const childDepth = node.type === "loop" ? depth + 1 : depth;
      nestedBodies(node).forEach((child) => validateLoopLevels(child, childDepth));
    }
  };
  program.functions.forEach((fn) => validateLoopLevels(fn.body));
  program.tests.forEach((test) => validateLoopLevels(test.body));
  for (const classNode of program.classes) {
    if (classNode.ancestor && !classes.has(classNode.ancestor))
      throw new LangoError(
        "LNG1206",
        classNode.line,
        `${classNode.name}: unknown ancestor ${classNode.ancestor}`,
      );
    const publicInstanceNames = new Set();
    for (const name of [
      ...classNode.publicProperties,
      ...classNode.publicMethods
        .filter((item) => !item.static)
        .map((item) => item.name),
    ]) {
      if (publicInstanceNames.has(name))
        throw new LangoError(
          "LNG1225",
          classNode.line,
          `${classNode.name}: duplicate public instance member ${name}`,
        );
      publicInstanceNames.add(name);
    }
    const staticNames = new Set();
    for (const name of [
      ...classNode.staticValues.map((item) => item.name),
      ...classNode.enumValues.map((item) => item.name),
      ...classNode.publicMethods
        .filter((item) => item.static)
        .map((item) => item.name),
    ]) {
      if (staticNames.has(name))
        throw new LangoError(
          "LNG1224",
          classNode.line,
          `${classNode.name}: duplicate static member ${name}`,
        );
      staticNames.add(name);
    }
    const inheritedMethods = [];
    for (
      let ancestor = classNode.ancestor ? classes.get(classNode.ancestor) : null;
      ancestor;
      ancestor = ancestor.ancestor ? classes.get(ancestor.ancestor) : null
    )
      inheritedMethods.push(...ancestor.methods);
    for (const method of classNode.methods) {
      if (method.name === "constructor") continue;
      const inherited = inheritedMethods.find(
        (candidate) =>
          candidate.name === method.name && candidate.static === method.static,
      );
      if (!inherited) continue;
      if (!inherited.public)
        throw new LangoError(
          "LNG1237",
          method.line,
          `${classNode.name}: method ${method.name} conflicts with an ancestor private method`,
        );
      if (
        !classNode.publicMethods.some(
          (candidate) =>
            candidate.name === method.name && candidate.static === method.static,
        )
      )
        throw new LangoError(
          "LNG1238",
          method.line,
          `${classNode.name}: override of public method ${method.name} cannot be private`,
        );
    }
    const implementations = new Set();
    for (const method of classNode.methods) {
      const key = `${method.static ? "static" : "instance"}:${method.name}`;
      if (implementations.has(key))
        throw new LangoError(
          "LNG1226",
          method.line,
          `${classNode.name}: duplicate ${method.static ? "static" : "instance"} method ${method.name}`,
        );
      implementations.add(key);
    }
    for (const method of classNode.publicMethods) {
      const implementation = classNode.methods.find(
        (item) => item.name === method.name && item.static === method.static,
      );
      if (!implementation)
        throw new LangoError(
          "LNG1209",
          classNode.line,
          `${classNode.name}: public method ${method.static ? "::" : ""}${method.name} has no implementation`,
        );
      const declaredParameters = JSON.stringify(method.parameters);
      const implementedParameters = JSON.stringify(implementation.parameters);
      if (declaredParameters !== implementedParameters)
        throw new LangoError(
          "LNG1223",
          implementation.line,
          `${classNode.name}: public method ${method.name} signature does not match its declaration`,
        );
    }
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
    const collectInheritedProtectedMembers = (body, members) => {
      for (const node of body) {
        if (node.type === "assign" && /^_[A-Za-z_]\w*$/.test(node.name))
          members.add(node.name);
        nestedBodies(node).forEach((child) =>
          collectInheritedProtectedMembers(child, members),
        );
      }
    };
    const inheritedInstanceMembers = new Set();
    const inheritedStaticMembers = new Set();
    let ancestor = classNode.ancestor ? classes.get(classNode.ancestor) : null;
    while (ancestor) {
      ancestor.publicProperties.forEach((name) => inheritedInstanceMembers.add(name));
      ancestor.methods.forEach((method) =>
        collectInheritedProtectedMembers(method.body, inheritedInstanceMembers),
      );
      ancestor.staticValues.forEach((value) => inheritedStaticMembers.add(value.name));
      ancestor.enumValues.forEach((value) => {
        inheritedStaticMembers.add(value.name);
        readonly.add(value.name);
      });
      ancestor = ancestor.ancestor ? classes.get(ancestor.ancestor) : null;
    }
    const classScope = {
      instanceMembers: new Set([...instanceMembers, ...inheritedInstanceMembers]),
      staticMembers: new Set([
        ...classNode.staticValues.map((item) => item.name),
        ...classNode.enumValues.map((item) => item.name),
        ...inheritedStaticMembers,
      ]),
    };
    const validateProperties = (value) => {
      if (!value || typeof value !== "object") return;
      const name =
        value.type === "assign"
          ? value.name
          : value.type === "raw"
            ? value.value
            : null;
      if (name && /^@@[A-Za-z_]\w*$/.test(name)) {
        if (!classScope.staticMembers.has(name.slice(2)))
          throw new LangoError(
            "LNG1221",
            classNode.line,
            `${classNode.name}: unknown static property ${name}`,
          );
      }
      if (name && /^@[A-Za-z_]\w*$/.test(name)) {
        if (!classScope.instanceMembers.has(name.slice(1)))
          throw new LangoError(
            "LNG1222",
            classNode.line,
            `${classNode.name}: unknown instance property ${name}`,
          );
      }
      if (name && /^_[A-Za-z_]\w*$/.test(name)) {
        if (!classScope.instanceMembers.has(name))
          throw new LangoError(
            "LNG1222",
            classNode.line,
            `${classNode.name}: unknown protected property ${name}`,
          );
      }
      Object.values(value).forEach((item) => {
        if (Array.isArray(item)) item.forEach(validateProperties);
        else validateProperties(item);
      });
    };
    const validateStaticInstanceAccess = (value) => {
      if (!value || typeof value !== "object") return;
      const name =
        value.type === "assign"
          ? value.name
          : value.type === "raw"
            ? value.value
            : null;
      if (
        name &&
        (/^@[A-Za-z_]\w*$/.test(name) || /^_[A-Za-z_]\w*$/.test(name))
      )
        throw new LangoError(
          "LNG1231",
          classNode.line,
          `${classNode.name}: static method cannot access instance property ${name}`,
        );
      Object.values(value).forEach((item) => {
        if (Array.isArray(item)) item.forEach(validateStaticInstanceAccess);
        else validateStaticInstanceAccess(item);
      });
    };
    classNode.methods.forEach((method) => {
      validateClosures(
        method.body,
        new Set([
          ...method.parameters.map((parameter) => parameter.name),
          ...imported,
        ]),
        classScope,
      );
      validateContextAssignments(
        method.body,
        contextDeclarations(method.body),
      );
      validateGlobalAccess(method.body);
      validateLoopLevels(method.body);
      if (method.static) validateStaticInstanceAccess(method.body);
      validateProperties(method.body);
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
      if (method.name === "constructor" && classNode.ancestor) {
        const ancestor = classes.get(classNode.ancestor);
        const constructor = findConstructor(ancestor);
        if (constructor)
          validateRequiredArguments(constructor, method.body[0], `super for ${classNode.name}`);
      }
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

function emit(program, moduleImports = [], includeTests = false) {
  const flags = {
    print: false,
    translate: false,
    context: false,
    decimal: program.globals.some((item) => item.name.startsWith("$")),
    loopCounter: 0,
    loopStack: [],
    functionNames: new Set(program.functions.map((item) => item.name)),
    importedFunctionNames: new Set(
      moduleImports.flatMap((item) =>
        item.names.map((name) => name.split(" as ").at(-1)),
      ),
    ),
  };
  const classes = program.classes
    .map((item) => emitClass(item, flags))
    .join("\n");
  const functions = program.functions
    .map((fn) => emitFunction(fn, flags))
    .join("\n");
  const tests = includeTests
    ? `export const __langoTests = [\n${program.tests
        .map((test) => emitTest(test, flags))
        .join(",\n")}\n];\n`
    : "";
  const helpers = [
    flags.decimal && "decimal as __decimal",
    flags.print && "println as __println",
    flags.translate && "translate as __translate",
    flags.xml && "xmlEscape as __xmlEscape",
    flags.context && "contextGet as __contextGet",
    flags.context && "contextSet as __contextSet",
    flags.context && "contextRestore as __contextRestore",
    flags.json && "fromJson as __fromJson",
    flags.json && "toJson as __toJson",
    flags.reflection && "getClass as __getClass",
    flags.reflection && "isKindof as __isKindof",
    flags.predicates && "isNumber as __isNumber",
    flags.predicates && "isString as __isString",
    flags.predicates && "isBool as __isBool",
    flags.predicates && "isObject as __isObject",
    flags.predicates && "isArray as __isArray",
    flags.membership && "includes as __includes",
    flags.entries && "entries as __entries",
    flags.toJsNumber && "toJsNumber as __toJsNumber",
    flags.boolean && "requireBoolean as __requireBoolean",
    flags.assert && "assert as __assert",
    flags.normalize && "normalize as __normalize",
    flags.finite && "finite as __finite",
    flags.call && "call as __call",
    flags.boundary && "boundary as __boundary",
    flags.database && "startTrans as __startTrans",
    flags.database && "commitTrans as __commitTrans",
    flags.database && "rollbackTrans as __rollbackTrans",
    flags.database && "transState as __transState",
    flags.databaseEnum && "DB as __DB",
    flags.sql && "query as __query",
    flags.arity && "requireArity as __requireArity",
    flags.closureArity && "withArity as __withArity",
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
  const jsModules = program.jsImports
    .map(
      (item) =>
        `import * as ${item.name} from ${JSON.stringify(item.specifier)};\n`,
    )
    .join("");
  const globals = program.globals
    .map((item) => {
      const value = emitExpr(item.value, flags);
      const prefix = item.exported ? "export let" : "let";
      if (!item.name.startsWith("$")) return `${prefix} ${item.name} = ${value};\n`;
      flags.decimal = true;
      return `${prefix} ${item.name} = __decimal(${item.value.type === "raw" ? JSON.stringify(item.value.value) : value});\n`;
    })
    .join("");
  const testReset = includeTests
    ? `export function __langoResetTests() {\n${program.globals
        .map((item) => `    ${item.name} = ${emitExpr(item.value, flags)};\n`)
        .join("")}${program.classes
        .flatMap((item) =>
          [...item.staticValues, ...item.enumValues].map(
            (value) =>
              `    ${item.name}.${value.name} = ${emitExpr(value.value, flags)};\n`,
          ),
        )
        .join("")}}\n`
    : "";
  return `${modules}${jsModules}${imports}${globals}${classes}${functions}${testReset}${tests}//# sourceMappingURL=main.mjs.map\n`;
}
function emitTest(test, flags) {
  const priorGlobalNames = flags.globalNames;
  const priorContextNames = flags.contextNames;
  flags.globalNames = collectGlobalNames(test.body);
  flags.contextNames = collectContextNames(test.body);
  const declared = new Set();
  const body = test.body
    .map((node) => emitStatement(node, 3, declared, flags))
    .join("");
  flags.globalNames = priorGlobalNames;
  flags.contextNames = priorContextNames;
  return `    { name: ${JSON.stringify(test.name)}, run() {\n${body}    } }`;
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
            JSON.stringify(method.body).match(/@@?\$?[A-Za-z_]\w*/g) ?? [],
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
      const priorArrayBindings = flags.arrayBindings;
      flags.arrayBindings = new Set();
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
      const statementDepth = contextNames.size ? 3 : 2;
      const statements = method.body
        .map((node) =>
          emitStatement(node, statementDepth, declared, flags),
        )
      const arityGuard = emitArityGuard(
        method.parameters,
        "arguments.length",
        method.name,
        statementDepth,
        flags,
      );
      const boundary = emitBoundaryChecks(method.parameters, statementDepth, flags);
      const methodBody =
        method.name === "constructor" && item.ancestor
          ? `${statements.shift() ?? ""}${arityGuard}${boundary}${statements.join("")}`
          : `${arityGuard}${boundary}${statements.join("")}`;
      flags.contextNames = priorContextNames;
      flags.globalNames = priorGlobalNames;
      flags.arrayBindings = priorArrayBindings;
      if (!contextNames.size)
        return `    ${method.static ? "static " : ""}${name}(${parameters}) {\n${methodBody}${suffix}    }\n`;
      flags.context = true;
      const returnNull = method.name === "constructor" ? "" : "            return null;\n";
      return `    ${method.static ? "static " : ""}${name}(${parameters}) {\n        const __contextScope = [];\n        try {\n${methodBody}${returnNull}        } finally {\n            __contextRestore(__contextScope);\n        }\n    }\n`;
    })
    .join("");
  const statics = [...item.staticValues, ...item.enumValues]
    .map(
      (value) => {
        const emitted = emitExpr(value.value, flags);
        if (!value.name.startsWith("$"))
          return `    static ${value.name} = ${emitted};\n`;
        flags.decimal = true;
        return `    static ${value.name} = __decimal(${value.value.type === "raw" ? JSON.stringify(value.value.value) : emitted});\n`;
      },
    )
    .join("");
  flags.publicProperties = prior.publicProperties;
  flags.className = prior.className;
  flags.methods = prior.methods;
  flags.staticMethod = prior.staticMethod;
  return `${item.exported ? "export " : ""}class ${item.name}${item.ancestor ? ` extends ${item.ancestor}` : ""} {\n${item.publicProperties.map((field) => `    ${field};\n`).join("")}${statics}${fields.map((field) => `    #${field};\n`).join("")}${implicitConstructor}${body}}\n`;
}
function emitFunction(fn, flags) {
  const topLevelAssigned = new Set(
    fn.body
      .filter((node) => node.type === "assign" || node.type === "closureAssign")
      .map((node) => node.name),
  );
  const hoisted = new Set(
    [...collectEmitLocals(fn.body)].filter((name) => !topLevelAssigned.has(name)),
  );
  const declared = new Set([...fn.parameters.map((p) => p.name), ...hoisted]);
  const priorArrayBindings = flags.arrayBindings;
  flags.arrayBindings = new Set();
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
  const body = `${emitArityGuard(
    fn.parameters,
    "arguments.length",
    fn.name,
    contextNames.size ? 2 : 1,
    flags,
  )}${emitBoundaryChecks(fn.parameters, contextNames.size ? 2 : 1, flags)}${[...hoisted].map((name) => `${"    ".repeat(contextNames.size ? 2 : 1)}let ${name};\n`).join("")}${fn.body
    .map((item) => emitStatement(item, contextNames.size ? 2 : 1, declared, flags))
    .join("")}`;
  flags.contextNames = priorContextNames;
  flags.globalNames = priorGlobalNames;
  flags.arrayBindings = priorArrayBindings;
  if (!contextNames.size)
    return `${fn.exported ? "export " : ""}function ${fn.name}(${parameters}) {\n${body}    return null;\n}\n`;
  flags.context = true;
  return `${fn.exported ? "export " : ""}function ${fn.name}(${parameters}) {\n    const __contextScope = [];\n    try {\n${body}        return null;\n    } finally {\n        __contextRestore(__contextScope);\n    }\n}\n`;
}
function collectEmitLocals(body, names = new Set(), nested = false) {
  for (const node of body) {
    if (nested && node.type === "assign" && /^[A-Za-z_]\w*$/.test(node.name))
      names.add(node.name);
    if (nested && node.type === "closureAssign") names.add(node.name);
    [node.thenBody, node.elseBody, node.tryBody, node.catchBody, node.finallyBody]
      .filter(Boolean)
      .forEach((child) => collectEmitLocals(child, names, true));
  }
  return names;
}
function emitDecimalExpression(node, flags) {
  const operand = (value) => {
    if (value.type === "binary" && ["+", "-", "*", "/", "%", "**"].includes(value.operator))
      return emitDecimalExpression(value, flags);
    if (value.type === "raw" && /^\d+(?:\.\d+)?$/.test(value.value)) {
      flags.decimal = true;
      return `__decimal(${JSON.stringify(value.value)})`;
    }
    if (value.type === "raw" && value.value.startsWith("$")) return emitExpr(value, flags);
    flags.decimal = true;
    return `__decimal(${emitExpr(value, flags)})`;
  };
  if (node.type !== "binary" || !["+", "-", "*", "/", "%", "**"].includes(node.operator))
    return operand(node);
  flags.decimal = true;
  const methods = { "+": "plus", "-": "minus", "*": "times", "/": "div", "%": "mod", "**": "pow" };
  return `${operand(node.left)}.${methods[node.operator]}(${operand(node.right)})`;
}
function emitStatement(node, depth, declared, flags) {
  const pad = "    ".repeat(depth);
  if (node.type === "globalDeclare") return "";
  if (node.type === "contextDeclare") return "";
  if (node.type === "contextSet") {
    flags.context = true;
    return `${pad}__contextScope.push(__contextSet(${JSON.stringify(node.name)}, ${emitExpr(node.value, flags)}));\n`;
  }
  if (node.type === "assert") {
    flags.assert = true;
    return `${pad}__assert(${emitBoolean(node.value, flags)}, ${JSON.stringify(`line ${node.line}: ${node.source}`)});\n`;
  }
  if (node.type === "assign") {
    const decimalBinding = node.name.startsWith("$") || /^@{1,2}\$/.test(node.name);
    const property = node.name.slice(node.name.startsWith("@@") ? 2 : 1);
    const target = /^[A-Za-z_]\w*\.\$?[A-Za-z_]\w*$/.test(node.name)
      ? node.name
      : node.name.startsWith("@@")
      ? `${flags.className}.${property}`
      : node.name.startsWith("@")
        ? flags.publicProperties?.has(property)
          ? `this.${property}`
          : `this.#${property}`
        : flags.className && node.name.startsWith("_")
          ? `this.${node.name}`
          : node.name;
    const prefix =
      /^[A-Za-z_]\w*\.\$?[A-Za-z_]\w*$/.test(node.name)
        ? ""
        : node.name.startsWith("@") ||
      (flags.className && node.name.startsWith("_")) ||
      declared.has(node.name) || flags.globalNames?.has(node.name)
        ? ""
        : "let ";
    declared.add(node.name);
    if (node.value.type === "array") flags.arrayBindings?.add(node.name);
    const value = decimalBinding && node.value.type === "binary"
      ? emitDecimalExpression(node.value, flags)
      : emitExpr(node.value, flags);
    if (decimalBinding) flags.decimal = true;
    const decimalInput =
      node.value.type === "raw" && /^\d+(?:\.\d+)?$/.test(node.value.value)
        ? JSON.stringify(node.value.value)
        : value;
    const decimalLiteral =
      node.value.type === "raw" && /^\$(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(node.value.value);
    return `${pad}${prefix}${target} = ${decimalBinding && node.value.type !== "binary" && !decimalLiteral ? `__decimal(${decimalInput})` : value};\n`;
  }
  if (node.type === "expression")
    return `${pad}${emitExpr(node.value, flags)};\n`;
  if (node.type === "chain")
    return `${pad}${emitChain(node, depth, flags)};\n`;
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
    return `${pad}return${node.value === null ? " null" : node.value.type === "closure" ? ` ${emitClosure(node.value, depth, flags)}` : node.value.type === "chain" ? ` ${emitChain(node.value, depth, flags)}` : ` ${emitExpr(node.value, flags)}`};\n`;
  if (node.type === "throw")
    return `${pad}throw ${emitExpr(node.value, flags)};\n`;
  if (node.type === "println") {
    flags.print = true;
    return `${pad}__println(${emitExpr(node.value, flags)});\n`;
  }
  if (node.type === "break" || node.type === "continue") {
    const label = flags.loopStack.at(-node.level);
    return `${pad}${node.type}${node.level === 1 ? "" : ` ${label}`};\n`;
  }
  if (node.type === "try") {
    let out = `${pad}try {\n${node.tryBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
    if (node.catchBody)
      out += ` catch (${node.catchName}) {\n${node.catchBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
    if (node.finallyBody)
      out += ` finally {\n${node.finallyBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
    return `${out}\n`;
  }
  if (node.type === "loop") {
    const label = `__loop${++flags.loopCounter}`;
    flags.loopStack.push(label);
    const body = node.body
      .map((item) => emitStatement(item, depth + 1, declared, flags))
      .join("");
    flags.loopStack.pop();
    return `${pad}${label}: while (${node.condition === null ? "true" : `${node.until ? "!" : ""}${emitBoolean(node.condition, flags)}`}) {\n${body}${pad}}\n`;
  }
  if (node.type === "for")
    return `${pad}for (const ${node.item} of ${node.collection}) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`;
  if (node.type === "forObject") {
    flags.entries = true;
    return `${pad}for (const [${node.key}, ${node.value}] of __entries(${node.collection})) {\n${node.body.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}\n`;
  }
  if (node.type === "switch") {
    const conditions = node.cases.map((item) =>
      item.tests
        .map((test) =>
          node.value
            ? `${emitExpr(node.value, flags)} === ${emitExpr(test, flags)}`
            : emitBoolean(test, flags),
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
  let out = `${pad}if (${emitBoolean(node.condition, flags)}) {\n${node.thenBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
  if (node.elseBody)
    out += ` else {\n${node.elseBody.map((item) => emitStatement(item, depth + 1, declared, flags)).join("")}${pad}}`;
  return `${out}\n`;
}
function emitChain(node, depth, flags) {
  return `${emitExpr(node.base, flags)}${node.steps
    .map((step) => `.${step.name}(${emitClosure(step, depth, flags)})`)
    .join("")}`;
}
function emitClosure(node, depth, flags) {
  const parameters = node.parameters
    .map((item) =>
      item.defaultValue === null
        ? item.name
        : `${item.name} = ${emitExpr(item.defaultValue, flags)}`,
    )
    .join(", ");
  const declared = new Set([
    ...node.parameters.map((parameter) => parameter.name),
    ...node.captures.filter((name) => !name.startsWith("@") && !name.startsWith("_")),
  ]);
  const pad = "    ".repeat(depth);
  const priorContextNames = flags.contextNames;
  const priorGlobalNames = flags.globalNames;
  const priorArrayBindings = flags.arrayBindings;
  const contextNames = collectContextNames(node.body);
  flags.contextNames = contextNames;
  flags.globalNames = collectGlobalNames(node.body);
  flags.arrayBindings = new Set();
  const body = node.body
    .map((item) =>
      emitStatement(item, depth + (contextNames.size ? 2 : 1), declared, flags),
    )
    .join("");
  const boundary = emitBoundaryChecks(
    node.parameters,
    depth + (contextNames.size ? 2 : 1),
    flags,
  );
  flags.contextNames = priorContextNames;
  flags.globalNames = priorGlobalNames;
  flags.arrayBindings = priorArrayBindings;
  const requiredPositions = node.parameters
    .map((parameter, index) => (parameter.defaultValue === null ? index : null))
    .filter((index) => index !== null);
  const wrap = (value) => {
    if (!requiredPositions.length) return value;
    flags.closureArity = true;
    return `__withArity(${value}, [${requiredPositions.join(", ")}], "closure")`;
  };
  if (!contextNames.size)
    return wrap(`(${parameters}) => {\n${boundary}${body}${pad}    return null;\n${pad}}`);
  flags.context = true;
  return wrap(`(${parameters}) => {\n${pad}    const __contextScope = [];\n${pad}    try {\n${boundary}${body}${pad}        return null;\n${pad}    } finally {\n${pad}        __contextRestore(__contextScope);\n${pad}    }\n${pad}}`);
}
function emitArityGuard(parameters, actual, name, depth, flags) {
  const positions = parameters
    .map((parameter, index) => (parameter.defaultValue === null ? index : null))
    .filter((index) => index !== null);
  if (!positions.length) return "";
  flags.arity = true;
  return `${"    ".repeat(depth)}__requireArity(${actual}, [${positions.join(", ")}], ${JSON.stringify(name)});\n`;
}
function emitBoundaryChecks(parameters, depth, flags) {
  if (!parameters.length) return "";
  flags.boundary = true;
  const pad = "    ".repeat(depth);
  return parameters
    .map((parameter) => {
      if (parameter.name.startsWith("$")) {
        flags.decimal = true;
        return `${pad}${parameter.name} = __decimal(${parameter.name});\n`;
      }
      return `${pad}${parameter.name} = __boundary(${parameter.name});\n`;
    })
    .join("");
}
function emitExpr(node, flags) {
  const decimalRaw = (value) =>
    value?.type === "raw" &&
    (value.value.startsWith("$") || value.value.includes(".$"));
  const decimalValue = (value) =>
    decimalRaw(value) ||
    (value?.type === "binary" && (decimalValue(value.left) || decimalValue(value.right))) ||
    (value?.type === "unary" && decimalValue(value.value));
  const normalize = (value) => {
    flags.normalize = true;
    return `__normalize(${value})`;
  };
  if (node.type === "raw")
    if (flags.contextNames?.has(node.value)) {
      flags.context = true;
      return `__contextGet(${JSON.stringify(node.value)})`;
    }
  if (node.type === "raw")
    if (/^DB\.(Active|RollbackOnly|Failed)$/.test(node.value)) {
      flags.databaseEnum = true;
      return `__${node.value}`;
    }
  if (node.type === "raw")
    if (/^\$(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(node.value)) {
      flags.decimal = true;
      return `__decimal(${JSON.stringify(node.value.slice(1))})`;
    }
  if (node.type === "raw")
    return node.value.startsWith("@@")
      ? normalize(`${flags.className}.${node.value.slice(2)}`)
      : node.value.startsWith("@")
        ? flags.publicProperties?.has(node.value.slice(1))
          ? normalize(`this.${node.value.slice(1)}`)
          : normalize(`this.#${node.value.slice(1)}`)
        : flags.className && node.value.startsWith("_")
          ? normalize(`this.${node.value}`)
          : (node.value.includes("?.") || /^(?:[A-Za-z_]\w*\.[A-Za-z_]\w*|[A-Za-z_]\w*\[(?:\d+|[A-Za-z_]\w*|['"][^'"]*['"])\])$/.test(node.value))
            ? normalize(node.value)
            : node.value;
  if (node.type === "sql") {
    flags.sql = true;
    const text = node.parts
      .map((part) => part.type === "text" ? JSON.stringify(part.value) : `String(${emitExpr(part.value, flags)})`)
      .join(" + ");
    return `__query(${text}, ${JSON.stringify(node.parameters)})`;
  }
  if (node.type === "unary") {
    if (node.operator === "not") return `!${emitBoolean(node.value, flags)}`;
    const decimalExpression = (value) =>
      decimalRaw(value) ||
      (value.type === "binary" && (decimalExpression(value.left) || decimalExpression(value.right)));
    if (decimalExpression(node.value)) {
      flags.decimal = true;
      return `__decimal("0").minus(${emitExpr(node.value, flags)})`;
    }
    flags.finite = true;
    return `__finite(-${emitExpr(node.value, flags)})`;
  }
  if (node.type === "new")
    return `new ${node.name.replaceAll("/", ".")}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
  if (node.type === "superMethodCall")
    return `super.${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
  if (node.type === "index")
    return normalize(
      `${typeof node.receiver === "string" ? node.receiver : emitExpr(node.receiver, flags)}${node.optional ? "?." : ""}[${emitExpr(node.index, flags)}]`,
    );
  if (node.type === "methodCall" || node.type === "namespaceMethodCall") {
    const namespace = node.type === "namespaceMethodCall";
    const sourceReceiver = namespace
      ? node.receiver.replaceAll("/", ".")
      : node.receiver;
    const type =
      sourceReceiver === flags.className ||
      (sourceReceiver === "this" && flags.staticMethod)
        ? "static"
        : "instance";
    const visibility = flags.methods?.get(`${type}:${node.name}`);
    const receiver =
      sourceReceiver === "this" && flags.staticMethod && visibility === false
        ? flags.className
        : sourceReceiver;
    const method =
      !namespace &&
      node.name === "add" && flags.arrayBindings?.has(node.receiver)
        ? "push"
        : node.name;
    const call = `${receiver}${visibility === false ? ".#" : node.optional ? "?." : "."}${method}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
    if (node.optional) return normalize(call);
    if (
      visibility === undefined &&
      !(!namespace && node.name === "add" && flags.arrayBindings?.has(node.receiver))
    ) {
      flags.normalize = true;
      return `__normalize(${call})`;
    }
    return call;
  }
  if (node.type === "array")
    return `[${node.values.map((item) => emitExpr(item, flags)).join(", ")}]`;
  if (node.type === "object")
    return `{ ${node.fields.map((item) => {
      const value = emitExpr(item.value, flags);
      if (!item.key.startsWith("$")) return `${item.key}: ${value}`;
      flags.decimal = true;
      return `${JSON.stringify(item.key)}: __decimal(${item.value.type === "raw" ? JSON.stringify(item.value.value) : value})`;
    }).join(", ")} }`;
  if (node.type === "binary") {
    const operators = { "==": "===", "!=": "!==", and: "&&", or: "||" };
    if (node.operator === "and" || node.operator === "or")
      return `${emitBoolean(node.left, flags)} ${operators[node.operator]} ${emitBoolean(node.right, flags)}`;
    if (["==", "!="].includes(node.operator) &&
        (decimalValue(node.left) || decimalValue(node.right))) {
      flags.decimal = true;
      const operand = (value) =>
        decimalValue(value)
          ? emitExpr(value, flags)
          : value.type === "raw" && /^\d+(?:\.\d+)?$/.test(value.value)
            ? `__decimal(${JSON.stringify(value.value)})`
            : `__decimal(${emitExpr(value, flags)})`;
      const comparison = decimalRaw(node.right) || decimalValue(node.left)
        ? `${operand(node.left)}.eq(${operand(node.right)})`
        : `${operand(node.right)}.eq(${operand(node.left)})`;
      return node.operator === "!=" ? `!(${comparison})` : comparison;
    }
    if (["<", ">", "<=", ">="].includes(node.operator) &&
        (decimalValue(node.left) || decimalValue(node.right))) {
      flags.decimal = true;
      const operand = (value) =>
        decimalValue(value)
          ? emitExpr(value, flags)
          : value.type === "raw" && /^\d+(?:\.\d+)?$/.test(value.value)
            ? `__decimal(${JSON.stringify(value.value)})`
            : `__decimal(${emitExpr(value, flags)})`;
      const methods = { "<": "lt", ">": "gt", "<=": "lte", ">=": "gte" };
      const reverse = { "<": "gt", ">": "lt", "<=": "gte", ">=": "lte" };
      return decimalValue(node.left)
        ? `${operand(node.left)}.${methods[node.operator]}(${operand(node.right)})`
        : `${operand(node.right)}.${reverse[node.operator]}(${operand(node.left)})`;
    }
    if (["in", "not in"].includes(node.operator)) {
      flags.membership = true;
      const membership = `__includes(${emitExpr(node.left, flags)}, ${emitExpr(node.right, flags)})`;
      return node.operator === "not in" ? `!${membership}` : membership;
    }
    if (["+", "-", "*", "/", "%", "**"].includes(node.operator) &&
        (decimalValue(node.left) || decimalValue(node.right))) {
      flags.decimal = true;
      const methods = { "+": "plus", "-": "minus", "*": "times", "/": "div", "%": "mod", "**": "pow" };
      const operand = (value) =>
        decimalValue(value)
          ? emitExpr(value, flags)
          : value.type === "raw" && /^\d+(?:\.\d+)?$/.test(value.value)
            ? `__decimal(${JSON.stringify(value.value)})`
            : emitExpr(value, flags);
      return `${operand(node.left)}.${methods[node.operator]}(${operand(node.right)})`;
    }
    const value = `${emitExpr(node.left, flags)} ${operators[node.operator] ?? node.operator} ${emitExpr(node.right, flags)}`;
    if (["+", "-", "*", "/", "%", "**"].includes(node.operator)) {
      flags.finite = true;
      return `__finite(${value})`;
    }
    return value;
  }
  if (node.type === "call")
    if (node.name === "to_js_number") {
      flags.toJsNumber = true;
      return `__toJsNumber(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
    }
  if (node.type === "call")
    if (node.name === "from_json" || node.name === "to_json") {
      flags.json = true;
      const helper = node.name === "from_json" ? "__fromJson" : "__toJson";
      return `${helper}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
    }
  if (node.type === "call")
    if (node.name === "get_class" || node.name === "is_kindof") {
      flags.reflection = true;
      const helper = node.name === "get_class" ? "__getClass" : "__isKindof";
      return `${helper}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
    }
  if (node.type === "call")
    if (["is_number", "is_string", "is_bool", "is_object", "is_array"].includes(node.name)) {
      flags.predicates = true;
      const helper = {
        is_number: "__isNumber",
        is_string: "__isString",
        is_bool: "__isBool",
        is_object: "__isObject",
        is_array: "__isArray",
      }[node.name];
      return `${helper}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
    }
  if (node.type === "call")
    if (["start_trans", "commit_trans", "rollback_trans", "trans_state"].includes(node.name)) {
      flags.database = true;
      const helper = { start_trans: "__startTrans", commit_trans: "__commitTrans", rollback_trans: "__rollbackTrans", trans_state: "__transState" }[node.name];
      return `${helper}()`;
    }
  if (node.type === "call")
    if (
      !flags.functionNames.has(node.name) &&
      !flags.importedFunctionNames.has(node.name)
    ) {
      flags.call = true;
      return `__call(${node.name}, ${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
    } else
      return `${node.name}(${node.arguments.map((item) => emitExpr(item, flags)).join(", ")})`;
  if (node.type === "string") return emitString(node.literal, flags);
  if (node.type === "xml") {
    flags.xml = true;
    return `[${node.parts
      .map((part) =>
        part.type === "text"
          ? JSON.stringify(part.value)
          : `__xmlEscape(${emitExpr(part.value, flags)})`,
      )
      .join(", ")}].join("")`;
  }
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
function emitBoolean(node, flags) {
  flags.boolean = true;
  return `__requireBoolean(${emitExpr(node, flags)})`;
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
    const selections = [];
    while (true) {
      const item = lines[index + 1] ?? "";
      const functionImport = /^    ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(item);
      const functionAlias =
        /^    alias ([A-Za-z_]\w*) = ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(item);
      const classImport = /^    class ([A-Za-z_]\w*)$/.exec(item);
      const classAlias =
        /^    alias ([A-Za-z_]\w*) = class ([A-Za-z_]\w*)$/.exec(item);
      const globalImport = /^    global (\$?[A-Za-z_]\w*)$/.exec(item);
      const globalAlias =
        /^    alias (\$?[A-Za-z_]\w*) = global (\$?[A-Za-z_]\w*)$/.exec(item);
      if (!functionImport && !functionAlias && !classImport && !classAlias && !globalImport && !globalAlias) break;
      names.push(
        classAlias || functionAlias || globalAlias
          ? `${(classAlias ?? functionAlias ?? globalAlias)[2]} as ${(classAlias ?? functionAlias ?? globalAlias)[1]}`
          : (functionImport ?? classImport ?? globalImport)[1],
      );
      const alias = classAlias ?? functionAlias ?? globalAlias;
      const sourceName = alias
        ? alias[2]
        : (functionImport ?? classImport ?? globalImport)[1];
      const selection = {
        sourceName,
        localName: alias ? alias[1] : sourceName,
        kind: classImport || classAlias ? "class" : globalImport || globalAlias ? "global" : "function",
        parameters:
          classImport || classAlias || globalImport || globalAlias
            ? []
            : importParameters(alias ? alias[3] : functionImport[2]),
      };
      index += 1;
      if (selection.kind === "class")
        selection.interface = collectClassImportInterface(lines, () => index, (value) => {
          index = value;
        });
      selections.push(selection);
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
      selections,
      sourcePath,
      outputPath: outputPathForImport,
      specifier: `./${path.basename(outputPathForImport)}`,
    });
  }
  return items;
}

async function validateModuleInitializerCycles(entryPath, entryOutputPath) {
  const modules = new Map();
  const visit = async (modulePath, outputPath) => {
    if (modules.has(modulePath)) return;
    const source = await readFile(modulePath, "utf8");
    const imports = collectImports(source, modulePath, outputPath);
    const program = new Parser(source, modulePath).parse();
    modules.set(modulePath, { program, imports });
    for (const item of imports) await visit(item.sourcePath, item.outputPath);
  };
  await visit(entryPath, entryOutputPath);

  const reaches = (from, target, visited = new Set()) => {
    if (from === target) return true;
    if (visited.has(from)) return false;
    visited.add(from);
    return (modules.get(from)?.imports ?? []).some((item) =>
      reaches(item.sourcePath, target, visited),
    );
  };
  const reads = (node, name, staticValue) => {
    if (!node || typeof node !== "object") return false;
    if (node.type === "raw")
      return staticValue
        ? node.value.startsWith(`${name}.`)
        : node.value === name || node.value.startsWith(`${name}.`) || node.value.startsWith(`${name}[`);
    return Object.values(node).some((value) =>
      Array.isArray(value)
        ? value.some((child) => reads(child, name, staticValue))
        : reads(value, name, staticValue),
    );
  };
  const initializers = (program) => [
    ...program.globals.map((item) => ({ value: item.value, line: item.line })),
    ...program.classes.flatMap((classNode) =>
      [...classNode.staticValues, ...classNode.enumValues].map((item) => ({
        value: item.value,
        line: item.line ?? classNode.line,
      })),
    ),
  ];

  for (const [modulePath, module] of modules)
    for (const item of module.imports) {
      if (!reaches(item.sourcePath, modulePath)) continue;
      for (const selection of item.selections)
        for (const initializer of initializers(module.program))
          if (
            (selection.kind === "global" && reads(initializer.value, selection.localName, false)) ||
            (selection.kind === "class" && reads(initializer.value, selection.localName, true))
          )
            throw new LangoError(
              "LNG1251",
              initializer.line,
              `${modulePath}: cyclic module initializer reads imported ${selection.kind} ${selection.localName}`,
            );
    }
}
function collectClassImportInterface(lines, getIndex, setIndex) {
  const api = {
    properties: [],
    methods: [],
    staticValues: [],
    staticMethods: [],
    staticListed: false,
  };
  let index = getIndex();
  while (true) {
    const section = lines[index + 1] ?? "";
    const target =
      section === "        properties"
        ? api.properties
        : section === "        methods"
          ? api.methods
          : section === "        static"
            ? null
            : undefined;
    if (target === undefined) break;
    index += 1;
    if (section === "        static") api.staticListed = true;
    while (true) {
      const line = lines[index + 1] ?? "";
      const method = /^            ([A-Za-z_]\w*)\(([^)]*)\)$/.exec(line);
      const name = /^            ([A-Za-z_]\w*)$/.exec(line);
      if (!method && !name) break;
      if (section === "        properties" && name) target.push(name[1]);
      else if (section === "        methods" && method)
        target.push({ name: method[1], parameters: importParameters(method[2]) });
      else if (section === "        static" && name) api.staticValues.push(name[1]);
      else if (section === "        static" && method)
        api.staticMethods.push({
          name: method[1],
          parameters: importParameters(method[2]),
        });
      else break;
      index += 1;
    }
  }
  setIndex(index);
  return api;
}
function validateImportedClassInterface(
  selection,
  target,
  program,
  inputPath,
  sourcePath,
) {
  const api = selection.interface;
  if (!api) return;
  const classes = new Map(program.classes.map((item) => [item.name, item]));
  const hierarchy = [];
  for (let current = target; current; current = classes.get(current.ancestor))
    hierarchy.push(current);
  const missing = (kind, name) => {
    throw new LangoError(
      "LNG1234",
      1,
      `${inputPath}: imported class ${selection.sourceName} does not export ${kind} ${name} from ${sourcePath}`,
    );
  };
  for (const name of api.properties)
    if (!hierarchy.some((item) => item.publicProperties.includes(name)))
      missing("property", name);
  for (const name of api.staticValues)
    if (
      !hierarchy.some((item) =>
        [...item.staticValues, ...item.enumValues].some(
          (value) => value.name === name,
        ),
      )
    )
      missing("static value", name);
  for (const [kind, methods] of [
    ["method", api.methods],
    ["static method", api.staticMethods],
  ])
    for (const method of methods) {
      const targetMethod = hierarchy
        .flatMap((item) => item.publicMethods)
        .find(
          (candidate) =>
            candidate.name === method.name &&
            candidate.static === (kind === "static method"),
        );
      if (!targetMethod) missing(kind, method.name);
      if (!sameParameters(method.parameters, targetMethod.parameters))
        throw new LangoError(
          "LNG1235",
          1,
          `${inputPath}: import signature for ${selection.sourceName}.${method.name} does not match ${sourcePath}`,
        );
    }
}
function importParameters(raw) {
  if (!raw) return [];
  return splitTopLevel(raw).map((parameter) => {
    const match = /^([A-Za-z_]\w*)(?: = .+)?$/.exec(parameter);
    if (!match) throw new Error("invalid import parameter");
    return {
      name: match[1],
      defaultValue: parameter.includes(" = ") ? parameter : null,
    };
  });
}
function sameParameters(left, right) {
  return (
    left.length === right.length &&
    left.every(
      (parameter, index) =>
        parameter.name === right[index].name &&
        (parameter.defaultValue === null) ===
          (right[index].defaultValue === null),
    )
  );
}
