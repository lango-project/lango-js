import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("XML literal names and text stay intact while interpolated identifiers use kebab-case", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lango-xml-kebab-"));
    try {
        const input = path.join(dir, "input.lango");
        const output = path.join(dir, "output.mjs");
        await writeFile(input, `export main(args)

main(args)
    route-name = "/custom-start"
    # An XML-looking comment <ui-start> must not consume the following code.
    xml = <routes>
        <!-- keep-this-comment -->
        <ui-start data-id="\${route-name}">keep-this-text __lango_dash__</ui-start>
        <ui-ping path="/ping"/>
    </routes>
    after-xml = xml2obj("\${xml}")
    child-tags = after-xml.children()
    return {
        name: child-tags[0].tag()
        attribute: child-tags[0].attributes()["data-id"]
        text: child-tags[0].innerText()
        next: child-tags[1].tag()
        value: helper-function(route-name)
    }

helper-function(value)
    xml = <message>hello-\${value}</message>
    return "\${xml}"
`);
        await buildFile(input, output);
        const program = await import(pathToFileURL(output).href);
        assert.deepEqual(program.main([]), {
            name: "ui-start",
            attribute: "/custom-start",
            text: "keep-this-text __lango_dash__",
            next: "ui-ping",
            value: "<message>hello-/custom-start</message>",
        });
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
