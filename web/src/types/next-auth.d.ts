import type { DefaultSession } from "next-auth";
import type { ProjectsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

type AppRole = "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";
type AppCustomRole = { projects: ProjectsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess } | null;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      isCardHolder: boolean;
      customRole: AppCustomRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    isCardHolder: boolean;
    customRole: AppCustomRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    isCardHolder: boolean;
    customRole: AppCustomRole;
  }
}
