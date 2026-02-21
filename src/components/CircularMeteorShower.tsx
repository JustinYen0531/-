import React, { useEffect, useRef } from 'react';

interface CircularMeteorShowerProps {
    className?: string;
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

const CircularMeteorShower: React.FC<CircularMeteorShowerProps> = ({ className = '' }) => {
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

        const makeStar = (maxRadius: number): OrbitStar => {
            const r = Math.pow(Math.random(), 0.62) * maxRadius;
            const isBright = Math.random() < 0.1;
            return {
                radius: r,
                angle: Math.random() * TAU,
                speed: (0.00005 + (1 - r / maxRadius) * 0.00028 + Math.random() * 0.00009) * (isBright ? 1.8 : 1),
                arcLength: (0.005 + Math.random() * 0.024) * (isBright ? 2.4 : 1),
                width: (0.35 + Math.random() * 1.2) * (isBright ? 1.35 : 1),
                alpha: 0.18 + Math.random() * (isBright ? 0.8 : 0.5),
                hue: 190 + Math.random() * 55,
                twinkleOffset: Math.random() * TAU,
            };
        };

        const resize = () => {
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const maxRadius = Math.sqrt(width * width + height * height) * 0.6;
            const starCount = width < 768 ? 320 : 560;
            stars = Array.from({ length: starCount }, () => makeStar(maxRadius));
        };

        const draw = (now: number) => {
            const dt = Math.min(now - lastTime, 35);
            lastTime = now;
            const centerX = width * 0.52;
            const centerY = height * 0.56;

            const bg = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.9);
            bg.addColorStop(0, 'rgba(10, 20, 45, 0.08)');
            bg.addColorStop(0.5, 'rgba(5, 10, 28, 0.16)');
            bg.addColorStop(1, 'rgba(1, 3, 10, 0.38)');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, width, height);

            const pulse = now * 0.0013;
            for (let i = 0; i < stars.length; i += 1) {
                const star = stars[i];
                star.angle += star.speed * dt;
                if (star.angle > TAU) star.angle -= TAU;

                const twinkle = 0.45 + 0.55 * Math.sin(pulse + star.twinkleOffset);
                const alpha = Math.max(0.18, star.alpha * twinkle * 1.2);
                const trailStart = star.angle - star.arcLength;

                ctx.strokeStyle = `hsla(${star.hue}, 100%, 86%, ${alpha})`;
                ctx.lineCap = 'round';
                ctx.lineWidth = star.width * 1.25;
                ctx.beginPath();
                ctx.arc(centerX, centerY, star.radius, trailStart, star.angle, false);
                ctx.stroke();
            }

            const coreGlow = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(width, height) * 0.25);
            coreGlow.addColorStop(0, 'rgba(163, 219, 255, 0.32)');
            coreGlow.addColorStop(0.3, 'rgba(97, 180, 255, 0.08)');
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
    }, []);

    return <canvas ref={canvasRef} className={`absolute inset-0 block w-full h-full pointer-events-none ${className}`.trim()} />;
};

export default CircularMeteorShower;
