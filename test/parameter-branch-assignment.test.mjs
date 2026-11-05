import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("conditional parameter writes reuse required/default bindings with and without context", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lango-parameter-"));
    const input = path.join(root, "input.lango");
    const output = path.join(root, "main.mjs");
    await writeFile(input, `export optional(options = null)
export required(value)
export scoped(options = null)

optional(options = null)
    if options == null
        options = {
            value: 42
        }
    return options.value

required(value)
    if value == 0
        value = 42
    return value

scoped(options = null)
    context log
    try
        if options == null
            options = 42
    catch error
        options = 0
    return options
`);
    await buildFile(input, output);
    const module = await import(pathToFileURL(output).href);
    assert.equal(module.optional(), 42);
    assert.equal(module.optional(null), 42);
    assert.equal(module.optional({ value: 7 }), 7);
    assert.equal(module.required(0), 42);
    assert.equal(module.required(7), 7);
    assert.equal(module.scoped(), 42);
    assert.equal(module.scoped(7), 7);
});
