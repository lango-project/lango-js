import {
    println as __println,
    requireBoolean as __requireBoolean,
} from "./.lango/runtime.mjs";

function sum_to(limit) {
    let number = 0;
    let total = 0;
    while (__requireBoolean(number < limit)) {
        total = total + number;
        number += 1;
    }
    return total;
    return null;
}

export function main(args) {
    __println(sum_to(5));
    return null;
}
//# sourceMappingURL=main.mjs.map
