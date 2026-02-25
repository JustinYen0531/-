import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('three', () => {
    const mockRenderer = { setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), domElement: document.createElement('canvas'), setPixelRatio: vi.fn(), setClearColor: vi.fn() };
    const mockScene = { add: vi.fn(), remove: vi.fn(), children: [] };
    const mockCamera = { position: { set: vi.fn(), z: 0 }, aspect: 1, updateProjectionMatrix: vi.fn() };
    return {
        WebGLRenderer: vi.fn(() => mockRenderer),
        Scene: vi.fn(() => mockScene),
        PerspectiveCamera: vi.fn(() => mockCamera),
        Mesh: vi.fn(() => ({ position: { set: vi.fn() }, rotation: { x: 0, y: 0 }, material: { uniforms: {} } })),
        SphereGeometry: vi.fn(() => ({ dispose: vi.fn() })),
        ShaderMaterial: vi.fn(() => ({ uniforms: {}, dispose: vi.fn() })),
        Color: vi.fn(),
        Vector3: vi.fn(() => ({ normalize: vi.fn().mockReturnThis(), clone: vi.fn().mockReturnThis() })),
        Clock: vi.fn(() => ({ getDelta: vi.fn(() => 0.016), elapsedTime: 0 })),
        AdditiveBlending: 1,
        BackSide: 1,
        FrontSide: 0,
    };
});

import ShaderPlanet from '../ShaderPlanet';
import * as THREE from 'three';

describe('ShaderPlanet', () => {
    it('mounts without error', () => {
        const { container } = render(<ShaderPlanet theme="blue" />);
        expect(container.firstChild).toBeTruthy();
        // The root div should have the shader-planet class
        expect(container.firstChild).toHaveClass('shader-planet');
        expect(container.firstChild).toHaveClass('shader-planet-blue');
    });

    it('unmounts and cleans up (dispose called)', () => {
        const { unmount } = render(<ShaderPlanet theme="red" />);
        // Get the mock renderer instance's dispose function
        const rendererInstances = (THREE.WebGLRenderer as unknown as ReturnType<typeof vi.fn>).mock.results;
        const lastRenderer = rendererInstances[rendererInstances.length - 1]?.value;

        unmount();

        // dispose should have been called during cleanup
        expect(lastRenderer.dispose).toHaveBeenCalled();
    });
});
