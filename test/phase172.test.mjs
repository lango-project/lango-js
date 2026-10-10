import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 172 lowers Array#remove_at to the shared array helper", () => {
    const output = compile(`main(args)
    items = ["Ada"]
    removed = items.remove_at(0)
    return removed
`).javascript;
    assert.match(output, /remove_at as __removeAt/);
    assert.match(output, /let removed = __removeAt\(items, 0\);/);
});

test("Faz 172 removes zero-based positions from local and host arrays", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase172-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = ["Ada", "Lin", "Noa"]
    removed = items.remove_at(1)
    missing = items.remove_at(9)
    args[0].remove_at(0)
    return [removed, missing, items]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const hostItems = ["Maya", "Ada"];
    assert.deepEqual(program.main([hostItems]), [true, false, ["Ada", "Noa"]]);
    assert.deepEqual(hostItems, ["Ada"]);
});
