import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 160 yields numeric code-point indexes for string key-value iteration", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase160-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    result = ""
    for args[0] as index: character
        result = "\${index}:\${character};"
    return result
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main(["A😀"]), "1:😀;");
});
