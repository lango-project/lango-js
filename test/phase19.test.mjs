import assert from "node:assert/strict";
import { compile, buildFile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 19 emits grouped value and condition-only switch cases", () => {
    const source = `export main(args)

main(args)
    n = 5
    switch n
      case 3
      case 5
          println("Hello")
      else
          println("Other")
    switch
      case n == 5
          println("Five")
      else
          println("Unknown")
`;
    const output = compile(source).javascript;
    assert.match(output, /n === 3 \|\| n === 5/);
    assert.match(output, /if \(n === 5\)/);
});

test("Faz 19 switch fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase19-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/019-switch/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const output = [];
    runtime.configure({ output: (value) => output.push(value) });
    program.main([]);
    assert.deepEqual(output, ["Hello", "Five"]);
});
