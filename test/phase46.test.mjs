import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 46 exposes explicit runtime kind predicates", async () => {
    const output = compile(`main(args)
    println(is_array([]))
`).javascript;
    assert.match(output, /isArray as __isArray/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase46-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/046-predicates/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["true", "true", "true", "true", "true"]);
});
