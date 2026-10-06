import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildFile, LangoError } from "../src/compiler.mjs";

test("Faz 90 treats an imported class static section as its explicit method API", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lango-phase90-"));
    const library = path.join(directory, "account.lango");
    const input = path.join(directory, "main.lango");
    const output = path.join(directory, "main.mjs");
    await writeFile(library, `export class Account
    static
        create()

Account::create()
    return null
`);
    await writeFile(input, `import "./account"
    class Account
        static
            create()

export main(args)

main(args)
    return Account.remove()
`);
    await assert.rejects(
        () => buildFile(input, output),
        (error) => error instanceof LangoError && error.code === "LNG1241",
    );
});
