import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 51 emits labeled break and continue levels", async () => {
    assert.throws(
        () => compile(`main(args)
    break 2
`),
        /LNG1220.*exceeds enclosing loop depth/,
    );

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase51-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/051-loop-levels/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["3"]);
});
