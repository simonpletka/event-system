import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getRealClient, rebuildTestDatabase, type DataMode } from "@/lib/data-mode";
import type { ProjectsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

type CustomRolePermissions = { projects: ProjectsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess } | null;

// Fixed 8-hour session lifetime: updateAge (24h, the NextAuth default) is
// longer than maxAge, so a session is never silently refreshed/extended
// mid-use — it expires exactly 8h after login regardless of activity, and
// the next request's requireUser() (which re-checks against the DB on
// every call) naturally bounces the user to /login once the JWT's `exp`
// has passed. No separate inactivity timer needed.
export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        mode: { label: "View", type: "text" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        const dataMode: DataMode = credentials?.mode === "test" ? "test" : "real";
        if (!email || !password) return null;

        // Credentials are always checked against the real database, in both
        // views: the testing view holds a copy of every real record, so only
        // a real account may open it (the demo accounts it adds can't).
        const prisma = getRealClient();
        const user = await prisma.user.findUnique({ where: { email }, include: { customRole: true } });
        // The Claude connector's service account is token-only (see src/lib/agent/oauth.ts).
        if (!user || !user.active || user.isAgent) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

        // Each testing sign-in starts from a fresh copy of the real data plus the demo data.
        if (dataMode === "test") await rebuildTestDatabase();

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isCardHolder: user.isCardHolder,
          dataMode,
          customRole: user.customRole
            ? {
                projects: user.customRole.projects,
                finance: user.customRole.finance,
                expenses: user.customRole.expenses,
                settings: user.customRole.settings,
              }
            : null,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as string;
        token.isCardHolder = Boolean((user as { isCardHolder?: boolean }).isCardHolder);
        token.customRole = (user as { customRole?: CustomRolePermissions }).customRole ?? null;
        token.dataMode = (user as { dataMode?: DataMode }).dataMode === "test" ? "test" : "real";
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";
        session.user.isCardHolder = token.isCardHolder as boolean;
        session.user.customRole = (token.customRole as CustomRolePermissions) ?? null;
        session.user.dataMode = token.dataMode === "test" ? "test" : "real";
      }
      return session;
    },
  },
});
