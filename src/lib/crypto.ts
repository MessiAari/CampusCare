// Node-only helpers. Imported by server code and by the seed script.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
} from "crypto";

export function anonSecret(): string {
  const s = process.env.ANON_SECRET;
  if (!s || s.length < 16) throw new Error("ANON_SECRET is missing or too short (16+ chars).");
  return s;
}

/** The only link between a student and their reports. One-way: cannot be reversed to a roll number. */
export function anonIdFor(rollNo: string): string {
  return createHmac("sha256", anonSecret()).update(rollNo.trim().toUpperCase()).digest("hex");
}

export function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function encKey(): Buffer {
  return createHash("sha256")
    .update("campuscare-enc:" + (process.env.ENCRYPTION_KEY || anonSecret()))
    .digest();
}

/** AES-256-GCM. Output: iv:tag:ciphertext, each base64. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64")).join(":");
}

export function decrypt(blob: string): string {
  const [iv, tag, ct] = blob.split(":").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function genCaseCode(): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return `CC-${s}`;
}

const WORDS = [
  "river", "maple", "quiet", "amber", "cloud", "stone", "lotus", "ember", "cedar", "harbor",
  "meadow", "falcon", "willow", "copper", "silver", "monsoon", "banyan", "saffron", "indigo", "pebble",
  "lantern", "orchid", "thunder", "valley", "breeze", "candle", "forest", "garden", "island", "jasmine",
  "kettle", "marble", "nectar", "oyster", "pepper", "quartz", "ribbon", "sunset", "temple", "velvet",
];
export function genPassphrase(): string {
  const parts: string[] = [];
  for (let i = 0; i < 4; i++) parts.push(WORDS[randomInt(WORDS.length)]);
  return parts.join("-") + "-" + randomInt(10, 100);
}
