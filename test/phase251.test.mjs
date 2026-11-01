import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("member collections support direct indexing, updates, calls and nested access", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-member-access-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export class Store
    properties
        publicItems
    methods
        update(name)
        invoke(name, input)

Store(module)
    @items = {}
    @list = []
    @publicItems = [[1]]
    @module = module

Store:update(name)
    @items[name] = 2
    @items[name] += 3
    @items[name]++
    @list.add(@items[name])
    @publicItems[0][0] = 4
    @publicItems[0][0] += 1
    if name in @items
        return [@items[name], @list[0], @publicItems[0][0], @list.includes(6)]

Store:invoke(name, input)
    return @module[name](input)
`);
    await buildFile(input, output);
    const { Store } = await import(pathToFileURL(output).href);
    const store = new Store({ base: 10, add(value) { return this.base + value; } });
    assert.deepEqual(store.update("first"), [6, 6, 5, true]);
    assert.equal(store.invoke("add", 2), 12);
});
