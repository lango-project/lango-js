import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 24 emits null for a value-free return", () => {
    const output = compile(`export main(args)

finish()
    return

main(args)
    finish()
`).javascript;
    assert.match(output, /return null;\n/);
});

test("Faz 24 empty-return fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase24-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/024-empty-return/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["done"]);
});
