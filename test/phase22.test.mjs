import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 22 accepts decimal, scientific, and hexadecimal number literals", () => {
    const output = compile(`export main(args)

main(args)
    total = 12.5 + 1.2e3 + 0xFF
    println(total)
`).javascript;
    assert.match(output, /12\.5 \+ 1\.2e3 \+ 0xFF/);
});

test("Faz 22 number-literals fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase22-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/022-number-literals/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["1467.5"]);
});
