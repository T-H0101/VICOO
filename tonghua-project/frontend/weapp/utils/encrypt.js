/**
 * AES-256-GCM encryption utilities for sensitive data (phone, ID card, etc.).
 * Uses the WeChat mini program compatible crypto API.
 */

var crypto = require('crypto');

/**
 * Derive a 256-bit key from the provided key string using SHA-256.
 */
function deriveKey(key) {
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt data using AES-256-GCM.
 * @param {string|object} data - Data to encrypt
 * @param {string} key - Encryption key (will be hashed to 256 bits)
 * @returns {string} Base64-encoded string: iv(12) + authTag(16) + ciphertext
 */
function encrypt(data, key) {
  if (!data) return '';
  var plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  var derivedKey = deriveKey(key);
  var iv = crypto.randomBytes(12);
  var cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
  var encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  var authTag = cipher.getAuthTag();
  // Concatenate iv + authTag + ciphertext
  var combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt AES-256-GCM data.
 * @param {string} encryptedBase64 - Base64-encoded iv+authTag+ciphertext
 * @param {string} key - Encryption key
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedBase64, key) {
  if (!encryptedBase64) return '';
  var combined = Buffer.from(encryptedBase64, 'base64');
  var derivedKey = deriveKey(key);
  var iv = combined.slice(0, 12);
  var authTag = combined.slice(12, 28);
  var ciphertext = combined.slice(28);
  var decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
  decipher.setAuthTag(authTag);
  var decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Mask phone number for display: 138****1234
 */
function maskPhone(phone) {
  if (!phone || phone.length < 7) return phone;
  return phone.substr(0, 3) + '****' + phone.substr(phone.length - 4);
}

/**
 * Mask ID card number for display: 1101***********1234
 */
function maskIdCard(id) {
  if (!id || id.length < 8) return id;
  return id.substr(0, 4) + '**********' + id.substr(id.length - 4);
}

/**
 * Mask name for display: 张**
 */
function maskName(name) {
  if (!name || name.length < 2) return name;
  return name.charAt(0) + '*'.repeat(name.length - 1);
}

module.exports = {
  encrypt: encrypt,
  decrypt: decrypt,
  maskPhone: maskPhone,
  maskIdCard: maskIdCard,
  maskName: maskName,
};
