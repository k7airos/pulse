import { customAlphabet } from 'nanoid'

const nano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16)
const keyNano = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 32)

export function newId(prefix = '') {
  return prefix ? `${prefix}_${nano()}` : nano()
}

export function newPublicId() {
  return `ws_${nano()}`
}

export function newApiKeyPlain() {
  // pk_live_<32>
  return `pk_live_${keyNano()}`
}

export function keyPrefixOf(plain: string) {
  return plain.slice(0, 12)
}

const shareNano = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 24)

/** Unguessable token for read-only share links. */
export function newShareId() {
  return shareNano()
}
