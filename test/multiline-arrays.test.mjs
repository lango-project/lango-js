import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile, diagnose, formatSource, LangoError } from "../src/compiler.mjs";

async function program(t, source) {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lango-array-lines-"));
    t.after(() => rm(dir, { recursive: true, force: true }));
    const input = path.join(dir, "main.lango");
    const output = path.join(dir, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output);
    return import(pathToFileURL(output).href);
}

test("multiline arrays accept comma-free maps on their own lines", async t => {
    const source = `export fill(input)
export global saved

global saved = null

setValue(name, value)
    global saved
    saved = {
        name: name
        value: value
    }

fill(input)
    context log
    rows = [
        {
            ad: "Savas"
            soyad: "Alparslan"
        }
    ]
    setValue("tablo", rows)
`;
    assert.equal(formatSource(source), source);
    const mod = await program(t, source);
    mod.fill({});
    assert.deepEqual(mod.saved, { name: "tablo", value: [{ ad: "Savas", soyad: "Alparslan" }] });
});

test("multiline arrays preserve nested values comments and statement boundaries", async t => {
    const mod = await program(t, `export rows()

identity(value)
    return value

rows()
    result = {
        items: [
            # brackets in comments do not open expressions: [{
            {
                name: "[first"
                values: [
                    1,
                    2
                ]
            },

            {
                name: "second]"
                values: []
            }
        ]
    }
    copied = identity([
        result.items[0],
        result.items[1]
    ])
    return [
        copied,
        "next statement"
    ]
`);
    assert.deepEqual(mod.rows(), [[{ name: "[first", values: [1, 2] }, { name: "second]", values: [] }], "next statement"]);
});

test("XML text containing unmatched square brackets is not a continued array", () => {
    assert.doesNotThrow(() => compile(`export render()

render()
    xml = <label>[literal text</label>
    return xml
`));
});

test("unterminated arrays retain the opening statement's source location", () => {
    assert.throws(() => compile(`main(args)
    rows = [
        {
            name: "value"
        }
`), error => error instanceof LangoError && error.code === "LNG1262" && error.span.start.line === 2);
});

test("syntax diagnostics omit implementation phase names", () => {
    for (const source of [
        "main(args)\n    unsupported syntax\n",
        "main(args)\n    value = ???\n",
        "export fill(input)\n    return input\n",
    ]) {
        const errors = diagnose(source);
        assert.ok(errors.length > 0);
        for (const error of errors) assert.doesNotMatch(error.message, /Faz|Phase/i);
    }
});
