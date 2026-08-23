import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { EventsAccess, FinanceAccess, ExpensesAccess, SettingsAccess } from "@/generated/prisma/enums";

type CustomRolePermissions = { events: EventsAccess; finance: FinanceAccess; expenses: ExpensesAccess; settings: SettingsAccess } | null;

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
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email }, include: { customRole: true } });
        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isCardHolder: user.isCardHolder,
          customRole: user.customRole
            ? {
                events: user.customRole.events,
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
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";
        session.user.isCardHolder = token.isCardHolder as boolean;
        session.user.customRole = (token.customRole as CustomRolePermissions) ?? null;
      }
      return session;
    },
  },
});
