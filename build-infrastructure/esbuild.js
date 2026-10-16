const esbuild = require('esbuild');
const copyPlugin = require('esbuild-plugin-copy');
const copyStaticFiles = require('esbuild-copy-static-files');
const cssModulesPlugin = require('esbuild-css-modules-plugin');
const child_process = require('child_process');
const path = require('path');
const fs = require('fs');
const postcss = require('postcss');

const spriteLibrary = path.join(__dirname, '../node_modules/crustacean-sprite-lib');

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
  const monacoEntry = 'src/app/breaditor/documents/monacoRuntime.ts';
  // Small build-test fixtures do not include the Text Document runtime.
  if (fs.existsSync(monacoEntry)) {
    const monacoRoot = path.join(__dirname, '../node_modules/monaco-editor');
    try {
      const {default: postcssNesting} = await import('postcss-nesting');
      await esbuild.build({
        entryPoints: [monacoEntry],
        outfile: 'dist/app/monaco/monaco.js',
        bundle: true,
        platform: 'browser',
        format: 'iife',
        globalName: 'breaditorMonaco',
        target: 'es2020',
        minify: true,
        sourcemap,
        loader: {'.ttf': 'file'},
        // loadMonaco supplies explicit worker URLs; Monaco's default
        // import.meta worker factories are unused in this classic bundle.
        banner: {js: 'var breaditorMonacoModuleUrl = document.currentScript.src;'},
        define: {'import.meta.url': 'breaditorMonacoModuleUrl'},
        plugins: [{
          name: 'monaco-css-nesting',
          setup(build) {
            // Use the physical ESM entry so the runtime and this project's
            // older TypeScript resolver agree on Monaco's declarations.
            build.onResolve({filter: /^monaco-editor\/esm\/vs\/index$/}, () => ({
              path: path.join(monacoRoot, 'esm/vs/index.js'),
            }));
            // Electron 23's Chromium predates native CSS nesting.
            build.onLoad({filter: /\.css$/}, async ({path: filename}) => ({
              contents: (await postcss([postcssNesting()]).process(
                await fs.promises.readFile(filename, 'utf8'), {from: filename},
              )).css,
              loader: 'css',
              resolveDir: path.dirname(filename),
            }));
          },
        }],
      });
      await esbuild.build({
        entryPoints: Object.fromEntries([
          ['editor', 'editor/editor.worker.js'],
          ['json', 'language/json/json.worker.js'],
          ['ts', 'language/typescript/ts.worker.js'],
          ['css', 'language/css/css.worker.js'],
          ['html', 'language/html/html.worker.js'],
        ].map(([name, source]) => [`${name}.worker`, path.join(monacoRoot, 'esm/vs', source)])),
        outdir: 'dist/app/monaco',
        target: 'es2020',
        bundle: true,
        platform: 'browser',
        format: 'iife',
        minify: true,
        sourcemap,
      });
    } catch (error) {
      console.error('Monaco build failed:', error.message);
      process.exit(2);
    }
  }
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
        copyStaticFiles({
          src: path.join(spriteLibrary, 'assets/lord-stan'),
          dest: 'dist/app/assets/lord-stan',
        }),
        ...(fs.existsSync('src/app/breaditor/documents/MapDocumentView.tsx') ? [copyStaticFiles({
          src: 'assets/sully',
          dest: 'dist/app/assets/sully',
        })] : []),
        ...['ASSET-ATTRIBUTION.md', 'LICENSE'].map(file => copyStaticFiles({
          src: path.join(spriteLibrary, file),
          dest: path.join('dist/app/assets/lord-stan', file),
        })),
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
