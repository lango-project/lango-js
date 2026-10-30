import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile } from "../src/compiler.mjs";

test("Phase 245 exposes XML as a Tag tree", async () => {
    const source = `export main(args)

main(args)
    root = xml2obj("<conf><http host=\"127.0.0.1\" /><message>Hello <strong>world</strong>!</message><item /><item /></conf>")
    return {
        tag: root.tag(),
        host: root.http.host,
        message: root.message.innerText(),
        children: root.children().length,
        repeated: root.item
    }
`;
    assert.match(compile(source).javascript, /xml2obj as __xml2obj/);
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase245-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.deepEqual(program.main([]), {
        tag: "conf",
        host: "127.0.0.1",
        message: "Hello !",
        children: 4,
        repeated: null,
    });
});

test("Phase 245 reports malformed XML", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase245-error-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    return xml2obj("<root><item></root>")
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.throws(() => program.main([]), /XmlParseError/);
});
