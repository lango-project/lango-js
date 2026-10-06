import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 66 reports NotCallable for local non-callable bindings", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase66-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    value = 42
    value()
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.main([]), /NotCallable/);
});
