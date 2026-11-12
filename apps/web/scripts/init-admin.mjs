import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { Pool } from "pg";
import { hashPassword } from "../src/server/domain/password.ts";
// Run from apps/web; initialization never overwrites an existing configured account.
if (process.env.ADMIN_PASSWORD_HASH || existsSync(".env.admin.local"))
  throw Error("Admin already configured; use documented reset procedure.");
const username = "admin";
const password = randomBytes(24).toString("base64url");
const hash = await hashPassword(password);
const db = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await db.query(
    'INSERT INTO "User" (id,"githubId",name,role,"updatedAt") VALUES ($1,$2,$3,\'OWNER\',now()) ON CONFLICT ("githubId") DO NOTHING',
    [randomUUID(), `local:${username}`, username],
  );
  writeFileSync(".env.admin.local", `ADMIN_USERNAME=${username}\nADMIN_PASSWORD_HASH=${hash}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  writeFileSync(".admin-credentials.local.txt", `Username: ${username}\nPassword: ${password}\n`, {
    mode: 0o600,
    flag: "wx",
  });
  console.log("Admin initialized. Credentials: apps/web/.admin-credentials.local.txt");
} finally {
  await db.end();
}
