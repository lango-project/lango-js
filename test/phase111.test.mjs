import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";
import { createSqliteAdapter } from "../src/database.mjs";

test("Faz 111 exposes INSERT RETURNING values as ordinary result rows", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase111-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    rs = SQL
        insert into item (name) values (@name)
        returning id, name
    rs.name = "Ada"
    rs.execute()
    if rs.next()
        return rs.id
    return null
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key, name text)");
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), 1);
        assert.deepEqual(database.execute("select name from item").rows, [{ name: "Ada" }]);
    } finally { database.close(); }
});

test("Faz 111 does not report a generated_key for an INSERT RETURNING result", () => {
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key, name text)");
        const result = database.execute("insert into item (name) values ('Ada') returning id");
        assert.deepEqual(result.rows, [{ id: 1 }]);
        assert.equal(result.lastInsertRowid, null);
    } finally { database.close(); }
});
