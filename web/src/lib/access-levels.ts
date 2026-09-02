import type { ProjectsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

export const PROJECTS_ACCESS_LABEL: Record<ProjectsAccess, string> = {
  NONE: "No access",
  ASSIGNED_READ: "Assigned projects, read-only",
  OWN_EDIT: "Own/assigned projects, can edit",
  ALL_READ: "All projects, read-only",
  ALL_FULL: "All projects, full access",
};

export const FINANCE_ACCESS_LABEL: Record<FinanceAccess, string> = {
  NONE: "No access",
  READ_OWN_PROJECTS: "Read-only, own projects",
  FULL: "Full access",
};

export const EXPENSES_ACCESS_LABEL: Record<ExpensesAccess, string> = {
  NONE: "No access",
  OWN_ONLY: "Own expenses only",
  ADD_ON_OWN_PROJECTS: "Add on own/assigned projects",
  FULL: "Full access",
};

export const SETTINGS_ACCESS_LABEL: Record<SettingsAccess, string> = {
  NONE: "No access",
  COMPANY: "Company & invoice template",
  USERS_AND_COMPANY: "Users, roles & company",
};

export const PROJECTS_ACCESS_OPTIONS = Object.keys(PROJECTS_ACCESS_LABEL) as ProjectsAccess[];
export const FINANCE_ACCESS_OPTIONS = Object.keys(FINANCE_ACCESS_LABEL) as FinanceAccess[];
export const EXPENSES_ACCESS_OPTIONS = Object.keys(EXPENSES_ACCESS_LABEL) as ExpensesAccess[];
export const SETTINGS_ACCESS_OPTIONS = Object.keys(SETTINGS_ACCESS_LABEL) as SettingsAccess[];
