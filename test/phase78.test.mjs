import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 78 constructs a qualified JavaScript class", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase78-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `import js "node:events" as events

export create()

create()
    return new events/EventEmitter()
`);
    await buildFile(input, output);
    const emitted = await (await import("node:fs/promises")).readFile(output, "utf8");
    assert.match(emitted, /new events\.EventEmitter\(\)/);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.create().constructor.name, "EventEmitter");
});
