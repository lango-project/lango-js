import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile } from "../src/compiler.mjs";

for (const target of ["node", "browser"])
test(`${target} startup globals can construct local classes through functions while static globals initialize first`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lango-startup-"));
    const input = path.join(root, "startup.lango");
    const output = path.join(root, "startup.mjs");
    await writeFile(input, `export global app
global app = start()
global seed = 42

export class Presenter
    properties
        value
    static
        initial = seed

Presenter()
    @value = Presenter.initial

start()
    return new Presenter()
`);
    await buildFile(input, output, new Set(), true, { target });
    const module = await import(pathToFileURL(output).href);
    assert.equal(module.app.value, 42);
    module.Presenter.initial = 7;
    module.__langoResetTests();
    assert.equal(module.app.value, 42);
});

test("initialization cycles fail at compilation and deferred callbacks do not create false cycles", () => {
    assert.throws(() => compile(`global app = new Item()

class Item
    static
        initial = app
`), error => error.code === "LNG1271");
    assert.doesNotThrow(() => compile(`global app = setup()

setup()
    callback = ()
        global app
        return app
    return callback
`));
});
