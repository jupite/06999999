import "server-only";
import { getServerSession, type NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { getDb } from "./db";
import type { Actor, Capability } from "./domain/permissions";
export function authConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET &&
    process.env.NEXTAUTH_SECRET &&
    process.env.DATABASE_URL,
  );
}
export const authOptions: NextAuthOptions = {
  providers:
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider !== "github" || !account.providerAccountId) return false;
      const githubId = account.providerAccountId;
      const db = getDb();
      const existing = await db.user.findUnique({ where: { githubId } });
      if (existing?.banned) return false;
      await db.user.upsert({
        where: { githubId },
        update: { name: user.name ?? "访客", avatarUrl: user.image },
        create: { githubId, name: user.name ?? "访客", avatarUrl: user.image },
      });
      return true;
    },
    async jwt({ token, account }) {
      if (account?.provider === "github") token.githubId = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      session.githubId = typeof token.githubId === "string" ? token.githubId : undefined;
      return session;
    },
  },
};
export async function currentActor(): Promise<Actor | null> {
  if (!authConfigured()) return null;
  const session = await getServerSession(authOptions);
  if (!session?.githubId) return null;
  const user = await getDb().user.findUnique({
    where: { githubId: session.githubId },
    include: { permissions: true },
  });
  if (!user) return null;
  return {
    id: user.id,
    role: process.env.OWNER_GITHUB_ID === user.githubId ? "OWNER" : "MEMBER",
    banned: user.banned,
    overrides: Object.fromEntries(user.permissions.map((p) => [p.capability, p.effect])) as Partial<
      Record<Capability, "ALLOW" | "DENY">
    >,
  };
}
