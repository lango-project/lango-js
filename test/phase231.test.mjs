import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("Faz 231 creates a runnable Lango project template", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lango-phase231-"));
    const project = path.join(root, "hello-lango");
    await execFileAsync(process.execPath, ["src/cli.mjs", "init", project], {
        cwd: path.resolve("."),
    });
    const packageJson = JSON.parse(await readFile(path.join(project, "package.json"), "utf8"));
    assert.equal(packageJson.devDependencies["@lango-project/lango-js"], "^0.1.2");
    assert.equal(packageJson.scripts.build, "lango build src/main.lango --out dist/main.mjs");
    assert.match(await readFile(path.join(project, ".gitignore"), "utf8"), /node_modules\//);
    assert.match(await readFile(path.join(project, "src/main.lango"), "utf8"), /export main\(args\)/);
    assert.deepEqual(
        JSON.parse(await readFile(path.join(project, ".vscode/extensions.json"), "utf8")),
        { recommendations: ["lango-project.lango"] },
    );
    await assert.rejects(
        () => execFileAsync(process.execPath, ["src/cli.mjs", "init", project], {
            cwd: path.resolve("."),
        }),
        (error) => error.code === 2,
    );
    await writeFile(path.join(root, "not-a-directory"), "occupied");
    await assert.rejects(
        () => execFileAsync(process.execPath, ["src/cli.mjs", "init", path.join(root, "not-a-directory")], {
            cwd: path.resolve("."),
        }),
    );
});
