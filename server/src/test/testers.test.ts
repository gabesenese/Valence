import { describe, it, expect } from 'vitest';
import { TESTER_EMAILS as shared } from '@valence/shared';
import { TESTER_EMAILS as serverMirror } from '../config/testers';

describe('tester emails', () => {
  it('server mirror matches the shared source of truth', () => {
    expect(serverMirror).toEqual(shared);
  });
});
