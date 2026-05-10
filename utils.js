
function greet(name) {
    try {
        if (typeof name !== 'string' || !name.trim()) {
            return 'Hello, Guest!';
        }
        const trimmed = name.trim();
        if (trimmed.length > 100) {
            return `Hello, ${trimmed.substring(0, 100)}...!`;
        }
        return `Hello, ${trimmed}!`;
    } catch (error) {
        return 'Hello, Guest!';
    }
}

module.exports = { greet };
