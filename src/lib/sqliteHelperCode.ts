// SQLite Database Helper for Mobile Applications with Zero-Knowledge E2EE Encryption
// Compatible with React Native (expo-sqlite / react-native-quick-sqlite), Flutter ffi, or SQLite3.

export const SQL_HELPER_CODE_MOBILE = `/**
 * SQLite Encryption Database Helper
 * File: SecureVaultDatabase.ts
 *
 * Implements AES-256-GCM authenticated encryption for database credentials.
 * Ensures rows are encrypted before being persisted to the SQLite file.
 * Prevents shoulder-surfing and raw SQLite database scraping.
 */

import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

// Types for Vault Item shape
export interface CredentialRow {
  id: string;
  service: string;
  username: string;
  encryptedPassword: string; // AES-GCM Encrypted
  iv: string;                 // Base64 encoded Initialization Vector
  authTag: string;            // Base64 encoded GCM Authentication Tag
  category: string;
  website?: string;
  updatedAt: number;
}

export class SecureVaultDatabase {
  private db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync('hermit_vault.db');
    this.initializeTable();
  }

  /**
   * Drops or bootstraps the SQLite local-first tables
   */
  private initializeTable() {
    this.db.execSync(\`
      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY NOT NULL,
        service TEXT NOT NULL,
        username TEXT NOT NULL,
        encrypted_password TEXT NOT NULL,
        iv TEXT NOT NULL,
        auth_tag TEXT NOT NULL,
        category TEXT NOT NULL,
        website TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_category ON credentials(category);
    \`);
    console.log('[SQLite] Local database schemas provisioned with secure columns.');
  }

  /**
   * Helper function: Implements WebCrypto GCM mode AES-256 encryption.
   * Derives a cryptographic crypt-key from the user's unlocked Master Password.
   */
  private async encryptString(plaintext: string, secretKey: string): Promise<{ ciphertext: string; iv: string; tag: string }> {
    // In a real mobile app, derive a robust key from Master Password via PBKDF2 first:
    // This example uses a standard AES-GCM payload cipher pipeline.
    
    // 1. Generate a secure 96-bit (12-byte) initialization vector
    const ivBytes = await Crypto.getRandomBytesAsync(12);
    const ivB64 = Buffer.from(ivBytes).toString('base64');

    // 2. Derive symmetrical AES key from the Master Password
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey.padEnd(32, '0').slice(0, 32)), // Padding / key length normalization
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // 3. Encrypt payload
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: ivBytes },
      keyMaterial,
      encoder.encode(plaintext)
    );

    // Extract auth tag from the end of the ciphertext (standard WebCrypto structure)
    const totalBytes = new Uint8Array(cipherBuffer);
    const tagLength = 16; // 128-bit authentication strength tag
    const ciphertextBytes = totalBytes.slice(0, totalBytes.length - tagLength);
    const tagBytes = totalBytes.slice(totalBytes.length - tagLength);

    return {
      ciphertext: Buffer.from(ciphertextBytes).toString('base64'),
      iv: ivB64,
      tag: Buffer.from(tagBytes).toString('base64')
    };
  }

  /**
   * Helper function: Decrypts an AES-256-GCM cipher block using the Master Password key
   */
  private async decryptString(ciphertextB64: string, ivB64: string, tagB64: string, secretKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // 1. Rebuild raw key reference
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey.padEnd(32, '0').slice(0, 32)),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // 2. Concatenate ciphertext and tag bytes for standard WebCrypto decrypt API
    const cipherBytes = Uint8Array.from(Buffer.from(ciphertextB64, 'base64'));
    const tagBytes = Uint8Array.from(Buffer.from(tagB64, 'base64'));
    const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
    combined.set(cipherBytes, 0);
    combined.set(tagBytes, cipherBytes.length);

    const ivBytes = Uint8Array.from(Buffer.from(ivB64, 'base64'));

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      keyMaterial,
      combined
    );

    return decoder.decode(decryptedBuffer);
  }

  /**
   * CRUD Operation: Save/Insert a new encrypted credential row
   */
  public async saveCredential(
    service: string,
    username: string,
    plainPassword: string,
    category: string,
    website: string,
    secretKey: string
  ): Promise<string> {
    const id = 'cred_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    const updatedAt = Date.now();

    // Zero-Knowledge Encrypt the Password block!
    const { ciphertext, iv, tag } = await this.encryptString(plainPassword, secretKey);

    // Run SQL prepared transaction
    this.db.runSync(
      \`INSERT OR REPLACE INTO credentials (
        id, service, username, encrypted_password, iv, auth_tag, category, website, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);\`,
      [id, service, username, ciphertext, iv, tag, category, website, updatedAt]
    );

    console.log(\`[SQLite] Securely persisted item: \${service} with encrypted key.\`);
    return id;
  }

  /**
   * CRUD Operation: Reads and decrypts credentials for a category
   */
  public async readAllCredentials(secretKey: string): Promise<CredentialRow[]> {
    const results = this.db.getAllSync<any>(\`SELECT * FROM credentials ORDER BY updated_at DESC;\`);
    const decryptedRows: CredentialRow[] = [];

    for (const row of results) {
      try {
        const plainPassword = await this.decryptString(
          row.encrypted_password,
          row.iv,
          row.auth_tag,
          secretKey
        );
        decryptedRows.push({
          id: row.id,
          service: row.service,
          username: row.username,
          encryptedPassword: plainPassword, // Decrypted for safe active UI use
          iv: row.iv,
          authTag: row.auth_tag,
          category: row.category,
          website: row.website,
          updatedAt: row.updated_at
        });
      } catch (err) {
        console.error(\`[SQLite] Decryption of item \${row.id} failed. Key might be locked or incorrect.\`);
      }
    }
    return decryptedRows;
  }

  /**
   * CRUD Operation: Delete a credential by ID
   */
  public deleteCredential(id: string): void {
    this.db.runSync(\`DELETE FROM credentials WHERE id = ?;\`, [id]);
    console.log(\`[SQLite] Row \${id} deleted from device storage.\`);
  }
}
`;
