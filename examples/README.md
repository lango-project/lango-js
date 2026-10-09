# Lango executable examples

Each example fixes one observable part of the language contract. Formatter
fixtures contain parseable source and its canonical form. Transpiler fixtures
contain an expected ES2022 module and a Node runtime assertion. A fixture may
include a minimal `.lango/runtime.mjs` test double; its helper names are a
compiler-output detail, never Lango source API.

Add a fixture when accepting a new decision or when implementing an existing
one. Example names start with a stable numeric prefix so test discovery and
review order remain deterministic.

`103-promises` covers ordinary `then`, `catch`, and returned Promise chains.
`096-decimals` covers dollar bindings and six-place Decimal division.
`098-xml` covers validated multiline XML and escaped interpolation.
`099-import-globals` covers explicitly exported globals and import aliases.
`100-module-cycles` covers permitted function-only module cycles.
`101-js-boundary` covers explicit Decimal conversion at a JavaScript boundary.
`102-namespace-statement` covers a discarded JavaScript namespace call.
`093-formatter` covers canonical blank lines and inline comments.
`105-transactions` covers the core transaction state and outer commit flow.
`106-sql-query` covers a bound SQL query and current-row access.
`107-query-results` covers affected rows and a generated insert key.
`108-sql-errors` covers the fields exposed by a database failure.
`109-database-configuration` covers host-selected default database setup.
`110-failed-transaction` covers an adapter-reported failed transaction.
`111-returning` covers result rows returned from an insert.
`112-decimal-sql` covers Decimal parameter binding.
`113-decimal-assignment` covers Decimal arithmetic in a dollar binding.
`114-sql-parameters` covers parameter recognition in SQL source.
`115-sql-interpolation` covers deliberate raw SQL interpolation.
`116-postgres-casts` covers colon parameters next to PostgreSQL casts.
`117-decimal-literals` covers explicit Decimal numeric values.
`118-nested-expressions` covers an operator inside a function argument.
`119-nested-arguments` covers commas in nested arguments.
`120-operator-order` covers left-to-right arithmetic chains.
