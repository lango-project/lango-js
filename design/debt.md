# Lango Design Debt

This is the list of intentionally unresolved language and implementation work.
Items belong here until an explicit decision moves them to `decisions.md`.

## Language semantics

## JavaScript interoperability

### Advanced database connections and transactions

Design a separate library for explicit connection selection, multiple databases,
pooling, SQL savepoints, and independent transactions. The core library has one
contextual default connection and join-only nested transactions (D-054).

### Embedded XML lexical and escaping rules

Define how XML literals are distinguished from `<`, `>`, and related operators;
which XML forms are accepted; and how interpolated text and attributes are
escaped. Decide whether parsing produces only validated text or an XML value
with query/manipulation operations.

### Macro evaluation and generated source

Define the compile-time expression subset available inside macros, macro
parameters and bindings, `IF` behavior, escaping and validation for `PASTE`,
hygiene/name-capture rules, source-map provenance, and expansion diagnostics.
Decide whether a macro may call an imported runtime function (presumably no)
and whether generated source may contain tests or translation texts. The
16-round limit applies to macro expansion only, never to resolving module cycles.

## Tooling

### Establish executable examples

Every accepted decision should gain at least one Lango input, expected JavaScript
output, and a runtime assertion. Start with parsing/formatting fixtures before
the full transpiler exists.

### Diagnostics and formatting

Define error spans, recovery behavior, error codes, formatter output, and the
policy for comments, blank lines, and line continuation.

### Test execution model

Specify test discovery order, test isolation, setup/teardown, assertion error
format, filtering, coverage, async tests, and how tests interact with imports,
macros, context, and production build output.
