/**
 * Secure Crypto Service utilizing standard browser WebCrypto APIs.
 * This mirrors the high-level logic used in mobile KeyStore/Keychain integrations
 * and provides 100% real cryptographically secure operations.
 */

// Helper to convert Uint8Array into Base64 string
export function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = '';
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 string into Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derives a cryptographic key from a master password using PBKDF2.
 * @param password The master password text
 * @param salt The cryptographic salt (at least 16 bytes)
 * @param iterations The number of hashing iterations (default: 100,000)
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  // 1. Import password string as a base key raw material
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    { name: 'PBKDF2' },
    false, // key is not extractable
    ['deriveKey', 'deriveBits']
  );

  // 2. Derive a symmetrical AES-GCM 256-bit key
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true, // let it be extractable for offline diagnostics if user wants to see it
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param plaintext String to encrypt
 * @param key Cryptographic Derived Symmetrical Key
 */
export async function encryptAESGCM(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Generate a random cryptographically secure 12-byte initialization vector (96-bit)
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // Perform standard AES-GCM encryption with 128-bit integrity tag appended by default
  const cipherBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      tagLength: 128, // 16 bytes auth tag
    },
    key,
    plaintextBytes
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(cipherBuffer)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload.
 * @param ciphertextBase64 Base64 encoded encrypted string (includes data + tag)
 * @param ivBase64 Base64 encoded initialization vector
 * @param key Symmetrical Derived Cryptographic Key
 */
export async function decryptAESGCM(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const cipherBytes = base64ToUint8Array(ciphertextBase64);
  const ivBytes = base64ToUint8Array(ivBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
      tagLength: 128,
    },
    key,
    cipherBytes
  );

  return decoder.decode(decryptedBuffer);
}

/**
 * Generates cryptographically secure random bytes (e.g. for a salt or key).
 * @param byteLength Number of random bytes requested
 */
export function generateRandomBytes(byteLength = 16): Uint8Array {
  return window.crypto.getRandomValues(new Uint8Array(byteLength));
}

const SECURE_WORDLIST = [
  'alpha', 'beacon', 'carbon', 'danger', 'enclave', 'forest', 'glitch', 'hybrid', 'index', 'jacket',
  'kernel', 'ledger', 'matrix', 'nephew', 'oxygen', 'phantom', 'quantum', 'radar', 'shield', 'tunnel',
  'vector', 'walnut', 'xenon', 'yellow', 'zenith', 'anchor', 'bronze', 'copper', 'dynamic', 'entropy',
  'fossil', 'galaxy', 'hazard', 'infinit', 'jordan', 'knight', 'legacy', 'magnet', 'neutron', 'orchid',
  'proton', 'quartz', 'rebel', 'system', 'theory', 'uranium', 'vortex', 'whisper', 'nexus', 'zodiac',
  'axis', 'blitz', 'cipher', 'derive', 'echo', 'flux', 'gravity', 'horizon', 'impulse', 'junction',
  'kinetic', 'luminous', 'momentum', 'nebula', 'opaque', 'pulse', 'resolv', 'spectral', 'tactical', 'ultrabond'
];

/**
 * Generates a cryptographically secure 24-word seed phrase.
 */
export function generateMnemonicPhrase(): string {
  const words: string[] = [];
  const randomIndices = new Uint32Array(24);
  window.crypto.getRandomValues(randomIndices);
  
  for (let i = 0; i < 24; i++) {
    const wordIndex = randomIndices[i] % SECURE_WORDLIST.length;
    words.push(SECURE_WORDLIST[wordIndex]);
  }
  return words.join(' ');
}
