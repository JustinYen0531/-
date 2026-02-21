import React, { useEffect, useRef } from 'react';
import { VisualDetailMode } from '../visualDetail';

interface CircularMeteorShowerProps {
    className?: string;
    detailMode?: VisualDetailMode;
}

interface OrbitStar {
    radius: number;
    angle: number;
    speed: number;
    arcLength: number;
    width: number;
    alpha: number;
    hue: number;
    twinkleOffset: number;
}

const TAU = Math.PI * 2;

const CircularMeteorShower: React.FC<CircularMeteorShowerProps> = ({ className = '', detailMode = 'normal' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let rafId = 0;
        let stars: OrbitStar[] = [];
        let lastTime = performance.now();
        let width = 0;
        let height = 0;
        let dpr = 1;
        const isLowDetail = detailMode === 'low';
        const isUltraLowDetail = detailMode === 'ultra_low';
        const qualityScale = isUltraLowDetail ? 0.4 : isLowDetail ? 0.65 : 1;

        const makeStar = (maxRadius: number): OrbitStar => {
            const r = Math.pow(Math.random(), 0.62) * maxRadius;
            const brightChance = isUltraLowDetail ? 0.03 : isLowDetail ? 0.06 : 0.1;
            const isBright = Math.random() < brightChance;
            return {
                radius: r,
                angle: Math.random() * TAU,
                speed: (0.00005 + (1 - r / maxRadius) * 0.00028 + Math.random() * 0.00009)
                    * (isBright ? 1.8 : 1)
                    * (isUltraLowDetail ? 0.72 : isLowDetail ? 0.86 : 1),
                arcLength: (0.02 + Math.random() * 0.065)
                    * (isBright ? 2.1 : 1.25)
                    * (isUltraLowDetail ? 0.58 : isLowDetail ? 0.78 : 1),
                width: (0.35 + Math.random() * 1.2) * (isBright ? 1.35 : 1) * (isUltraLowDetail ? 0.78 : isLowDetail ? 0.9 : 1),
                alpha: (0.18 + Math.random() * (isBright ? 0.8 : 0.5)) * (isUltraLowDetail ? 0.62 : isLowDetail ? 0.8 : 1),
                hue: isUltraLowDetail ? 200 + Math.random() * 22 : isLowDetail ? 195 + Math.random() * 36 : 190 + Math.random() * 55,
                twinkleOffset: Math.random() * TAU,
            };
        };

        const resize = () => {
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            dpr = Math.min(window.devicePixelRatio || 1, isUltraLowDetail ? 1 : isLowDetail ? 1.5 : 2);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const maxRadius = Math.sqrt(width * width + height * height) * 0.6;
            const starCountBase = width < 768 ? 320 : 560;
            const starCount = Math.max(70, Math.floor(starCountBase * qualityScale));
            stars = Array.from({ length: starCount }, () => makeStar(maxRadius));
        };

        const draw = (now: number) => {
            const dt = Math.min(now - lastTime, 35);
            lastTime = now;
            const centerX = width * 0.52;
            const centerY = height * 0.56;
            ctx.clearRect(0, 0, width, height);

            const leftAura = ctx.createRadialGradient(width * 0.1, height * 0.52, 0, width * 0.1, height * 0.52, width * 0.8);
            leftAura.addColorStop(0, `rgba(40, 170, 255, ${0.16 * qualityScale})`);
            leftAura.addColorStop(1, 'rgba(40, 170, 255, 0)');
            ctx.fillStyle = leftAura;
            ctx.fillRect(0, 0, width, height);

            const rightAura = ctx.createRadialGradient(width * 0.9, height * 0.52, 0, width * 0.9, height * 0.52, width * 0.8);
            rightAura.addColorStop(0, `rgba(255, 70, 115, ${0.16 * qualityScale})`);
            rightAura.addColorStop(1, 'rgba(255, 70, 115, 0)');
            ctx.fillStyle = rightAura;
            ctx.fillRect(0, 0, width, height);

            const pulse = now * 0.0013;
            for (let i = 0; i < stars.length; i += 1) {
                const star = stars[i];
                star.angle += star.speed * dt;
                if (star.angle > TAU) star.angle -= TAU;

                const twinkle = 0.45 + 0.55 * Math.sin(pulse + star.twinkleOffset);
                const alpha = Math.max(0.09, star.alpha * twinkle * (isUltraLowDetail ? 0.76 : isLowDetail ? 0.92 : 1.2));
                const trailStart = star.angle - star.arcLength;

                ctx.strokeStyle = `hsla(${star.hue}, 100%, 86%, ${alpha})`;
                ctx.lineCap = 'round';
                ctx.lineWidth = star.width * (isUltraLowDetail ? 0.95 : isLowDetail ? 1.05 : 1.25);
                ctx.beginPath();
                ctx.arc(centerX, centerY, star.radius, trailStart, star.angle, false);
                ctx.stroke();
            }

            const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.25);
            coreGlow.addColorStop(0, `rgba(163, 219, 255, ${0.32 * qualityScale})`);
            coreGlow.addColorStop(0.3, `rgba(97, 180, 255, ${0.08 * qualityScale})`);
            coreGlow.addColorStop(1, 'rgba(97, 180, 255, 0)');
            ctx.fillStyle = coreGlow;
            ctx.beginPath();
            ctx.arc(centerX, centerY, Math.max(width, height) * 0.25, 0, TAU);
            ctx.fill();

            rafId = window.requestAnimationFrame(draw);
        };

        resize();
        window.addEventListener('resize', resize);
        rafId = window.requestAnimationFrame(draw);

        return () => {
            window.removeEventListener('resize', resize);
            window.cancelAnimationFrame(rafId);
        };
    }, [detailMode]);

    return <canvas ref={canvasRef} className={`absolute inset-0 block w-full h-full pointer-events-none ${className}`.trim()} />;
};

export default CircularMeteorShower;
