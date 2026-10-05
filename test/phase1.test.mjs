import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { buildFile } from "../src/compiler.mjs";

const fixtureRoot = path.resolve("examples/002-main-branch");

test("Faz 1 compiles and runs the main-branch fixture", async () => {
    const outputDir = await mkdtemp(path.join(os.tmpdir(), "lango-phase1-"));
    const outputPath = path.join(outputDir, "main.mjs");

    await buildFile(path.join(fixtureRoot, "input.lango"), outputPath);

    const expected = await readFile(path.join(fixtureRoot, "expected.mjs"), "utf8");
    const emitted = await readFile(outputPath, "utf8");
    assert.equal(emitted, expected);

    const runtime = await import(pathToFileURL(path.join(outputDir, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];

    runtime.configure({ output: (value) => output.push(value) });
    assert.equal(program.main([]), null);
    assert.equal(program.main(["Savaş"]), null);

    runtime.configure({
        catalog: { "Hello, {0}": "Merhaba, {0}" },
        output: (value) => output.push(value),
    });
    assert.equal(program.main(["Savaş"]), null);
    assert.deepEqual(output, ["Hello, world", "Hello, Savaş", "Merhaba, Savaş"]);
});
