import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const source = `export main(args)

export class Counter
    static
        Start = 10
    methods
        ::next()

Counter::next()
    @@Start = @@Start + 1
    return @@Start

main(args)
    println(Counter.next())
    println(Counter.next())
`;

test("Faz 16 emits static methods and @@ access", () => {
    const output = compile(source).javascript;
    assert.match(output, /static next\(\)/);
    assert.match(output, /Counter\.Start = Counter\.Start \+ 1;/);
    assert.match(output, /Counter\.next\(\)/);
});

test("Faz 16 static-methods fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase16-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/016-static-methods/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["11", "12"]);
});
