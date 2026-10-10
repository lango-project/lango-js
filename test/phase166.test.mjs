import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 166 lowers add on non-literal array receivers through the runtime helper", () => {
    const output = compile(`main(args)
    state = { items: args[0] }
    return state.items.add("Ada")
`).javascript;
    assert.match(output, /add as __add/);
    assert.match(output, /return __add\(state\.items, "Ada"\);/);
});

test("Faz 166 adds to object-held and host-provided arrays", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase166-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    state = { items: args[0] }
    state.items.add("Ada")
    return args[0].length
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const items = [];
    assert.equal(program.main([items]), 1);
    assert.deepEqual(items, ["Ada"]);
});
