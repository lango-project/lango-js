import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

async function program(source) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-capture-lines-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output);
    return import(pathToFileURL(output).href);
}

test("consecutive capture declarations preserve local and context bindings", async () => {
    const module = await program(`export callback(value, offset)

callback(value, offset)
    context request = value
    return ()
        capture request
        capture offset
        return request.value + offset
`);
    assert.equal(module.callback({ value: 4 }, 3)(), 7);
});

test("capture declarations reject duplicate names across physical lines", () => {
    assert.throws(() => compile(`export callback(value)

callback(value)
    return ()
        capture value
        capture value
        return value
`), error => error instanceof LangoError && error.code === "LNG1118");
});

test("object fields accept calls and arrays containing multiline comma-free maps", async () => {
    const module = await program(`export render()

identity(value)
    return value

render()
    value = {
        nested: identity({
            label: "ok"
            empty: {
            }
        })
        items: [{
            count: 2
        }, {
            count: 3
        }]
    }
    return "\${value.nested.label}:\${value.items[1].count}"
`);
    assert.equal(module.render(), "ok:3");
});
