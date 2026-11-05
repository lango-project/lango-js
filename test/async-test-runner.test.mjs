import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

test("CLI awaits Lango tests, reports rejected Promises as failures and continues", async t => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-async-tests-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const input = path.join(directory, "input.lango");
    await writeFile(input, `import js global Promise

test "async failure"
    return Promise/resolve().then(()
        throw "ExpectedAsyncFailure"
    )

test "async success afterwards"
    return Promise/resolve(1).then((value)
        assert value == 1
    )
`);
    await assert.rejects(promisify(execFile)(process.execPath, ["src/cli.mjs", "test", input]), error => {
        assert.equal(error.code, 1);
        assert.match(error.stderr, /FAIL async failure: ExpectedAsyncFailure/);
        assert.doesNotMatch(error.stdout, /PASS async failure/);
        assert.match(error.stdout, /PASS async success afterwards/);
        return true;
    });
});
