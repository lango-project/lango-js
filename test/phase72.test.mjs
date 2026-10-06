import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 72 imports a Lango function under an alias", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase72-"));
    const library = path.join(directory, "math.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `export add(left, right)

add(left, right)
    return left + right
`);
    await writeFile(input, `import "./math"
    alias sum = add(left, right)

export main(args)

main(args)
    return sum(2, 3)
`);
    await buildFile(input, output);
    const emitted = await (await import("node:fs/promises")).readFile(output, "utf8");
    assert.match(emitted, /import \{ add as sum \} from "\.\/math\.mjs";/);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), 5);
});
