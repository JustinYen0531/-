const fs = require('fs');
const path = 'c:/Users/閻星澄/Desktop/Mine Chess/src/components/ControlPanel.tsx';
let content = fs.readFileSync(path, 'utf8');

// Normalize line endings
content = content.replace(/\r\n/g, '\n');

// 1. Add showBidModal state after energyBidInput
const stateOld = 'const [energyBidInput, setEnergyBidInput] = React.useState<string>("");';
const stateNew = 'const [energyBidInput, setEnergyBidInput] = React.useState<string>("");\n    const [showBidModal, setShowBidModal] = React.useState(false);';

if (content.includes(stateOld)) {
    content = content.replace(stateOld, stateNew);
    console.log('State added OK');
}

// 2. Wrap existing Bid Logic into a Modal and replace inline UI with a premium button
// First find the inserted bid UI block from previous turn
const bidUIStart = content.indexOf('{/* Energy Bid for First-Mover Initiative */}');
const bidUIEnd = content.indexOf('</div>', content.indexOf('<Zap size={10} className="text-yellow-500" />')) + 12; // approximate end of that custom block

if (bidUIStart > 0) {
    const originalBidBlock = content.substring(bidUIStart, bidUIEnd);

    // New premium button that opens the modal
    const premiumBidButton = `
                                    {/* Energy Bid Trigger Button */}
                                    <button
                                        disabled={isInteractionDisabled}
                                        onClick={() => setShowBidModal(true)}
                                        className="w-full mt-1.5 py-1.5 px-3 rounded-lg font-black text-[10px] flex items-center justify-center gap-2 border-2 transition-all bg-gradient-to-r from-yellow-600/30 to-amber-600/30 border-yellow-500/40 text-yellow-300 hover:from-yellow-500/40 hover:to-amber-500/40 hover:border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)] hover:shadow-[0_0_15px_rgba(234,179,8,0.4)] group overflow-hidden relative"
                                    >
                                        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
                                        <Zap size={12} className="text-yellow-400 group-hover:scale-125 transition-transform animate-pulse" />
                                        <span className="uppercase tracking-[0.15em]">{t('energy_bid_label')}</span>
                                        {parseInt(energyBidInput) > 0 && (
                                            <div className="ml-1 px-1.5 py-0.5 bg-yellow-400 text-black rounded-full text-[9px] min-w-[18px]">
                                                {energyBidInput}
                                            </div>
                                        )}
                                    </button>`;

    content = content.substring(0, bidUIStart) + premiumBidButton + content.substring(bidUIEnd);
    console.log('Inline bid UI replaced with button');
}

// 3. Add the Modal JSX before the final closing </div> of the component
// The component is large, so let's find the last few characters
const lastClosingDiv = content.lastIndexOf('</div>');
const bidModalJSX = `
            {/* Energy Bid Modal - Premium Overlay */}
            {showBidModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300 bg-black/60 backdrop-blur-md">
                    <div 
                        className="w-full max-w-[320px] bg-slate-900/95 border-2 border-yellow-500/50 rounded-2xl p-6 shadow-[0_0_40px_rgba(234,179,8,0.2)] relative overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-5 duration-300"
                    >
                        {/* Background Decoration */}
                        <div className="absolute top-0 right-0 -tranyellow-y-1/2 translate-x-1/2 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                        {/* Header */}
                        <div className="flex items-center justify-between mb-5 relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
                                    <Zap size={20} className="text-yellow-400 animate-pulse" />
                                </div>
                                <div>
                                    <div className="text-lg font-black text-white tracking-widest uppercase">{t('energy_bid_label')}</div>
                                    <div className="text-[10px] font-black text-yellow-500/70 tracking-tighter uppercase">{t('placement_phase')}</div>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowBidModal(false)}
                                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="space-y-4 relative z-10">
                            <div className="text-xs text-slate-300 leading-relaxed font-bold bg-slate-800/40 p-3 rounded-xl border border-white/5">
                                {t('energy_bid_hint')}
                            </div>

                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-500 to-amber-600 rounded-xl blur opacity-25 group-focus-within:opacity-50 transition-opacity"></div>
                                <div className="relative flex flex-col bg-slate-950/80 border border-yellow-500/30 rounded-xl p-4">
                                    <div className="flex items-end justify-between mb-2">
                                        <span className="text-[10px] font-black text-slate-500 uppercase">{t('energy')}</span>
                                        <div className="flex items-center gap-1.5 text-xs text-yellow-400/90 font-black">
                                            <Zap size={14} />
                                            <span>{player.energy}</span>
                                        </div>
                                    </div>
                                    <input
                                        type="number"
                                        min="0"
                                        max={player.energy}
                                        value={energyBidInput}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            const num = parseInt(val);
                                            if (val === '' || (!isNaN(num) && num >= 0 && num <= player.energy)) {
                                                setEnergyBidInput(val);
                                            }
                                        }}
                                        autoFocus
                                        placeholder={t('energy_bid_placeholder')}
                                        className="w-full bg-transparent text-3xl font-black text-white text-center outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none placeholder:text-slate-800"
                                    />
                                </div>
                            </div>

                            {/* Confirm Button */}
                            <button
                                onClick={() => setShowBidModal(false)}
                                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-black font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-yellow-500/25 active:scale-[0.98]"
                            >
                                {t('confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
`;

content = content.substring(0, lastClosingDiv) + bidModalJSX + content.substring(lastClosingDiv);
console.log('Bid Modal added to bottom');

// Restore CRLF
content = content.replace(/\n/g, '\r\n');
fs.writeFileSync(path, content, 'utf8');
console.log('Update Complete');
