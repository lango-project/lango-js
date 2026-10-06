import {
    println as __println,
    requireArity as __requireArity,
} from "./.lango/runtime.mjs";

function greet(name, prefix = "Hello") {
    __requireArity(arguments.length, [0], "greet");
    return `${prefix}, ${name}`;
    return null;
}

export function main(args) {
    __requireArity(arguments.length, [0], "main");
    __println(greet("Savaş"));
    __println(greet("Savaş", "Merhaba"));
    return null;
}
//# sourceMappingURL=main.mjs.map
