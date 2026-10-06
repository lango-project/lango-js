import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 63 rejects non-finite arithmetic and JavaScript boundary values", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase63-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export divide(value)
export read(object)

divide(value)
    return value / 0

read(object)
    return object.value
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.divide(1), /NonFiniteNumber/);
    assert.throws(() => program.read({ value: Infinity }), /NonFiniteNumber/);
    assert.throws(() => program.divide(0), /NonFiniteNumber/);
});
