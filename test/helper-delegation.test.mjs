import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

for (const target of ["node", "browser"])
test(`${target} collection helpers forward every foreign argument with its receiver`, async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-delegation-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export invoke(target)
export optional(target)
export class Repository
    methods
        remove(owner, id, version)

Repository:remove(owner, id, version)
    return [owner, id, version]

invoke(target)
    return [target.remove("owner", "id", 3), target.remove_all(1, 2, 3), target.clear(1, 2), target.remove_at(1, 2), target.insert_at(1, 2, 3)]

optional(target)
    return target?.remove("owner", "id", 3)
`);
    await buildFile(input, output, new Set(), false, { target });
    const module = await import(pathToFileURL(output).href);
    const calls = [];
    const receiver = {};
    for (const name of ["remove", "remove_all", "clear", "remove_at", "insert_at"])
        receiver[name] = function (...args) { assert.equal(this, receiver); calls.push([name, ...args]); };
    assert.deepEqual(module.invoke(receiver), [null, null, null, null, null]);
    assert.deepEqual(calls, [
        ["remove", "owner", "id", 3], ["remove_all", 1, 2, 3], ["clear", 1, 2],
        ["remove_at", 1, 2], ["insert_at", 1, 2, 3],
    ]);
    assert.equal(module.optional(null), null);
    assert.equal(module.optional(receiver), null);
    assert.deepEqual(calls.at(-1), ["remove", "owner", "id", 3]);
    assert.deepEqual(module.optional(new module.Repository()), ["owner", "id", 3]);
});
