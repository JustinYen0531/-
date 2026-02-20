import React, { useState } from 'react';
import {
    Users, DoorOpen, Swords, FlaskConical, Cpu, X, Globe, ArrowRight, Crown, Bomb, HelpCircle
} from '../icons';
import { Language } from '../i18n';
import Tutorial from './Tutorial';

interface Room {
    id: string;
    name: string;
    players: number;
    maxPlayers: number;
    status: 'waiting' | 'playing';
}

const MOCK_ROOMS: Room[] = [
    { id: 'MC1024', name: '新手練習區', players: 1, maxPlayers: 2, status: 'waiting' },
    { id: 'BATTLE', name: '高手對決', players: 2, maxPlayers: 2, status: 'playing' },
    { id: 'QC999', name: '快速棋局', players: 1, maxPlayers: 2, status: 'waiting' },
];

interface LobbyProps {
    language: Language;
    t: (key: string, params?: any) => string;
    setLanguage: (lang: Language) => void;
    roomId: string | null;
    setRoomId: (id: string | null) => void;
    isHost: boolean;
    setIsHost: (host: boolean) => void;
    showJoinModal: boolean;
    setShowJoinModal: (show: boolean) => void;
    handleStartGame: (mode: 'pvp' | 'pve' | 'sandbox') => void;
    roomCode: string;
    setRoomCode: (code: string) => void;
    joinMode: 'join' | 'create';
    setJoinMode: (mode: 'join' | 'create') => void;
    createRoomId: string;
    setCreateRoomId: (id: string) => void;
    createRoomName: string;
    setCreateRoomName: (name: string) => void;
    isPrivate: boolean;
    setIsPrivate: (priv: boolean) => void;
    createRoomPassword: string;
    setCreateRoomPassword: (pass: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({
    language, t, setLanguage, roomId, setRoomId, isHost, setIsHost,
    showJoinModal, setShowJoinModal, handleStartGame, roomCode, setRoomCode,
    joinMode, setJoinMode, createRoomId, setCreateRoomId, createRoomName, setCreateRoomName,
    isPrivate, setIsPrivate, createRoomPassword, setCreateRoomPassword
}) => {
    const [showTutorial, setShowTutorial] = useState(false);

    return (
        <div className="flex flex-col items-center justify-center h-full gap-8 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-4 relative">
            <div className="text-center space-y-2 z-10">
                <h1 className="neon-title text-7xl font-black drop-shadow-2xl">
                    {t('app_title')}
                </h1>
                <p className="text-cyan-300 max-w-md mx-auto font-semibold tracking-[0.08em]">{t('lobby_desc')}</p>
            </div>

            <div className="flex gap-6 z-10">
                {!roomId ? (
                    <div className="flex flex-col gap-4 items-center">
                        {/* 第一排：主要遊戲模式 */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleStartGame('sandbox')}
                                className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 rounded-xl font-black text-lg shadow-2xl shadow-yellow-500/50 transform hover:scale-110 transition-all duration-200 flex items-center justify-center gap-3 border-2 border-amber-300"
                            >
                                <FlaskConical size={24} />
                                {t('sandbox_mode')}
                            </button>
                            <button
                                onClick={() => handleStartGame('pve')}
                                className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-400 hover:to-fuchsia-400 rounded-xl font-black text-lg shadow-2xl shadow-violet-500/50 transform hover:scale-110 transition-all duration-200 flex items-center justify-center gap-3 border-2 border-violet-300"
                            >
                                <Cpu size={24} />
                                {t('pve_mode')}
                            </button>
                            <button
                                onClick={() => setShowJoinModal(true)}
                                className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-indigo-700 to-blue-700 hover:from-indigo-600 hover:to-blue-600 rounded-xl font-black text-lg shadow-2xl shadow-indigo-500/45 transform hover:scale-110 transition-all duration-200 flex items-center justify-center gap-3 border-2 border-indigo-300 text-white"
                            >
                                <DoorOpen size={24} />
                                {language === 'zh_tw' ? '加入大廳' : 'Join Lobby'}
                            </button>
                        </div>
                        {/* 第二排：教學 */}
                        <button
                            onClick={() => setShowTutorial(true)}
                            className="min-w-[170px] px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 rounded-xl font-black text-lg shadow-2xl shadow-emerald-500/50 transform hover:scale-110 transition-all duration-200 flex items-center justify-center gap-3 border-2 border-emerald-300"
                        >
                            <HelpCircle size={24} />
                            {language === 'zh_tw' ? '新手教學' : 'Tutorial'}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4 animate-fade-in">
                        {isHost ? (
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => {
                                        setRoomId(null);
                                        setIsHost(false);
                                    }}
                                    className="px-8 py-6 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold text-white text-xl transition-all border-2 border-slate-500"
                                >
                                    {language === 'zh_tw' ? '離開大廳' : 'LEAVE'}
                                </button>
                                <button
                                    onClick={() => handleStartGame('pvp')}
                                    className="px-12 py-6 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 rounded-xl font-black text-2xl shadow-2xl shadow-orange-500/50 transform hover:scale-105 transition-all duration-200 flex items-center gap-4 border-2 border-orange-400 animate-pulse"
                                >
                                    <Swords size={32} />
                                    {language === 'zh_tw' ? '開始對戰' : 'START GAME'}
                                </button>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <div className="text-2xl font-bold text-cyan-300 animate-pulse">
                                    {language === 'zh_tw' ? '等待房主開始對戰' : 'Waiting for host to start game'}
                                    <span className="dot-loading"></span>
                                </div>
                                <button
                                    onClick={() => {
                                        setRoomId(null);
                                        setIsHost(false);
                                    }}
                                    className="px-6 py-2 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg text-slate-300 text-sm border border-slate-600 transition-all hover:text-white"
                                >
                                    {language === 'zh_tw' ? '離開大廳' : 'Leave Lobby'}
                                </button>
                                <style>{`
                                .dot-loading::after {
                                    content: ' .';
                                    animation: dots 1.5s steps(5, end) infinite;
                                }
                                @keyframes dots {
                                    0%, 20% { content: ''; }
                                    40% { content: '.'; }
                                    60% { content: '..'; }
                                    80%, 100% { content: '...'; }
                                }
                            `}</style>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {roomId && (
                <div className="absolute top-4 left-4 z-20 bg-cyan-900/80 border border-cyan-500 px-4 py-2 rounded-full text-cyan-200 font-bold backdrop-blur-sm shadow-lg shadow-cyan-500/20 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    {language === 'zh_tw' ? '已加入房間: ' : 'Joined Room: '} {roomId}
                </div>
            )}
            <div className="absolute top-4 right-4 flex gap-2">
                <button
                    onClick={() => setLanguage(language === 'zh_tw' ? 'en' : 'zh_tw')}
                    className="p-2 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-600 transition-colors flex items-center gap-2"
                >
                    <Globe size={16} />
                    {language === 'zh_tw' ? 'EN' : '中文'}
                </button>
            </div>

            {/* Join Modal - Enhanced with Room List */}
            {showJoinModal && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center backdrop-blur-md p-4">
                    <div className="bg-slate-900 border-2 border-cyan-500 rounded-xl shadow-2xl shadow-cyan-500/20 max-w-5xl w-full h-[600px] flex overflow-hidden relative">
                        <button
                            onClick={() => setShowJoinModal(false)}
                            className="absolute top-4 right-4 z-10 p-2 text-slate-400 hover:text-white bg-slate-800/50 rounded-full hover:bg-slate-700 transition-colors"
                        >
                            <X size={24} />
                        </button>

                        {/* Left Panel: Room List */}
                        <div className="w-2/3 border-r border-slate-700 bg-slate-900/50 flex flex-col">
                            <div className="p-6 border-b border-slate-700 bg-slate-800/30">
                                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                    <Users size={24} className="text-cyan-400" />
                                    {language === 'zh_tw' ? '大廳列表' : 'Lobby List'}
                                </h2>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                {MOCK_ROOMS.map(room => (
                                    <div
                                        key={room.id}
                                        onClick={() => room.status === 'waiting' ? setRoomCode(room.id) : null}
                                        className={`p-4 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-between group
                                        ${room.status === 'waiting'
                                                ? 'border-slate-700 hover:border-cyan-500 bg-slate-800/50 hover:bg-slate-800'
                                                : 'border-slate-800 bg-slate-900/50 opacity-60 cursor-not-allowed'}`}
                                    >
                                        <div className="flex flex-col">
                                            <span className={`font-bold text-lg ${room.status === 'waiting' ? 'text-white group-hover:text-cyan-300' : 'text-slate-500'}`}>
                                                {room.name}
                                            </span>
                                            <span className="text-xs text-slate-400 font-mono">ID: {room.id}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase
                                            ${room.status === 'waiting' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                {room.status === 'waiting'
                                                    ? (language === 'zh_tw' ? '等待中' : 'WAITING')
                                                    : (language === 'zh_tw' ? '遊戲中' : 'PLAYING')}
                                            </div>
                                            <div className="flex items-center gap-1 text-slate-400">
                                                <Users size={14} />
                                                <span className="text-sm font-mono">{room.players}/{room.maxPlayers}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Panel: Input Code */}
                        <div className="w-1/3 bg-slate-950/80 flex flex-col items-center justify-center p-8 border-l-2 border-cyan-500/10 shadow-xl relative overflow-hidden">
                            {/* Background Decor */}
                            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, cyan 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

                            {joinMode === 'join' ? (
                                <div className="w-full max-w-xs space-y-6 relative z-10 animate-fade-in">
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-white mb-2">{language === 'zh_tw' ? '輸入房間代碼' : 'Enter Room Code'}</h3>
                                        <p className="text-xs text-slate-400">{language === 'zh_tw' ? '輸入私人房間ID加入' : 'Input private room ID to join'}</p>
                                    </div>

                                    <input
                                        type="text"
                                        value={roomCode}
                                        onChange={(e) => setRoomCode(e.target.value)}
                                        className="w-full bg-slate-900 border-2 border-slate-700 rounded-lg p-4 text-white font-black text-center focus:border-cyan-500 focus:shadow-[0_0_20px_rgba(34,211,238,0.3)] outline-none text-3xl tracking-[0.2em] transition-all uppercase placeholder:opacity-20"
                                        placeholder="____"
                                        maxLength={6}
                                    />

                                    <button
                                        onClick={() => {
                                            if (roomCode.trim()) {
                                                setRoomId(roomCode);
                                                setShowJoinModal(false);
                                            }
                                        }}
                                        className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg font-black text-white text-lg shadow-lg shadow-cyan-500/30 transform hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        disabled={!roomCode.trim()}
                                    >
                                        {language === 'zh_tw' ? '加入房間' : 'JOIN ROOM'}
                                        <ArrowRight size={20} />
                                    </button>

                                    <div className="flex items-center justify-center gap-2 pt-4 border-t border-slate-800/50">
                                        <span className="text-xs text-slate-500">{language === 'zh_tw' ? '沒有房間？' : 'No room?'}</span>
                                        <button
                                            onClick={() => setJoinMode('create')}
                                            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline"
                                        >
                                            {language === 'zh_tw' ? '創建大廳' : 'Create Room'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-xs space-y-4 relative z-10 animate-fade-in">
                                    <div className="text-center mb-2">
                                        <h3 className="text-xl font-bold text-white mb-1">{language === 'zh_tw' ? '創建大廳' : 'Create Room'}</h3>
                                    </div>

                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 mb-1 block">{language === 'zh_tw' ? '房間ID' : 'Room ID'}</label>
                                            <input
                                                type="text"
                                                value={createRoomId}
                                                onChange={(e) => setCreateRoomId(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono text-center focus:border-cyan-500 outline-none uppercase"
                                                placeholder="ID"
                                                maxLength={6}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-400 mb-1 block">{language === 'zh_tw' ? '房間名稱' : 'Room Name'}</label>
                                            <input
                                                type="text"
                                                value={createRoomName}
                                                onChange={(e) => setCreateRoomName(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 outline-none"
                                                placeholder={language === 'zh_tw' ? '輸入名稱...' : 'Enter name...'}
                                                maxLength={12}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-400">{language === 'zh_tw' ? '私人房間？' : 'Private?'}</label>
                                            <input
                                                type="checkbox"
                                                checked={isPrivate}
                                                onChange={(e) => setIsPrivate(e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-offset-slate-900"
                                            />
                                        </div>
                                        {isPrivate && (
                                            <input
                                                type="password"
                                                value={createRoomPassword}
                                                onChange={(e) => setCreateRoomPassword(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-500 outline-none"
                                                placeholder={language === 'zh_tw' ? '密碼...' : 'Password...'}
                                            />
                                        )}
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => setJoinMode('join')}
                                            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded font-bold text-slate-400 text-sm transition-colors"
                                        >
                                            {language === 'zh_tw' ? '返回' : 'Back'}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (createRoomId.trim() && createRoomName.trim()) {
                                                    setRoomId(createRoomId);
                                                    setIsHost(true); // Host
                                                    setShowJoinModal(false);
                                                }
                                            }}
                                            className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded font-black text-white text-sm shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!createRoomId.trim() || !createRoomName.trim()}
                                        >
                                            {language === 'zh_tw' ? '創建' : 'Create'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Animated Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Top-left Crown with Cloud */}
                <div className="absolute top-20 left-20">
                    <div className="absolute inset-0 bg-cyan-500/20 blur-[50px] rounded-full scale-150 animate-pulse" style={{ animation: 'cloud-flow 6s ease-in-out infinite' }}></div>
                    <div style={{ animation: 'fadeInOut 4s ease-in-out infinite' }}>
                        <Crown size={200} className="text-cyan-400 drop-shadow-2xl relative z-10" />
                    </div>
                </div>

                {/* Bottom-right Bomb with Cloud */}
                <div className="absolute bottom-20 right-20">
                    <div className="absolute inset-0 bg-red-500/20 blur-[50px] rounded-full scale-150 animate-pulse" style={{ animation: 'cloud-flow 6s ease-in-out infinite reverse' }}></div>
                    <div style={{ animation: 'fadeInOut 4s ease-in-out infinite' }}>
                        <Bomb size={200} className="text-red-400 drop-shadow-2xl relative z-10" />
                    </div>
                </div>
                {/* Mist effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-red-500/5"></div>
            </div>

            {/* Tutorial Modal */}
            {showTutorial && (
                <Tutorial language={language} onClose={() => setShowTutorial(false)} />
            )}
        </div>
    );
};

export default Lobby;
