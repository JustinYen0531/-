const path = require('path');
const PptxGenJS = require('pptxgenjs');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Yan Xingcheng';
pptx.company = 'Mine Chess';
pptx.subject = '校內申請作品集';
pptx.title = 'Mine Chess 校內申請作品集';
pptx.lang = 'zh-TW';
pptx.theme = {
  headFontFace: 'Microsoft JhengHei',
  bodyFontFace: 'Microsoft JhengHei',
  lang: 'zh-TW'
};

const C = {
  primary: '1F4E79',
  accent: '3FA7D6',
  text: '1A1A1A',
  soft: 'EEF3F8',
  white: 'FFFFFF',
  ok: '1F9D55'
};

function base(slide, title, subtitle) {
  slide.background = { color: 'FFFFFF' };
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.55, fill: { color: C.primary }, line: { color: C.primary } });
  slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0.55, w: 13.33, h: 0.08, fill: { color: C.accent }, line: { color: C.accent } });
  slide.addText(title, { x: 0.65, y: 0.9, w: 9.5, h: 0.6, fontFace: 'Microsoft JhengHei', fontSize: 28, bold: true, color: C.text });
  if (subtitle) {
    slide.addText(subtitle, { x: 0.65, y: 1.45, w: 11.8, h: 0.4, fontFace: 'Microsoft JhengHei', fontSize: 14, color: '4B5563' });
  }
}

function bullets(slide, items, x=0.85, y=2.1, w=6.2, h=3.8) {
  const lines = items.map((s) => ({ text: s, options: { bullet: { indent: 18 } } }));
  slide.addText(lines, {
    x, y, w, h,
    fontFace: 'Microsoft JhengHei',
    fontSize: 20,
    color: C.text,
    paraSpaceAfterPt: 10,
    breakLine: true
  });
}

function imagePlaceholder(slide, x, y, w, h, label) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: C.soft },
    line: { color: 'C8D5E5', pt: 1.2, dash: 'dash' },
    radius: 0.08
  });
  slide.addText(label, { x: x+0.2, y: y+h/2-0.2, w: w-0.4, h: 0.4, align: 'center', fontFace: 'Microsoft JhengHei', fontSize: 14, color: '5B6B7A', bold: true });
}

// P1
let s = pptx.addSlide();
base(s, 'Mine Chess 地雷棋', '校內申請作品集簡報');
s.addText('結合地雷策略、進化系統與奪旗機制的回合制戰略遊戲', { x: 0.85, y: 2.15, w: 8.5, h: 0.8, fontFace: 'Microsoft JhengHei', fontSize: 22, color: C.primary, bold: true });
s.addText('申請者：閻星澄\n申請用途：校內作品審查', { x: 0.85, y: 3.1, w: 4.5, h: 1.1, fontFace: 'Microsoft JhengHei', fontSize: 16, color: C.text, valign: 'top' });
imagePlaceholder(s, 7.1, 2.1, 5.2, 3.9, 'Hero 截圖（請放最精彩戰局）');
s.addNotes('【講者備註】30 秒內先講這個作品解決了什麼、特色是什麼，讓評審先記住成果。');

// P2
s = pptx.addSlide();
base(s, '專案一句話', '為什麼做、給誰用、帶來什麼價值');
bullets(s, [
  '目的：打造一款兼具策略深度與可讀性的校園展示遊戲',
  '目標使用者：喜歡戰略與回合制玩法的學生族群',
  '核心價值：把「地雷不確定性」變成「可學習的策略決策」'
], 0.85, 2.05, 7.2, 3.0);
imagePlaceholder(s, 8.2, 2.0, 4.2, 3.7, '核心價值圖示/關鍵詞卡片');
s.addNotes('【講者備註】用一句話版本講完：這不是純運氣遊戲，而是可規劃、可反制、可演進的策略對戰。');

// P3
s = pptx.addSlide();
base(s, '成果總覽', '三個最強賣點');
const cards = [
  ['玩法差異化', '地雷 + 奪旗 + 進化\n機制互相牽制，對局變化高'],
  ['功能完成度', '單位職能、AI 對戰、多語系\n與核心回合流程已可運行'],
  ['展示可讀性', 'UI 分層清楚、資訊密度可控\n適合評審快速理解']
];
for (let i = 0; i < cards.length; i++) {
  const x = 0.9 + i * 4.15;
  s.addShape(pptx.ShapeType.roundRect, { x, y: 2.15, w: 3.9, h: 3.0, fill: { color: C.soft }, line: { color: 'D6E2EF' }, radius: 0.08 });
  s.addText(cards[i][0], { x: x+0.2, y: 2.4, w: 3.5, h: 0.4, bold: true, fontFace: 'Microsoft JhengHei', fontSize: 19, color: C.primary, align: 'center' });
  s.addText(cards[i][1], { x: x+0.25, y: 3.0, w: 3.4, h: 1.7, fontFace: 'Microsoft JhengHei', fontSize: 14, color: C.text, align: 'center', valign: 'mid' });
}
s.addNotes('【講者備註】這頁不談細節，只讓評審知道你交出的成果有差異、有完整度、有可展示性。');

// P4 gameplay flow
s = pptx.addSlide();
base(s, '核心玩法流程', '開始 → 佈陣 → 行動/博弈 → 勝負回饋');
const flow = ['開始對局', '佈陣與放置初始地雷', '回合制行動（移動/攻擊/技能）', '奪旗成功或關鍵擊破', '結算與策略回顧'];
for (let i = 0; i < flow.length; i++) {
  const x = 0.8 + i * 2.45;
  s.addShape(pptx.ShapeType.roundRect, { x, y: 2.55, w: 2.15, h: 1.2, fill: { color: i%2===0 ? 'EAF2FB' : 'F5FAFE' }, line: { color: 'BFD3E8' }, radius: 0.06 });
  s.addText(flow[i], { x: x+0.12, y: 2.8, w: 1.9, h: 0.7, align: 'center', fontFace: 'Microsoft JhengHei', fontSize: 12, color: C.text });
  if (i < flow.length - 1) {
    s.addShape(pptx.ShapeType.chevron, { x: x+2.2, y: 2.93, w: 0.25, h: 0.42, fill: { color: C.accent }, line: { color: C.accent } });
  }
}
imagePlaceholder(s, 0.8, 4.25, 11.6, 1.6, '可放一張「流程對應的實際戰鬥畫面」');
s.addNotes('【講者備註】邊指流程邊講，重點是「玩家每一步都有可理解的策略選擇」。');

// P5 feature A
s = pptx.addSlide();
base(s, '代表功能 A：地雷情報與反制', '問題：地雷機制容易變成純運氣');
bullets(s, [
  '解法：設計掃描、拆彈、搬運等單位職能，讓玩家可主動反制',
  '成果：風險變成可管理資訊，不再只是踩中/沒踩中的隨機感',
  '價值：策略深度提升，對戰決策更有學習曲線'
], 0.85, 2.1, 6.8, 3.2);
imagePlaceholder(s, 7.9, 2.0, 4.3, 3.8, '功能 A 戰鬥截圖（掃雷/反制）');
s.addNotes('【講者備註】這頁用「問題→設計→效果」講法，評審會快速感受到你在做產品思考。');

// P6 feature B
s = pptx.addSlide();
base(s, '代表功能 B：進化系統', '讓同一單位在不同局勢有不同成長策略');
bullets(s, [
  '設計：每個單位具備兩條進化路線，對應不同戰局需求',
  '使用者好處：降低重複感，增加中後期決策層次',
  '成果：同樣開局可導向不同打法，提升重玩性'
], 0.85, 2.1, 6.9, 3.3);
imagePlaceholder(s, 7.9, 2.0, 4.3, 3.8, '功能 B 截圖（進化樹/UI）');
s.addNotes('【講者備註】強調「可重玩性」與「策略分歧」，這是校內評審常會加分的點。');

// P7 tech
s = pptx.addSlide();
base(s, '技術實作精華', '不只做畫面，也有完整工程結構');

s.addShape(pptx.ShapeType.roundRect, { x: 0.9, y: 2.0, w: 4.8, h: 3.8, fill: { color: C.soft }, line: { color: 'D4E0ED' }, radius: 0.08 });
s.addText('技術棧\nReact 18 / TypeScript / Vite / Tailwind CSS', { x: 1.15, y: 2.35, w: 4.3, h: 1.0, fontFace: 'Microsoft JhengHei', fontSize: 15, color: C.text, align: 'center', bold: true });
s.addText('關鍵模組\n- gameEngine.ts（規則與戰鬥計算）\n- useGameAI.ts（AI 行動邏輯）\n- useGameLoop.ts（回合循環與控制）', { x: 1.15, y: 3.35, w: 4.25, h: 1.9, fontFace: 'Microsoft JhengHei', fontSize: 12, color: C.text });

s.addShape(pptx.ShapeType.roundRect, { x: 6.2, y: 2.0, w: 6.1, h: 3.8, fill: { color: 'F7FAFD' }, line: { color: 'D4E0ED' }, radius: 0.08 });
s.addText('架構簡圖（UI → Hooks → Engine）', { x: 6.45, y: 2.25, w: 5.6, h: 0.4, fontFace: 'Microsoft JhengHei', fontSize: 14, bold: true, color: C.primary, align: 'center' });
const blocks = [
  ['UI Components', 6.55, 2.95],
  ['Game Hooks', 8.55, 2.95],
  ['Core Engine', 10.55, 2.95]
];
blocks.forEach(([t, x, y]) => {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w: 1.7, h: 0.9, fill: { color: 'EAF2FB' }, line: { color: 'C3D7EA' }, radius: 0.05 });
  s.addText(String(t), { x, y: Number(y)+0.28, w: 1.7, h: 0.3, align: 'center', fontFace: 'Microsoft JhengHei', fontSize: 11, color: C.text, bold: true });
});
s.addShape(pptx.ShapeType.line, { x: 8.25, y: 3.4, w: 0.28, h: 0, line: { color: C.accent, pt: 2, beginArrowType: 'none', endArrowType: 'triangle' } });
s.addShape(pptx.ShapeType.line, { x: 10.25, y: 3.4, w: 0.28, h: 0, line: { color: C.accent, pt: 2, beginArrowType: 'none', endArrowType: 'triangle' } });
s.addNotes('【講者備註】你可把這頁重點放在「我負責讓規則穩定、流程可維護、對戰可擴充」。');

// P8 challenges
s = pptx.addSlide();
base(s, '挑戰與解法', '用工程思維把複雜系統做穩');
const challengeCards = [
  {
    title: '挑戰 1：地雷資訊與公平性',
    body: '問題：地雷若過度隱藏，玩家會感到無力。\n嘗試：只靠提示特效，但資訊不足。\n最終解法：加入掃描/拆彈職能，建立可反制路徑。'
  },
  {
    title: '挑戰 2：回合流程與 AI 決策',
    body: '問題：回合狀態多，容易出現判定衝突。\n嘗試：將邏輯分散在 UI，維護困難。\n最終解法：集中在 hooks + engine 分層，降低耦合。'
  }
];
for (let i = 0; i < challengeCards.length; i++) {
  const x = 0.9 + i * 6.25;
  s.addShape(pptx.ShapeType.roundRect, { x, y: 2.15, w: 5.75, h: 3.9, fill: { color: C.soft }, line: { color: 'D4E0ED' }, radius: 0.08 });
  s.addText(challengeCards[i].title, { x: x+0.2, y: 2.4, w: 5.35, h: 0.5, fontFace: 'Microsoft JhengHei', fontSize: 16, bold: true, color: C.primary });
  s.addText(challengeCards[i].body, { x: x+0.2, y: 3.0, w: 5.3, h: 2.8, fontFace: 'Microsoft JhengHei', fontSize: 12, color: C.text, breakLine: true });
}
s.addNotes('【講者備註】這頁是加分頁，證明你是「會診斷問題、會做取捨」的人。');

// P9 outcomes
s = pptx.addSlide();
base(s, '成果與反饋', '可量化成果 + 使用者感受');

const metric = [
  ['核心單位職能', '5 種'],
  ['主要進化路線', '2 條/單位'],
  ['語言支援', '繁中/簡中/英文'],
  ['核心模式', 'PvP + PvE(AI)']
];
for (let i = 0; i < metric.length; i++) {
  const row = Math.floor(i / 2);
  const col = i % 2;
  const x = 0.95 + col * 3.35;
  const y = 2.1 + row * 1.8;
  s.addShape(pptx.ShapeType.roundRect, { x, y, w: 3.05, h: 1.35, fill: { color: 'F2F8FF' }, line: { color: 'C8DDF2' }, radius: 0.06 });
  s.addText(metric[i][0], { x: x+0.2, y: y+0.25, w: 2.65, h: 0.4, fontFace: 'Microsoft JhengHei', fontSize: 12, color: '4C5D70', align: 'center' });
  s.addText(metric[i][1], { x: x+0.2, y: y+0.68, w: 2.65, h: 0.5, fontFace: 'Microsoft JhengHei', fontSize: 20, bold: true, color: C.primary, align: 'center' });
}

s.addShape(pptx.ShapeType.roundRect, { x: 7.9, y: 2.1, w: 4.3, h: 3.95, fill: { color: 'F8FCF9' }, line: { color: 'D2ECDD' }, radius: 0.06 });
s.addText('回饋摘錄（可替換）', { x: 8.1, y: 2.35, w: 3.9, h: 0.4, fontFace: 'Microsoft JhengHei', fontSize: 14, bold: true, color: C.ok, align: 'center' });
s.addText('「玩法有策略深度，不只是踩地雷運氣。」\n「進化與奪旗讓戰局很有張力。」\n「介面資訊清楚，觀戰也看得懂。」', { x: 8.15, y: 2.95, w: 3.85, h: 2.75, fontFace: 'Microsoft JhengHei', fontSize: 12, color: C.text, breakLine: true, valign: 'mid' });
s.addNotes('【講者備註】如果目前沒有正式問卷，先用測試觀察回饋，之後可替換成真實數據。');

// P10 close
s = pptx.addSlide();
base(s, '總結與下一步', '我不只完成作品，也建立了可持續迭代能力');

bullets(s, [
  '這次收穫：把複雜規則轉為可維護的程式結構與可理解的玩家體驗',
  '能力證明：需求拆解、機制設計、工程落地、迭代優化',
  '下一步：平衡性調校、更多關卡/地圖、使用者測試與數據化評估'
], 0.9, 2.1, 8.2, 3.4);

s.addShape(pptx.ShapeType.roundRect, { x: 9.4, y: 2.15, w: 2.85, h: 3.45, fill: { color: C.primary }, line: { color: C.primary }, radius: 0.08 });
s.addText('Q&A', { x: 9.7, y: 3.25, w: 2.25, h: 0.8, fontFace: 'Microsoft JhengHei', fontSize: 44, bold: true, color: C.white, align: 'center' });
s.addNotes('【講者備註】最後一句可固定為：「謝謝老師，我很期待把這套系統發展成更完整的作品。」');

const out = path.resolve(process.cwd(), 'MineChess_校內申請作品集_v1.pptx');
pptx.writeFile({ fileName: out }).then(() => {
  console.log('PPT generated:', out);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
