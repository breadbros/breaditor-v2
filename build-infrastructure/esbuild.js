const esbuild = require('esbuild');
const copyPlugin = require('esbuild-plugin-copy');
const copyStaticFiles = require('esbuild-copy-static-files');
const cssModulesPlugin = require('esbuild-css-modules-plugin');
const child_process = require('child_process');

console.log('CWD:', process.cwd());

/*
// Run tsc to check for type errors
const tsc = child_process.spawnSync(
  'tsc',
  ['--noEmit', '--project tsconfig.json'],
  {
    stdio: 'inherit',
  },
);

// If there were errors, log an error message and exit with an error code
if (tsc.status !== 0) {
  console.error(
    'TypeScript compilation failed, please fix errors before building with esbuild',
  );
  console.error('OUT:', tsc.stdout);
  console.error('ERR:', tsc.stderr);
  process.exit(1);
}
*/

// TODO: make these settable from args
const sourcemap = true;
const analyze = !process.argv.includes("--quiet");
const watch = false;
const minify = false;

(async () => {

  /// server translation
  const result = await esbuild
    .build({
      tsconfig: 'tsconfig.json',

      // logLevel: 'verbose',

      bundle: true,
      sourcemap,
      minify,
      watch,
      metafile: true,
      platform: 'node',
      entryPoints: ['src/main/main.ts'],
      outfile: 'dist/main/main.js',
      external: ['electron'],
      plugins: [
        copyPlugin.copy({
          resolveFrom: 'cwd',
          assets: {
            from: ['src/main/preload/*.js'],
            to: ['dist/app/'],
          },
          verbose: analyze,
          // Copy 'src/main/preload.js' to 'dist/static/preload.js'
          //'src/main/preload.js': 'dist/static/preload.js',
        }),
      ],
    })
    .catch(function () {
      return process.exit(1);
    });

  if (analyze) console.log(await esbuild.analyzeMetafile(result.metafile));
})();

(async () => {
  /// client translation
  const result = await esbuild
    .build({
      tsconfig: 'tsconfig.json',

      // logLevel: 'verbose',

      bundle: true,
      sourcemap,
      minify,
      watch,
      metafile: true,
      platform: 'browser',
      entryPoints: ['src/app/index.tsx'],
      outfile: 'dist/app/index.js',
      plugins: [
        copyStaticFiles({
          src: 'src/app/index.html',
          dest: 'dist/app/index.html',
        }),
        cssModulesPlugin(),
      ],
      // plugins: [
      //   extensionResolverPlugin(['coffee', 'jadelet']),
      //   coffeeScriptPlugin({
      //     bare: true,
      //     inlineMap: sourcemap,
      //   }),
      // ],
    })
    .catch(function () {
      return process.exit(2);
    });

  if (analyze) console.log(await esbuild.analyzeMetafile(result.metafile));
})();
