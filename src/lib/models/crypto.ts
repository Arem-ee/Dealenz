import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto"

// Envelope encryption for user-held provider keys (BYOK). AES-256-GCM with
// a server-held 32-byte key (MODEL_KEYS_ENCRYPTION_KEY, 64 hex chars).
// Envelope layout (base64): version(1) || iv(12) || tag(16) || ciphertext.
// Decryption is constant-shape: wrong key or tampered envelope fails
// closed, never partial plaintext. Keys are decrypted only for the live
// provider call and discarded immediately after.

const VERSION = 0x01

function masterKey(): Buffer {
  const hex = process.env.MODEL_KEYS_ENCRYPTION_KEY ?? ""
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("Model key storage is not configured.")
  }
  return Buffer.from(hex, "hex")
}

export function encryptSecret(plain: string): string {
  if (!plain) throw new Error("Nothing to encrypt.")
  const key = masterKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ciphertext]).toString("base64")
}

export function decryptSecret(envelope: string): string {
  const key = masterKey()
  const raw = Buffer.from(envelope, "base64")
  if (raw.length < 1 + 12 + 16 + 1 || raw[0] !== VERSION) {
    throw new Error("Stored key is unreadable.")
  }
  const iv = raw.subarray(1, 13)
  const tag = raw.subarray(13, 29)
  const ciphertext = raw.subarray(29)
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
    if (!plain) throw new Error("Stored key is unreadable.")
    return plain
  } catch {
    throw new Error("Stored key is unreadable.")
  }
}

// Key-shape validation per provider (format only — live verification
// happens on first use, and failures mark the key, never silently pass).
export function keyShapeFor(provider: string): { prefix: string; minLength: number } | null {
  if (provider === "anthropic") return { prefix: "sk-ant-", minLength: 20 }
  if (provider === "gemini") return { prefix: "AIza", minLength: 20 }
  if (provider === "openai_compatible") return { prefix: "sk-", minLength: 20 }
  return null
}

export function validateKeyShape(provider: string, secret: string): string | null {
  const shape = keyShapeFor(provider)
  if (!shape) return "Unknown provider."
  if (!secret.startsWith(shape.prefix) || secret.trim().length < shape.minLength) {
    return `That doesn't look like an ${provider} key (expected ${shape.prefix}…).`
  }
  return null
}

export function secretsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
