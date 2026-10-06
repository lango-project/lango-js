import assert from "node:assert/strict";
import { compile, buildFile, LangoError } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const source = `export main(args)

class Person
    methods
        describe()

Person(name)
    @name = name

Person:describe()
    return @name

export class Employee : Person
    methods
        describe()

Employee(name, id)
    super(name)
    @id = id

Employee:describe()
    return super.describe() + ": " + @id

main(args)
    employee = new Employee("Ada", 7)
    println(employee.describe())
`;

test("Faz 13 emits extends, super constructor, and super method calls", () => {
    const output = compile(source).javascript;
    assert.match(output, /export class Employee extends Person/);
    assert.match(output, /super\(name\);/);
    assert.match(output, /return super\.describe\(\) \+ ": " \+ __normalize\(this\.\#id\);/);
});

test("Faz 13 requires one leading super call in a child constructor", () => {
    const invalid = source.replace("    super(name)\n", "");
    assert.throws(() => compile(invalid), (error) => error instanceof LangoError && error.code === "LNG1207");
});

test("Faz 13 rejects super method calls without an ancestor", () => {
    const invalid = source
        .replace("export class Employee : Person", "class Employee")
        .replace("    super(name)\n", "");
    assert.throws(() => compile(invalid), (error) => error instanceof LangoError && error.code === "LNG1208");
});

test("Faz 13 inheritance fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase13-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/013-inheritance/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["Ada: 7"]);
});
