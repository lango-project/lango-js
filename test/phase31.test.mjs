import assert from "node:assert/strict";
import { buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 31 captures a class property through its original instance", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase31-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/031-property-capture/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["8", "8"]);
});
