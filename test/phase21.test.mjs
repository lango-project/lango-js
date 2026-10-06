import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 21 emits logical word operators", () => {
    const output = compile(`export main(args)

main(args)
    if not false and true or false
        println("yes")
      else
          println("no")
`).javascript;
    assert.match(output, /!false && true \|\| false/);
});

test("Faz 21 accepts symbolic logical operators too", () => {
    const output = compile(`export main(args)

main(args)
    if !false && true || false
        println("yes")
      else
          println("no")
`).javascript;
    assert.match(output, /!false && true \|\| false/);
});

test("Faz 21 logical-operators fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase21-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/021-logical-operators/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["yes"]);
});
