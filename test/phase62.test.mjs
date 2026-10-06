import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 62 normalizes missing property and index reads to null", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase62-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export missing(object)
export at(values)
export class Counter
    properties
        value
    methods
        get()

Counter()
    _ready = true

Counter:get()
    return @value

missing(object)
    return object.missing

at(values)
    return values[0]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.missing({}), null);
    assert.equal(program.at([]), null);
    assert.equal(new program.Counter().get(), null);
});
