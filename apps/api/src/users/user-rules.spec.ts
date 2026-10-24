import { validateUserChange } from './user-rules';

describe('validateUserChange', () => {
  const admin = { id: 'admin-1', role: 'ADMIN' as const };

  it('allows an admin to change someone else', () => {
    expect(
      validateUserChange('admin-2', admin, { role: 'WORKER', active: false }),
    ).toEqual([]);
  });

  it('forbids changing your own role', () => {
    expect(validateUserChange('admin-1', admin, { role: 'WORKER' })).toEqual([
      'You cannot change your own role',
    ]);
  });

  it('forbids deactivating yourself', () => {
    expect(validateUserChange('admin-1', admin, { active: false })).toEqual([
      'You cannot deactivate yourself',
    ]);
  });

  it('reports both violations at once', () => {
    expect(
      validateUserChange('admin-1', admin, { role: 'WORKER', active: false }),
    ).toHaveLength(2);
  });

  it('allows "changes" to yourself that change nothing', () => {
    // Sending your own current role, or keeping yourself active, is harmless.
    expect(
      validateUserChange('admin-1', admin, { role: 'ADMIN', active: true }),
    ).toEqual([]);
    expect(validateUserChange('admin-1', admin, {})).toEqual([]);
  });
});
