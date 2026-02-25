import { describe, it, expect } from 'vitest';
import type { VisualDetailMode } from '../visualDetail';
import { DETAIL_MODE_LABELS } from '../visualDetail';

describe('DETAIL_MODE_LABELS', () => {
  it('contains exactly three modes', () => {
    expect(Object.keys(DETAIL_MODE_LABELS)).toHaveLength(3);
  });

  it('has "normal" mode with label "Normal"', () => {
    expect(DETAIL_MODE_LABELS['normal']).toBe('Normal');
  });

  it('has "low" mode with label "Low"', () => {
    expect(DETAIL_MODE_LABELS['low']).toBe('Low');
  });

  it('has "ultra_low" mode with label "Ultra Low"', () => {
    expect(DETAIL_MODE_LABELS['ultra_low']).toBe('Ultra Low');
  });

  it('contains all expected keys', () => {
    const expectedKeys: VisualDetailMode[] = ['normal', 'low', 'ultra_low'];
    expect(Object.keys(DETAIL_MODE_LABELS).sort()).toEqual(expectedKeys.sort());
  });

  it('all label values are non-empty strings', () => {
    for (const value of Object.values(DETAIL_MODE_LABELS)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
