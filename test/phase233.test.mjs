import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 233 converts a value to Decimal with $()", () => {
    const output = compile(`main(args)
    $value = $("12.50")
    return $value + 0.25
`).javascript;
    assert.match(output, /__decimal\("12\.50"\)/);
    assert.match(output, /\$value\.plus\(__decimal\("0\.25"\)\)/);
});

test("Faz 233 rejects an invalid dynamic Decimal value", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase233-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return $("not-a-number")
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.main([]), /Decimal value must be finite/);
});

test("Faz 233 retains Decimal precision after $() conversion", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase233-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return $("9007199254740993") + 1
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]).toFixed(), "9007199254740994");
});

test("Faz 233 accepts a Decimal argument explicitly converted by $()", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase233-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

topla(a, $b)
    return $(a) + $b

main(args)
    return topla($10, $2)
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]).toFixed(), "12");
});

test("Faz 233 requires one $() argument", () => {
    for (const source of ["$()", "$(1, 2)"])
        assert.throws(
            () => compile(`main(args)\n    return ${source}\n`),
            (error) => error instanceof LangoError && error.code === "LNG1261",
        );
});
