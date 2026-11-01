import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("call arguments accept newline-separated map fields including nested maps", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-multiline-map-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export create(host)

create(host)
    return host.command({
        type: "setEnabled"
        target: "saveButton"
        options: {
            text: "Quoted { braces } and commas, remain text"
            enabled: false
        }
        value: false
    })
`);
    await buildFile(input, output);
    const { create } = await import(pathToFileURL(output).href);
    const result = create({ command(value) { return value; } });
    assert.deepEqual(result, {
        type: "setEnabled",
        target: "saveButton",
        options: { text: "Quoted { braces } and commas, remain text", enabled: false },
        value: false,
    });
});
