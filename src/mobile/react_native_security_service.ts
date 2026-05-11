import crypto from 'crypto';

/**
 * Production-grade Security Service for React Native.
 * Uses standard Node `crypto` or polyfills/shims such as `react-native-quick-crypto`.
 * Meets standard AES-256-GCM guidelines with PBKDF2 password-to-key-stretching.
 */
export class ReactNativeSecurityService {

  /**
   * Performs 100,000 iterations of PBKDF2 using SHA-256 HMAC to derive a 256-bit (32 bytes) AES key.
   * Runs asynchronously to prevent main loop UI blocking during key calculations.
   * 
   * @param masterPassword The password key.
   * @param salt Symmetrical salt array (minimum 16 bytes recommended).
   */
  static generateKey(masterPassword: string, salt: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const iterations = 100000;
      const keyLength = 32; // 256-bit key

      crypto.pbkdf2(
        masterPassword,
        salt,
        iterations,
        keyLength,
        'sha256',
        (err, derivedKey) => {
          if (err) {
            reject(new Error(`Key derivation system failure: ${err.message}`));
          } else {
            resolve(derivedKey);
          }
        }
      );
    });
  }

  /**
   * Encrypts plaintext using AES-256-GCM.
   * Generates a 12-byte random IV, constructs the cipher, and attaches the 16-byte authentication tag
   * along with the initialization vector to produce a secure, packed payload:
   * 
   * [ 12-byte IV ] + [ 16-byte Auth Tag ] + [ Ciphertext payload ]
   * 
   * @param plaintext Original data string.
   * @param key The derived 32-byte key buffer.
   * @returns Base64 encoded string containing IV + Tag + Ciphertext.
   */
  static encrypt(plaintext: string, key: Buffer): string {
    if (key.length !== 32) {
      throw new Error('Symmetrical key length must be exactly 32 bytes (256-bit AES).');
    }

    // Generate secure 12-byte IV
    const iv = crypto.randomBytes(12);
    
    // Create Cipheriv instance using standard aes-256-gcm
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    // Encrypt the encoded data
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final()
    ]);
    
    // Retrieve GCM authentication tag (16 bytes)
    const tag = cipher.getAuthTag();

    // Pack: IV (12) + Tag (16) + Ciphertext (Variable)
    const packedPayload = Buffer.concat([iv, tag, ciphertext]);
    
    return packedPayload.toString('base64');
  }

  /**
   * Decrypts a cumulative [IV + Tag + Ciphertext] packed Base64 payload using the derived key.
   * Integrates Galois Counter verification of auth tag to prevent padding attacks or tamper attempts.
   * 
   * @param base64Payload Packed Base64 string.
   * @param key The derived 32-byte key buffer.
   * @returns Decrypted plaintext string.
   */
  static decrypt(base64Payload: string, key: Buffer): string {
    if (key.length !== 32) {
      throw new Error('Symmetrical key length must be exactly 32 bytes (256-bit AES).');
    }

    const payloadBuffer = Buffer.from(base64Payload, 'base64');

    // Expected length must account for IV (12) and Auth Tag (16) = minimum 28 bytes
    if (payloadBuffer.length < 28) {
      throw new Error('Cryptographic error: Payload is too short or corrupted.');
    }

    // Unpack bytes
    const iv = payloadBuffer.subarray(0, 12);
    const tag = payloadBuffer.subarray(12, 28);
    const ciphertext = payloadBuffer.subarray(28);

    // Create decipher instance
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    
    // Set authentication tag for verification
    decipher.setAuthTag(tag);

    try {
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      return decrypted.toString('utf8');
    } catch (e: any) {
      throw new Error(`Authentication token tag mismatch: Payload manipulated or incorrect password. ${e.message}`);
    }
  }
}
