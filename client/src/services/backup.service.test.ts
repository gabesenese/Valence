import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
}));

vi.mock('./api', () => ({
  api: {
    get: getMock,
  },
}));

import { backupService } from './backup.service';

describe('backupService.download', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: '{"ok":true}' });
  });

  it('downloads backup json through the authenticated api client', async () => {
    const createObjectURL = vi.fn(() => 'blob:backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });

    const anchor = document.createElement('a');
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {});
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);

    await backupService.download('backup-123');

    expect(getMock).toHaveBeenCalledWith('/backups/backup-123/download', { responseType: 'blob' });
    expect(anchor.download).toBe('valence-backup-backup-123.json');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup');
  });
});
