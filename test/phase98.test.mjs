import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile, compile, LangoError } from "../src/compiler.mjs";

test("Faz 98 validates and emits a multiline XML literal", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase98-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    name = "<Savaş & Co>"
    xml = <customer name="\${name}">
        <status>active</status>
      </customer>
    println(xml)
`);
    await buildFile(input, output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.deepEqual(values, [
        '<customer name="&lt;Savaş &amp; Co&gt;">\n        <status>active</status>\n      </customer>',
    ]);
});

test("Faz 98 XML conformance fixture escapes interpolation", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase98-example-"));
    const output = path.join(directory, "main.mjs");
    await buildFile(path.resolve("examples/098-xml/input.lango"), output);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);
    const program = await import(pathToFileURL(output).href);
    const values = [];
    runtime.configure({ output: (value) => values.push(value) });
    program.main([]);
    assert.equal(values[0], '<customer name="&lt;Savaş &amp; Co&gt;">\n        <status>active</status>\n      </customer>');
});

test("Faz 98 supports a self-closing XML literal in a call expression", () => {
    const output = compile(`main(args)
    println(<item/>)
`).javascript;
    assert.match(output, /\["<item\/>"]\.join\(""\)/);
});

test("Faz 98 rejects malformed XML and dynamic XML structure", () => {
    assert.throws(
        () => compile(`main(args)
    xml = <customer></order>
`),
        (error) => error instanceof LangoError && error.code === "LNG1249",
    );
    assert.throws(
        () => compile(`main(args)
    xml = <\${name} />
`),
        (error) => error instanceof LangoError && error.code === "LNG1248",
    );
    assert.throws(
        () => compile(`main(args)
    xml = <item id="1" id="2" />
`),
        (error) => error instanceof LangoError && error.code === "LNG1249",
    );
});
