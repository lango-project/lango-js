import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 45 exposes JavaScript-constructor reflection", async () => {
    const output = compile(`main(args)
    println(get_class(null) == null)
    println(is_kindof(1, Number))
`).javascript;
    assert.match(output, /getClass as __getClass/);
    assert.match(output, /isKindof as __isKindof/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase45-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/045-reflection/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["true", "true", "false"]);
});
