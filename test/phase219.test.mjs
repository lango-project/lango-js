import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Faz 219 defines Node 24 CI for tests and package validation", async () => {
    const workflow = await readFile(".github/workflows/ci.yml", "utf8");
    assert.match(workflow, /node-version: 24/);
    assert.match(workflow, /npm test/);
    assert.match(workflow, /npm pack --dry-run --ignore-scripts/);
});
