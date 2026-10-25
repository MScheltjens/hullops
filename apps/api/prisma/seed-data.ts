import type {
  Locale,
  OrderStatus,
  ProtectionKind,
  ProtectionMaterial,
  Role,
  ServiceType,
} from '../src/generated/prisma/client';

/**
 * Demo data for local development and demos. It's plain data so a unit test
 * (seed-data.spec.ts) can check it follows the domain rules; seed.ts writes
 * it to the database.
 *
 * All names, vessels and IMO numbers are fictional. Every seeded user can log
 * in with SEED_PASSWORD.
 */
export const SEED_PASSWORD = 'hullops-dev';

export interface SeedUser {
  email: string;
  name: string;
  role: Role;
  serviceTypes: ServiceType[];
  locale: Locale;
}

export interface SeedVessel {
  id: string;
  name: string;
  imoNumber: string | null;
  vesselType: string;
  lengthM: number | null;
  /** The team lead responsible for the vessel on the yard. */
  teamLeadEmail?: string;
}

export interface SeedStatusUpdate {
  status: OrderStatus;
  note: string | null;
  authorEmail: string;
  at: Date;
}

interface SeedOrderBase {
  id: string;
  title: string;
  description: string | null;
  status: OrderStatus;
  shipyard: string;
  berth: string | null;
  areaSqm: number | null;
  startDate: Date;
  dueDate: Date;
  vesselId: string;
  createdByEmail: string;
  teamEmails: string[];
  history: SeedStatusUpdate[];
}

export interface SeedCleaningOrder extends SeedOrderBase {
  serviceType: 'CLEANING';
  cleaning: { method: string; surface: string };
}

export interface SeedProtectionOrder extends SeedOrderBase {
  serviceType: 'PROTECTION';
  protection: {
    kind: ProtectionKind;
    protectedItem: string | null;
    materials: ProtectionMaterial[];
    coatingProduct?: string;
    layers?: number;
    targetThicknessUm?: number;
  };
}

// A discriminated union: TypeScript only allows cleaning details on cleaning
// orders and protection details on protection orders.
export type SeedOrder = SeedCleaningOrder | SeedProtectionOrder;

/** What a vessel's team lead asked for, for one vessel and one week. */
export interface SeedStaffingRequest {
  vesselId: string;
  /** Weeks from the current week: -1 is last week, 1 is next week. */
  weekOffset: number;
  workersNeeded: number;
  workersActual: number | null;
  note: string | null;
  /** Workers the team lead asked for by name. */
  workerEmails: string[];
  enteredByEmail: string;
}

export interface SeedData {
  users: SeedUser[];
  vessels: SeedVessel[];
  orders: SeedOrder[];
  staffingRequests: SeedStaffingRequest[];
}

/** Midnight UTC on the Monday `weekOffset` weeks from the week of `now`. */
export function weekStartFor(now: Date, weekOffset: number): Date {
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const sinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight + (weekOffset * 7 - sinceMonday) * 86_400_000);
}

const LENA = 'lena.hoffmann@hullops.example';
const JONAS = 'jonas.becker@hullops.example';
const MEHMET = 'mehmet.yilmaz@hullops.example';
const PIOTR = 'piotr.nowak@hullops.example';
const ANNA = 'anna.schulz@hullops.example';
const TOM = 'tom.dejong@hullops.example';
const SOFIA = 'sofia.rossi@hullops.example';
const ADMIN = 'admin@hullops.example';
const HEINZ = 'heinz.brandt@hullops.example';
const UTE = 'ute.lange@hullops.example';

/**
 * Builds the demo data with dates relative to `now`, so orders are in
 * progress, upcoming or overdue whenever you seed.
 */
export function buildSeedData(now: Date): SeedData {
  // Midnight UTC today, shifted by whole days; 8:00 for status updates.
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const day = (offset: number) => new Date(today + offset * 86_400_000);
  const at8 = (offset: number) =>
    new Date(today + offset * 86_400_000 + 8 * 3_600_000);

  const users: SeedUser[] = [
    {
      email: LENA,
      name: 'Lena Hoffmann',
      role: 'PROJECT_LEAD',
      serviceTypes: ['CLEANING', 'PROTECTION'],
      locale: 'DE',
    },
    {
      email: JONAS,
      name: 'Jonas Becker',
      role: 'PROJECT_LEAD',
      serviceTypes: ['PROTECTION'],
      locale: 'DE',
    },
    {
      email: MEHMET,
      name: 'Mehmet Yilmaz',
      role: 'WORKER',
      serviceTypes: ['CLEANING'],
      locale: 'DE',
    },
    {
      email: PIOTR,
      name: 'Piotr Nowak',
      role: 'WORKER',
      serviceTypes: ['CLEANING', 'PROTECTION'],
      locale: 'EN',
    },
    {
      email: ANNA,
      name: 'Anna Schulz',
      role: 'WORKER',
      serviceTypes: ['PROTECTION'],
      locale: 'DE',
    },
    {
      email: TOM,
      name: 'Tom de Jong',
      role: 'WORKER',
      serviceTypes: ['PROTECTION'],
      locale: 'EN',
    },
    {
      email: SOFIA,
      name: 'Sofia Rossi',
      role: 'WORKER',
      serviceTypes: ['CLEANING'],
      locale: 'EN',
    },
    {
      // The on-site team leads (voorarbeider): each is responsible for some
      // vessels and asks for workers for their coming weeks.
      email: HEINZ,
      name: 'Heinz Brandt',
      role: 'TEAM_LEAD',
      serviceTypes: ['CLEANING', 'PROTECTION'],
      locale: 'DE',
    },
    {
      email: UTE,
      name: 'Ute Lange',
      role: 'TEAM_LEAD',
      serviceTypes: ['CLEANING', 'PROTECTION'],
      locale: 'DE',
    },
    {
      // The technical administrator: manages users and reads everything, but
      // is on no team and creates no orders. For a demo it shares the public
      // SEED_PASSWORD like everyone else.
      email: ADMIN,
      name: 'Admin',
      role: 'ADMIN',
      serviceTypes: [],
      locale: 'EN',
    },
  ];

  // The two vessels the business works on at the moment. Their IMO numbers
  // and lengths aren't known here, so they are left empty rather than invented.
  const vessels: SeedVessel[] = [
    {
      // A Lürssen yacht in dock 5 (a dry dock) for a refit.
      id: 'seed-vessel-avatage',
      name: 'Avatage',
      imoNumber: null,
      vesselType: 'Yacht (refit)',
      lengthM: null,
      teamLeadEmail: UTE,
    },
    {
      // A new naval vessel: delivered by Blohm+Voss as a steel hull and now in
      // the dry dock for the hoisting work (Heisarbeiten) and the installation
      // of the pipe and machinery systems (Rohr- und Maschinenanlagen).
      id: 'seed-vessel-flottendienstboot-1',
      name: 'Flottendienstboot 1',
      imoNumber: null,
      vesselType: 'Fleet service boat (naval, new build)',
      lengthM: null,
      teamLeadEmail: HEINZ,
    },
  ];

  const orders: SeedOrder[] = [
    // ---- Avatage: refit in dock 5
    {
      id: 'seed-order-avatage-hull-cleaning',
      title: 'Hull cleaning before repainting',
      description:
        'Remove marine growth and loose paint from the underwater hull while the yacht is in the dry dock.',
      serviceType: 'CLEANING',
      status: 'IN_PROGRESS',
      shipyard: 'Lürssen',
      berth: 'Dock 5 (dry dock)',
      areaSqm: 900,
      startDate: day(-4),
      dueDate: day(3),
      vesselId: 'seed-vessel-avatage',
      createdByEmail: LENA,
      teamEmails: [MEHMET, SOFIA],
      cleaning: { method: 'High-pressure water', surface: 'Hull' },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(-9) },
        {
          status: 'IN_PROGRESS',
          note: 'Started at the stern, port side first.',
          authorEmail: MEHMET,
          at: at8(-4),
        },
      ],
    },
    {
      // Runs at the same time as the hull cleaning above, on the same vessel.
      id: 'seed-order-avatage-deck-protection',
      title: 'Protect the main deck and corridors during the refit',
      description:
        'Floor protection while trades work on board, so the finished teak and the corridors stay clean and undamaged.',
      serviceType: 'PROTECTION',
      status: 'IN_PROGRESS',
      shipyard: 'Lürssen',
      berth: 'Dock 5 (dry dock)',
      areaSqm: 420,
      startDate: day(-4),
      dueDate: day(14),
      vesselId: 'seed-vessel-avatage',
      createdByEmail: LENA,
      teamEmails: [ANNA, TOM],
      protection: {
        kind: 'FLOOR',
        protectedItem: 'Main deck and corridors',
        materials: ['PROPLEX_3MM', 'PROPLEX_HD'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(-8) },
        {
          status: 'IN_PROGRESS',
          note: 'Main deck done; corridors on the lower deck next.',
          authorEmail: ANNA,
          at: at8(-3),
        },
      ],
    },
    {
      // No team yet: the project lead still has to staff it.
      id: 'seed-order-avatage-spark-protection',
      title: 'Cover interior fittings against welding sparks',
      description:
        'Glass fiber fabric over furniture and fittings in the areas where hot work starts next week.',
      serviceType: 'PROTECTION',
      status: 'PLANNED',
      shipyard: 'Lürssen',
      berth: 'Dock 5 (dry dock)',
      areaSqm: null,
      startDate: day(3),
      dueDate: day(9),
      vesselId: 'seed-vessel-avatage',
      createdByEmail: LENA,
      teamEmails: [],
      protection: {
        kind: 'COVERING',
        protectedItem: 'Interior furniture and fittings',
        materials: ['GLASS_FIBER_FABRIC'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(-1) },
      ],
    },
    {
      id: 'seed-order-avatage-aft-deck',
      title: 'Clean the aft deck after removing the old covering',
      description: null,
      serviceType: 'CLEANING',
      status: 'DONE',
      shipyard: 'Lürssen',
      berth: 'Dock 5 (dry dock)',
      areaSqm: 160,
      startDate: day(-22),
      dueDate: day(-14),
      vesselId: 'seed-vessel-avatage',
      createdByEmail: LENA,
      teamEmails: [SOFIA],
      cleaning: { method: 'Manual and industrial vacuum', surface: 'Aft deck' },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(-26) },
        {
          status: 'IN_PROGRESS',
          note: null,
          authorEmail: SOFIA,
          at: at8(-21),
        },
        {
          status: 'DONE',
          note: 'Signed off by the yacht captain.',
          authorEmail: SOFIA,
          at: at8(-15),
        },
      ],
    },

    // ---- Flottendienstboot 1: naval new build in the dry dock
    {
      id: 'seed-order-fdb1-hoisting-protection',
      title: 'Protect finished deck areas during the hoisting work',
      description:
        'Heavy components are lifted into the machinery spaces (Heisarbeiten). Protect the finished deck plates and coated surfaces along the lifting route.',
      serviceType: 'PROTECTION',
      status: 'IN_PROGRESS',
      shipyard: 'Blohm+Voss',
      berth: 'Dry dock',
      areaSqm: 300,
      startDate: day(-6),
      dueDate: day(8),
      vesselId: 'seed-vessel-flottendienstboot-1',
      createdByEmail: JONAS,
      teamEmails: [PIOTR, ANNA],
      protection: {
        kind: 'FLOOR',
        protectedItem: 'Deck plates along the lifting route',
        materials: ['OSB_STANDARD'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: JONAS, at: at8(-10) },
        {
          status: 'IN_PROGRESS',
          note: 'Boards down from the hatch to the engine room.',
          authorEmail: PIOTR,
          at: at8(-5),
        },
      ],
    },
    {
      id: 'seed-order-fdb1-machinery-enclosure',
      title: 'Enclose machinery and pipework during welding',
      description:
        'Fire-resistant enclosures around the installed machinery and pipe runs while the pipe and machinery systems (Rohr- und Maschinenanlagen) are welded.',
      serviceType: 'PROTECTION',
      status: 'PLANNED',
      shipyard: 'Blohm+Voss',
      berth: 'Dry dock',
      areaSqm: null,
      startDate: day(2),
      dueDate: day(20),
      vesselId: 'seed-vessel-flottendienstboot-1',
      createdByEmail: JONAS,
      teamEmails: [PIOTR],
      protection: {
        kind: 'ENCLOSURE',
        protectedItem: 'Installed machinery and pipe runs',
        materials: ['OSB_FIRE_RESISTANT', 'GLASS_FIBER_FABRIC'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: JONAS, at: at8(-2) },
      ],
    },
    {
      // Overdue: the steel work ran longer than planned.
      id: 'seed-order-fdb1-machinery-cleaning',
      title: 'Clean the machinery spaces after the steel work',
      description:
        'Remove welding residue, grinding dust and offcuts from the machinery spaces and tanks before the systems are installed.',
      serviceType: 'CLEANING',
      status: 'IN_PROGRESS',
      shipyard: 'Blohm+Voss',
      berth: 'Dry dock',
      areaSqm: 520,
      startDate: day(-12),
      dueDate: day(-2),
      vesselId: 'seed-vessel-flottendienstboot-1',
      createdByEmail: JONAS,
      teamEmails: [PIOTR, SOFIA],
      cleaning: {
        method: 'Industrial vacuum and manual',
        surface: 'Machinery spaces and tanks',
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: JONAS, at: at8(-14) },
        {
          status: 'IN_PROGRESS',
          note: 'Two tanks still blocked by scaffolding.',
          authorEmail: SOFIA,
          at: at8(-9),
        },
      ],
    },
  ];

  // What the team leads asked for. Flottendienstboot 1 repeats last week's
  // crew, which is what asking by name is for.
  const staffingRequests: SeedStaffingRequest[] = [
    {
      vesselId: 'seed-vessel-flottendienstboot-1',
      weekOffset: -1,
      workersNeeded: 8,
      workersActual: 7,
      note: null,
      workerEmails: [PIOTR, SOFIA, MEHMET],
      enteredByEmail: HEINZ,
    },
    {
      vesselId: 'seed-vessel-flottendienstboot-1',
      weekOffset: 1,
      workersNeeded: 10,
      workersActual: null,
      note: 'Same crew as last week, please. Two more for the pipe and machinery installation.',
      workerEmails: [PIOTR, SOFIA, MEHMET],
      enteredByEmail: HEINZ,
    },
    {
      vesselId: 'seed-vessel-avatage',
      weekOffset: -1,
      workersNeeded: 4,
      workersActual: 4,
      note: null,
      workerEmails: [ANNA, TOM],
      enteredByEmail: UTE,
    },
    {
      vesselId: 'seed-vessel-avatage',
      weekOffset: 1,
      workersNeeded: 5,
      workersActual: null,
      note: 'Interior protection before the joiners start.',
      workerEmails: [ANNA, TOM],
      enteredByEmail: UTE,
    },
  ];

  return { users, vessels, orders, staffingRequests };
}
