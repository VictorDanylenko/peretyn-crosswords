import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = name => fs.readFileSync(new URL('src/'+name,root),'utf8');
const modules = ['generator.js','pdf.js','app.js'];
const files = ['index.html','style.css','mark.svg',...modules];

fs.mkdirSync(new URL('dist/',root),{recursive:true});
for (const file of files) {
  fs.copyFileSync(new URL('src/'+file,root),new URL('dist/'+file,root));
}
// Retire the example dictionary from older incremental builds.
fs.rmSync(new URL('dist/data.js',root),{force:true});

const script = modules.map(file => read(file)
  .replace(/^import[^\n]*\n/gm,'')
  .replace(/\bexport\s+(?=(?:async\s+)?(?:const|function|class))/g,'')).join('\n');
const mark = 'data:image/svg+xml;base64,'+Buffer.from(read('mark.svg')).toString('base64');
const offline = read('index.html')
  .replaceAll('./mark.svg',mark)
  .replace('<link rel="stylesheet" href="./style.css">',() => '<style>'+read('style.css')+'</style>')
  .replace('<script type="module" src="./app.js"></script>',() => '<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script>');
fs.writeFileSync(new URL('peretyn.html',root),offline);
console.log('Static site and offline HTML ready in '+fileURLToPath(root));
