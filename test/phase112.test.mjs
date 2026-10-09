import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 112 binds a Decimal SQL parameter as canonical text", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase112-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    $one = 1
    $amount = $one / 3
    rs = SQL
        select :amount
    rs.amount = $amount
    rs.execute()
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    let bound = null;
    runtime.configure({ database_adapter: {
        execute(sql, parameters) { bound = parameters; return { rows: [], changes: null, lastInsertRowid: null }; },
        begin() {}, commit() {}, rollback() {}, transactionState() { return null; },
    } });
    program.main([]);
    assert.deepEqual(bound, { amount: "0.333333" });
});
