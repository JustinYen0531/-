import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

// Mock canvas getContext to return a mock 2D context
const mockContext = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({
        addColorStop: vi.fn(),
    })),
    setTransform: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    lineCap: '',
    lineWidth: 0,
};

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockContext as unknown as CanvasRenderingContext2D);
});

import CircularMeteorShower from '../CircularMeteorShower';

describe('CircularMeteorShower', () => {
    it('renders a canvas element', () => {
        const { container } = render(<CircularMeteorShower />);
        const canvas = container.querySelector('canvas');
        expect(canvas).toBeInTheDocument();
    });

    it('applies className prop', () => {
        const { container } = render(<CircularMeteorShower className="test-shower" />);
        const canvas = container.querySelector('canvas');
        expect(canvas).toHaveClass('test-shower');
    });
});
