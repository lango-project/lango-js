import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("Faz 95 copies the pinned Decimal backend beside the generated runtime", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase95-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return null
`);
    await buildFile(input, output);
    assert.match(
        await readFile(path.join(directory, ".lango/runtime.mjs"), "utf8"),
        /import BigNumber from "\.\/bignumber\.mjs"/,
    );
    assert.match(
        await readFile(path.join(directory, ".lango/bignumber.mjs"), "utf8"),
        /bignumber\.js v11\.1\.5/,
    );
});
