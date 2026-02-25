import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import SpeedyShoe from '../SpeedyShoe';

describe('SpeedyShoe', () => {
    it('renders an SVG element', () => {
        const { container } = render(<SpeedyShoe />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('applies className prop', () => {
        const { container } = render(<SpeedyShoe className="custom-class" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('custom-class');
    });
});
