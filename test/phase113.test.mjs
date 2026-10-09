import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 113 lowers numeric arithmetic assigned to a Decimal binding as Decimal arithmetic", () => {
    const output = compile(`main(args)
    $ratio = 1 / 3
    return $ratio
`).javascript;
    assert.match(output, /let \$ratio = __decimal\("1"\)\.div\(__decimal\("3"\)\)/);
});

test("Faz 113 applies the Decimal division profile to a numeric Decimal assignment", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase113-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    $ratio = 1 / 3
    return to_json($ratio)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), "0.333333");
});
