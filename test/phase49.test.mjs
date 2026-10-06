import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 49 lowers Array#add to push and preserves its return value", async () => {
    const output = compile(`main(args)
    values = []
    length = values.add(1)
`).javascript;
    assert.match(output, /let length = values\.push\(1\);/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase49-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/049-array-add-return/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["3", "3"]);
});
