// Signature artifact validation: PNG data URLs produced by SignaturePad
// (drawn strokes, typed script rendering, or an uploaded scan/photo
// re-encoded as PNG). Storage-bounded and format pinned — anything else is
// rejected before any database touch.

export const MAX_SIGNATURE_CHARS = 70000
const DATA_URL_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/

export type SignatureMethod = "drawn" | "typed" | "uploaded"

export function validateSignatureArtifact(input: {
  imageData: unknown
  method: unknown
}): { ok: true; imageData: string; method: SignatureMethod } | { ok: false; error: string } {
  const { imageData, method } = input
  if (method !== "drawn" && method !== "typed" && method !== "uploaded") {
    return { ok: false, error: "Unknown signature style." }
  }
  if (typeof imageData !== "string" || !DATA_URL_RE.test(imageData)) {
    return { ok: false, error: "That signature did not save correctly — draw or type it again." }
  }
  if (imageData.length > MAX_SIGNATURE_CHARS) {
    return { ok: false, error: "That signature image is too large — draw it smaller and try again." }
  }
  if (imageData.length < 100) {
    return { ok: false, error: "The signature pad is blank — draw or type your signature first." }
  }
  return { ok: true, imageData, method }
}
