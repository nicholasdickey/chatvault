/** @type {import("jest").Config} */
module.exports = {
  globalSetup: "<rootDir>/src/test/jest-global-setup.cjs",
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["<rootDir>/src/**/*.test.ts"],
  testTimeout: 120000,
  rootDir: ".",
  /** Shared Postgres + truncate; parallel test files race and flake. */
  maxWorkers: 1,
};
