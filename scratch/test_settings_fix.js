const fs = require('fs');
const vm = require('vm');

const content = fs.readFileSync('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/frontend_updated/frontend/www/settings.html', 'utf8');
const scriptMatch = content.match(/<script type="module">([\s\S]*?)<\/script>/i);
const code = scriptMatch[1];

const lines = code.split('\n');
console.log('Line 231:', lines[231]);
console.log('Line 232:', lines[232]);

lines.splice(231, 2); // delete lines 231 and 232 (0-indexed)
const fixedCode = lines.join('\n');

try {
  new vm.SourceTextModule(fixedCode);
  console.log('SUCCESS: settings.html script parsed cleanly with zero syntax errors!');
} catch (err) {
  console.error('PARSE FAILED:', err);
}
