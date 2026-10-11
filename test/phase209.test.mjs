import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 209 rejects non-numeric dynamic range bounds", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase209-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    for range(args[0]) as value
        println(value)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.main(["2"]), /RangeBounds/);
});
