import { canManageRole, validateUserChange } from './user-rules';

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

describe('canManageRole', () => {
  it('lets an admin manage every role', () => {
    for (const role of [
      'ADMIN',
      'HR',
      'PROJECT_LEAD',
      'TEAM_LEAD',
      'WORKER',
    ] as const) {
      expect(canManageRole('ADMIN', role)).toBe(true);
    }
  });

  it('lets HR manage workers, team leads and project leads', () => {
    expect(canManageRole('HR', 'WORKER')).toBe(true);
    expect(canManageRole('HR', 'TEAM_LEAD')).toBe(true);
    expect(canManageRole('HR', 'PROJECT_LEAD')).toBe(true);
  });

  // The point of the rule: HR can't make or take over an account that has
  // more power than HR itself, e.g. by resetting an admin's password.
  it('stops HR from managing admins and other HR', () => {
    expect(canManageRole('HR', 'ADMIN')).toBe(false);
    expect(canManageRole('HR', 'HR')).toBe(false);
  });

  it('gives everyone else no access', () => {
    for (const actor of ['PROJECT_LEAD', 'TEAM_LEAD', 'WORKER'] as const) {
      expect(canManageRole(actor, 'WORKER')).toBe(false);
    }
  });
});
