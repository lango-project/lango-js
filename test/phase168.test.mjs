import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 168 lowers multiple Array#add arguments to push", () => {
    const output = compile(`main(args)
    items = []
    items.add("Ada", "Lin")
    return items
`).javascript;
    assert.match(output, /items\.push\("Ada", "Lin"\);/);
});

test("Faz 168 adds multiple values to local and host arrays", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase168-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = []
    items.add("Ada", "Lin")
    args[0].add("Maya", "Noa")
    return items
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const hostItems = [];
    assert.deepEqual(program.main([hostItems]), ["Ada", "Lin"]);
    assert.deepEqual(hostItems, ["Maya", "Noa"]);
});
