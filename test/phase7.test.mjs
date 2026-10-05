import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 7 builds relative Lango modules", async () => {
    const root = path.resolve("examples/008-modules");
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase7-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.join(root, "main.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["Hello, Savaş"]);
});
