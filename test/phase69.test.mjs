import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 69 gives to_json Lango boundary semantics", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase69-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export serialize(value)

serialize(value)
    return to_json(value)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(
        program.serialize({ missing: undefined, items: [undefined] }),
        `{"missing":null,"items":[null]}`,
    );
    assert.throws(() => program.serialize({ value: Infinity }), /NonFiniteNumber/);
    const cycle = {};
    cycle.self = cycle;
    assert.throws(() => program.serialize(cycle), /JsonCycle/);
});
