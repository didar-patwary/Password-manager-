import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:pointycastle/export.dart';

/// Production-grade Security Service for Flutter utilizing PointyCastle crypto engine.
/// Meets standard AES-256-GCM guidelines with PBKDF2 password-to-key-stretching.
class FlutterSecurityService {
  
  /// Performs 100,000 iterations of PBKDF2 using SHA-256 HMAC to derive a 256-bit (32 bytes) AES key.
  ///
  /// [masterPassword] - The user's input password.
  /// [salt] - The salt array (minimum 16 bytes recommended).
  static Uint8List generateKey(String masterPassword, Uint8List salt) {
    const int iterations = 100000;
    const int keyLength = 32; // 256-bit key

    // Setup SHA-256 MAC with a 64 bytes block size
    final hmac = HMac(SHA256Digest(), 64);
    
    // Configure PBKDF2 setup parameter
    final params = Pbkdf2Parameters(salt, iterations, keyLength);
    final derivator = PBKDF2KeyDerivator(hmac)..init(params);

    // Derivation step
    final passwordBytes = utf8.encode(masterPassword);
    return derivator.process(Uint8List.fromList(passwordBytes));
  }

  /// Encrypts plaintext using AES-256-GCM.
  /// Randomly generates a cryptographically secure 12-byte IV for the cipher payload,
  /// then prepends this 12-byte IV to the front of the resulting ciphertext bytes.
  /// Returns a safe Base64 string that includes both iv and ciphertext.
  static String encrypt(String plaintext, Uint8List key) {
    if (key.length != 32) {
      throw ArgumentError('Cryptographic key must be exactly 256 bits (32 bytes) for AES-256-GCM.');
    }

    // Generate secure 12-byte (96-bit) IV (recommended standard size for GCM parameters)
    final random = Random.secure();
    final iv = Uint8List(12);
    for (int i = 0; i < 12; i++) {
      iv[i] = random.nextInt(256);
    }

    final plaintextBytes = utf8.encode(plaintext);

    // Setup Galois Counter Mode Block Cipher
    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(
      KeyParameter(key),
      128, // 16 bytes authentication payload integrity tag (128 bits)
      iv,
      Uint8List(0), // No additional authenticated data
    );
    
    cipher.init(true, params); // Set mode: true = encrypt, false = decrypt

    final ciphertextBytes = cipher.process(Uint8List.fromList(plaintextBytes));

    // Instantiate builder to serialize [IV (12 bytes) + Encrypted Bytes with attached integrity tag]
    final b = BytesBuilder();
    b.add(iv);
    b.add(ciphertextBytes);
    final combined = b.toBytes();

    return base64.encode(combined);
  }

  /// Decrypts a cumulative AES-GCM Base64 string by peeling the 12-byte IV from the front,
  /// initializing Galois Counter Mode, checking the appended tag integrity and returning clear text.
  static String decrypt(String base64CiphertextCombined, Uint8List key) {
    if (key.length != 32) {
      throw ArgumentError('Cryptographic key must yield exactly 256 bits (32 bytes) for AES-256-GCM.');
    }

    final combinedBytes = base64.decode(base64CiphertextCombined);
    
    if (combinedBytes.length < 28) { // 12-byte IV + minimum possible auth-tag
      throw ArgumentError('Ciphertext format corrupt: Combined payload length is too small to process.');
    }

    // Carve out iv (first 12 bytes) and ciphertext from the subsequent indices
    final iv = combinedBytes.sublist(0, 12);
    final ciphertextBytes = combinedBytes.sublist(12);

    // Setup GCM Block Cipher decryption
    final cipher = GCMBlockCipher(AESEngine());
    final params = AEADParameters(
      KeyParameter(key),
      128, // Same tag length as encryption
      iv,
      Uint8List(0),
    );

    cipher.init(false, params); // Set mode: false = decrypt

    try {
      final decryptedBytes = cipher.process(ciphertextBytes);
      return utf8.decode(decryptedBytes);
    } catch (e) {
      throw SecurityException('Decryption rejected: GCM authentication tag validation failed or key is incorrect. $e');
    }
  }
}

class SecurityException implements Exception {
  final String message;
  SecurityException(this.message);
  @override
  String toString() => message;
}
