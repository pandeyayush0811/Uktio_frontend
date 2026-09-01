const fs = require('fs');
const vm = require('vm');

const content = fs.readFileSync('c:/Users/pande/OneDrive/Desktop/Safe Version/v2/frontend_updated/frontend/www/settings.html', 'utf8');
const scriptMatch = content.match(/<script type="module">([\s\S]*?)<\/script>/i);
if (!scriptMatch) throw new Error('No module script found in settings.html');

const code = scriptMatch[1];
const lines = code.split('\n');

try {
  new vm.SourceTextModule(code);
  console.log('Parsed successfully!');
} catch (err) {
  console.error('PARSE FAILED: ' + err.message);
  console.log('Error stack:\n' + err.stack);
}
