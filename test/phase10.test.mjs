import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 10 emits declared public properties and keeps other properties private", () => {
    const source = `export main(args)

class Account
    properties
        name

Account(name)
    @name = name
    @secret = "only the class can read this"

Account:label()
    return @name

main(args)
    account = new Account("Lango")
    println(account.name)
    println(account.label())
`;
    const output = compile(source).javascript;
    assert.match(output, /    name;\n/);
    assert.match(output, /    #secret;\n/);
    assert.match(output, /this\.name = name/);
    assert.match(output, /return this\.name/);
    assert.doesNotMatch(output, /#name/);
});

test("Faz 10 public properties fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase10-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/010-public-properties/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["Lango", "Lango"]);
});
