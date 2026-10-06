import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("Faz 88 recognizes exported enum values in a class static import API", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase88-"));
    const library = path.join(directory, "color.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `export class Color
    enum
        Red = "red"
`);
    await writeFile(input, `import "./color"
    class Color
        static
            Red
`);
    await assert.doesNotReject(() => buildFile(input, output));
});
