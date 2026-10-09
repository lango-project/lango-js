import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 119 preserves a comma inside a function string argument", () => {
    assert.doesNotThrow(() => compile(`main(args)
    println("a, b")
`));
});

test("Faz 119 preserves commas in nested function and array arguments", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase119-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return to_json(["a, b", "c"])
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), '["a, b","c"]');
});
