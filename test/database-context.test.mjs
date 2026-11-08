import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";
import { postgresQuery, sqlBindings } from "../src/sql.mjs";

async function compiled(t, target = "node") {
    const root = await mkdtemp(path.join(os.tmpdir(), "lango-db-context-"));
    t.after(() => rm(root, { recursive: true, force: true }));
    const input = path.join(root, "main.lango");
    await writeFile(input, `export read()

read()
    context db
    rs = SQL
        select :amount::numeric as amount
    rs.amount = $12345678901234567890.123456789
    rs.execute()
    if rs.next()
        return rs.amount
    return null
`);
    const output = path.join(root, "main.mjs");
    await buildFile(input, output, new Set(), false, { target });
    return {
        program: await import(pathToFileURL(output).href),
        runtime: await import(pathToFileURL(path.join(root, ".lango/runtime.mjs")).href),
    };
}

for (const target of ["node", "browser"])
test(`${target} context db is shared across runtime copies, preserves Decimal and overrides fallback`, async t => {
    const a = await compiled(t, target), b = await compiled(t, target);
    let calls = 0;
    const adapter = {
        parameterStyle: "postgresql",
        execute(sql, values) {
            calls++;
            assert.equal(sql.trim(), "select $1::numeric as amount");
            assert.deepEqual(values, ["12345678901234567890.123456789"]);
            return { rows: [{ amount: values[0] }] };
        },
    };
    b.runtime.configure({ database_adapter: { execute: () => ({ rows: [{ amount: "fallback" }] }) } });
    a.runtime.contextSet("db", adapter);
    try {
        assert.equal(b.program.read(), "12345678901234567890.123456789");
        assert.equal(calls, 1);
        a.runtime.contextSet("db", null);
        try { assert.throws(() => b.program.read(), /DatabaseNotConfigured/); }
        finally { a.runtime.contextRestore(["db"]); }
    } finally { a.runtime.contextRestore(["db"]); }
    assert.equal(b.program.read(), "fallback");
});

test("failed transactions are shared across runtime copies and isolated by DB scope", async t => {
    const a = await compiled(t), b = await compiled(t);
    let state = null;
    const broken = {
        begin() { state = "active"; }, commit() { state = null; }, rollback() { state = null; },
        transactionState() { return state; },
        execute() { throw Object.assign(new Error("query failed"), { transactionUnusable: true }); },
    };
    a.runtime.contextSet("db", broken);
    try {
        a.runtime.startTrans();
        assert.throws(() => b.program.read(), /query failed/);
        assert.equal(a.runtime.transState(), a.runtime.DB.Failed);
        assert.throws(() => a.runtime.commitTrans(), /TransactionFailed/);
        b.runtime.contextSet("db", { transactionState: () => null });
        try { assert.equal(a.runtime.transState(), null); }
        finally { b.runtime.contextRestore(["db"]); }
        b.runtime.rollbackTrans();
        assert.equal(a.runtime.transState(), null);
    } finally { a.runtime.contextRestore(["db"]); }
});

test("binding conversion preserves quoted SQL, nested comments, dollar strings and casts", () => {
    const sql = `select :id::int, :id, :amount, ':literal', "colon:name", \`colon:name\`, [colon:name],
        E'escaped\\':literal', $$ :literal $$, $body$ :also_literal $body$
        -- :comment
        /* outer :comment /* nested :comment */ still :comment */
        where value = :value`;
    assert.deepEqual(sqlBindings(sql).map(b => b.name), ["id", "id", "amount", "value"]);
    const prepared = postgresQuery(sql, { id: 5, amount: "0.1234567890123456789", value: null });
    assert.deepEqual(prepared.values, [5, "0.1234567890123456789", null]);
    assert.ok(prepared.text.startsWith("select $1::int, $1, $2"));
    assert.ok(prepared.text.endsWith("value = $3"));
    assert.ok(prepared.text.includes("$$ :literal $$"));
    assert.throws(() => postgresQuery("select :missing", {}), /SqlParameterNotBound/);
    assert.doesNotThrow(() => compile(`run()
    rs = SQL
        select $$ :not_a_parameter $$, :real::int
    rs.real = 1
    rs.execute()
`));
});

test("a callback can create a local db context without capturing the new binding", () => {
    assert.doesNotThrow(() => compile(`import js global Promise

run(adapter)
    return chain Promise/resolve(null)
      then(ignored)
        capture adapter
        context db = adapter
        rs = SQL
            select 1
        rs.execute()
        return db.transactionState()
`));
});
