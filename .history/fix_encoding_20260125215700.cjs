const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Remove BOM
content = content.replace(/^\uFEFF/, '');

// Fix corrupted unit names in getUnitName
content = content.replace(/case UnitType\.GENERAL: return '撠\?';/, "case UnitType.GENERAL: return '將軍';");
content = content.replace(/case UnitType\.MINESWEEPER: return '\?';/, "case UnitType.MINESWEEPER: return '掃雷者';");
content = content.replace(/case UnitType\.RANGER: return '\?\?';/, "case UnitType.RANGER: return '遊俠';");
content = content.replace(/case UnitType\.MAKER: return '鋆賡';/, "case UnitType.MAKER: return '造雷者';");
content = content.replace(/case UnitType\.DEFUSER: return '閫\?';/, "case UnitType.DEFUSER: return '解雷者';");
content = content.replace(/default: return '\?芰';/, "default: return '未知';");

// Fix some corrupted comments for better readability (optional but good)
content = content.replace(/\/\/ \?\?\?\?謅\?\?選\?\?\?\?\?/, "// 隨機選擇初始位置");
content = content.replace(/\/\/ \?冽\?\?豢\? 5 \?\?嚗\?\?撟\?嚗\?/, "// 優先選擇 5 個位置");

fs.writeFileSync('src/App.tsx', content, 'utf-8');
console.log('Fixed BOM and corrupted strings in App.tsx');
