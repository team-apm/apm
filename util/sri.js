// > yarn sri "C:\path\to\some.file"

const ssri = require('ssri');
const fs = require('fs-extra');

(async () => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('A pass is required.');
    return;
  }
  const readStream = fs.createReadStream(args[0]);
  const str = await ssri.fromStream(readStream, {
    algorithms: ['sha384'],
  });
  console.log(str.toString());
  readStream.destroy();
})();
