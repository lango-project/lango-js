import assert from "node:assert/strict";
import { buildFile, compile } from "../src/compiler.mjs";
import test from "node:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("Faz 43 parses and serializes JSON with runtime helpers", async () => {
    const output = compile(`main(args)
    customer = from_json('{"name":"Ada"}')
    println(to_json(customer))
`).javascript;
    assert.match(output, /fromJson as __fromJson/);
    assert.match(output, /toJson as __toJson/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase43-"));
    const outputPath = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/043-json/input.lango"), outputPath);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(outputPath).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, ["Ada", '{"name":"Ada","active":true}']);
});
