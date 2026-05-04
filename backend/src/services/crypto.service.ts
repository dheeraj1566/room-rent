/**
 * Crypto Service for encrypting/decrypting sensitive data like Aadhaar
 * Uses AES-256-CBC encryption with random IV for each encryption
 */
import crypto from "node:crypto";
import env from "../config/env.js";

export class CryptoService {
  private static readonly ALGORITHM = env.ENCRYPTION_ALGORITHM || "aes-256-cbc";
  private static readonly KEY = env.ENCRYPTION_KEY;
  private static readonly IV_LENGTH = parseInt(env.ENCRYPTION_IV_LENGTH || "16", 10);

  /**
   * Validate encryption configuration
   */
  private static validateConfig(): void {
    if (!this.KEY) {
      throw new Error("ENCRYPTION_KEY is required in environment variables");
    }
    if (this.KEY.length !== 64) {
      throw new Error("ENCRYPTION_KEY must be 64 characters (32 bytes in hex)");
    }
  }

  /**
   * Encrypt sensitive data (like Aadhaar)
   * @param plaintext - The plain text to encrypt
   * @returns Buffer containing IV + encrypted data
   */
  static encrypt(plaintext: string): Buffer {
    this.validateConfig();

    // Generate random IV for each encryption
    const iv = crypto.randomBytes(this.IV_LENGTH);
    
    // Create cipher with key and IV
    const cipher = crypto.createCipheriv(this.ALGORITHM, Buffer.from(this.KEY, 'hex'), iv);
    cipher.setAutoPadding(true);
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Prepend IV to encrypted data
    return Buffer.concat([iv, encrypted]);
  }

  /**
   * Decrypt sensitive data (like Aadhaar)
   * @param encryptedBuffer - Buffer containing IV + encrypted data
   * @returns Decrypted plain text
   */
  static decrypt(encryptedBuffer: Buffer): string {
    this.validateConfig();

    // Extract IV from the beginning of the buffer
    const iv = encryptedBuffer.subarray(0, this.IV_LENGTH);
    const encrypted = encryptedBuffer.subarray(this.IV_LENGTH);
    
    // Create decipher with key and IV
    const decipher = crypto.createDecipheriv(this.ALGORITHM, Buffer.from(this.KEY, 'hex'), iv);
    decipher.setAutoPadding(true);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Create SHA-256 hash for uniqueness checking (without decryption)
   * @param plaintext - The plain text to hash
   * @returns Buffer containing the hash
   */
  static createHash(plaintext: string): Buffer {
    return crypto.createHash("sha256").update(plaintext).digest();
  }

  /**
   * Encrypt and create hash in one operation (for Aadhaar)
   * @param plaintext - The plain text to encrypt and hash
   * @returns Object with encrypted buffer and hash buffer
   */
  static encryptWithHash(plaintext: string): { encrypted: Buffer; hash: Buffer } {
    return {
      encrypted: this.encrypt(plaintext),
      hash: this.createHash(plaintext)
    };
  }

  /**
   * Verify if a plaintext matches an encrypted buffer
   * @param plaintext - The plain text to verify
   * @param encryptedBuffer - The encrypted buffer to compare against
   * @returns True if they match, false otherwise
   */
  static verify(plaintext: string, encryptedBuffer: Buffer): boolean {
    try {
      const decrypted = this.decrypt(encryptedBuffer);
      return decrypted === plaintext;
    } catch (error) {
      console.error("Decryption verification failed:", error);
      return false;
    }
  }
}