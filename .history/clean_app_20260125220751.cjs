const fs = require('fs');
let buffer = fs.readFileSync('src/App.tsx');

// Check for BOM manually
if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    buffer = buffer.slice(3);
}

let content = buffer.toString('utf-8');

// Replace problematic ranges
// PUA: \uE000-\uF8FF
// control/junk: \u0080
content = content.replace(/[\uE000-\uF8FF\u0080]/g, ' ');

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log('Cleaned App.tsx of BOM and corrupted characters');
