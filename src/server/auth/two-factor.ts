import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;

export class TotpEncryptionKeyError extends Error {}

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.TOTP_ENCRYPTION_KEY;

  if (!configuredKey || !/^[\da-f]{64}$/i.test(configuredKey)) {
    throw new TotpEncryptionKeyError("TOTP_ENCRYPTION_KEY wajib berupa 64 karakter heksadesimal.");
  }

  return Buffer.from(configuredKey, "hex");
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(value: string): Buffer {
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];

  for (const character of value.toUpperCase().replace(/=+$/u, "")) {
    const digit = BASE32_ALPHABET.indexOf(character);

    if (digit === -1) {
      throw new Error("Secret TOTP tersimpan tidak valid.");
    }

    buffer = (buffer << 5) | digit;
    bits += 5;

    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return encodeBase32(randomBytes(20));
}

export function createOtpAuthUri(account: string, issuer: string, secret: string): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: String(TOTP_PERIOD_SECONDS),
  });

  return `otpauth://totp/${label}?${query.toString()}`;
}

export function encryptTotpSecret(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);

  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptTotpSecret(encryptedSecret: string): string {
  const [version, ivText, tagText, ciphertextText, extra] = encryptedSecret.split(".");

  if (version !== "v1" || !ivText || !tagText || !ciphertextText || extra) {
    throw new Error("Secret TOTP tersimpan memiliki format yang tidak valid.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivText, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof TotpEncryptionKeyError) {
      throw error;
    }

    throw new Error("Secret TOTP tidak dapat didekripsi. Periksa TOTP_ENCRYPTION_KEY.", {
      cause: error,
    });
  }
}

function createTotpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary =
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255);

  return String(binary % 1_000_000).padStart(6, "0");
}

function codesEqual(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export function verifyTotpCode(
  secret: string,
  code: string,
  nowMs = Date.now(),
  lastAcceptedStep = -1,
): number | null {
  if (!/^\d{6}$/u.test(code)) {
    return null;
  }

  const currentStep = Math.floor(nowMs / 1000 / TOTP_PERIOD_SECONDS);

  for (
    let step = currentStep - TOTP_WINDOW_STEPS;
    step <= currentStep + TOTP_WINDOW_STEPS;
    step += 1
  ) {
    if (step > lastAcceptedStep && codesEqual(createTotpCode(secret, step), code)) {
      return step;
    }
  }

  return null;
}

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => randomBytes(10).toString("hex").toUpperCase());
}

export function hashRecoveryCode(code: string): string {
  const normalizedCode = code.replace(/[\s-]/gu, "").toUpperCase();

  if (!/^[\da-f]{20}$/iu.test(normalizedCode)) {
    return "";
  }

  return createHash("sha256").update(normalizedCode).digest("hex");
}
