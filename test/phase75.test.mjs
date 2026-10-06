import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile, LangoError } from "../src/compiler.mjs";

test("Faz 75 validates direct imported Lango function arity", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase75-"));
    const library = path.join(directory, "math.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `export add(left, right)

add(left, right)
    return left + right
`);
    await writeFile(input, `import "./math"
    add(left, right)

export main(args)

main(args)
    return add(1)
`);
    await assert.rejects(
        () => buildFile(input, output),
        (error) => error instanceof LangoError && error.code === "LNG1203",
    );
});
