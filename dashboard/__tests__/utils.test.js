const { greet } = require("../../utils");

test("greet with no argument returns Guest", () => {
  expect(greet()).toBe("Hello, Guest!");
});

test("greet with empty string returns Guest", () => {
  expect(greet("")).toBe("Hello, Guest!");
});

test("greet with name returns name", () => {
  expect(greet("julius")).toBe("Hello, julius!");
});

test("greet with whitespace-only returns Guest", () => {
  expect(greet("   ")).toBe("Hello, Guest!");
});

test("greet trims whitespace", () => {
  expect(greet("  julius  ")).toBe("Hello, julius!");
});

test("greet truncates names over 100 chars", () => {
  const long = "a".repeat(150);
  expect(greet(long)).toBe(`Hello, ${"a".repeat(100)}...!`);
});
