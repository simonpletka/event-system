import type { EventsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

export const EVENTS_ACCESS_LABEL: Record<EventsAccess, string> = {
  NONE: "No access",
  ASSIGNED_READ: "Assigned events, read-only",
  OWN_EDIT: "Own/assigned events, can edit",
  ALL_READ: "All events, read-only",
  ALL_FULL: "All events, full access",
};

export const FINANCE_ACCESS_LABEL: Record<FinanceAccess, string> = {
  NONE: "No access",
  READ_OWN_EVENTS: "Read-only, own events",
  FULL: "Full access",
};

export const EXPENSES_ACCESS_LABEL: Record<ExpensesAccess, string> = {
  NONE: "No access",
  OWN_ONLY: "Own expenses only",
  ADD_ON_OWN_EVENTS: "Add on own/assigned events",
  FULL: "Full access",
};

export const SETTINGS_ACCESS_LABEL: Record<SettingsAccess, string> = {
  NONE: "No access",
  COMPANY: "Company & invoice template",
  USERS_AND_COMPANY: "Users, roles & company",
};

export const EVENTS_ACCESS_OPTIONS = Object.keys(EVENTS_ACCESS_LABEL) as EventsAccess[];
export const FINANCE_ACCESS_OPTIONS = Object.keys(FINANCE_ACCESS_LABEL) as FinanceAccess[];
export const EXPENSES_ACCESS_OPTIONS = Object.keys(EXPENSES_ACCESS_LABEL) as ExpensesAccess[];
export const SETTINGS_ACCESS_OPTIONS = Object.keys(SETTINGS_ACCESS_LABEL) as SettingsAccess[];
