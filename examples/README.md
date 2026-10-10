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
`121-parentheses` covers explicit arithmetic grouping.
`122-negative-numbers` covers unary minus.
`123-inclusive-comparisons` covers inclusive comparisons.
`124-decimal-comparisons` covers precision-safe Decimal comparisons.
`125-decimal-equality` covers precision-safe equality for compound Decimal expressions.
`126-not-equal` covers strict and Decimal inequality.
`127-remainder` covers native and Decimal remainder.
`128-exponentiation` covers native and Decimal exponentiation.
`129-compound-decimal-arithmetic` covers Decimal arithmetic with two compound operands.
`130-decimal-return-inference` covers nested Decimal function-return inference.
`131-null-coalescing` covers fallback values for `null`.
`132-membership` covers membership in arrays and strings.
`133-not-membership` covers negated array and string membership.
`134-object-membership` covers own-key membership in objects.
`135-inline-objects` covers compact and nested object literals.
`136-quoted-object-keys` covers object keys containing spaces.
`137-duplicate-object-keys` covers compile-time duplicate-key detection.
`138-decimal-null-coalescing` covers Decimal returns through `??`.
`140-set-membership` covers host `Set` membership.
`141-map-membership` covers host `Map` key membership.
`142-map-iteration` covers key-value iteration over host `Map` values.
`143-optional-properties` covers null-safe nested property access.
`144-optional-indexing` covers null-safe array indexing.
`145-optional-methods` covers null-safe method calls.
`146-computed-indexing` covers expression-based array and object indexing.
`147-chained-indexing` covers nested array and object indexing.
`148-optional-chained-indexing` covers null-safe nested indexing.
`149-indexed-members` covers properties and methods after indexed values.
`150-call-result-members` covers properties and methods after call results.
`151-call-result-indexing` covers indexing after function and method results.
`152-chained-call-result-access` covers nested safe access after call results.
`153-compound-assignment` covers compound numeric updates and decrement.
`154-postfix-updates` covers postfix updates for properties and Decimal bindings.
`155-indexed-assignment` covers indexed assignment and numeric updates.
`156-multidimensional-assignment` covers nested indexed updates.
`157-property-indexed-assignment` covers updates through an object collection property.
`158-iterable-expressions` covers `for` loops over properties, indexes, and call results.
`159-array-key-value-iteration` covers numeric array indexes in `key: value` loops.
`160-string-key-value-iteration` covers numeric string indexes in `key: value` loops.
`161-set-key-value-iteration` covers matching key-value pairs from host `Set` values.
`162-range` covers end-exclusive integer range iteration.
`163-range-step` covers stepped and descending integer ranges.
`164-range-end` covers the zero-based `range(end)` shorthand.
`165-iterable-key-value-iteration` covers numeric indexes for generic iterables.
`166-array-add-receivers` covers `Array#add()` on property and host array values.
