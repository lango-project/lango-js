import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { buildFile, compile, LangoError } from "../src/compiler.mjs";
import { Decimal } from "../src/runtime.mjs";

test("Faz 213 pins the configured Decimal division profile into a build runtime", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase213-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    $one = 1
    $three = 3
    return $one / $three
`);
    await buildFile(input, output, new Set(), false, {
        decimal_division_scale: 2,
        decimal_division_rounding: Decimal.Rounding.HalfUp,
    });
    const runtimeSource = await readFile(path.join(directory, ".lango/runtime.mjs"), "utf8");
    assert.match(runtimeSource, /DECIMAL_PLACES: 2/);
    assert.match(runtimeSource, /ROUNDING_MODE: BigNumber\.ROUND_HALF_UP/);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]).toFixed(), "0.33");
});

test("Faz 213 rejects invalid Decimal profiles", () => {
    assert.throws(
        () => compile("main(args)\n    return null\n", "<source>", [], false, { decimal_division_scale: -1 }),
        (error) => error instanceof LangoError && error.code === "LNG1262",
    );
    assert.throws(
        () => compile("main(args)\n    return null\n", "<source>", [], false, { decimal_division_rounding: "nearest" }),
        (error) => error instanceof LangoError && error.code === "LNG1263",
    );
});
