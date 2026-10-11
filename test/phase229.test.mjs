import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 229 counts for loops for leveled break and continue", () => {
    const output = compile(`main(args)
    for args as outer
        loop
            continue 2
`).javascript;
    assert.match(output, /__loop1: for \(const outer of args\)/);
    assert.match(output, /continue __loop1;/);
    assert.throws(
        () => compile(`main(args)
    for args as item
        break 2
`),
        (error) => error instanceof LangoError && error.code === "LNG1220",
    );
});

test("Faz 229 executes a leveled break through nested for loops", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase229-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    values = []
    for [1, 2] as outer
        for [1, 2] as inner
            values.add(outer * 10 + inner)
            break 2
    println(values)
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["11"]);
});
