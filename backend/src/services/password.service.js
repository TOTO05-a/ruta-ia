const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

async function hashPassword(password) {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
    return `scrypt$16384$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

async function verifyPassword(password, stored) {
    const [algorithm, n, r, p, saltHex, hashHex] = String(stored).split("$");
    if (algorithm !== "scrypt" || n !== "16384" || r !== "8" || p !== "1" || !/^[a-f0-9]{32}$/.test(saltHex || "") || !/^[a-f0-9]{128}$/.test(hashHex || "")) {
        return false;
    }
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LENGTH, { N: 16384, r: 8, p: 1 });
    return timingSafeEqual(actual, Buffer.from(hashHex, "hex"));
}

module.exports = { hashPassword, verifyPassword };
