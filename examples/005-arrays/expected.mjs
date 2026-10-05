import {
    println as __println,
} from "./.lango/runtime.mjs";

function sum(values) {
    let total = 0;
    for (const value of values) {
        total = total + value;
    }
    return total;
    return null;
}

export function main(args) {
    let values = [2, 3, 5];
    values.push(7);
    __println(sum(values));
    return null;
}
//# sourceMappingURL=main.mjs.map
