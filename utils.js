/**
 * @param {string} [name]
 * @returns {string}
 */
function greet(name) {
    const s = typeof name === "string" ? name.trim() : "";
    if (!s) return "Hello, Guest!";
    if (s.length > 100) return `Hello, ${s.slice(0, 100)}...!`;
    return `Hello, ${s}!`;
}

module.exports = { greet };
