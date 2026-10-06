import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 68 validates JavaScript arguments entering Lango closures", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase68-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export make()

make()
    return (value)
        return value
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const callback = program.make();
    assert.equal(callback(undefined), null);
    assert.throws(() => callback(Infinity), /NonFiniteNumber/);
});
