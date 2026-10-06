import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 71 lets a closure explicitly capture a JavaScript namespace", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase71-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `import js "node:path" as path

export make()

make()
    callback = (value)
        capture path
        return path.basename(value)
    return callback
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.make()("/tmp/demo.txt"), "demo.txt");
});
