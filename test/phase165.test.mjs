import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 165 yields numeric indexes for generic iterable key-value loops", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase165-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    total = 0
    for range(4) as index: value
        total += index * value
    return total
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 14);
});
