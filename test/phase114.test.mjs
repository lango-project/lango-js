import assert from "node:assert/strict";
import test from "node:test";
import { compile, LangoError } from "../src/compiler.mjs";

test("Faz 114 collects colon SQL parameters only from SQL code", () => {
    const output = compile(`main(args)
    rs = SQL
        select ':quoted', ":identifier" -- :line_comment
        /* :block_comment */
        from item where id = :id or owner = :owner
    rs.id = 1
    rs.owner = "Ada"
    return rs
`).javascript;
    assert.match(output, /\["id","owner"\]/);
});

test("Faz 114 does not allow binding a colon name found only in SQL text or comments", () => {
    assert.throws(
        () => compile(`main(args)
    rs = SQL
        select ':name' -- :name
    rs.name = "Ada"
`),
        (error) => error instanceof LangoError && error.code === "LNG1256",
    );
});

test("Faz 114 rejects the former at-sign SQL parameter spelling", () => {
    assert.throws(
        () => compile(`main(args)
    rs = SQL
        select @id
    rs.id = 1
`),
        (error) => error instanceof LangoError && error.code === "LNG1256",
    );
});
