import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("context member reads and writes resolve through the active binding", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-context-path-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export update(value)

class Reader
    methods
        update()

Reader:update()
    context form
    form.panel.button.enabled = false
    return form.panel.button.enabled

update(value)
    context form = value
    reader = new Reader()
    return reader.update()
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const value = { panel: { button: { enabled: true } } };
    assert.equal(program.update(value), false);
    assert.equal(value.panel.button.enabled, false);
});
