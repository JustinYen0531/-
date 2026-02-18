const fs = require('fs');
const path = 'src/components/ControlPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

// Updated regex to be more flexible with spaces and targetMode checks
function fixButtonFlex(mode, activeColor, inactiveColor) {
    const pattern = new RegExp(`targetMode\\s*===\\s*['"]${mode}['"]\\s*(&&\\s*!endTurnConfirm)?\\s*\\?\\s*['"]([^'"]+)['"]\\s*:\\s*['"]bg-slate-700[^'"]+['"]`, 'g');
    content = content.replace(pattern, (match, confirmPart) => {
        const confirm = confirmPart || '';
        return `targetMode === '${mode}' ${confirm} ? 'bg-${activeColor}-600 shadow-lg shadow-${activeColor}-500/50 scale-105 border-${activeColor}-400 text-white font-bold' : 'bg-${inactiveColor}-900/40 hover:bg-${inactiveColor}-800/60 border-${inactiveColor}-800/50 text-${inactiveColor}-100/70'`;
    });
}

// Fix buttons with various targetMode checks
fixButtonFlex('move', 'emerald', 'emerald');
fixButtonFlex('attack', 'red', 'red');
fixButtonFlex('scan', 'blue', 'blue');
fixButtonFlex('disarm', 'amber', 'amber');
fixButtonFlex('place_mine', 'purple', 'purple');
fixButtonFlex('throw_mine', 'purple', 'purple');

// Scan and Disarm might have been missed if they used cyan-600 before
content = content.replace(/targetMode\s*===\s*['"]scan['"]\s*&&\s*!endTurnConfirm\s*\?\s*['"]bg-cyan-600[^'"]+['"]\s*:\s*['"]bg-slate-700[^'"]+['"]/g,
    `targetMode === 'scan' && !endTurnConfirm ? 'bg-blue-600 shadow-lg shadow-blue-500/50 scale-105 border-blue-400 text-white font-bold' : 'bg-blue-900/40 hover:bg-blue-800/60 border-blue-800/50 text-blue-100/70'`);

content = content.replace(/targetMode\s*===\s*['"]disarm['"]\s*&&\s*!endTurnConfirm\s*\?\s*['"]bg-cyan-600[^'"]+['"]\s*:\s*['"]bg-slate-700[^'"]+['"]/g,
    `targetMode === 'disarm' && !endTurnConfirm ? 'bg-amber-600 shadow-lg shadow-amber-500/50 scale-105 border-amber-400 text-white font-bold' : 'bg-amber-900/40 hover:bg-amber-800/60 border-amber-800/50 text-amber-100/70'`);

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated button styles with flexible regex');
