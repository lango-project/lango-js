import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";
import { createSqliteAdapter } from "../src/database.mjs";

test("Faz 108 wraps database failures as a parameter-safe SqlError", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase108-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    try
        rs = SQL
            select name from missing_table where name = :name
        rs.name = "secret-value"
        rs.execute()
    catch err
        return err.query
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        runtime.configure({ database_adapter: database });
        assert.equal(program.main([]), "select name from missing_table where name = :name");
    } finally { database.close(); }
});

test("Faz 108 SqlError exposes driver code and a null position when SQLite supplies none", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase108-fields-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    try
        rs = SQL
            select from
        rs.execute()
    catch err
        if err.position == null
            return err.code
    return null
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const database = createSqliteAdapter();
    try {
        runtime.configure({ database_adapter: database });
        assert.equal(typeof program.main([]), "string");
    } finally { database.close(); }
});
