/**
 * The two kinds of work: an order has one, and a user can work in one or
 * both. Codes like the API's ServiceType enum; the labels are translations.
 */
export const SERVICE_TYPES = ["CLEANING", "PROTECTION"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];
