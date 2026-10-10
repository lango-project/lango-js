import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";

test("Faz 152 lowers chained access after a safely indexed call result", () => {
    const output = compile(`main(args)
    return find_rows(args)?.[row]?.[column]?.name ?? find_rows(args)?.[row]?.format()

find_rows(args)
    return args
`).javascript;
    assert.match(output, /find_rows\(args\)\?\.\[row\]/);
    assert.match(output, /\?\.\[column\]/);
    assert.match(output, /\?\.name/);
    assert.match(output, /\?\.format\(\)/);
});

test("Faz 152 supports chained indexes, properties, and methods after call results", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase152-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return find_rows(args[0])?.[args[1]]?.[args[2]]?.name ?? find_rows(args[0])?.[args[1]]?.format() ?? "unknown"

find_rows(rows)
    return rows
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([[[{ name: "Ada" }]], 0, 0]), "Ada");
    assert.equal(program.main([[{ format() { return "Lin"; } }], 0, 0]), "Lin");
    assert.equal(program.main([null, 0, 0]), "unknown");
});
