import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 157 lowers indexed updates on object-held collections", () => {
    const output = compile(`main(args)
    state = { items: [1] }
    state.items[0] = 3
    state.items[0] += 2
    state.items[0]--
    return state.items[0]
`).javascript;
    assert.match(output, /state\.items\[0\] = 3;/);
    assert.match(output, /state\.items\[0\] = __finite\(state\.items\[0\] \+ 2\);/);
});

test("Faz 157 updates an object-held collection target", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase157-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    state = { items: [1] }
    state.items[0] = 3
    state.items[0] += 2
    state.items[0]--
    return state.items[0]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 4);
});
