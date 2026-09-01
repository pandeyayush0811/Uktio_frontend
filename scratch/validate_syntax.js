const fs = require('fs');
const path = require('path');
const vm = require('vm');

const wwwDir = 'c:/Users/pande/OneDrive/Desktop/Safe Version/v2/frontend_updated/frontend/www';
const files = fs.readdirSync(wwwDir).filter(f => f.endsWith('.html'));

console.log('Validating HTML scripts in www/ (stripping comments)...');
let errCount = 0;
files.forEach(file => {
  let content = fs.readFileSync(path.join(wwwDir, file), 'utf8');
  content = content.replace(/<!--[\s\S]*?-->/g, ''); // strip HTML comments
  const scripts = [...content.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((match, idx) => {
    const fullTag = match[0];
    const isModule = fullTag.includes('type="module"') || fullTag.includes("type='module'");
    const code = match[1];
    if (!code.trim()) return;
    try {
      if (isModule) {
        new vm.SourceTextModule(code);
      } else {
        new vm.Script(code);
      }
      console.log(`[PASS] ${file} (script #${idx}, module=${isModule})`);
    } catch (err) {
      errCount++;
      console.error(`\n[FAIL] SYNTAX ERROR in ${file} (script #${idx}):\n${err.stack}\n`);
    }
  });
});

console.log(`\nFinished script validation. Total errors: ${errCount}`);
