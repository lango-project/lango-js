import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildFile } from "../src/compiler.mjs";

test("Faz 167 permits indexed and call-result method calls as statements", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase167-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, `export main(args)

main(args)
    groups = args[0]
    groups[0].add("Ada")
    get_group(groups).add("Lin")
    return groups[0]

get_group(groups)
    return groups[0]
`);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    assert.deepEqual(program.main([[[]]]), ["Ada", "Lin"]);
});
