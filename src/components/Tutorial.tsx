import React, { useState } from 'react';
import {
    X, ChevronLeft, ChevronRight, Bomb, Eye, Zap,
    Dna, Flag, Building2, Timer, Users, Swords, Sparkles
} from '../icons';
import { Language } from '../i18n';

interface TutorialProps {
    language: Language;
    onClose: () => void;
}

interface TutorialStep {
    id: string;
    icon: React.ReactNode;
    titleEn: string;
    titleZh: string;
    contentEn: string;
    contentZh: string;
    highlight?: 'concept' | 'pillar' | 'genre' | 'usp' | 'feature';
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        id: 'concept',
        icon: <Sparkles size={48} className="text-cyan-400" />,
        titleEn: 'Welcome to Mine Chess',
        titleZh: '歡迎來到地雷棋',
        contentEn: `Mine Chess is a 2-player strategic turn-based game that combines classic Minesweeper mechanics with tactical warfare.

Your goal: Carry YOUR flag into ENEMY territory!

⚠️ Critical Rule: If your General dies, you LOSE immediately!

The unique twist? Mines are not just obstacles — they are your weapons.`,
        contentZh: `地雷棋是一款雙人回合制策略遊戲，將經典踩地雷與戰術攻防完美融合。

你的目標：將「自己的旗幟」插到「敵方領土」！

⚠️ 關鍵規則：將軍死亡 = 立即敗北！

獨特之處？地雷不再只是障礙——它是你的武器。`,
        highlight: 'concept'
    },
    {
        id: 'units',
        icon: <Users size={48} className="text-purple-400" />,
        titleEn: 'Your Squad: 5 Unique Units',
        titleZh: '你的小隊：5 種特化職業',
        contentEn: `Each player controls a squad of 5 specialized units:

👑 General — ★CORE UNIT★ Can attack & carry flag. If killed, YOU LOSE!
👁️ Sweeper — Scans for hidden mines (3×3 area)
🏃 Ranger — Fast movement, can pick up & move mines
💣 Maker — Places various special mines
🛡️ Defuser — Tank with 50% mine damage reduction, can disarm

Protect your General at all costs!`,
        contentZh: `每位玩家控制由 5 種特化職業組成的小隊：

👑 將軍 — ★核心單位★ 能攻擊與搬旗。死亡 = 立即敗北！
👁️ 掃雷者 — 掃描隱藏地雷 (3×3 範圍)
🏃 遊俠 — 高機動、可撿放地雷
💣 製雷者 — 放置各類特殊地雷
🛡️ 解雷者 — 坦克型、50%地雷減傷、可拆除

不惜一切代價保護你的將軍！`,
        highlight: 'usp'
    },
    {
        id: 'energy',
        icon: <Zap size={48} className="text-yellow-400" />,
        titleEn: 'Energy Economy',
        titleZh: '能量經濟系統',
        contentEn: `Energy is the lifeblood of the game. Every action costs energy:

⚡ Moving, attacking, placing mines, scanning — all require energy
📊 Each unit has an energy cap per turn (33% of starting energy)
💰 Energy generates interest (1 per 10 energy, max 10)
⛏️ Mining ore and killing enemies give bonus energy

Manage wisely: Aggressive pushes drain fast, but hoarding may lose momentum!`,
        contentZh: `能量是遊戲的命脈。所有行動都需要消耗能量：

⚡ 移動、攻擊、放雷、掃描 — 全都需要能量
📊 每單位每回合有能量上限 (起始能量的 33%)
💰 能量會產生利息 (每 10 能量 +1，上限 10)
⛏️ 採礦與擊殺敵人可獲得額外能量

精打細算：激進推進會迅速耗盡，但過度保守可能錯失戰機！`,
        highlight: 'pillar'
    },
    {
        id: 'mines',
        icon: <Bomb size={48} className="text-red-400" />,
        titleEn: 'Mine Types',
        titleZh: '地雷種類',
        contentEn: `Mines are your tactical arsenal. Through evolution, unlock special types:

💥 Normal Mine — 8 damage, basic trap
🐌 Slow Mine — 3 damage, doubles enemy move cost
🌫️ Smoke Mine — 5 damage, creates 3×3 fog
⛓️ Chain Mine — 6 damage, triggers nearby normal mines
☢️ Nuke Mine — 12 damage, 3×3 proximity trigger (hits allies too!)

Place up to 5 mines on the board. Use them to control territory!`,
        contentZh: `地雷是你的戰術武器庫。透過進化解鎖特殊類型：

💥 普通雷 — 8 傷害，基礎陷阱
🐌 減速雷 — 3 傷害，敵人移動成本加倍
🌫️ 煙霧雷 — 5 傷害，產生 3×3 迷霧
⛓️ 連鎖雷 — 6 傷害，引爆周圍普通雷
☢️ 終極雷 — 12 傷害，3×3 接近觸發 (會傷到友軍！)

場上最多放置 5 顆地雷。善用它們來控制領土！`,
        highlight: 'feature'
    },
    {
        id: 'scanning',
        icon: <Eye size={48} className="text-green-400" />,
        titleEn: 'Mine Detection',
        titleZh: '地雷偵測',
        contentEn: `Enemy mines are hidden! Use your Sweeper to detect them:

🔍 Basic Scan — Reveals 3×3 area around Sweeper
📡 Sensor Scan (Evolution) — Shows mine COUNT in target 3×3 area
    (Classic Minesweeper style — you see the number, not positions!)
🏗️ Detection Tower (Evolution) — Permanent 3×3 scanning zone

Information is power. Scout before you march!`,
        contentZh: `敵方地雷是隱藏的！使用掃雷者來偵測：

🔍 基礎掃描 — 揭露掃雷者周圍 3×3 區域
📡 數值共振 (進化) — 顯示目標 3×3 區域的地雷「數量」
    (經典踩地雷風格 — 你看到數字，而非確切位置！)
🏗️ 偵測塔 (進化) — 永久 3×3 掃描區域

資訊就是力量。行軍前先偵查！`,
        highlight: 'feature'
    },
    {
        id: 'evolution',
        icon: <Dna size={48} className="text-indigo-400" />,
        titleEn: 'Evolution System',
        titleZh: '進化系統',
        contentEn: `Each unit has 2 evolution paths (A & B), each with 3 tiers:

🔬 Complete quests to unlock tiers (deal damage, place mines, etc.)
💎 Tier 3 splits into 2 exclusive variants — choose wisely!
👁️ Enemy can see your evolution choices — mind games begin!

Example: General Path A focuses on combat, Path B enhances flag aura.
Adapt your build to the battlefield situation!`,
        contentZh: `每個職業都有 2 條進化路線 (A 與 B)，每條 3 個等級：

🔬 完成任務以解鎖等級 (造成傷害、放置地雷等)
💎 第三級會分裂成 2 個互斥分支 — 謹慎選擇！
👁️ 敵人可以看到你的進化選擇 — 心理戰開始！

例如：將軍路徑 A 強化戰鬥，路徑 B 強化旗幟光環。
根據戰場狀況調整你的 Build！`,
        highlight: 'pillar'
    },
    {
        id: 'phases',
        icon: <Timer size={48} className="text-orange-400" />,
        titleEn: 'Turn Structure',
        titleZh: '回合結構',
        contentEn: `Each round has 3 phases:

📋 Placement Phase (45s) — Setup: Swap unit positions, place initial mines (max 3)
🧠 Thinking Phase (30s) — Plan: Observe battlefield, strategize
⚔️ Action Phase (15s/unit) — Execute: Move, attack, use abilities

Time pressure creates tension. Think fast, but don't panic!`,
        contentZh: `每個回合分為 3 個階段：

📋 佈陣階段 (45秒) — 準備：調整單位位置、放置初始地雷 (最多3顆)
🧠 思考階段 (30秒) — 規劃：觀察戰場、制定策略
⚔️ 行動階段 (每單位15秒) — 執行：移動、攻擊、使用技能

時間壓力創造緊張感。快速思考，但別慌張！`,
        highlight: 'feature'
    },
    {
        id: 'objective',
        icon: <Flag size={48} className="text-blue-400" />,
        titleEn: 'Victory Conditions',
        titleZh: '勝利條件',
        contentEn: `There are TWO ways to win:

🚀 Flag Capture — Carry YOUR flag into ENEMY territory!
   • Only General can carry the flag (unless evolved)
   • Carrying the flag increases move cost
   • If the carrier dies, the flag drops at that location

💀 Assassination — Kill the enemy General!
   • General death = immediate defeat for that player
   • Protect your General while hunting theirs

Balance offense and defense. One mistake can cost the game!`,
        contentZh: `有兩種勝利方式：

🚀 插旗勝利 — 將「自己的旗幟」插到「敵方領土」！
   • 只有將軍能搬旗 (除非進化解鎖)
   • 搬旗時移動成本增加
   • 持旗者陣亡後，旗幟掉落在該位置

💀 斜首勝利 — 擊殺敵方將軍！
   • 將軍死亡 = 該玩家立即敗北
   • 保護自己的將軍，獲獵敵方的

攻守平衡至關重要。一個失誤可能輸掉整場遊戲！`,
        highlight: 'pillar'
    },
    {
        id: 'buildings',
        icon: <Building2 size={48} className="text-teal-400" />,
        titleEn: 'Building System',
        titleZh: '建築系統',
        contentEn: `Unlock buildings through evolution to control the battlefield:

👁️ Detection Tower (Sweeper) — Reveals 3×3 area continuously
⚡ Energy Hub (Ranger) — Reduces move cost in 3×3 area, allows teleport
🏭 Factory (Maker) — Expands mine placement range, increases mine limit

Buildings create "territory". Enemy can dismantle them (costs 2 energy).
Strategic placement wins games!`,
        contentZh: `透過進化解鎖建築來控制戰場：

👁️ 偵測塔 (掃雷者) — 持續揭露 3×3 區域
⚡ 能量樞紐 (遊俠) — 降低 3×3 範圍內移動成本、可傳送
🏭 自動工坊 (製雷者) — 擴大放雷範圍、增加地雷上限

建築創造「領土」。敵人可以拆除它們 (消耗 2 能量)。
策略性佈置贏得勝利！`,
        highlight: 'usp'
    },
    {
        id: 'tips',
        icon: <Swords size={48} className="text-rose-400" />,
        titleEn: 'Pro Tips',
        titleZh: '進階技巧',
        contentEn: `Ready to dominate? Keep these in mind:

👑 Protect Your General — Their death means instant defeat!
🧠 Information War — Scout before you commit. Blind moves get punished.
💰 Economy Matters — Sometimes saving energy beats aggressive plays.
🎭 Read Your Opponent — Their evolution choices reveal their strategy.
🔄 Adapt Your Build — Don't follow a fixed path; react to the battlefield.

Now go conquer the minefield! Good luck, Commander! 🎮`,
        contentZh: `準備好稱霸戰場了嗎？記住這些：

👑 保護將軍 — 他的死亡意味著立即敗北！
🧠 資訊戰 — 行動前先偵查。盲目移動會被懲罰。
💰 經濟至上 — 有時存能量比激進進攻更明智。
🎭 解讀對手 — 他們的進化選擇揭露了策略。
🔄 靈活調整 — 別走固定路線，根據戰場反應。

現在去征服雷場吧！祝好運，指揮官！🎮`,
        highlight: 'concept'
    }
];

const Tutorial: React.FC<TutorialProps> = ({ language, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const step = TUTORIAL_STEPS[currentStep];

    const isZh = language === 'zh_tw' || language === 'zh_cn';

    const handlePrev = () => {
        if (currentStep > 0) setCurrentStep(currentStep - 1);
    };

    const handleNext = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) setCurrentStep(currentStep + 1);
    };

    const getHighlightColor = (type?: string) => {
        switch (type) {
            case 'concept': return 'from-cyan-500/20 to-purple-500/20 border-cyan-500/50';
            case 'pillar': return 'from-amber-500/20 to-orange-500/20 border-amber-500/50';
            case 'genre': return 'from-green-500/20 to-teal-500/20 border-green-500/50';
            case 'usp': return 'from-rose-500/20 to-pink-500/20 border-rose-500/50';
            case 'feature': return 'from-blue-500/20 to-indigo-500/20 border-blue-500/50';
            default: return 'from-slate-500/20 to-slate-600/20 border-slate-500/50';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center backdrop-blur-xl p-4">
            <div className="relative w-full max-w-4xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 text-slate-400 hover:text-white bg-slate-800/80 rounded-full hover:bg-slate-700 transition-colors z-20"
                >
                    <X size={24} />
                </button>

                {/* Main Card */}
                <div className={`relative bg-gradient-to-br ${getHighlightColor(step.highlight)} border-2 rounded-2xl shadow-2xl overflow-hidden`}>
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at center, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
                        <div
                            className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-rose-500 transition-all duration-500"
                            style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
                        />
                    </div>

                    {/* Content */}
                    <div className="p-8 pt-10">
                        {/* Step Indicator */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                {TUTORIAL_STEPS.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentStep(idx)}
                                        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentStep
                                            ? 'bg-white scale-125'
                                            : idx < currentStep
                                                ? 'bg-cyan-500'
                                                : 'bg-slate-600 hover:bg-slate-500'
                                            }`}
                                    />
                                ))}
                            </div>
                            <span className="text-sm font-mono text-slate-400">
                                {currentStep + 1} / {TUTORIAL_STEPS.length}
                            </span>
                        </div>

                        {/* Icon & Title */}
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                {step.icon}
                            </div>
                            <h2 className="text-3xl font-black text-white">
                                {isZh ? step.titleZh : step.titleEn}
                            </h2>
                        </div>

                        {/* Content */}
                        <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/30 min-h-[280px]">
                            <p className="text-slate-200 whitespace-pre-line leading-relaxed text-lg">
                                {isZh ? step.contentZh : step.contentEn}
                            </p>
                        </div>

                        {/* Navigation */}
                        <div className="flex items-center justify-between mt-8">
                            <button
                                onClick={handlePrev}
                                disabled={currentStep === 0}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${currentStep === 0
                                    ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                    : 'bg-slate-800 text-white hover:bg-slate-700 hover:scale-105'
                                    }`}
                            >
                                <ChevronLeft size={20} />
                                {isZh ? '上一步' : 'Previous'}
                            </button>

                            {currentStep === TUTORIAL_STEPS.length - 1 ? (
                                <button
                                    onClick={onClose}
                                    className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl font-black text-white shadow-lg shadow-emerald-500/30 hover:scale-105 transition-all"
                                >
                                    <Swords size={20} />
                                    {isZh ? '開始遊戲！' : "Let's Play!"}
                                </button>
                            ) : (
                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 rounded-xl font-bold text-white shadow-lg shadow-cyan-500/30 hover:scale-105 transition-all"
                                >
                                    {isZh ? '下一步' : 'Next'}
                                    <ChevronRight size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Quick Jump Hint */}
                <p className="text-center text-slate-500 text-sm mt-4">
                    {isZh ? '點擊進度點可快速跳轉' : 'Click dots to jump to any section'}
                </p>
            </div>
        </div>
    );
};

export default Tutorial;
