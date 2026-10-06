import assert from "node:assert/strict";
import { buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 14 builds and imports an exported Lango class", async () => {
    const root = path.resolve("examples/014-class-modules");
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase14-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.join(root, "main.lango"), outputPath);
    const emitted = await readFile(outputPath, "utf8");
    assert.match(emitted, /import \{ Person \} from "\.\/person\.mjs"/);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["Ada"]);
});
