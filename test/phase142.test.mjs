import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 142 lowers key-value loops through the entries helper", () => {
    const output = compile(`main(args)
    values = { first: 1 }
    for values as key: value
        return value
`).javascript;
    assert.match(output, /entries as __entries/);
    assert.match(output, /of __entries\(values\)/);
});

test("Faz 142 supports key-value loops over host Maps", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase142-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    values = args[0]
    result = ""
    for values as key: value
        result = result + key + value
    return result
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([new Map([["a", 1], ["b", 2]])]), "a1b2");
});
