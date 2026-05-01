import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  calculateJwkThumbprint,
  exportJWK,
  exportPKCS8,
  exportSPKI,
  importPKCS8,
  importSPKI,
  generateKeyPair as joseGenerateKeyPair,
} from 'jose'

export interface KeyPairResult {
  privateKey: CryptoKey
  publicKey: CryptoKey
  kid: string
}

export interface JwksDocument {
  keys: JwkPublicKey[]
}

export interface JwkPublicKey {
  kty: string
  use: string
  alg: string
  kid: string
  n?: string
  e?: string
  [key: string]: unknown
}

const PRIVATE_PEM_FILE = 'private.pem'
const PUBLIC_PEM_FILE = 'public.pem'
const KID_FILE = 'kid.txt'
const KEY_ALGORITHM = 'RS256'
const MODULUS_LENGTH = 2048

export async function generateKeyPair(): Promise<KeyPairResult> {
  const { privateKey, publicKey } = await joseGenerateKeyPair(KEY_ALGORITHM, {
    modulusLength: MODULUS_LENGTH,
    extractable: true,
  })

  const publicJwk = await exportJWK(publicKey)
  const kid = await calculateJwkThumbprint(publicJwk)

  return { privateKey, publicKey, kid }
}

export async function exportJwks(publicKey: CryptoKey, kid: string): Promise<JwksDocument> {
  const jwk = await exportJWK(publicKey)

  const keyEntry: JwkPublicKey = {
    ...jwk,
    kty: 'RSA',
    use: 'sig',
    alg: KEY_ALGORITHM,
    kid,
  }

  return { keys: [keyEntry] }
}

export async function loadOrGenerateKeys(keysDir: string): Promise<KeyPairResult> {
  mkdirSync(keysDir, { recursive: true })

  const privatePemPath = join(keysDir, PRIVATE_PEM_FILE)
  const publicPemPath = join(keysDir, PUBLIC_PEM_FILE)
  const kidPath = join(keysDir, KID_FILE)

  if (existsSync(privatePemPath) && existsSync(publicPemPath) && existsSync(kidPath)) {
    const privatePem = readFileSync(privatePemPath, 'utf8')
    const publicPem = readFileSync(publicPemPath, 'utf8')
    const kid = readFileSync(kidPath, 'utf8').trim()

    const privateKey = await importPKCS8(privatePem, KEY_ALGORITHM)
    const publicKey = await importSPKI(publicPem, KEY_ALGORITHM, { extractable: true })

    return { privateKey, publicKey, kid }
  }

  const keys = await generateKeyPair()

  const privatePem = await exportPKCS8(keys.privateKey)
  const publicPem = await exportSPKI(keys.publicKey)

  writeFileSync(privatePemPath, privatePem, { mode: 0o600 })
  writeFileSync(publicPemPath, publicPem)
  writeFileSync(kidPath, keys.kid)

  return keys
}
