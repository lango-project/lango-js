import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 20 compiles Lango == to JavaScript strict equality", () => {
    const output = compile(`export main(args)

main(args)
    if 1 == "1"
        println("coerced")
      else
          println("strict")
`).javascript;
    assert.match(output, /1 === "1"/);
    assert.doesNotMatch(output, /1 == "1"/);
});

test("Faz 20 strict-equality fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase20-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/020-strict-equality/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["strict"]);
});
