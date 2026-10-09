import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

async function buildProgram(source) {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase109-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output);
    return import(pathToFileURL(output).href);
}

test("Faz 109 reports DatabaseNotConfigured for transactions without a host adapter", async () => {
    const program = await buildProgram(`export main(args)

main(args)
    try
        start_trans()
    catch err
        return err.message
`);
    assert.equal(program.main([]), "DatabaseNotConfigured");
});

test("Faz 109 does not wrap a missing default adapter as SqlError", async () => {
    const program = await buildProgram(`export main(args)

main(args)
    try
        rs = SQL
            select 1
        rs.execute()
    catch err
        return err.message
`);
    assert.equal(program.main([]), "DatabaseNotConfigured");
});
