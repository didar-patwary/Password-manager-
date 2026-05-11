import 'dart:convert';
import 'dart:typed_data';
import 'dart:math';
import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;
import 'flutter_security_service.dart';

/// Representation of Client Vault Records conforming to the zero-knowledge model.
class ClientRecord {
  final String id;
  final String collection;
  final Map<String, dynamic> data;
  final int updatedAt;
  final String clientScopeId;
  final String syncStatus;
  final int version;

  ClientRecord({
    required this.id,
    required this.collection,
    required this.data,
    required this.updatedAt,
    required this.clientScopeId,
    required this.syncStatus,
    required this.version,
  });

  factory ClientRecord.fromMap(Map<String, dynamic> map, Map<String, dynamic> decryptedData) {
    return ClientRecord(
      id: map['id'] as String,
      collection: map['collection'] as String,
      data: decryptedData,
      updatedAt: map['updated_at'] as int,
      clientScopeId: map['client_scope_id'] as String,
      syncStatus: map['sync_status'] as String,
      version: map['version'] as int,
    );
  }

  Map<String, dynamic> toDatabaseRow(String encryptedDataString) {
    return {
      'id': id,
      'collection': collection,
      'encrypted_payload': encryptedDataString,
      'updated_at': updatedAt,
      'client_scope_id': clientScopeId,
      'sync_status': syncStatus,
      'version': version,
    };
  }
}

/// A Secure Database Manager for Flutter executing locally encrypted SQL storage actions.
class FlutterDatabaseService {
  static Database? _database;
  static const String _dbName = 'hermitvault.db';
  static const int _dbVersion = 1;

  // Singleton approach
  static final FlutterDatabaseService instance = FlutterDatabaseService._init();
  FlutterDatabaseService._init();

  /// Gets the initialized active SQL database context. Null-safety.
  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB(_dbName);
    return _database!;
  }

  /// Configures local file structures and opens connection
  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, filePath);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _createDB,
    );
  }

  /// Initial DB installation schemas
  Future<void> _createDB(Database db, int version) async {
    // 1. Key configuration metadata store
    await db.execute('''
      CREATE TABLE IF NOT EXISTS system_config (
        config_key TEXT PRIMARY KEY,
        config_value TEXT NOT NULL
      )
    ''');

    // 2. Client records table containing encrypted payloads
    await db.execute('''
      CREATE TABLE IF NOT EXISTS vault_records (
        id TEXT PRIMARY KEY,
        collection TEXT NOT NULL,
        encrypted_payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        client_scope_id TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        version INTEGER NOT NULL
      )
    ''');

    // Indices for optimal query speed during updates and sync runs
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_records_collection ON vault_records (collection)
    ''');
    
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_records_sync_status ON vault_records (sync_status)
    ''');
  }

  /// Derives and validates the AES encryption key using PBKDF2.
  /// If this is a first-time setup, a random salt and validation block are created.
  /// If it is an unlock attempt, the key is derived from the retrieved salt and validated.
  /// Returns a valid 32-byte key on success or throws an exception on error.
  Future<Uint8List> authenticateAndDeriveKey(String masterPassword) async {
    final db = await database;

    // Check if configuration already has keying parameters
    final List<Map<String, dynamic>> saltResult = await db.query(
      'system_config',
      where: 'config_key = ?',
      whereArgs: ['pbkdf2_salt'],
    );

    if (saltResult.isEmpty) {
      // Setup master key setup for the first time
      // 1. Generate 16 bytes secure salt
      final random = Random.secure();
      final saltBytes = Uint8List(16);
      for (int i = 0; i < 16; i++) {
        saltBytes[i] = random.nextInt(256);
      }
      final saltBase64 = base64.encode(saltBytes);

      // 2. Derive key using 100,000 rounds
      final aesKey = FlutterSecurityService.generateKey(masterPassword, saltBytes);

      // 3. Encrypt verification block
      final verificationPayload = 'hermitvault_verified_and_intact';
      final verificationBlock = FlutterSecurityService.encrypt(verificationPayload, aesKey);

      // 4. Save into DB metadata
      await db.transaction((txn) async {
        await txn.insert('system_config', {
          'config_key': 'pbkdf2_salt',
          'config_value': saltBase64,
        });
        await txn.insert('system_config', {
          'config_key': 'verification_block',
          'config_value': verificationBlock,
        });
      });

      return aesKey;
    } else {
      // Salt exists, perform validation
      final saltBase64 = saltResult.first['config_value'] as String;
      final saltBytes = base64.decode(saltBase64);

      // Derive key
      final aesKey = FlutterSecurityService.generateKey(masterPassword, saltBytes);

      // Retrieve validation block
      final List<Map<String, dynamic>> verificationResult = await db.query(
        'system_config',
        where: 'config_key = ?',
        whereArgs: ['verification_block'],
      );

      if (verificationResult.isEmpty) {
        throw StateError('Corruption error: Database contains salt but verification block is absent.');
      }

      final storedVerificationBlock = verificationResult.first['config_value'] as String;

      try {
        final decryptedVerifier = FlutterSecurityService.decrypt(storedVerificationBlock, aesKey);
        if (decryptedVerifier == 'hermitvault_verified_and_intact') {
          return aesKey;
        } else {
          throw SecurityException('Permission Denied: Invalid Master Password signature.');
        }
      } catch (e) {
        throw SecurityException('Permission Denied: Symmetric verification failed (incorrect credentials or tampered payload).');
      }
    }
  }

  /// Encrypts and inserts or replaces a client record in the database.
  Future<void> saveRecord({
    required ClientRecord record,
    required Uint8List aesKey,
  }) async {
    final db = await database;

    // Convert Record fields to JSON format before encrypting
    final rawJsonBytes = utf8.encode(json.encode(record.data));
    final plainTextJson = utf8.decode(rawJsonBytes);

    // Encrypt JSON block
    final encryptedPayload = FlutterSecurityService.encrypt(plainTextJson, aesKey);

    // Write row to SQL table
    final Map<String, dynamic> row = record.toDatabaseRow(encryptedPayload);

    await db.insert(
      'vault_records',
      row,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// Retrieves and decrypts a specific record from the database.
  Future<ClientRecord?> getRecord({
    required String id,
    required Uint8List aesKey,
  }) async {
    final db = await database;

    final List<Map<String, dynamic>> results = await db.query(
      'vault_records',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (results.isEmpty) return null;

    final row = results.first;
    final encryptedPayload = row['encrypted_payload'] as String;

    try {
      final decryptedJson = FlutterSecurityService.decrypt(encryptedPayload, aesKey);
      final decryptedData = json.decode(decryptedJson) as Map<String, dynamic>;

      return ClientRecord.fromMap(row, decryptedData);
    } catch (e) {
      throw SecurityException('Integrity Breach: Unable to decrypt target record payload. $e');
    }
  }

  /// Retrieves, decrypts, and filters all vault records under a specific collection namespace.
  Future<List<ClientRecord>> getCollection({
    required String collectionId,
    required Uint8List aesKey,
  }) async {
    final db = await database;

    final List<Map<String, dynamic>> results = await db.query(
      'vault_records',
      where: 'collection = ?',
      whereArgs: [collectionId],
      orderBy: 'updated_at DESC',
    );

    final List<ClientRecord> records = [];

    for (final row in results) {
      final encryptedPayload = row['encrypted_payload'] as String;
      try {
        final decryptedJson = FlutterSecurityService.decrypt(encryptedPayload, aesKey);
        final decryptedData = json.decode(decryptedJson) as Map<String, dynamic>;
        
        records.add(ClientRecord.fromMap(row, decryptedData));
      } catch (e) {
        // Log individual item errors and skip so a single corrupted item doesn't crash the whole UI
        print('Warning: Skipped decrypting record ID ${row['id']}: $e');
      }
    }

    return records;
  }

  /// Deletes a record from the vault of local SQLite nodes.
  Future<int> deleteRecord(String id) async {
    final db = await database;
    return await db.delete(
      'vault_records',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Erases all application data from the local database on client request.
  Future<void> wipeAllLocalCaches() async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.delete('vault_records');
      await txn.delete('system_config');
    });
  }
}
