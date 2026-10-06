import assert from "node:assert/strict";
import { compile, buildFile, LangoError } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const source = `export main(args)

class Person

Person(label)
    _label = label

export class Employee : Person

Employee(label)
    super(label)

Employee:describe()
    return _label

main(args)
    employee = new Employee("Ada")
    println(employee.describe())
`;

test("Faz 15 emits protected properties as inherited fields", () => {
    const output = compile(source).javascript;
    assert.match(output, /this\._label = label;/);
    assert.match(output, /return this\._label;/);
});

test("Faz 15 rejects external protected-property access", () => {
    const invalid = source.replace("println(employee.describe())", "println(employee._label)");
    assert.throws(() => compile(invalid), (error) => error instanceof LangoError && error.code === "LNG1115");
});

test("Faz 15 protected-properties fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase15-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/015-protected-properties/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["Ada"]);
});
