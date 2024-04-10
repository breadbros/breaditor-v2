const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

console.log(process.cwd());

const srcDir = './src';
const destDir = './fuck-tsc';

function copyCssAndSvgFiles(sourceDir, destinationDir) {
  // Read the contents of the source directory
  const files = fs.readdirSync(sourceDir);

  // Iterate over each file in the source directory
  files.forEach((file) => {
    const filePath = path.join(sourceDir, file);
    const destPath = path.join(destinationDir, file);

    // Check if the file is a directory
    if (fs.statSync(filePath).isDirectory()) {
      // Recursively copy files in subdirectories
      mkdirp.sync(destPath);
      copyCssAndSvgFiles(filePath, destPath);
    } else {
      // Check if the file is a CSS file
      if (path.extname(file) === '.css' || path.extname(file) === '.svg') {
        // Create the destination directory if it does not exist
        mkdirp.sync(path.dirname(destPath));

        // Copy the file to the destination directory
        fs.copyFileSync(filePath, destPath);
        console.log(`${file} copied to ${destPath}`);
      }
    }
  });
}

copyCssAndSvgFiles(srcDir, destDir);
