import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 135 lowers inline object literals", () => {
    const output = compile(`main(args)
    return { name: "Ada", active: true }
`).javascript;
    assert.match(output, /return \{ name: "Ada", active: true \};/);
});

test("Faz 135 supports nested inline object literals", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase135-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    user = { profile: { name: "Ada" }, active: true }
    return user.profile.name
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(program.main([]), "Ada");
});

test("Faz 135 requires explicit values in object fields", () => {
    assert.throws(
        () => compile(`main(args)
    return { name }
`),
        (error) => error instanceof LangoError && error.code === "LNG1111",
    );
});
