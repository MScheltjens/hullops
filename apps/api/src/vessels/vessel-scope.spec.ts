import type { Role } from '../generated/prisma/client';
import { visibleVesselsWhere } from './vessel-scope';

// A Wednesday, so "this week" starts two days earlier.
const NOW = new Date('2026-11-18T10:00:00Z');
const as = (role: Role) => ({ id: 'user-1', role });

describe('visibleVesselsWhere', () => {
  it.each(['ADMIN', 'PROJECT_LEAD'] as const)(
    'lets %s see every vessel',
    (role) => {
      expect(visibleVesselsWhere(as(role), NOW)).toEqual({});
    },
  );

  it('limits a team lead to the vessels he leads', () => {
    expect(visibleVesselsWhere(as('TEAM_LEAD'), NOW)).toEqual({
      teamLeadId: 'user-1',
    });
  });

  it("limits a worker to this and next week's planned vessels", () => {
    expect(visibleVesselsWhere(as('WORKER'), NOW)).toEqual({
      crewAssignments: {
        some: {
          userId: 'user-1',
          weekStart: {
            in: [
              new Date('2026-11-16T00:00:00Z'),
              new Date('2026-11-23T00:00:00Z'),
            ],
          },
        },
      },
    });
  });

  it('shows HR no vessels', () => {
    expect(visibleVesselsWhere(as('HR'), NOW)).toEqual({ id: { in: [] } });
  });
});
