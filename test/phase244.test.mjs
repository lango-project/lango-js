import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile } from "../src/compiler.mjs";

test("Phase 244 calls a function selected by an object index with its receiver", () => {
    const output = compile(`invoke(module, name, input)
    return module[name](input)
`).javascript;
    assert.match(output, /return __callMethod\(module, name, input\)/);
});

test("Phase 244 preserves the selected method receiver", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase244-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export invoke(module)

invoke(module)
    return module["add"](2)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.invoke({ base: 3, add(value) { return this.base + value; } }), 5);
});
