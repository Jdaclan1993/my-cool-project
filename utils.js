
function greet(name) {
    if (typeof name !== 'string' || !name) {
        return 'Hello, Guest!';
    }
    return `Hello, ${name}!`;
}

module.exports = { greet };
