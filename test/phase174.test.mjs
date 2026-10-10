import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 174 lowers Array#remove_all to the shared array helper", () => {
    const output = compile(`main(args)
    items = ["Ada"]
    removed = items.remove_all("Ada")
    return removed
`).javascript;
    assert.match(output, /remove_all as __removeAll/);
    assert.match(output, /let removed = __removeAll\(items, "Ada"\);/);
});

test("Faz 174 removes every matching value from local and host arrays", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase174-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = ["Ada", "Lin", "Ada", "Ada"]
    removed = items.remove_all("Ada")
    args[0].remove_all("Ada")
    return [removed, items]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const hostItems = ["Ada", "Maya", "Ada"];
    assert.deepEqual(program.main([hostItems]), [3, ["Lin"]]);
    assert.deepEqual(hostItems, ["Maya"]);
});
