import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";
import { createSqliteAdapter } from "../src/database.mjs";

test("Faz 107 reports affected rows only for data-changing statements", () => {
    const database = createSqliteAdapter();
    try {
        assert.equal(database.execute("create table item (id integer primary key, name text)").changes, null);
        assert.equal(database.execute("insert into item (name) values ('Ada')").changes, 1);
        assert.equal(database.execute("select * from item").changes, null);
    } finally { database.close(); }
});

test("Faz 107 reports one generated key only for a single-row insert", () => {
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key, name text)");
        assert.equal(database.execute("insert into item (name) values ('Ada')").lastInsertRowid, 1);
        assert.equal(database.execute("insert into item (name) values ('Lin'), ('Mia')").lastInsertRowid, null);
    } finally { database.close(); }
});

test("Faz 107 exposes affected_rows and generated_key on a Lango query", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase107-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    rs = SQL
        insert into item (name) values (@name)
    rs.name = "Ada"
    rs.execute()
    return rs.generated_key
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key, name text)");
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), 1);
    } finally { database.close(); }
});
