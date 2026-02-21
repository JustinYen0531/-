import React from 'react';
import { Language } from '../i18n';
import { Globe, Settings, Volume2, VolumeX, X } from '../icons';
import { DETAIL_MODE_LABELS, VisualDetailMode } from '../visualDetail';

interface CommonSettingsModalProps {
    open: boolean;
    onClose: () => void;
    language: Language;
    setLanguage: (lang: Language) => void;
    musicVolume: number;
    setMusicVolume: (vol: number) => void;
    sfxVolume: number;
    setSfxVolume: (vol: number) => void;
    allowDevToolsInAiChallenge: boolean;
    setAllowDevToolsInAiChallenge: (value: boolean) => void;
    disableBoardShake: boolean;
    setDisableBoardShake: (value: boolean) => void;
    detailMode: VisualDetailMode;
    setDetailMode: (mode: VisualDetailMode) => void;
}

const CommonSettingsModal: React.FC<CommonSettingsModalProps> = ({
    open,
    onClose,
    language,
    setLanguage,
    musicVolume,
    setMusicVolume,
    sfxVolume,
    setSfxVolume,
    allowDevToolsInAiChallenge,
    setAllowDevToolsInAiChallenge,
    disableBoardShake,
    setDisableBoardShake,
    detailMode,
    setDetailMode
}) => {
    if (!open) return null;

    const isZh = language === 'zh_tw' || language === 'zh_cn';

    return (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border-2 border-cyan-500/70 bg-slate-950/95 shadow-2xl shadow-cyan-500/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <h2 className="text-xl font-black text-cyan-200 flex items-center gap-2">
                        <Settings size={20} />
                        {isZh ? '通用設定' : 'Common Settings'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg border border-slate-600 bg-slate-800/70 hover:bg-slate-700/80 text-slate-200"
                        aria-label={isZh ? '關閉設定' : 'Close settings'}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <section className="space-y-3">
                        <div className="text-sm font-bold text-cyan-100 flex items-center gap-2">
                            <Globe size={16} />
                            {isZh ? '語言' : 'Language'}
                        </div>
                        <div className="flex gap-2">
                            {([
                                { key: 'zh_tw', label: '繁中' },
                                { key: 'en', label: 'EN' },
                                { key: 'zh_cn', label: '简中' }
                            ] as const).map((option) => (
                                <button
                                    key={option.key}
                                    onClick={() => setLanguage(option.key)}
                                    className={`px-4 py-2 rounded-lg border text-sm font-bold transition-colors ${language === option.key
                                        ? 'bg-cyan-500/20 border-cyan-300 text-cyan-100'
                                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'}`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="text-sm font-bold text-cyan-100 flex items-center gap-2">
                            {musicVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            {isZh ? '音樂音量' : 'Music Volume'}
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={musicVolume * 100}
                            onChange={(event) => setMusicVolume(Number(event.target.value) / 100)}
                            className="w-full h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            style={{
                                background: `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(34, 211, 238) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) ${musicVolume * 100}%, rgba(34, 211, 238, 0.2) 100%)`
                            }}
                        />
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-cyan-300 font-bold">{Math.round(musicVolume * 100)}%</span>
                            <div className="flex gap-2">
                                {[0, 30, 60].map((value) => (
                                    <button
                                        key={value}
                                        onClick={() => setMusicVolume(value / 100)}
                                        className="px-3 py-1 rounded border border-slate-600 bg-slate-900/80 text-xs font-bold text-slate-200 hover:border-cyan-500/60"
                                    >
                                        {value}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="text-sm font-bold text-cyan-100 flex items-center gap-2">
                            {sfxVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            {isZh ? '音效音量' : 'SFX Volume'}
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={sfxVolume * 100}
                            onChange={(event) => setSfxVolume(Number(event.target.value) / 100)}
                            className="w-full h-2 bg-cyan-500/20 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                            style={{
                                background: `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(34, 211, 238) ${sfxVolume * 100}%, rgba(34, 211, 238, 0.2) ${sfxVolume * 100}%, rgba(34, 211, 238, 0.2) 100%)`
                            }}
                        />
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-cyan-300 font-bold">
                                {Math.round(sfxVolume * 100)}%
                                {sfxVolume === 0 ? (isZh ? '（不推薦，仍在開發）' : ' (Not recommended, still in development)') : ''}
                            </span>
                            <div className="flex gap-2">
                                {[0, 40, 80].map((value) => (
                                    <button
                                        key={value}
                                        onClick={() => setSfxVolume(value / 100)}
                                        className="px-3 py-1 rounded border border-slate-600 bg-slate-900/80 text-xs font-bold text-slate-200 hover:border-cyan-500/60"
                                    >
                                        {value}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    <section className="space-y-2">
                        <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-100">
                            <span>{isZh ? 'AI 對戰開放 Dev Tools/Sandbox' : 'Allow Dev Tools/Sandbox in AI'}</span>
                            <input
                                type="checkbox"
                                checked={allowDevToolsInAiChallenge}
                                onChange={(event) => setAllowDevToolsInAiChallenge(event.target.checked)}
                                className="h-4 w-4 accent-cyan-500"
                            />
                        </label>
                        <p className="text-xs text-slate-400">
                            {isZh ? '開啟後，僅 AI 對戰可使用 DevTools 與 Sandbox。' : 'When enabled, DevTools and sandbox utilities are available only in AI matches.'}
                        </p>
                    </section>

                    <section className="space-y-2">
                        <label className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-100">
                            <span>{isZh ? '關閉棋盤晃動' : 'Disable Board Shake'}</span>
                            <input
                                type="checkbox"
                                checked={disableBoardShake}
                                onChange={(event) => setDisableBoardShake(event.target.checked)}
                                className="h-4 w-4 accent-cyan-500"
                            />
                        </label>
                        <p className="text-xs text-slate-400">
                            {isZh ? '關閉滑鼠移動時的棋盤傾斜動畫。' : 'Turn off board tilt animation while moving the mouse.'}
                        </p>
                    </section>

                    <section className="space-y-3">
                        <div className="text-sm font-bold text-cyan-100 flex items-center gap-2">
                            <Settings size={16} />
                            {isZh ? '畫面細節' : 'Visual Detail'}
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {(['normal', 'low', 'ultra_low'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setDetailMode(mode)}
                                    className={`px-3 py-2 rounded-lg border text-xs font-black transition-colors ${detailMode === mode
                                        ? 'bg-cyan-500/20 border-cyan-300 text-cyan-100'
                                        : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:border-cyan-500/50'}`}
                                >
                                    {DETAIL_MODE_LABELS[mode]}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400">
                            {isZh
                                ? 'Low / Ultra Low 會降低特效密度、呼吸幅度、星球轉速與線條色澤複雜度。'
                                : 'Low and Ultra Low reduce VFX density, breathing amplitude, planet spin speed, and color/line complexity.'}
                        </p>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default CommonSettingsModal;
