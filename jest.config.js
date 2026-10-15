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
    "^crustacean-map-lib$": "<rootDir>/node_modules/crustacean-map-lib/dist/mod.js",
    "^crustacean-map-lib/webgl$": "<rootDir>/node_modules/crustacean-map-lib/dist/webgl.js",
    "^crustacean-sprite-lib$": "<rootDir>/node_modules/crustacean-sprite-lib/dist/mod.js",
    "^crustacean-sprite-lib/(webgl|load)$": "<rootDir>/node_modules/crustacean-sprite-lib/dist/$1.js",
    "^shared/(.*)$": "<rootDir>/src/shared/$1",
    "^app/(.*)$": "<rootDir>/src/app/$1",
    "^main/(.*)$": "<rootDir>/src/main/$1",
  },
  transformIgnorePatterns: ["node_modules[/\\\\](?!crustacean-(?:sprite|map)-lib[/\\\\])"],
  setupFiles: ["<rootDir>/test-infrastructure/globalInclude.js"],
};
