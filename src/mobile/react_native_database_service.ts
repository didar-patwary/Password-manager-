import SQLite from 'react-native-sqlite-storage';
import { ReactNativeSecurityService } from './react_native_security_service';
import { ClientRecord, SyncStatus } from '../types';

// Enable Promise-based API for react-native-sqlite-storage wrappers
SQLite.enablePromise(true);

/**
 * A highly secured, zero-knowledge SQLite storage orchestrator for React Native.
 * Uses `react-native-sqlite-storage` and AES-256-GCM symmetric decryption layers
 * to protect passwords, secure forms, and secrets offline on the mobile hardware.
 */
export class ReactNativeDatabaseService {
  private static dbInstance: SQLite.SQLiteDatabase | null = null;
  private static readonly DB_NAME = 'hermitvault.db';

  /**
   * Safe getter to retrieve or hot-load the active SQLite database instance.
   */
  static async getDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    // Initialize the DB reference
    const db = await SQLite.openDatabase({
      name: this.DB_NAME,
      location: 'default',
    });

    // Run structural initializations
    await this.initSchema(db);
    this.dbInstance = db;
    return db;
  }

  /**
   * Declares core SQL definitions.
   * Isolates system meta settings and encrypted row dumps.
   */
  private static async initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.transaction((tx) => {
      // 1. Storage config parameters (salt, validation checkpoints)
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS system_config (
          config_key TEXT PRIMARY KEY,
          config_value TEXT NOT NULL
        );
      `);

      // 2. Main Encrypted SQLite Table dump
      tx.executeSql(`
        CREATE TABLE IF NOT EXISTS vault_records (
          id TEXT PRIMARY KEY,
          collection TEXT NOT NULL,
          encrypted_payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          client_scope_id TEXT NOT NULL,
          sync_status TEXT NOT NULL,
          version INTEGER NOT NULL
        );
      `);

      // 3. Optimal performance index bindings
      tx.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_records_collection ON vault_records (collection);
      `);
      tx.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_records_sync_status ON vault_records (sync_status);
      `);
    });
  }

  /**
   * Cryptographically validates the entered master password against the DB secure check-structure.
   * If the app is launched for the first time, a random securely-generated 16-byte salt is persisted, 
   * a Pbkdf2 key drawn, and a test signature crafted.
   * On subsequent launches, credentials are verified by drawing and checking the verification block.
   * 
   * Returns derived 32-byte security master key Buffer on success, or throws Security Error.
   */
  static async authenticateAndDeriveKey(masterPassword: string): Promise<Buffer> {
    const db = await this.getDatabase();

    // Query pre-existing salt
    const [saltResults] = await db.executeSql(
      'SELECT config_value FROM system_config WHERE config_key = ?;',
      ['pbkdf2_salt']
    );

    if (saltResults.rows.length === 0) {
      // Fresh Launch: Setup zero-knowledge credential matrix
      // 1. Generate random salt bytes (16 bytes)
      const saltBytes = require('crypto').randomBytes(16);
      const saltBase64 = saltBytes.toString('base64');

      // 2. Derive key using 100,000 pbkdf2 rounds
      const aesKey = await ReactNativeSecurityService.generateKey(masterPassword, saltBytes);

      // 3. Synthesize verification token string and encrypt it
      const verificationString = 'hermitvault_verified_and_intact';
      const encryptedBlock = ReactNativeSecurityService.encrypt(verificationString, aesKey);

      // 4. Save to the configuration database table
      await db.transaction((tx) => {
        tx.executeSql('INSERT INTO system_config (config_key, config_value) VALUES (?, ?);', [
          'pbkdf2_salt',
          saltBase64,
        ]);
        tx.executeSql('INSERT INTO system_config (config_key, config_value) VALUES (?, ?);', [
          'verification_block',
          encryptedBlock,
        ]);
      });

      return aesKey;
    } else {
      // Warm Start: Verify entered password match
      const saltBase64 = saltResults.rows.item(0).config_value;
      const saltBytes = Buffer.from(saltBase64, 'base64');

      // Derive AES PBKDF2 Key from provided password
      const aesKey = await ReactNativeSecurityService.generateKey(masterPassword, saltBytes);

      // Pull validation signature block from database
      const [verificationResults] = await db.executeSql(
        'SELECT config_value FROM system_config WHERE config_key = ?;',
        ['verification_block']
      );

      if (verificationResults.rows.length === 0) {
        throw new Error('Database State Corruption: Salt exists but verifier token block is missing.');
      }

      const storedVerificationBlock = verificationResults.rows.item(0).config_value;

      try {
        const decryptedVerifier = ReactNativeSecurityService.decrypt(storedVerificationBlock, aesKey);
        
        if (decryptedVerifier === 'hermitvault_verified_and_intact') {
          return aesKey; // Successfully logged in! Key matches structure
        } else {
          throw new Error('Mnemonic Password Verification Error: Derived symmetric credentials mismatched.');
        }
      } catch (err) {
        throw new Error('Authentication Rejected: Symmetrical validation hash invalid (password incorrect or payload tampered).');
      }
    }
  }

  /**
   * Encrypts and saves or updates a vault record in the local database.
   * 
   * @param record Client record conforming to HermitVault specifications.
   * @param aesKey Cryptographic AES key derived from authenticated handshake.
   */
  static async saveRecord(record: ClientRecord, aesKey: Buffer): Promise<void> {
    const db = await this.getDatabase();

    // 1. Serialize data dict to plain JSON string
    const plaintextJsonData = JSON.stringify(record.data);

    // 2. Perform AES-256-GCM encryption
    const encryptedPayload = ReactNativeSecurityService.encrypt(plaintextJsonData, aesKey);

    // 3. Upsert into database
    await db.executeSql(
      `INSERT OR REPLACE INTO vault_records 
       (id, collection, encrypted_payload, updated_at, client_scope_id, sync_status, version) 
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        record.id,
        record.collection,
        encryptedPayload,
        record.updatedAt,
        record.clientScopeId,
        record.syncStatus,
        record.version,
      ]
    );
  }

  /**
   * Reads, decrypts, and reconstitutes a specific record.
   * 
   * @param id The record UUID.
   * @param aesKey Cryptographic AES key.
   */
  static async getRecord(id: string, aesKey: Buffer): Promise<ClientRecord | null> {
    const db = await this.getDatabase();

    const [results] = await db.executeSql(
      'SELECT * FROM vault_records WHERE id = ? LIMIT 1;',
      [id]
    );

    if (results.rows.length === 0) {
      return null;
    }

    const row = results.rows.item(0);
    
    try {
      // Decrypt encrypted payload back to string
      const decryptedString = ReactNativeSecurityService.decrypt(row.encrypted_payload, aesKey);
      const dataPayload = JSON.parse(decryptedString);

      return {
        id: row.id,
        collection: row.collection,
        data: dataPayload,
        updatedAt: row.updated_at,
        clientScopeId: row.client_scope_id,
        syncStatus: row.sync_status as SyncStatus,
        version: row.version,
      };
    } catch (e: any) {
      throw new Error(`Data Tampering Detected: Unable to decrypt target node payload. ${e.message}`);
    }
  }

  /**
   * Resolves and decrypts all records matching a target collection filter.
   * Skips single erroneous rows gracefully to preserve rendering of undamaged cells.
   */
  static async getCollection(collectionId: string, aesKey: Buffer): Promise<ClientRecord[]> {
    const db = await this.getDatabase();

    const [results] = await db.executeSql(
      'SELECT * FROM vault_records WHERE collection = ? ORDER BY updated_at DESC;',
      [collectionId]
    );

    const decryptedRecords: ClientRecord[] = [];

    for (let i = 0; i < results.rows.length; i++) {
      const row = results.rows.item(i);
      try {
        const decryptedString = ReactNativeSecurityService.decrypt(row.encrypted_payload, aesKey);
        const dataPayload = JSON.parse(decryptedString);

        decryptedRecords.push({
          id: row.id,
          collection: row.collection,
          data: dataPayload,
          updatedAt: row.updated_at,
          clientScopeId: row.client_scope_id,
          syncStatus: row.sync_status as SyncStatus,
          version: row.version,
        });
      } catch (err) {
        console.warn(`[ReactNativeDatabaseService] Decrypt skipped for corrupted row ${row.id}:`, err);
      }
    }

    return decryptedRecords;
  }

  /**
   * Deletes a record from the local SQLite store.
   * 
   * @param id The record UUID.
   */
  static async deleteRecord(id: string): Promise<void> {
    const db = await this.getDatabase();
    await db.executeSql('DELETE FROM vault_records WHERE id = ?;', [id]);
  }

  /**
   * Resets local mobile configurations and databases to baseline zero-knowledge status.
   */
  static async wipeAllLocalCaches(): Promise<void> {
    const db = await this.getDatabase();
    await db.transaction((tx) => {
      tx.executeSql('DELETE FROM vault_records;');
      tx.executeSql('DELETE FROM system_config;');
    });
  }
}
