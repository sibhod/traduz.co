import { describe, expect, it } from 'vitest';
import { APPS } from './apps';

describe('APPS registry', () => {
  it('lists mata-el-torre with a relative directory path', () => {
    const torre = APPS.find((a) => a.path === './mata-el-torre/');
    expect(torre).toBeDefined();
    expect(torre!.title).toBe('Mata el Torre');
  });

  it('every entry is complete and directory-style', () => {
    expect(APPS.length).toBeGreaterThan(0);
    for (const app of APPS) {
      expect(app.title).toBeTruthy();
      expect(app.blurb).toBeTruthy();
      expect(app.path).toMatch(/^\.\/.+\/$/); // relative, trailing slash
    }
  });
});
