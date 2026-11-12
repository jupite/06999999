import "server-only";
import { config } from "dotenv";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GitHubProvider from "next-auth/providers/github";
import { verifyPassword } from "./domain/password";
import { getDb } from "./db";
import { accountActor, hasCurrentSession, type Actor } from "./domain/permissions";
config({ path: ".env.admin.local", quiet: true });
export function authConfigured() {
  return Boolean(process.env.NEXTAUTH_SECRET && process.env.DATABASE_URL);
}
export function githubConfigured() {
  return (
    authConfigured() && Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET)
  );
}
export function passwordConfigured() {
  return authConfigured() && Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH);
}
const globalAuth = globalThis as unknown as { passwordAttempts?: { count: number; until: number } };
export const authOptions: NextAuthOptions = {
  providers: [
    ...(githubConfigured()
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "Account password",
      credentials: { username: { type: "text" }, password: { type: "password" } },
      async authorize(credentials) {
        if (!passwordConfigured()) return null;
        const username = credentials?.username ?? "";
        const password = credentials?.password ?? "";
        if (username.length > 64 || password.length > 256 || !password) return null;
        const now = Date.now();
        if (!globalAuth.passwordAttempts || globalAuth.passwordAttempts.until <= now)
          globalAuth.passwordAttempts = { count: 0, until: now + 15 * 60 * 1000 };
        const attempts = globalAuth.passwordAttempts;
        if (attempts.count >= 5) return null;
        attempts.count++;
        const valid = await verifyPassword(password, process.env.ADMIN_PASSWORD_HASH!);
        if (username !== process.env.ADMIN_USERNAME || !valid) return null;
        const user = await getDb().user.findUnique({ where: { githubId: "local:" + username } });
        if (!user || user.banned || user.role !== "OWNER") return null;
        attempts.count = 0;
        return { id: user.id, name: user.name };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === "credentials") return true;
      if (account?.provider !== "github" || !account.providerAccountId) return false;
      const githubId = account.providerAccountId;
      if (!/^\d+$/.test(githubId)) return false;
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
    async jwt({ token, account, user: signedInUser }) {
      const githubId =
        account?.provider === "credentials"
          ? (
              await getDb().user.findUnique({
                where: { id: signedInUser.id },
                select: { githubId: true },
              })
            )?.githubId
          : account?.provider === "github"
            ? account.providerAccountId
            : token.githubId;
      if (typeof githubId !== "string") return token;
      const user = await getDb().user.findUnique({
        where: { githubId },
        select: { banned: true, sessionVersion: true },
      });
      if (account)
        return user && !user.banned
          ? { ...token, githubId, sessionVersion: user.sessionVersion }
          : {};
      return hasCurrentSession(user, token.sessionVersion) ? token : {};
    },
    async session({ session, token }) {
      if (typeof token.githubId !== "string") return { expires: session.expires };
      return {
        ...session,
        githubId: token.githubId,
        sessionVersion: typeof token.sessionVersion === "number" ? token.sessionVersion : undefined,
      };
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
  if (!user || !hasCurrentSession(user, session.sessionVersion)) return null;
  return accountActor(user, process.env.OWNER_GITHUB_ID);
}
