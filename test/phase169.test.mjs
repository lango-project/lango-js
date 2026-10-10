import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 169 lowers Array#remove to the shared array helper", () => {
    const output = compile(`main(args)
    items = ["Ada"]
    removed = items.remove("Ada")
    return removed
`).javascript;
    assert.match(output, /remove as __remove/);
    assert.match(output, /let removed = __remove\(items, "Ada"\);/);
});

test("Faz 169 removes the first matching value from local and host arrays", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase169-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = ["Ada", "Lin", "Ada"]
    removed = items.remove("Ada")
    missing = items.remove("Noa")
    args[0].remove("Noa")
    args[0].remove("Maya")
    return [removed, missing, items]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const hostItems = ["Maya", "Ada"];
    assert.deepEqual(program.main([hostItems]), [true, false, ["Lin", "Ada"]]);
    assert.deepEqual(hostItems, ["Ada"]);
});
