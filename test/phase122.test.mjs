import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 122 lowers unary minus for native and Decimal values", () => {
    const output = compile(`main(args)
    native = -1
    decimal = -$10.5
    return native
`).javascript;
    assert.match(output, /let native = __finite\(-1\)/);
    assert.match(output, /let decimal = __decimal\("0"\)\.minus\(__decimal\("10\.5"\)\)/);
});

test("Faz 122 preserves Decimal division when the operand is negative", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase122-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return to_json(-$1 / $2)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), "-0.5");
});
