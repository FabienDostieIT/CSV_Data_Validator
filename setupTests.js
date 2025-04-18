// jest.setup.js

// Polyfill DOMRect.fromRect for Radix/Floating UI in Jest tests
if (typeof DOMRect === "function" && !DOMRect.fromRect) {
  DOMRect.fromRect = function ({ x = 0, y = 0, width = 0, height = 0 } = {}) {
    return new DOMRect(x, y, width, height);
  };
}

module.exports = {
  setupFilesAfterEnv: ["<rootDir>/setupTests.js"],
};
