import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile, LangoError } from "../src/compiler.mjs";

test("Faz 73 requires selected Lango imports to be exported", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase73-"));
    const library = path.join(directory, "library.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `hidden(value)
    return value
`);
    await writeFile(input, `import "./library"
    hidden(value)

export main(args)

main(args)
    return hidden("no")
`);
    await assert.rejects(
        () => buildFile(input, output),
        (error) => error instanceof LangoError && error.code === "LNG1227",
    );
});
