// jest.polyfills.js
if (typeof DOMRect === "function" && !DOMRect.fromRect) {
  DOMRect.fromRect = function ({ x = 0, y = 0, width = 0, height = 0 } = {}) {
    return new DOMRect(x, y, width, height);
  };
}
