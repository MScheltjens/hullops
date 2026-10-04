import type {
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
}

export interface SeedVessel {
  id: string;
  name: string;
  imoNumber: string | null;
  vesselType: string;
  lengthM: number;
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

export interface SeedData {
  users: SeedUser[];
  vessels: SeedVessel[];
  orders: SeedOrder[];
}

const LENA = 'lena.hoffmann@hullops.example';
const JONAS = 'jonas.becker@hullops.example';
const MEHMET = 'mehmet.yilmaz@hullops.example';
const PIOTR = 'piotr.nowak@hullops.example';
const ANNA = 'anna.schulz@hullops.example';
const TOM = 'tom.dejong@hullops.example';
const SOFIA = 'sofia.rossi@hullops.example';

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
    },
    {
      email: JONAS,
      name: 'Jonas Becker',
      role: 'PROJECT_LEAD',
      serviceTypes: ['PROTECTION'],
    },
    {
      email: MEHMET,
      name: 'Mehmet Yilmaz',
      role: 'WORKER',
      serviceTypes: ['CLEANING'],
    },
    {
      email: PIOTR,
      name: 'Piotr Nowak',
      role: 'WORKER',
      serviceTypes: ['CLEANING', 'PROTECTION'],
    },
    {
      email: ANNA,
      name: 'Anna Schulz',
      role: 'WORKER',
      serviceTypes: ['PROTECTION'],
    },
    {
      email: TOM,
      name: 'Tom de Jong',
      role: 'WORKER',
      serviceTypes: ['PROTECTION'],
    },
    {
      email: SOFIA,
      name: 'Sofia Rossi',
      role: 'WORKER',
      serviceTypes: ['CLEANING'],
    },
  ];

  const vessels: SeedVessel[] = [
    {
      id: 'seed-vessel-elbe-trader',
      name: 'Elbe Trader',
      imoNumber: '9312456',
      vesselType: 'Container ship',
      lengthM: 294,
    },
    {
      id: 'seed-vessel-hanseatic-star',
      name: 'Hanseatic Star',
      imoNumber: '9487615',
      vesselType: 'Cruise ship',
      lengthM: 230,
    },
    {
      id: 'seed-vessel-nordic-aurora',
      name: 'Nordic Aurora',
      imoNumber: '9215830',
      vesselType: 'Yacht',
      lengthM: 92,
    },
    // Small harbor craft often have no IMO number.
    {
      id: 'seed-vessel-hermann',
      name: 'Hermann',
      imoNumber: null,
      vesselType: 'Tug',
      lengthM: 32,
    },
  ];

  const orders: SeedOrder[] = [
    {
      id: 'seed-order-elbe-hull-cleaning',
      title: 'Hull cleaning before repainting',
      description:
        'Remove marine growth and loose paint from the underwater hull.',
      serviceType: 'CLEANING',
      status: 'IN_PROGRESS',
      shipyard: 'Blohm+Voss',
      berth: 'Dock 10',
      areaSqm: 4200,
      startDate: day(-3),
      dueDate: day(2),
      vesselId: 'seed-vessel-elbe-trader',
      createdByEmail: LENA,
      teamEmails: [MEHMET, SOFIA],
      cleaning: { method: 'High-pressure water', surface: 'Hull' },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(-7) },
        {
          status: 'IN_PROGRESS',
          note: 'Started on the port side.',
          authorEmail: MEHMET,
          at: at8(-3),
        },
      ],
    },
    {
      // Runs at the same time as the hull cleaning above, on the same vessel.
      id: 'seed-order-elbe-engine-enclosure',
      title: 'Enclose main engine during welding work',
      description:
        'Protect the main engine from sparks while the engine room is being welded.',
      serviceType: 'PROTECTION',
      status: 'IN_PROGRESS',
      shipyard: 'Blohm+Voss',
      berth: 'Dock 10',
      areaSqm: null,
      startDate: day(-3),
      dueDate: day(5),
      vesselId: 'seed-vessel-elbe-trader',
      createdByEmail: JONAS,
      teamEmails: [ANNA, TOM, PIOTR],
      protection: {
        kind: 'ENCLOSURE',
        protectedItem: 'Main engine',
        materials: ['OSB_FIRE_RESISTANT', 'GLASS_FIBER_FABRIC'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: JONAS, at: at8(-6) },
        {
          status: 'IN_PROGRESS',
          note: 'Frame built, panels going on today.',
          authorEmail: ANNA,
          at: at8(-3),
        },
      ],
    },
    {
      id: 'seed-order-hanseatic-floor',
      title: 'Floor protection in the atrium',
      description: null,
      serviceType: 'PROTECTION',
      status: 'PLANNED',
      shipyard: 'Lloyd Werft',
      berth: 'Pier 3',
      areaSqm: 650,
      startDate: day(4),
      dueDate: day(10),
      vesselId: 'seed-vessel-hanseatic-star',
      createdByEmail: JONAS,
      teamEmails: [TOM],
      protection: {
        kind: 'FLOOR',
        protectedItem: 'Atrium marble floor',
        materials: ['PROPLEX_HD'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: JONAS, at: at8(-1) },
      ],
    },
    {
      // Overdue: due yesterday and never started.
      id: 'seed-order-hanseatic-bridge-covering',
      title: 'Cover navigation equipment on the bridge',
      description: 'Dust protection while the bridge ceiling is replaced.',
      serviceType: 'PROTECTION',
      status: 'PLANNED',
      shipyard: 'Lloyd Werft',
      berth: 'Pier 3',
      areaSqm: null,
      startDate: day(-4),
      dueDate: day(-1),
      vesselId: 'seed-vessel-hanseatic-star',
      createdByEmail: JONAS,
      teamEmails: [ANNA],
      protection: {
        kind: 'COVERING',
        protectedItem: 'Navigation consoles',
        materials: ['PROPLEX_3MM'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: JONAS, at: at8(-8) },
      ],
    },
    {
      id: 'seed-order-hanseatic-generator',
      title: 'Generator enclosure',
      description: null,
      serviceType: 'PROTECTION',
      status: 'DONE',
      shipyard: 'Lloyd Werft',
      berth: 'Pier 3',
      areaSqm: null,
      startDate: day(-12),
      dueDate: day(-9),
      vesselId: 'seed-vessel-hanseatic-star',
      createdByEmail: JONAS,
      teamEmails: [TOM, PIOTR],
      protection: {
        kind: 'ENCLOSURE',
        protectedItem: 'Auxiliary generator',
        materials: ['OSB_STANDARD'],
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: JONAS, at: at8(-15) },
        { status: 'IN_PROGRESS', note: null, authorEmail: TOM, at: at8(-12) },
        {
          status: 'DONE',
          note: 'Enclosure finished and checked by the yard.',
          authorEmail: TOM,
          at: at8(-10),
        },
      ],
    },
    {
      id: 'seed-order-aurora-interior',
      title: 'Interior cleaning after refit',
      description: 'Final clean of the guest cabins and salon.',
      serviceType: 'CLEANING',
      status: 'DONE',
      shipyard: 'Lürssen',
      berth: 'Hall 2',
      areaSqm: 380,
      startDate: day(-20),
      dueDate: day(-14),
      vesselId: 'seed-vessel-nordic-aurora',
      createdByEmail: LENA,
      teamEmails: [SOFIA, PIOTR],
      cleaning: { method: 'Manual', surface: 'Interior' },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(-25) },
        { status: 'IN_PROGRESS', note: null, authorEmail: SOFIA, at: at8(-20) },
        {
          status: 'DONE',
          note: 'Handed over to the owner’s crew.',
          authorEmail: SOFIA,
          at: at8(-15),
        },
      ],
    },
    {
      // Overdue: in progress, but the due date has passed.
      id: 'seed-order-aurora-coating',
      title: 'Antifouling coating',
      description: null,
      serviceType: 'PROTECTION',
      status: 'IN_PROGRESS',
      shipyard: 'Lürssen',
      berth: 'Hall 2',
      areaSqm: 900,
      startDate: day(-10),
      dueDate: day(-2),
      vesselId: 'seed-vessel-nordic-aurora',
      createdByEmail: LENA,
      teamEmails: [ANNA, PIOTR],
      protection: {
        kind: 'COATING',
        protectedItem: 'Underwater hull',
        materials: [],
        coatingProduct: 'Antifouling',
        layers: 2,
        targetThicknessUm: 250,
      },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(-14) },
        {
          status: 'IN_PROGRESS',
          note: 'Second layer delayed by humidity.',
          authorEmail: ANNA,
          at: at8(-10),
        },
      ],
    },
    {
      // No team yet: still to be staffed.
      id: 'seed-order-hermann-deck-blasting',
      title: 'Deck blasting',
      description: null,
      serviceType: 'CLEANING',
      status: 'PLANNED',
      shipyard: 'Blohm+Voss',
      berth: 'Dock 11',
      areaSqm: 120,
      startDate: day(1),
      dueDate: day(3),
      vesselId: 'seed-vessel-hermann',
      createdByEmail: LENA,
      teamEmails: [],
      cleaning: { method: 'Abrasive blasting', surface: 'Deck' },
      history: [
        { status: 'PLANNED', note: null, authorEmail: LENA, at: at8(0) },
      ],
    },
  ];

  return { users, vessels, orders };
}
