import { DatabaseSync } from "node:sqlite";

export function createSqliteAdapter(filename = ":memory:") {
  const database = new DatabaseSync(filename);
  let depth = 0;
  let state = null;

  return {
    execute(sql, parameters = {}) {
      const statement = database.prepare(sql);
      if (/^\s*(select|pragma|with)\b/i.test(sql))
        return { rows: statement.all(parameters).map((row) => ({ ...row })), changes: null, lastInsertRowid: null };
      const result = statement.run(parameters);
      const dataChange = /^\s*(insert|update|delete)\b/i.test(sql);
      const valuesAt = sql.search(/\bvalues\s*\(/i);
      const singleRowInsert =
        /^\s*insert\b/i.test(sql) &&
        valuesAt >= 0 &&
        !/\)\s*,\s*\(/.test(sql.slice(valuesAt));
      return {
        rows: [],
        changes: dataChange ? Number(result.changes) : null,
        lastInsertRowid: singleRowInsert && result.lastInsertRowid !== undefined
          ? Number(result.lastInsertRowid)
          : null,
      };
    },
    begin() {
      if (depth === 0) database.exec("BEGIN");
      if (depth === 0) state = "active";
      depth += 1;
    },
    commit() {
      if (depth === 0) throw new Error("NoActiveTransaction");
      depth -= 1;
      if (depth === 0) {
        if (state === "rollback_only") {
          database.exec("ROLLBACK");
          state = null;
          throw new Error("TransactionRolledBack");
        }
        database.exec("COMMIT");
        state = null;
      }
    },
    rollback() {
      if (depth === 0) throw new Error("NoActiveTransaction");
      if (depth > 1) {
        depth -= 1;
        state = "rollback_only";
      } else {
        depth = 0;
        database.exec("ROLLBACK");
        state = null;
      }
    },
    transactionState() { return state; },
    close() {
      if (depth > 0) {
        depth = 0;
        state = null;
        database.exec("ROLLBACK");
      }
      database.close();
    },
  };
}
