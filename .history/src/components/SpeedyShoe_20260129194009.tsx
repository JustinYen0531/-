import React from 'react';

interface IconProps {
    size?: number | string;
    className?: string;
    color?: string;
}

const SpeedyShoe: React.FC<IconProps> = ({ size = 24, className = "", color = "currentColor" }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            {/* Speed Lines */}
            <path d="M2 11h4" />
            <path d="M1 14h6" />
            <path d="M2 17h3" />

            {/* Shoe Outline */}
            <path d="M22 17.5c0 1.4-1.1 2.5-2.5 2.5H10c-1.4 0-2.5-1.1-2.5-2.5v-3L5 10l2.5-4h4.5l4 6h4v4.5c0 .6-.4 1-1 1" />

            {/* Sole Line */}
            <path d="M8 17h11" />

            {/* Laces Detail */}
            <path d="M12 10l3 3" />
        </svg>
    );
};

export default SpeedyShoe;
