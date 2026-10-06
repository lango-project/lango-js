import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("Faz 94 gives an emitted source-map comment its actual output filename", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase94-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "server-entry.mjs");
    await writeFile(input, `export main(args)

main(args)
    return null
`);
    await buildFile(input, output);
    assert.match(
        await readFile(output, "utf8"),
        /sourceMappingURL=server-entry\.mjs\.map/,
    );
});
