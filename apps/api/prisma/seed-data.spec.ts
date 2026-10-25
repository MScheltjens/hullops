import { isValidImoNumber } from '../src/vessels/imo-number';
import { buildSeedData, SeedOrder, weekStartFor } from './seed-data';

const STATUS_ORDER = ['PLANNED', 'IN_PROGRESS', 'DONE'] as const;
const NOW = new Date('2026-10-04T12:00:00Z');
const { users, vessels, orders, staffingRequests } = buildSeedData(NOW);

const userByEmail = new Map(users.map((user) => [user.email, user]));
const isOverdue = (order: SeedOrder) =>
  order.dueDate < NOW && order.status !== 'DONE';

describe('seed data', () => {
  it('has unique user emails, vessel ids and order ids', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(users.map((u) => u.email))).toBe(true);
    expect(unique(vessels.map((v) => v.id))).toBe(true);
    expect(unique(orders.map((o) => o.id))).toBe(true);
  });

  it('has an administrator who is on no team and creates no orders', () => {
    const admins = users.filter((user) => user.role === 'ADMIN');
    expect(admins).toHaveLength(1);
    const [admin] = admins;
    for (const order of orders) {
      expect(order.createdByEmail).not.toBe(admin.email);
      expect(order.teamEmails).not.toContain(admin.email);
    }
  });

  describe('staffing requests', () => {
    it('reference existing vessels and users, entered by a project lead', () => {
      for (const request of staffingRequests) {
        expect(vessels.some((v) => v.id === request.vesselId)).toBe(true);
        expect(userByEmail.get(request.enteredByEmail)?.role).toBe(
          'PROJECT_LEAD',
        );
      }
    });

    it('ask by name only for workers, within the total', () => {
      for (const request of staffingRequests) {
        expect(request.workerEmails.length).toBeLessThanOrEqual(
          request.workersNeeded,
        );
        for (const email of request.workerEmails) {
          expect(userByEmail.get(email)?.role).toBe('WORKER');
        }
      }
    });

    it('have one request per vessel and week', () => {
      const keys = staffingRequests.map((r) => `${r.vesselId}|${r.weekOffset}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('never ask for the same worker on two vessels in one week', () => {
      const seen = new Set<string>();
      for (const request of staffingRequests) {
        for (const email of request.workerEmails) {
          const key = `${request.weekOffset}|${email}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    });
  });

  describe('weekStartFor', () => {
    it('gives the Monday of the current, previous and next week', () => {
      // NOW is a Sunday (2026-10-04); its week began on Monday 2026-09-28.
      expect(weekStartFor(NOW, 0).toISOString()).toBe(
        '2026-09-28T00:00:00.000Z',
      );
      expect(weekStartFor(NOW, -1).toISOString()).toBe(
        '2026-09-21T00:00:00.000Z',
      );
      expect(weekStartFor(NOW, 1).toISOString()).toBe(
        '2026-10-05T00:00:00.000Z',
      );
    });
  });

  it('uses only valid IMO numbers', () => {
    for (const vessel of vessels) {
      if (vessel.imoNumber !== null) {
        expect(isValidImoNumber(vessel.imoNumber)).toBe(true);
      }
    }
  });

  describe.each(orders.map((order) => [order.id, order] as const))(
    'order %s',
    (_id, order) => {
      it('references existing users and vessels', () => {
        const emails = [
          order.createdByEmail,
          ...order.teamEmails,
          ...order.history.map((update) => update.authorEmail),
        ];
        for (const email of emails) {
          expect(userByEmail.has(email)).toBe(true);
        }
        expect(vessels.some((vessel) => vessel.id === order.vesselId)).toBe(
          true,
        );
      });

      it('is created by a project lead', () => {
        expect(userByEmail.get(order.createdByEmail)?.role).toBe(
          'PROJECT_LEAD',
        );
      });

      it('only has team members who work in its service area', () => {
        for (const email of order.teamEmails) {
          expect(userByEmail.get(email)?.serviceTypes).toContain(
            order.serviceType,
          );
        }
      });

      it('starts no later than it is due', () => {
        expect(order.startDate.getTime()).toBeLessThanOrEqual(
          order.dueDate.getTime(),
        );
      });

      it('has coating fields only for coatings', () => {
        if (order.serviceType !== 'PROTECTION') return;
        const { kind, coatingProduct, layers, targetThicknessUm } =
          order.protection;
        const hasCoatingFields = [
          coatingProduct,
          layers,
          targetThicknessUm,
        ].some((value) => value !== undefined);
        expect(hasCoatingFields).toBe(kind === 'COATING');
      });

      it('has a history that moves forward and ends at the current status', () => {
        const statuses = order.history.map((update) => update.status);
        expect(statuses[0]).toBe('PLANNED');
        expect(statuses.at(-1)).toBe(order.status);
        const steps = statuses.map((status) => STATUS_ORDER.indexOf(status));
        steps.slice(1).forEach((step, i) => expect(step).toBe(steps[i] + 1));
        const times = order.history.map((update) => update.at.getTime());
        expect(times).toEqual([...times].sort((a, b) => a - b));
      });
    },
  );

  // The data should show off every state the app has to display.
  describe('coverage for demos', () => {
    it('has orders in every status and of both service types', () => {
      expect(new Set(orders.map((o) => o.status))).toEqual(
        new Set(STATUS_ORDER),
      );
      expect(new Set(orders.map((o) => o.serviceType))).toEqual(
        new Set(['CLEANING', 'PROTECTION']),
      );
    });

    it('has overdue orders and orders that are on time', () => {
      expect(orders.some(isOverdue)).toBe(true);
      expect(orders.some((order) => !isOverdue(order))).toBe(true);
    });

    it('has cleaning and protection running at the same time on one vessel', () => {
      const overlaps = (a: SeedOrder, b: SeedOrder) =>
        a.vesselId === b.vesselId &&
        a.startDate <= b.dueDate &&
        b.startDate <= a.dueDate;
      const cleaning = orders.filter((o) => o.serviceType === 'CLEANING');
      const protection = orders.filter((o) => o.serviceType === 'PROTECTION');
      expect(cleaning.some((c) => protection.some((p) => overlaps(c, p)))).toBe(
        true,
      );
    });

    it('has an order without a team and a vessel without an IMO number', () => {
      expect(orders.some((order) => order.teamEmails.length === 0)).toBe(true);
      expect(vessels.some((vessel) => vessel.imoNumber === null)).toBe(true);
    });
  });
});
