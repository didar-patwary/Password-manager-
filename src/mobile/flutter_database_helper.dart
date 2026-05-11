import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart' as p;

/// Represents a secure credential item mapped directly to the local SQLite schema.
class CredentialItem {
  final String? id;
  final String serviceName;
  final String username;
  final String encryptedPassword;
  final String iv;
  final String category;

  CredentialItem({
    this.id,
    required this.serviceName,
    required this.username,
    required this.encryptedPassword,
    required this.iv,
    required this.category,
  });

  /// Instantiates a CredentialItem from a database record row map.
  factory CredentialItem.fromMap(Map<String, dynamic> map) {
    return CredentialItem(
      id: map['id']?.toString(),
      serviceName: map['service_name'] as String,
      username: map['username'] as String,
      encryptedPassword: map['encrypted_password'] as String,
      iv: map['iv'] as String,
      category: map['category'] as String,
    );
  }

  /// Converts the current CredentialItem into an SQLite insertable map instance.
  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'service_name': serviceName,
      'username': username,
      'encrypted_password': encryptedPassword,
      'iv': iv,
      'category': category,
    };
  }
}

/// A production-ready SQLite database wrapper representing offline password managers.
/// Integrates sqflite to execute secure CRUD operations on encrypted inputs.
class DatabaseHelper {
  static Database? _database;
  static const String _dbName = 'credentials_vault.db';
  static const int _dbVersion = 1;

  // Singleton instance
  static final DatabaseHelper instance = DatabaseHelper._init();
  DatabaseHelper._init();

  /// Gets the active Database interface, lazily opening the sqlite channel when referenced.
  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB(_dbName);
    return _database!;
  }

  /// Initializes the SQLite connection path on mobile device directories.
  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = p.join(dbPath, filePath);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _createDB,
    );
  }

  /// Bootstraps database tables and columns.
  /// Sets up indexes to ensure lightning-fast filtered search operations.
  Future<void> _createDB(Database db, int version) async {
    // Requirements: id, service_name, username, encrypted_password, iv, and category
    await db.execute('''
      CREATE TABLE passwords (
        id TEXT PRIMARY KEY,
        service_name TEXT NOT NULL,
        username TEXT NOT NULL,
        encrypted_password TEXT NOT NULL,
        iv TEXT NOT NULL,
        category TEXT NOT NULL
      )
    ''');

    // Create dynamic index for rapid searching by service_name
    await db.execute('''
      CREATE INDEX IF NOT EXISTS idx_passwords_service_name ON passwords (service_name)
    ''');
  }

  /// 2. Saves or updates an encrypted credential payload in the local SQLite table.
  /// If the ID matches an existing document, it overrides it. If not, a new row is created.
  ///
  /// [credential] - A map or object holding service_name, username, encrypted payload, IV, and category metadata.
  Future<int> saveCredential(Map<String, dynamic> credential) async {
    final db = await database;

    // Enforce that mandatory fields exist before triggering a write
    final requiredKeys = ['service_name', 'username', 'encrypted_password', 'iv', 'category'];
    for (final key in requiredKeys) {
      if (!credential.containsKey(key) || credential[key] == null) {
        throw ArgumentError('Malformed credential payload: Missing mandatory key "$key".');
      }
    }

    // Ensure we have an ID for conflict resolution or primary indexing
    final String activeId = credential['id']?.toString() ?? 
        DateTime.now().millisecondsSinceEpoch.toString() + '_' + (1000 + (credential.hashCode % 9000)).toString();

    final Map<String, dynamic> dbRow = {
      'id': activeId,
      'service_name': credential['service_name'] as String,
      'username': credential['username'] as String,
      'encrypted_password': credential['encrypted_password'] as String,
      'iv': credential['iv'] as String,
      'category': credential['category'] as String,
    };

    return await db.insert(
      'passwords',
      dbRow,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  /// 3. Returns all stored credentials from the SQLite data table.
  /// Outputs a full List of Map representations.
  Future<List<Map<String, dynamic>>> getAllCredentials() async {
    final db = await database;
    return await db.query(
      'passwords',
      orderBy: 'service_name ASC',
    );
  }

  /// 4. Provides a full-text SQL search routine filtering elements where service_name matches the term.
  /// Supports wildcard partial match lookups (LIKE queries) for user convenience.
  ///
  /// [query] - Partial or complete name of the external account or service.
  Future<List<Map<String, dynamic>>> searchCredentialsByService(String query) async {
    if (query.trim().isEmpty) {
      return await getAllCredentials();
    }

    final db = await database;

    return await db.query(
      'passwords',
      where: 'service_name LIKE ?',
      whereArgs: ['%${query.trim()}%'],
      orderBy: 'service_name ASC',
    );
  }

  /// Helper to delete a credential by its primary key ID.
  Future<int> deleteCredential(String id) async {
    final db = await database;
    return await db.delete(
      'passwords',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  /// Helper to clean/drop the database credentials table.
  Future<void> wipeCredentialsTable() async {
    final db = await database;
    await db.delete('passwords');
  }

  /// Closes database channels securely.
  Future<void> close() async {
    final db = _database;
    if (db != null) {
      await db.close();
      _database = null;
    }
  }
}
