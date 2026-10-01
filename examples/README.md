# Lango executable examples

Each example fixes one observable part of the language contract. Formatter
fixtures contain parseable source and its canonical form. Transpiler fixtures
will add an expected ES2022 module and a runtime assertion once the core
JavaScript runtime-import surface is specified; they must not invent that
surface in a fixture.

Add a fixture when accepting a new decision or when implementing an existing
one. Example names start with a stable numeric prefix so test discovery and
review order remain deterministic.
