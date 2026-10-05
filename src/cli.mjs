import path from "node:path";

import { buildFile, LangoError } from "./compiler.mjs";

const [command, inputPath, ...rest] = process.argv.slice(2);

if (command !== "build" || !inputPath || rest.length !== 2 || rest[0] !== "--out") {
    console.error("Usage: node src/cli.mjs build <input.lango> --out <output.mjs>");
    process.exitCode = 2;
} else {
    try {
        await buildFile(path.resolve(inputPath), path.resolve(rest[1]));
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = error instanceof LangoError ? 1 : 2;
    }
}
