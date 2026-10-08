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
