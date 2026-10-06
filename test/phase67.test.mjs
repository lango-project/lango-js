import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 67 normalizes and validates JavaScript arguments at Lango entry", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase67-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export echo(value)

echo(value)
    return value
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.echo(undefined), null);
    assert.throws(() => program.echo(Infinity), /NonFiniteNumber/);
});
