// TypeScript 4's legacy Node resolution does not follow package subpath exports.
// Keep runtime imports on the public API while using the shipped declarations.
declare module 'crustacean-sprite-lib/webgl' {
  export * from 'crustacean-sprite-lib/dist/webgl';
}

declare module 'crustacean-sprite-lib/load' {
  export * from 'crustacean-sprite-lib/dist/load';
}
