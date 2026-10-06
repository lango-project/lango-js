import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 47 requires Boolean conditions and operands", async () => {
    const output = compile(`main(args)
    if true and not false
        println("ok")
`).javascript;
    assert.match(output, /requireBoolean as __requireBoolean/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase47-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/047-boolean-conditions/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["enabled"]);

    assert.match(
        compile(`main(args)
    if 1
        println("never")
`).javascript,
        /__requireBoolean\(1\)/,
    );
});
