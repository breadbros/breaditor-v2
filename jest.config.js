module.exports = {
  globals: {
    __TEST__: true,
    TextEncoder,
    TextDecoder,
    "ts-jest": {
      tsconfig: "tsconfig.json",
    },
  },
  cache: false,
  //testEnvironment: 'jsdom',
  transform: {
    ".+\\.(ts|tsx|js|jsx)$": "ts-jest",
    ".+\\.(css|styl|less|sass|scss)$": "jest-css-modules-transform",
  },
  moduleNameMapper: {
    "^shared/(.*)$": "<rootDir>/src/shared/$1",
    "^app/(.*)$": "<rootDir>/src/app/$1",
    "^main/(.*)$": "<rootDir>/src/main/$1",
  },
  setupFiles: ["<rootDir>/test-infrastructure/globalInclude.js"],
};
