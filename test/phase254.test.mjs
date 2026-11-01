import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("generated Node XML helpers load inside an ESM package", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-esm-xml-"));
    await writeFile(path.join(directory, "package.json"), '{"type":"module"}');
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export parse(xml)

parse(xml)
    return xml2obj(xml)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.parse('<profile name="Ada" />').name, "Ada");
});
