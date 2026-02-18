const fs = require('fs');
const content = fs.readFileSync('src/App.tsx', 'utf-8');

for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const code = content.charCodeAt(i);
    if (code > 127) {
        // Log non-ASCII characters and their positions
        console.log(`Pos ${i}, Line ${content.substring(0, i).split('\n').length}: Char ${char} (0x${code.toString(16)})`);
    }
}
