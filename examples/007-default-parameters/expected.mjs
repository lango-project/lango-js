import {
    println as __println,
} from "./.lango/runtime.mjs";

function greet(name, prefix = "Hello") {
    return `${prefix}, ${name}`;
    return null;
}

export function main(args) {
    __println(greet("Savaş"));
    __println(greet("Savaş", "Merhaba"));
    return null;
}
//# sourceMappingURL=main.mjs.map
