import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { buildFile } from "../src/compiler.mjs";

test("Faz 210 discovers Lango tests across the imported module graph", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase210-"));
    const shared = path.join(directory, "shared.lango");
    const library = path.join(directory, "library.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(shared, `test "shared"
    assert true
`);
    await writeFile(library, `import "./shared"

test "library"
    assert true
`);
    await writeFile(input, `import "./library"
import "./shared"

test "main"
    assert true
`);

    await buildFile(input, output, new Set(), true);
    const program = await import(pathToFileURL(output).href);
    assert.deepEqual(
        program.__langoTests.map((item) => item.name),
        ["shared", "library", "shared", "main"],
    );
    assert.equal(new Set(program.__langoTests.map((item) => item.run)).size, 3);
});
