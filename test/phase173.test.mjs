import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 173 lowers Array#insert_at to the shared array helper", () => {
    const output = compile(`main(args)
    items = ["Ada"]
    inserted = items.insert_at(0, "Lin")
    return inserted
`).javascript;
    assert.match(output, /insert_at as __insertAt/);
    assert.match(output, /let inserted = __insertAt\(items, 0, "Lin"\);/);
});

test("Faz 173 inserts at valid positions in local and host arrays", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase173-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    items = ["Ada", "Noa"]
    inserted = items.insert_at(1, "Lin")
    appended = items.insert_at(items.length, "Maya")
    missing = items.insert_at(9, "Ece")
    args[0].insert_at(1, "Lin")
    return [inserted, appended, missing, items]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const hostItems = ["Ada", "Noa"];
    assert.deepEqual(
        program.main([hostItems]),
        [true, true, false, ["Ada", "Lin", "Noa", "Maya"]],
    );
    assert.deepEqual(hostItems, ["Ada", "Lin", "Noa"]);
});
