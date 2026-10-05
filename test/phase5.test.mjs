import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 5 objects compile and run", async () => {
    const root = path.resolve("examples/006-objects");
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase5-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.join(root, "input.lango"), outputPath);
    assert.equal(await readFile(outputPath, "utf8"), await readFile(path.join(root, "expected.mjs"), "utf8"));
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["id=42", "customer=Savaş", "Order 42: Savaş"]);
});
