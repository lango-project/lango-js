import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 65 supports dynamic callback parameters and reports NotCallable", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase65-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export invoke(callback)

invoke(callback)
    return callback()
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.invoke(() => undefined), null);
    assert.throws(() => program.invoke(42), /NotCallable/);
});
