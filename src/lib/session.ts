import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { anonSecret } from "./crypto";

// The student session holds only an anonymous id and/or case ids unlocked with a passphrase.
// No roll number, name or any ERP field ever goes in here.
export type StudentSession = { anon_id?: string; cases?: string[] };

const COOKIE = "campuscare_s";
const key = () => new TextEncoder().encode("session:" + anonSecret());

export async function getSession(): Promise<StudentSession | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { anon_id: payload.anon_id as string | undefined, cases: (payload.cases as string[]) ?? [] };
  } catch {
    return null;
  }
}

export async function setSession(s: StudentSession) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(key());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}
