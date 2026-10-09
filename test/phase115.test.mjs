import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";
import { createSqliteAdapter } from "../src/database.mjs";

test("Faz 115 lowers SQL interpolation separately from named bindings", () => {
    const output = compile(`main(args)
    table = "item"
    rs = SQL
        select name from \${table} where id = :id
    rs.id = 1
    return rs
`).javascript;
    assert.match(output, /__query\("select name from " \+ String\(table\) \+ " where id = :id", \["id"\]\)/);
});

test("Faz 115 interpolates raw SQL while preserving colon parameter binding", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase115-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    table = "item"
    rs = SQL
        select name from \${table} where id = :id
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
        database.execute("insert into item values (2, 'Lin')");
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), "Lin");
    } finally { database.close(); }
});

test("Faz 115 rejects an empty SQL interpolation", () => {
    assert.throws(
        () => compile(`main(args)
    rs = SQL
        select \${}
`),
        (error) => error instanceof LangoError && error.code === "LNG1257",
    );
});
