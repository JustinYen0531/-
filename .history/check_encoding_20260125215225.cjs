const fs = require('fs');

try {
    const buffer = fs.readFileSync('src/App.tsx');
    try {
        buffer.toString('utf-8');
        console.log('File is valid UTF-8');
    } catch (e) {
        console.log('File has invalid UTF-8');
    }
} catch (e) {
    console.error('Error reading file:', e);
}
