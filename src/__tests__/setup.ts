import '@testing-library/jest-dom';

// Mock window.Audio
class MockAudio {
    src = '';
    volume = 1;
    currentTime = 0;
    loop = false;
    paused = true;
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    addEventListener() {}
    removeEventListener() {}
}
Object.defineProperty(globalThis, 'Audio', { value: MockAudio, writable: true });

// Mock AudioContext
class MockAudioContext {
    state = 'running';
    createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 0 } }; }
    createGain() { return { connect() {}, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} } }; }
    createAnalyser() { return { connect() {}, fftSize: 0, getByteTimeDomainData() {} }; }
    close() { return Promise.resolve(); }
    get destination() { return {}; }
}
Object.defineProperty(globalThis, 'AudioContext', { value: MockAudioContext, writable: true });
Object.defineProperty(globalThis, 'webkitAudioContext', { value: MockAudioContext, writable: true });

// Mock matchMedia
Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

// Mock ResizeObserver
class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', { value: MockResizeObserver, writable: true });

// Mock requestAnimationFrame / cancelAnimationFrame
if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}
