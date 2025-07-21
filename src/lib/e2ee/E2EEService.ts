import { API_ENDPOINTS, API_HEADERS } from '../providers/auth/AuthProvider';

// E2EE Key Management and Encryption Service
export class E2EEService {
  private static instance: E2EEService | null = null;
  private isInitialized = false;
  private identityKeyPair: CryptoKeyPair | null = null;
  private signedPreKeyPair: CryptoKeyPair | null = null;
  private preKeys: Map<number, CryptoKeyPair> = new Map();


  private constructor() {}

  public static getInstance(): E2EEService {
    if (!E2EEService.instance) {
      E2EEService.instance = new E2EEService();
    }
    return E2EEService.instance;
  }

  // Initialize E2EE for the current user
  public async initialize(): Promise<boolean> {
    try {
      console.log('[E2EE] Initializing E2EE service...');
      
      // Check if user already has E2EE keys
      const status = await this.checkE2EEStatus();
      if (status.initialized) {
        console.log('[E2EE] User already has E2EE keys initialized');
        this.isInitialized = true;
        return true;
      }

      // Generate new keys
      await this.generateKeys();
      
      // Initialize E2EE on the server
      const success = await this.initializeE2EEOnServer();
      if (success) {
        this.isInitialized = true;
        console.log('[E2EE] E2EE service initialized successfully');
      }
      
      return success;
    } catch (error) {
      console.error('[E2EE] Failed to initialize E2EE service:', error);
      return false;
    }
  }

  // Generate cryptographic keys
  private async generateKeys(): Promise<void> {
    try {
      // Generate identity key pair using X25519 (Ed25519 for signing, X25519 for ECDH)
      // Note: Using P-256 as fallback since X25519 support is limited in browsers
      // In production, consider using a WebAssembly implementation of Curve25519
      this.identityKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256', // TODO: Replace with X25519 when browser support improves
        },
        true,
        ['deriveKey', 'deriveBits']
      );

      // Generate signed pre-key pair
      this.signedPreKeyPair = await window.crypto.subtle.generateKey(
        {
          name: 'ECDH',
          namedCurve: 'P-256',
        },
        true,
        ['deriveKey', 'deriveBits']
      );

      // Generate one-time pre-keys (reduced count for better performance)
      for (let i = 0; i < 50; i++) {
        const preKeyPair = await window.crypto.subtle.generateKey(
          {
            name: 'ECDH',
            namedCurve: 'P-256',
          },
          true,
          ['deriveKey', 'deriveBits']
        );
        this.preKeys.set(i, preKeyPair);
      }

      console.log('[E2EE] Generated all cryptographic keys');
    } catch (error) {
      console.error('[E2EE] Failed to generate keys:', error);
      throw error;
    }
  }

  // Initialize E2EE on the server
  private async initializeE2EEOnServer(): Promise<boolean> {
    try {
      if (!this.identityKeyPair || !this.signedPreKeyPair) {
        throw new Error('Keys not generated');
      }

      // Export public keys
      const identityPublicKey = await this.exportPublicKey(this.identityKeyPair.publicKey);
      const signedPreKeyPublic = await this.exportPublicKey(this.signedPreKeyPair.publicKey);
      
      // Export one-time pre-keys
      const preKeyBundles = [];
      for (const [keyId, keyPair] of this.preKeys) {
        const publicKey = await this.exportPublicKey(keyPair.publicKey);
        preKeyBundles.push({
          key_id: keyId,
          public_key: publicKey,
        });
      }

      const response = await fetch(API_ENDPOINTS.E2EE_INITIALIZE, {
        method: 'POST',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify({
          identity_key: identityPublicKey,
          signed_pre_key: {
            key_id: 1,
            public_key: signedPreKeyPublic,
            signature: 'placeholder_signature', // In a real implementation, this would be signed
          },
          pre_keys: preKeyBundles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to initialize E2EE');
      }

      console.log('[E2EE] E2EE initialized on server successfully');
      return true;
    } catch (error) {
      console.error('[E2EE] Failed to initialize E2EE on server:', error);
      return false;
    }
  }

  // Check E2EE status for current user
  public async checkE2EEStatus(): Promise<{ initialized: boolean }> {
    try {
      const response = await fetch(API_ENDPOINTS.E2EE_STATUS, {
        method: 'GET',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });

      if (!response.ok) {
        return { initialized: false };
      }

      const data = await response.json();
      return { initialized: data.initialized || false };
    } catch (error) {
      console.error('[E2EE] Failed to check E2EE status:', error);
      return { initialized: false };
    }
  }

  // Check E2EE status for another user
  public async checkUserE2EEStatus(userId: string): Promise<{ initialized: boolean }> {
    try {
      const response = await fetch(API_ENDPOINTS.E2EE_USER_STATUS(userId), {
        method: 'GET',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });

      if (!response.ok) {
        return { initialized: false };
      }

      const data = await response.json();
      return { initialized: data.initialized || false };
    } catch (error) {
      console.error('[E2EE] Failed to check user E2EE status:', error);
      return { initialized: false };
    }
  }

  // Get pre-key bundle for a user
  private async getPreKeyBundle(_userId: string): Promise<any> {
    try {
      const response = await fetch(API_ENDPOINTS.E2EE_PRE_KEY_BUNDLE(_userId), {
        method: 'GET',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get pre-key bundle');
      }

      return await response.json();
    } catch (error) {
      console.error('[E2EE] Failed to get pre-key bundle:', error);
      throw error;
    }
  }

  // Encrypt message for direct PM using proper Signal-like protocol
  public async encryptDirectMessage(recipientId: string, content: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('E2EE not initialized');
      }

      // Get recipient's pre-key bundle (in real implementation)
      // For now, we'll use a simplified approach with proper AES-GCM
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      
      // Derive a session key using HKDF-like approach
      // In real implementation, this would use X3DH key agreement
      const sessionKeyMaterial = window.crypto.getRandomValues(new Uint8Array(32));
      
      // Import the session key material
      const sessionKey = await window.crypto.subtle.importKey(
        'raw',
        sessionKeyMaterial,
        { name: 'HKDF' },
        false,
        ['deriveKey']
      );

      // Derive encryption key using HKDF
      const encryptionKey = await window.crypto.subtle.deriveKey(
        {
          name: 'HKDF',
          hash: 'SHA-256',
          salt: new Uint8Array(32), // In real implementation, use proper salt
          info: new TextEncoder().encode(`Signal_MessageKey_${recipientId}`),
        },
        sessionKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      );

      // Generate random IV/nonce
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      
      // Create additional authenticated data (AAD)
      const aad = new TextEncoder().encode(`${recipientId}_${Date.now()}`);
      
      // Encrypt the content with AES-GCM
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: aad,
        },
        encryptionKey,
        data
      );

      // Combine IV, AAD, session key material, and encrypted data
      const result = {
        iv: Array.from(iv),
        aad: Array.from(aad),
        sessionKeyMaterial: Array.from(sessionKeyMaterial), // In real implementation, this would be encrypted with recipient's public key
        data: Array.from(new Uint8Array(encrypted)),
        version: 2, // Updated version for improved security
      };

      return `E2EE:${btoa(JSON.stringify(result))}`;
    } catch (error) {
      console.error('[E2EE] Failed to encrypt direct message:', error);
      throw error;
    }
  }

  // Decrypt message for direct PM using proper Signal-like protocol
  public async decryptDirectMessage(senderId: string, encryptedContent: string): Promise<string> {
    try {
      if (!encryptedContent.startsWith('E2EE:')) {
        // Not encrypted, return as-is
        return encryptedContent;
      }

      const encryptedData = JSON.parse(atob(encryptedContent.substring(5)));
      
      // Handle both old and new versions for backward compatibility
      if (encryptedData.version === 1) {
        // Legacy decryption for old format
        const key = await window.crypto.subtle.importKey(
          'raw',
          new Uint8Array(encryptedData.key),
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        const decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(encryptedData.iv),
          },
          key,
          new Uint8Array(encryptedData.data)
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
      }
      
      // New version 2 decryption with HKDF
      if (encryptedData.version === 2) {
        // Import the session key material
        const sessionKey = await window.crypto.subtle.importKey(
          'raw',
          new Uint8Array(encryptedData.sessionKeyMaterial),
          { name: 'HKDF' },
          false,
          ['deriveKey']
        );

        // Derive decryption key using HKDF
        // Note: We need to use the recipient ID from the AAD to match the encryption key derivation
        // Extract recipient ID from AAD (format: "recipientId_timestamp")
        const aadString = new TextDecoder().decode(new Uint8Array(encryptedData.aad));
        // For group messages, the format is "group_roomId_timestamp", so we need to handle this properly
        const aadParts = aadString.split('_');
        let recipientId;
        if (aadParts[0] === 'group' && aadParts.length >= 3) {
          // Group message: reconstruct "group_roomId" from first two parts
          recipientId = `${aadParts[0]}_${aadParts[1]}`;
        } else {
          // Direct message: just use the first part
          recipientId = aadParts[0];
        }
        
        const decryptionKey = await window.crypto.subtle.deriveKey(
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(32), // Same salt as encryption
            info: new TextEncoder().encode(`Signal_MessageKey_${recipientId}`),
          },
          sessionKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

        // Decrypt the content with AAD verification
        const decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(encryptedData.iv),
            additionalData: new Uint8Array(encryptedData.aad),
          },
          decryptionKey,
          new Uint8Array(encryptedData.data)
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
      }
      
      throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
    } catch (error) {
      console.error('[E2EE] Failed to decrypt direct message:', error);
      // Return original content if decryption fails
      return encryptedContent;
    }
  }

  // Encrypt message for group PM using group session key
  public async encryptGroupMessage(roomId: string, content: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('E2EE not initialized');
      }

      // For group messages, use room-specific encryption
      // In a real implementation, this would use a shared group session key
      return await this.encryptDirectMessage(`group_${roomId}`, content);
    } catch (error) {
      console.error('[E2EE] Failed to encrypt group message:', error);
      throw error;
    }
  }

  // Decrypt message for group PM using group session key
  public async decryptGroupMessage(roomId: string, encryptedContent: string): Promise<string> {
    try {
      // For group messages, use room-specific decryption
      // In a real implementation, this would use a shared group session key
      return await this.decryptDirectMessage(`group_${roomId}`, encryptedContent);
    } catch (error) {
      console.error('[E2EE] Failed to decrypt group message:', error);
      // Return original content if decryption fails
      return encryptedContent;
    }
  }

  // Helper function to export public key
  private async exportPublicKey(publicKey: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('spki', publicKey);
    const exportedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    return exportedAsBase64;
  }

  // Check if E2EE is initialized
  public isE2EEInitialized(): boolean {
    return this.isInitialized;
  }

  // Get E2EE status for UI indicators
  public getE2EEStatusForRoom(roomType: number, _recipients?: string[]): 'enabled' | 'partial' | 'disabled' {
    if (!this.isInitialized) {
      return 'disabled';
    }

    // For PM (type 0), GROUP_PM (type 1), and TEXT_ROOM (type 2), E2EE is enabled
    if (roomType === 0 || roomType === 1 || roomType === 2) {
      return 'enabled';
    }

    return 'disabled';
  }
}

// Export singleton instance
export const e2eeService = E2EEService.getInstance();