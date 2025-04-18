module.exports = {
<<<<<<< HEAD
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': 'ts-jest',
  },
=======
  testEnvironment: 'jsdom',
>>>>>>> be234e6 (chore: test and performance experiments (web worker, e2e, UI tweaks))
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json', 'node'],
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/setupTests.js'],
  testPathIgnorePatterns: ['<rootDir>/tests/e2e/'],
};
