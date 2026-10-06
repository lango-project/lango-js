import assert from "node:assert/strict";
import { compile, LangoError } from "../src/compiler.mjs";
import test from "node:test";

test("Faz 80 reserves slash for imported JavaScript namespace paths", () => {
    assert.throws(
        () => compile(`import js "node:fs" as fs

main(args)
    return path/promises/readFile("file", "utf8")
`),
        (error) => error instanceof LangoError && error.code === "LNG1233",
    );
    assert.throws(
        () => compile(`import js "node:fs" as fs

main(args)
    return fs.promises.readFile("file", "utf8")
`),
        (error) => error instanceof LangoError && error.code === "LNG1232",
    );
});
