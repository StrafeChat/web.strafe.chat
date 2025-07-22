import { API_ENDPOINTS, API_HEADERS } from '../providers/auth/AuthProvider';
import { SignalProtocol, PreKeyBundle } from './signalProtocol';

// E2EE Key Management and Encryption Service
export class E2EEService {
  private static instance: E2EEService | null = null;
  private isInitialized = false;
  private signalProtocol: SignalProtocol | null = null;
  private userSessions: Map<string, string> = new Map(); // userId -> sessionId


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
        console.log('[E2EE] User already has E2EE keys initialized on server');
        // Just initialize the Signal protocol for local operations
        // Don't send keys to server since they already exist
        this.signalProtocol = new SignalProtocol();
        await this.signalProtocol.initialize();
        this.isInitialized = true;
        return true;
      }

      // Initialize Signal protocol for new user
      this.signalProtocol = new SignalProtocol();
      await this.signalProtocol.initialize();
      
      // Initialize E2EE on the server with new keys
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



  // Initialize E2EE on the server
  private async initializeE2EEOnServer(): Promise<boolean> {
    try {
      if (!this.signalProtocol) {
        throw new Error('Signal protocol not initialized');
      }

      // Get pre-key bundle from Signal protocol
      const preKeyBundle = this.signalProtocol.getPreKeyBundle();
      
      console.log('[E2EE] Pre-key bundle from Signal protocol:', {
        hasBundle: !!preKeyBundle,
        identityKeyLength: preKeyBundle?.identityKey?.length || 0,
        signedPreKeyLength: preKeyBundle?.signedPreKey?.publicKey?.length || 0,
        signatureLength: preKeyBundle?.signedPreKey?.signature?.length || 0,
        preKeyLength: preKeyBundle?.preKey?.publicKey?.length || 0
      });
      
      if (!preKeyBundle) {
        throw new Error('Failed to get pre-key bundle from Signal protocol');
      }

      // Prepare pre-key bundles for server
      const preKeyBundles = [{
        key_id: preKeyBundle.preKey?.keyId || 0,
        public_key: Array.from(preKeyBundle.preKey?.publicKey || new Uint8Array()),
      }];

      const payload = {
        identity_key: Array.from(preKeyBundle.identityKey),
        signed_pre_key: {
          key_id: preKeyBundle.signedPreKey.keyId,
          public_key: Array.from(preKeyBundle.signedPreKey.publicKey),
          signature: Array.from(preKeyBundle.signedPreKey.signature),
        },
        pre_keys: preKeyBundles,
      };

      console.log('[E2EE] Payload being sent to server:', {
        identity_key_length: payload.identity_key.length,
        signed_pre_key_length: payload.signed_pre_key.public_key.length,
        signature_length: payload.signed_pre_key.signature.length,
        pre_keys_length: payload.pre_keys[0]?.public_key?.length || 0
      });
      console.log('[E2EE] Full payload:', JSON.stringify(payload, null, 2));

      const response = await fetch(API_ENDPOINTS.E2EE_INITIALIZE, {
        method: 'POST',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
        body: JSON.stringify(payload),
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

  // Fetch user's pre-key bundle for session establishment
  private async fetchUserPreKeyBundle(userId: string): Promise<PreKeyBundle | null> {
    try {
      const response = await fetch(API_ENDPOINTS.E2EE_PRE_KEY_BUNDLE(userId), {
        method: 'GET',
        headers: {
          ...API_HEADERS.JSON,
          ...API_HEADERS.SESSION(),
        },
      });

      if (!response.ok) {
        console.error('[E2EE] Failed to fetch pre-key bundle for user:', userId);
        return null;
      }

      const data = await response.json();
      
      // Convert the server response to PreKeyBundle format
      const preKeyBundle: PreKeyBundle = {
        registrationId: data.registration_id || 0,
        deviceId: data.device_id || 1,
        identityKey: new Uint8Array(data.identity_key),
        signedPreKey: {
          keyId: data.signed_pre_key.key_id,
          publicKey: new Uint8Array(data.signed_pre_key.public_key),
          signature: new Uint8Array(data.signed_pre_key.signature)
        },
        preKey: data.pre_key ? {
          keyId: data.pre_key.key_id,
          publicKey: new Uint8Array(data.pre_key.public_key)
        } : undefined
      };

      return preKeyBundle;
    } catch (error) {
      console.error('[E2EE] Failed to fetch pre-key bundle:', error);
      return null;
    }
  }



  // Encrypt message for direct PM using Signal protocol
  public async encryptDirectMessage(recipientId: string, content: string): Promise<string> {
    try {
      if (!this.isInitialized || !this.signalProtocol) {
        throw new Error('E2EE not initialized');
      }

      // Get or create session for this user
      let sessionId = this.userSessions.get(recipientId);
      if (!sessionId) {
        // Fetch recipient's pre-key bundle and create session
        const preKeyBundle = await this.fetchUserPreKeyBundle(recipientId);
        if (!preKeyBundle) {
          throw new Error('Failed to fetch pre-key bundle for recipient');
        }
        sessionId = await this.signalProtocol.createSession(preKeyBundle);
        this.userSessions.set(recipientId, sessionId);
      }

      // Encrypt the message using Signal protocol
      const encryptedMessage = await this.signalProtocol.encryptMessage(sessionId, content);
      
      // Return the encrypted message with Signal prefix
      return `SIGNAL:${btoa(JSON.stringify(encryptedMessage))}`;
    } catch (error) {
      console.error('[E2EE] Failed to encrypt direct message:', error);
      throw error;
    }
  }

  // Decrypt message for direct PM using Signal protocol
  public async decryptDirectMessage(senderId: string, encryptedContent: string): Promise<string> {
    try {
      // Handle Signal protocol messages
      if (encryptedContent.startsWith('SIGNAL:')) {
        if (!this.isInitialized || !this.signalProtocol) {
          throw new Error('E2EE not initialized');
        }

        // Get session for this user
        let sessionId = this.userSessions.get(senderId);
        if (!sessionId) {
          // Create session if it doesn't exist (this shouldn't happen in normal flow)
          const preKeyBundle = await this.fetchUserPreKeyBundle(senderId);
          if (!preKeyBundle) {
            throw new Error('Failed to fetch pre-key bundle for sender');
          }
          sessionId = await this.signalProtocol.createSession(preKeyBundle);
          this.userSessions.set(senderId, sessionId);
        }

        const encryptedMessage = JSON.parse(atob(encryptedContent.substring(7)));
        return await this.signalProtocol.decryptMessage(sessionId, encryptedMessage);
      }

      // Handle legacy E2EE messages for backward compatibility
      if (encryptedContent.startsWith('E2EE:')) {
        return await this.decryptLegacyMessage(encryptedContent);
      }

      // Not encrypted, return as-is
      return encryptedContent;
    } catch (error) {
      console.error('[E2EE] Failed to decrypt direct message:', error);
      // Return original content if decryption fails
      return encryptedContent;
    }
  }

  // Legacy decryption for backward compatibility
  private async decryptLegacyMessage(encryptedContent: string): Promise<string> {
    try {
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
        const aadString = new TextDecoder().decode(new Uint8Array(encryptedData.aad));
        const aadParts = aadString.split('_');
        let recipientId;
        if (aadParts[0] === 'group' && aadParts.length >= 3) {
          recipientId = `${aadParts[0]}_${aadParts[1]}`;
        } else {
          recipientId = aadParts[0];
        }
        
        const decryptionKey = await window.crypto.subtle.deriveKey(
          {
            name: 'HKDF',
            hash: 'SHA-256',
            salt: new Uint8Array(32),
            info: new TextEncoder().encode(`Signal_MessageKey_${recipientId}`),
          },
          sessionKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );

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
      console.error('[E2EE] Failed to decrypt legacy message:', error);
      throw error;
    }
  }

  // Encrypt message for group PM using simplified group encryption
  // Note: This is a simplified implementation. A full Signal group protocol
  // would use Sender Keys for better forward secrecy and scalability.
  public async encryptGroupMessage(roomId: string, content: string): Promise<string> {
    try {
      if (!this.isInitialized) {
        throw new Error('E2EE not initialized');
      }

      // For now, use a simplified group encryption approach
      // In a full implementation, this would use the Signal group protocol with Sender Keys
      const sessionKey = await this.getOrCreateGroupSessionKey(roomId);
      const iv = window.crypto.getRandomValues(new Uint8Array(16));
      const plaintextBytes = new TextEncoder().encode(content);
      
      const key = await window.crypto.subtle.importKey(
        'raw',
        sessionKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );
      
      const ciphertext = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv,
          additionalData: new TextEncoder().encode(roomId)
        },
        key,
        plaintextBytes
      );
      
      const encryptedMessage = {
        version: 1,
        roomId: roomId,
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(ciphertext))
      };
      
      // Return the encrypted message with Signal group prefix
      return `SIGNAL_GROUP:${btoa(JSON.stringify(encryptedMessage))}`;
    } catch (error) {
      console.error('[E2EE] Failed to encrypt group message:', error);
      throw error;
    }
  }

  // Decrypt message for group PM using group session key
  public async decryptGroupMessage(roomId: string, encryptedContent: string): Promise<string> {
    try {
      // Handle Signal group protocol messages
      if (encryptedContent.startsWith('SIGNAL_GROUP:')) {
        if (!this.isInitialized) {
          throw new Error('E2EE not initialized');
        }

        const encryptedMessage = JSON.parse(atob(encryptedContent.substring(13)));
        
        // Get group session key
        const sessionKey = await this.getOrCreateGroupSessionKey(roomId);
        
        const key = await window.crypto.subtle.importKey(
          'raw',
          sessionKey,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
        
        const plaintext = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(encryptedMessage.iv),
            additionalData: new TextEncoder().encode(roomId)
          },
          key,
          new Uint8Array(encryptedMessage.ciphertext)
        );
        
        return new TextDecoder().decode(plaintext);
      }

      // Handle legacy group messages for backward compatibility
      if (encryptedContent.startsWith('E2EE:')) {
        return await this.decryptLegacyMessage(encryptedContent);
      }

      // Not encrypted, return as-is
      return encryptedContent;
    } catch (error) {
      console.error('[E2EE] Failed to decrypt group message:', error);
      // Return original content if decryption fails
      return encryptedContent;
    }
  }

  // Get or create group session key (simplified implementation)
  private async getOrCreateGroupSessionKey(roomId: string): Promise<Uint8Array> {
    const storageKey = `${this.storagePrefix}group_${roomId}`;
    
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return new Uint8Array(JSON.parse(stored));
      }
    }
    
    // Generate new session key
    const sessionKey = window.crypto.getRandomValues(new Uint8Array(32));
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(sessionKey)));
    }
    
    return sessionKey;
  }

  private storagePrefix = 'signal_e2ee_';



  // Check if E2EE is initialized
  public isE2EEInitialized(): boolean {
    return this.isInitialized;
  }

  // Get E2EE status for UI indicators
  public getE2EEStatusForRoom(roomType: number, _recipients?: string[]): 'enabled' | 'partial' | 'disabled' {
    if (!this.isInitialized) {
      return 'disabled';
    }

    // Direct PMs (type 0) are not encrypted
    if (roomType === 0) {
      return 'disabled';
    }

    // For GROUP_PM (type 1) and TEXT_ROOM (type 2), E2EE is enabled
    if (roomType === 1 || roomType === 2) {
      return 'enabled';
    }

    return 'disabled';
  }
}

// Export singleton instance
export const e2eeService = E2EEService.getInstance();