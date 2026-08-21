/**
 * Create (or update) an admin account.
 *
 *   node scripts/create-admin.mjs
 *   node scripts/create-admin.mjs ibrahim@example.com "Ibrahim"
 *
 * The password is typed at a prompt, never passed as an argument — arguments
 * end up in shell history and in `ps` output. Nothing secret lives in this file,
 * which is why it belongs in git: anyone with database access can run it.
 *
 * Re-running with an existing email resets that account's password and signs
 * out its existing sessions.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";
import pg from "pg";
import { hashPassword } from "../src/lib/password.ts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Run with it in the environment, e.g.\n" +
      "  DATABASE_URL=postgresql://... node scripts/create-admin.mjs",
  );
  exit(1);
}

const CTRL_C = "\u0003";
const BACKSPACE = ["\u007f", "\u0008"];

/** Read a line without echoing it, so the password never appears on screen. */
async function secret(prompt) {
  stdout.write(prompt);
  const wasRaw = Boolean(stdin.isRaw);
  stdin.setRawMode?.(true);

  let value = "";
  for await (const chunk of stdin) {
    const s = chunk.toString("utf8");
    if (s === "\r" || s === "\n") break;
    if (s === CTRL_C) {
      stdin.setRawMode?.(wasRaw);
      stdout.write("\n");
      exit(130);
    }
    if (BACKSPACE.includes(s)) {
      value = value.slice(0, -1);
      continue;
    }
    value += s;
  }

  stdin.setRawMode?.(wasRaw);
  stdout.write("\n");
  return value;
}

const rl = createInterface({ input: stdin, output: stdout });

const email = (argv[2] ?? (await rl.question("Email: "))).trim().toLowerCase();
const nameInput = argv[3] ?? (await rl.question("Name (optional): "));
const name = nameInput.trim() || null;

rl.close();

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error(`"${email}" doesn't look like an email address.`);
  exit(1);
}

const password = await secret("Password: ");
const confirm = await secret("Confirm:  ");

if (password !== confirm) {
  console.error("Passwords don't match.");
  exit(1);
}
if (password.length < 12) {
  console.error("Use at least 12 characters — this account can publish and delete everything.");
  exit(1);
}

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const password_hash = await hashPassword(password);

  // `xmax = 0` is true only for a freshly inserted row, which is how we tell a
  // new account apart from a password reset.
  const { rows } = await db.query(
    `INSERT INTO users (email, name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (lower(email)) DO UPDATE
       SET password_hash = excluded.password_hash,
           name          = coalesce(excluded.name, users.name)
     RETURNING id, (xmax = 0) AS created`,
    [email, name, password_hash],
  );

  const { id, created } = rows[0];

  if (created) {
    console.log(`Created admin ${email}.`);
  } else {
    // A password reset should not leave old sessions alive.
    const { rowCount } = await db.query(`DELETE FROM sessions WHERE user_id = $1`, [id]);
    console.log(`Password updated for ${email}. ${rowCount} existing session(s) signed out.`);
  }
} catch (err) {
  if (err.code === "42P01") {
    console.error("The `users` table doesn't exist — run db/0003_auth.sql first.");
  } else {
    console.error(err.message);
  }
  exit(1);
} finally {
  await db.end();
}
