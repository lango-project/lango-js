import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 61 normalizes JavaScript undefined to Lango null", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase61-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export pop_empty()
export empty_return()

pop_empty()
    values = []
    return values.pop()

empty_return()
    return
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.pop_empty(), null);
    assert.equal(program.empty_return(), null);
});
