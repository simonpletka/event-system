import type { DefaultSession } from "next-auth";

type AppRole = "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      isCardHolder: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
    isCardHolder: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    isCardHolder: boolean;
  }
}
