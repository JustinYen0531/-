const fs = require('fs');
const path = 'src/App.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split(/\r?\n/);
// Line 743 is index 742
lines[742] = "                    { turn: prev.turnCount, messageKey: 'log_placed_building', params: { type: '傳送道標' }, owner: unit.owner, type: 'info' as const },";
fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed line 743');
