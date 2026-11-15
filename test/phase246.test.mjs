import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { buildFile, compile } from "../src/compiler.mjs";

test("Phase 246 provides a default log context and supports replacement", async () => {
    const source = `export main(args)

write()
    context log
    log.info("custom")

main(args)
    if args.length == 0
        context log
        return log
    context log = args[0]
    write()
    return null
`;
    const javascript = compile(source).javascript;
    assert.match(javascript, /__contextGet\("log"\)/);
    assert.match(javascript, /__contextSet\("log", __normalize\(args\[0\]\)\)/);

    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase246-"));
    const input = path.join(directory, "input.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(input, source);
    await buildFile(input, output);
    const program = await import(pathToFileURL(output).href);
    const runtime = await import(pathToFileURL(path.join(directory, ".lango/runtime.mjs")).href);

    const stdout = [];
    const stderr = [];
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    process.stdout.write = (value) => { stdout.push(String(value)); return true; };
    process.stderr.write = (value) => { stderr.push(String(value)); return true; };
    try {
        const log = program.main([]);
        runtime.configure({ verbose: false });
        assert.equal(log.verbose, false);
        assert.equal(log.debug("hidden"), null);
        runtime.configure({ verbose: true });
        assert.equal(log.verbose, true);
        assert.throws(() => { log.verbose = false; }, TypeError);
        assert.equal(log.debug("debug"), null);
        assert.equal(log.info("info"), null);
        assert.equal(log.warn("warn"), null);
        assert.equal(log.err("error"), null);
    } finally {
        runtime.configure({ verbose: false });
        process.stdout.write = originalStdout;
        process.stderr.write = originalStderr;
    }
    assert.deepEqual(stdout, ["[DEBUG] debug\n", "[INFO] info\n"]);
    assert.deepEqual(stderr, ["[WARN] warn\n", "[ERROR] error\n"]);

    const entries = [];
    const customLog = { info(value) { entries.push(value); return null; } };
    assert.equal(program.main([customLog]), null);
    assert.deepEqual(entries, ["custom"]);
});
