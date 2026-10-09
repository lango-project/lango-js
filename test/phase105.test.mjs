import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createSqliteAdapter } from "../src/database.mjs";
import { compile } from "../src/compiler.mjs";
import { buildFile } from "../src/compiler.mjs";
import { pathToFileURL } from "node:url";

test("Faz 105 SQLite adapter executes statements and reports generated keys", () => {
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key, name text)");
        const inserted = database.execute("insert into item (name) values ($name)", { name: "one" });
        assert.equal(inserted.changes, 1);
        assert.equal(inserted.lastInsertRowid, 1);
        assert.deepEqual(database.execute("select id, name from item").rows, [{ id: 1, name: "one" }]);
    } finally {
        database.close();
    }
});

test("Faz 105 SQLite adapter rolls back a transaction", () => {
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key)");
        database.begin();
        database.execute("insert into item values (1)");
        database.rollback();
        assert.deepEqual(database.execute("select id from item").rows, []);
    } finally {
        database.close();
    }
});

test("Faz 105 joins nested transactions until the outer commit", () => {
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key)");
        database.begin();
        database.begin();
        database.execute("insert into item values (1)");
        database.commit();
        assert.equal(database.transactionState(), "active");
        database.commit();
        assert.deepEqual(database.execute("select id from item").rows, [{ id: 1 }]);
        assert.equal(database.transactionState(), null);
    } finally {
        database.close();
    }
});

test("Faz 105 marks an outer transaction rollback-only after an inner rollback", () => {
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key)");
        database.begin();
        database.begin();
        database.execute("insert into item values (1)");
        database.rollback();
        assert.equal(database.transactionState(), "rollback_only");
        assert.throws(() => database.commit(), /TransactionRolledBack/);
        assert.deepEqual(database.execute("select id from item").rows, []);
    } finally { database.close(); }
});

test("Faz 105 rejects transaction completion without an active transaction", () => {
    const database = createSqliteAdapter();
    try {
        assert.throws(() => database.commit(), /NoActiveTransaction/);
        assert.throws(() => database.rollback(), /NoActiveTransaction/);
    } finally {
        database.close();
    }
});

test("Faz 105 rolls back an active transaction on close", async () => {
    const filename = path.join(await mkdtemp(path.join(os.tmpdir(), "lango-phase105-")), "data.sqlite");
    const database = createSqliteAdapter(filename);
    database.execute("create table item (id integer primary key)");
    database.begin();
    database.execute("insert into item values (1)");
    database.close();
    const reopened = createSqliteAdapter(filename);
    try {
        assert.deepEqual(reopened.execute("select id from item").rows, []);
    } finally {
        reopened.close();
    }
});

test("Faz 105 lowers core transaction functions", () => {
    const output = compile(`main(args)
    start_trans()
    commit_trans()
    return trans_state()
`).javascript;
    assert.match(output, /startTrans as __startTrans/);
    assert.match(output, /return __transState\(\)/);
});

test("Faz 105 exposes transaction states through the DB enum", () => {
    const output = compile(`main(args)
    return trans_state() == DB.Active
`).javascript;
    assert.match(output, /DB as __DB/);
    assert.match(output, /__transState\(\) === __DB\.Active/);
});

test("Faz 105 exposes all active transaction states through the DB enum", () => {
    const output = compile(`main(args)
    return trans_state() == DB.RollbackOnly or trans_state() == DB.Failed
`).javascript;
    assert.match(output, /__DB\.RollbackOnly/);
    assert.match(output, /__DB\.Failed/);
});

test("Faz 105 executes core transaction functions through the configured adapter", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase105-runtime-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    start_trans()
    commit_trans()
    return trans_state()
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), null);
    } finally { database.close(); }
});

test("Faz 105 exposes DB.Active while a Lango transaction is open", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase105-state-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    start_trans()
    return trans_state() == DB.Active
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), true);
    } finally { database.close(); }
});

test("Faz 105 exposes DB.RollbackOnly after a joined Lango transaction rolls back", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase105-rollback-only-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    start_trans()
    start_trans()
    rollback_trans()
    return trans_state() == DB.RollbackOnly
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), true);
    } finally { database.close(); }
});

test("Faz 105 transaction conformance fixture runs", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase105-example-"));
    const output = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/105-transactions/input.lango"), output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), null);
    } finally { database.close(); }
});
