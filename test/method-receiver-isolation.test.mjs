import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile } from "../src/compiler.mjs";

test("foreign calls ignore same-named private/public methods and normalize missing JS results", async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-receiver-isolation-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const output = path.join(directory, "out", "main.mjs");
    await mkdir(path.dirname(output));
    await writeFile(path.join(directory, "input.lango"), `import js "./host.mjs" as host
import js global Promise

export main(args)

class PrivateCollision
    methods
        run()

PrivateCollision:resolve(value)
    return value

PrivateCollision:get(value)
    return value

PrivateCollision:run()
    assert host/resolve() == "native"
    assert host/get() == null
    source = host/source()
    assert source.get() == null
    return Promise/resolve("ready")

class PublicCollision
    methods
        get(value)
        run()

PublicCollision:get(value)
    return value

PublicCollision:run()
    source = host/source()
    assert source.get() == null
    assert get("own") == "own"

main(args)
    pub = new PublicCollision()
    pub.run()
    priv = new PrivateCollision()
    return priv.run()
`);
    await writeFile(path.join(path.dirname(output), "host.mjs"), 'export function resolve() { return "native"; }\nexport function get() {}\nexport function source() { return { get() {} }; }\n');
    await buildFile(path.join(directory, "input.lango"), output);
    const program = await import(pathToFileURL(output).href);
    assert.equal(await program.main([]), "ready");
});
