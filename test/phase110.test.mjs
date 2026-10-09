import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 110 marks an unusable transaction as failed until it is rolled back", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase110-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    start_trans()
    try
        rs = SQL
            select 1
        rs.execute()
    catch err
        return trans_state() == DB.Failed
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    let state = null;
    const adapter = {
        begin() { state = "active"; },
        commit() { state = null; },
        rollback() { state = null; },
        transactionState() { return state; },
        execute() {
            const error = new Error("timed out");
            error.code = "timeout";
            error.transactionUnusable = true;
            throw error;
        },
    };
    runtime.configure({ database_adapter: adapter });
    assert.equal(program.main([]), true);
    assert.throws(() => runtime.commitTrans(), /TransactionFailed/);
    runtime.rollbackTrans();
    assert.equal(runtime.transState(), null);
});
