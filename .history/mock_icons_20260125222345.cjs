import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace lucide-react import with a mock
const lucideImportRegex = /import \{([\s\S]*?)\} from 'lucide-react';/;
const match = content.match(lucideImportRegex);

if (match) {
    const icons = match[1].split(',').map(s => s.trim()).filter(Boolean);
    let mockContent = 'const IconMock = ({ size = 18, className = "" }) => <span className={className} style={{ display: "inline-block", width: size, height: size, background: "currentColor" }}></span>;\n';
    icons.forEach(icon => {
        mockContent += `const ${icon} = IconMock;\n`;
    });
    content = content.replace(lucideImportRegex, mockContent);
    fs.writeFileSync('src/App.tsx', content, 'utf-8');
    console.log('Lucide icons mocked.');
} else {
    console.log('Lucide import not found.');
}
