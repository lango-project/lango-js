import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 117 lowers dollar-prefixed numeric literals as Decimal values", () => {
    const output = compile(`main(args)
    price = $10.50
    return price + $0.25
`).javascript;
    assert.match(output, /let price = __decimal\("10\.50"\)/);
    assert.match(output, /price\.plus\(__decimal\("0\.25"\)\)/);
});

test("Faz 117 executes Decimal literals without a dollar binding target", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase117-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    ratio = $1 / $3
    return ratio
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]).toFixed(), "0.333333");
});

test("Faz 117 rejects a non-finite Decimal literal", () => {
    assert.throws(
        () => compile(`main(args)
    return $1e999
`),
        (error) => error instanceof LangoError && error.code === "LNG1120",
    );
});
