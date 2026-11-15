import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execute = promisify(execFile);
const cli = new URL("../src/cli.mjs", import.meta.url).pathname;

test("verbose log accessors and debug output follow the CLI flag and environment", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "lango-verbose-"));
    const source = path.join(dir, "main.lango");
    await writeFile(source, `export main(args)

main(args)
    context log
    println("verbose=\${log.verbose?}")
    log.debug("diagnostic")
`);
    const env = { ...process.env, LANGO_VERBOSE: "0" };
    try {
        const quiet = await execute(process.execPath, [cli, "run", source], { env });
        assert.equal(quiet.stdout.trim(), "verbose=false");
        const verbose = await execute(process.execPath, [cli, "run", source, "--verbose"], { env });
        assert.match(verbose.stdout, /verbose=true/);
        assert.match(verbose.stdout, /\[DEBUG\] diagnostic/);
        const inherited = await execute(process.execPath, [cli, "run", source], {
            env: { ...env, LANGO_VERBOSE: "1" },
        });
        assert.match(inherited.stdout, /verbose=true/);
        assert.match(inherited.stdout, /\[DEBUG\] diagnostic/);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
