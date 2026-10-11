import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 211 includes original source content in each external source map", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase211-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    const source = `export main(args)\n\nmain(args)\n    return null\n`;
    await writeFile(input, source);
    await buildFile(input, output);
    const map = JSON.parse(await readFile(`${output}.map`, "utf8"));
    assert.deepEqual(map.sourcesContent, [source]);
    assert.notEqual(map.mappings, "");
    assert.match(map.mappings, /A(?:AAA|ACA|AEA)/);
});

test("Faz 211 exposes structured parser diagnostic locations", () => {
    assert.throws(
        () => compile("main(args)\n    unsupported statement\n", "broken.lango"),
        (error) => {
            assert.ok(error instanceof LangoError);
            assert.equal(error.severity, "error");
            assert.equal(error.sourceName, "broken.lango");
            assert.deepEqual(error.span.start, { line: 2, column: 5 });
            assert.deepEqual(error.span.end, { line: 2, column: 26 });
            return true;
        },
    );
});
