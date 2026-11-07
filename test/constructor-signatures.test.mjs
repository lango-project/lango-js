import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile, diagnose, formatSource } from "../src/compiler.mjs";

const source = `export class Total(left, right = 2)
    properties
        value

Total(left, right = 2)
    @value = left + right
`;

test("class constructor signatures parse and format without changing legacy declarations", () => {
    const program = compile(source).program;
    assert.deepEqual(program.classes[0].constructorParameters.map(item => item.name), ["left", "right"]);
    assert.equal(formatSource(source), source);
    assert.equal(compile("class Legacy\n\nLegacy()\n    return null\n").program.classes[0].constructorParameters, null);
    assert.doesNotThrow(() => compile("class Empty()\n\nEmpty()\n    return null\n"));
    assert.doesNotThrow(() => compile(`class Settings(options = defaults())

Settings(options = defaults())
    @options = options

defaults()
    return {
        value: 1
    }
`));
});

for (const target of ["node", "browser"])
test(`${target} declared constructors preserve defaults, required arguments and imported inheritance`, async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-constructor-signature-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    await writeFile(path.join(directory, "total.lango"), source);
    await writeFile(path.join(directory, "main.lango"), `import "./total"
    alias Parent = class Total

export class Child(left, right = 2) : Parent
    methods
        read()

Child(left, right = 2)
    super(left, right)

Child:read()
    return @value

export class Inherited : Parent
`);
    const output = path.join(directory, "dist/main.mjs");
    await buildFile(path.join(directory, "main.lango"), output, new Set(), false, { target });
    const module = await import(pathToFileURL(output).href);
    assert.equal(new module.Child(40).read(), 42);
    assert.equal(new module.Child(20, 3).read(), 23);
    assert.equal(new module.Inherited(40).value, 42);
    const emitted = await readFile(output, "utf8");
    assert.match(emitted, /constructor\(left, right = 2\)/);
    await writeFile(path.join(directory, "bad.lango"), 'import "./total"\n    class Total\n\nrun()\n    return new Total()\n');
    await assert.rejects(buildFile(path.join(directory, "bad.lango"), path.join(directory, "dist/bad.mjs")), error => error.code === "LNG1203");
});

test("constructor signature mismatches report names, order, dollar markers and defaults", () => {
    for (const implementation of ["Total(right, left = 2)", "Total(left)", "Total(left, right)", "Total(left, right = 3)", "Total($left, right = 2)"])
        assert.throws(() => compile(source.replace("\nTotal(left, right = 2)", `\n${implementation}`)),
            error => error.code === "LNG1272" && /constructor signature/.test(error.message));
    const diagnostics = diagnose("class Missing(value)\n", "signature.lango");
    assert.equal(diagnostics[0].code, "LNG1272");
    assert.equal(diagnostics[0].sourceName, "signature.lango");
    assert.equal(diagnostics[0].span.start.line, 1);
});

test("declared dollar constructor parameters retain Decimal validation", () => {
    const decimal = `class Amount($value)

Amount($value)
    @$value = $value

run()
    return new Amount($10)
`;
    assert.doesNotThrow(() => compile(decimal));
    assert.doesNotThrow(() => compile(decimal.replace("Amount($10)", "Amount(10)")));
    assert.equal(compile(decimal).program.classes[0].constructorParameters[0].name, "$value");
});
