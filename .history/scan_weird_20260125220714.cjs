const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');

const regex = /[^\x00-\x7F\u4E00-\u9FFF\u3000-\u303F\uFF00-\uFFEF]/g;
let match;
while ((match = regex.exec(content)) !== null) {
    const char = match[0];
    const code = char.charCodeAt(0);
    const line = content.substring(0, match.index).split('\n').length;
    console.log(`Line ${line}: Char ${char} (0x${code.toString(16)})`);
}
