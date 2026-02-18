const fs = require('fs');
const path = 'src/components/ControlPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

// Helper to replace action button patterns
function fixButton(mode, activeColor, inactiveColor) {
    const regex = new RegExp(`class(Name)?={\`([^\`]*?targetMode === ['"]${mode}['"][^\`]*?)\\? (['"]bg-[^'"]+['"]\\s*:\\s*['"]bg-slate-700[^'"]+['"])\`}`, 'g');
    content = content.replace(regex, (match, p1, p2) => {
        return `className={\`${p2} ? 'bg-${activeColor}-600 shadow-lg shadow-${activeColor}-500/50 scale-105 border-${activeColor}-400 text-white' : 'bg-${inactiveColor}-900/40 hover:bg-${inactiveColor}-800/60 border-${inactiveColor}-800/50 text-${inactiveColor}-100/70'\`}`;
    });
}

// Fix buttons with targetMode logic
fixButton('move', 'emerald', 'emerald');
fixButton('attack', 'red', 'red');
fixButton('scan', 'blue', 'blue');
fixButton('disarm', 'amber', 'amber');
fixButton('place_mine', 'purple', 'purple');
fixButton('throw_mine', 'purple', 'purple');

// Special cases for static buttons (those without a complex ternary in the className)
// Place Tower
content = content.replace(/<button onClick=\{\(\) => handlePlaceTowerAction\(unit, unit\.r, unit\.c\)\} className="w-\[74px\] h-\[74px\] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">/g,
    '<button onClick={() => handlePlaceTowerAction(unit, unit.r, unit.c)} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-blue-900/40 hover:bg-blue-800/60 border-blue-800/50 text-blue-100/70">');

// Place Hub
content = content.replace(/<button onClick=\{\(\) => handlePlaceHubAction\(unit, unit\.r, unit\.c\)\} className="w-\[74px\] h-\[74px\] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-slate-700 hover:bg-slate-600 border-slate-600 text-slate-300">/g,
    '<button onClick={() => handlePlaceHubAction(unit, unit.r, unit.c)} className="w-[74px] h-[74px] p-1 rounded flex flex-col items-center justify-center gap-1 transition-all relative font-bold border-2 bg-indigo-900/40 hover:bg-indigo-800/60 border-indigo-800/50 text-indigo-100/70">');

// Pickup Mine & Place Setup Mine
content = content.replace(/bg-slate-700 border-slate-600 hover:bg-slate-600[^"]*?text-slate-300/g, (match) => {
    if (match.includes('hover:border-purple-500')) return 'bg-purple-900/40 border-purple-800/50 hover:bg-purple-800/60 text-purple-100/70'; // setup mine
    return 'bg-yellow-900/40 border-yellow-800/50 hover:bg-yellow-800/60 text-yellow-100/70'; // default faded yellow
});

// Pickup Flag / Drop Flag / Drop Mine (those using bg-yellow-600/70)
content = content.replace(/bg-yellow-600\/70 hover:bg-yellow-600 border-2 border-yellow-500/g,
    'bg-yellow-900/40 hover:bg-yellow-800/60 border-2 border-yellow-800/50 text-yellow-100/70 font-bold');

// End Turn
content = content.replace(/bg-slate-700 hover:bg-slate-600 border-slate-600 hover:border-emerald-500 text-white/g,
    'bg-slate-900/60 hover:bg-slate-800/80 border-slate-700 hover:border-emerald-500 text-slate-400');

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully updated button styles');
