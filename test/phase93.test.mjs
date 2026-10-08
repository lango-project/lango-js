import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { formatSource } from "../src/compiler.mjs";

const execFileAsync = promisify(execFile);

test("Faz 93 formats parseable source without discarding comments", () => {
    assert.equal(
        formatSource(`\n# heading   \n\n\nexport main(args)   # entry   \n\nmain(args)   \n    return "ok"   \n\n`),
        `# heading\n\nexport main(args) # entry\n\nmain(args)\n    return "ok"\n`,
    );
});

test("Faz 93 format command rewrites its input file", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase93-"));
    const input = path.join(directory, "input.lango");
    await writeFile(input, `export main(args)   \n\n\nmain(args)\n    return null   \n`);
    await execFileAsync(process.execPath, ["src/cli.mjs", "format", input], {
        cwd: path.resolve("."),
    });
    assert.equal(
        await readFile(input, "utf8"),
        `export main(args)\n\nmain(args)\n    return null\n`,
    );
});

test("Faz 93 formatting is idempotent for inline comments", () => {
    const once = formatSource(["main(args)   # entry   ", "    return \"# literal\"   # result   ", ""].join("\n"));
    assert.equal(once, `main(args) # entry
    return "# literal" # result
`);
    assert.equal(formatSource(once), once);
});

test("Faz 93 formatter conformance fixture has its canonical form", async () => {
    const input = await readFile("examples/093-formatter/input.lango", "utf8");
    const expected = await readFile("examples/093-formatter/expected.lango", "utf8");
    assert.equal(formatSource(input), expected);
});
