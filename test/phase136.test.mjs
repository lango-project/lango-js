import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 136 lowers quoted inline object keys", () => {
    const output = compile(`main(args)
    return { "display name": "Ada" }
`).javascript;
    assert.match(output, /return \{ "display name": "Ada" \};/);
});

test("Faz 136 supports quoted keys in multiline objects and bracket access", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase136-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    user = {
        "display name": "Ada"
    }
    return user["display name"]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), "Ada");
});
