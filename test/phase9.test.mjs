import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 9 emits JavaScript private class fields", () => {
    const source = `class Counter

Counter(start)
    @value = start

Counter:add(amount)
    @value = @value + amount
    return @value

export main(args)

main(args)
    counter = new Counter(10)
    println(counter.add(5))
`;
    const output = compile(source).javascript;
    assert.match(output, /class Counter/);
    assert.match(output, /#value;/);
    assert.match(output, /this\.\#value = this\.\#value \+ amount/);
    assert.match(output, /new Counter\(10\)/);
});

test("Faz 9 class fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase9-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/009-classes/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["15"]);
});
