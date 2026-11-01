import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("string interpolation resolves active context bindings and captured contexts", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-context-string-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export render(value)
export callback(value)

render(value)
    context request = value
    return "\${request.method} \${request.path}"

callback(value)
    context request = value
    return ()
        capture request
        return "\${request.path}"
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.render({ method: "POST", path: "/private" }), "POST /private");
    assert.equal(program.callback({ path: "/captured" })(), "/captured");
});
