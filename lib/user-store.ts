import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");

async function ensureUsersFile(): Promise<void> {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(usersFile, "utf8");
  } catch {
    await writeFile(usersFile, "[]", "utf8");
  }
}

async function readUsers(): Promise<UserRecord[]> {
  await ensureUsersFile();
  const raw = await readFile(usersFile, "utf8");
  try {
    const parsed = JSON.parse(raw) as UserRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeUsers(users: UserRecord[]): Promise<void> {
  await ensureUsersFile();
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const users = await readUsers();
  return users.find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export async function createUser(params: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<UserRecord> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const users = await readUsers();

  const exists = users.some((user) => user.email.toLowerCase() === normalizedEmail);
  if (exists) {
    throw new Error("USER_EXISTS");
  }

  const newUser: UserRecord = {
    id: randomUUID(),
    name: params.name.trim(),
    email: normalizedEmail,
    passwordHash: params.passwordHash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  await writeUsers(users);

  return newUser;
}
