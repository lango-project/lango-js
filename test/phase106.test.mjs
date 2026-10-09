import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile } from "../src/compiler.mjs";
import { createSqliteAdapter } from "../src/database.mjs";

test("Faz 106 lowers an indented SQL query and its parameter names", () => {
    const output = compile(`main(args)
    rs = SQL
        select name from item where id = @id
    rs.id = 1
    return rs
`).javascript;
    assert.match(output, /query as __query/);
    assert.match(output, /__query\("select name from item where id = @id", \["id"\]\)/);
    assert.match(output, /rs\.id = 1/);
});

test("Faz 106 executes a bound SQL query and reads its current row", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase106-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    rs = SQL
        select name from item where id = @id
    rs.id = 2
    rs.execute()
    if rs.next()
        return rs.name
    return null
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        database.execute("create table item (id integer primary key, name text)");
        database.execute("insert into item values (1, 'Ada'), (2, 'Lin')");
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), "Lin");
    } finally { database.close(); }
});

test("Faz 106 rejects a SQL body with no statement", () => {
    assert.throws(
        () => compile(`main(args)
    rs = SQL
`),
        /LNG1255/,
    );
});

test("Faz 106 rejects binding a parameter not declared by the SQL body", () => {
    assert.throws(
        () => compile(`main(args)
    rs = SQL
        select name from item where id = @id
    rs.name = "Ada"
`),
        (error) => error.code === "LNG1256",
    );
});
