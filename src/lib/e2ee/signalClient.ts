// Signal Protocol Implementation for StrafeChat
// This implements the Signal protocol for end-to-end encryption

// Constants
const MAX_CACHE = 1000;
const MAX_SKIP = 1000;

// Interfaces
interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

interface PreKeyBundle {
  identityKey: Uint8Array;
  signedPreKey: {
    keyId: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
  };
  preKey?: {
    keyId: number;
    publicKey: Uint8Array;
  };
}

interface SessionState {
  localIdentityKey: Uint8Array;
  remoteIdentityKey: Uint8Array;
  rootKey: Uint8Array;
  sendingChain?: ChainState;
  receivingChains: Map<string, ChainState>;
  skippedMessages: Map<string, MessageKeys>;
  sessionVersion: number;
  messageNumber: number;
}

interface ChainState {
  chainKey: Uint8Array;
  messageNumber: number;
  dhKeyPair?: KeyPair;
}

interface MessageKeys {
  cipherKey: Uint8Array;
  macKey: Uint8Array;
  iv: Uint8Array;
}

interface MessageHeader {
  dhPublicKey: Uint8Array;
  previousCounter: number;
  messageNumber: number;
}

interface EncryptedMessage {
  header: MessageHeader;
  ciphertext: Uint8Array;
}

interface GroupSession {
  sessionKey: Uint8Array;
  sessionId: string;
  messageNumber: number;
}

export class SignalClient {
  private identityKeyPair: IdentityKeyPair | null = null;
  private signedPreKey: { keyId: number; keyPair: KeyPair; signature: Uint8Array } | null = null;
  private preKeys: Array<{ keyId: number; keyPair: KeyPair }> = [];
  private sessions: Map<string, SessionState> = new Map();
  private groupSessions: Map<string, GroupSession> = new Map();
  private storagePrefix = 'strafe_e2ee_';

  async initialize(): Promise<void> {
    // Try to restore from storage first
    await this.restoreFromStorage();
    
    // If no stored data, generate new keys
    if (!this.identityKeyPair) {
      // Generate identity key pair
      this.identityKeyPair = await this.generateKeyPair();
      
      // Generate signed pre-key
      const signedPreKeyPair = await this.generateKeyPair();
      const signature = await this.signPreKey(signedPreKeyPair.publicKey, this.identityKeyPair.privateKey);
      this.signedPreKey = {
        keyId: 1,
        keyPair: signedPreKeyPair,
        signature
      };
      
      // Generate one-time pre-keys
      for (let i = 0; i < 100; i++) {
        const preKeyPair = await this.generateKeyPair();
        this.preKeys.push({
          keyId: i,
          keyPair: preKeyPair
        });
      }
      
      // Save to storage
      await this.saveToStorage();
    }
    
    console.log('[Signal] Client initialized successfully');
  }

  // Key generation using Web Crypto API (P-256 as fallback for X25519)
  private async generateKeyPair(): Promise<KeyPair> {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      true,
      ['deriveKey', 'deriveBits']
    );
    
    const publicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    const privateKey = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    
    return {
      publicKey: new Uint8Array(publicKey),
      privateKey: new Uint8Array(privateKey)
    };
  }

  // Sign pre-key with identity key
  private async signPreKey(preKeyPublic: Uint8Array, identityPrivate: Uint8Array): Promise<Uint8Array> {
    // Import identity private key for signing
    const signingKey = await window.crypto.subtle.importKey(
      'pkcs8',
      identityPrivate,
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      false,
      ['sign']
    );
    
    // Sign the pre-key
    const signature = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-256'
      },
      signingKey,
      preKeyPublic
    );
    
    return new Uint8Array(signature);
  }

  // Verify pre-key signature
  private async verifyPreKeySignature(
    preKeyPublic: Uint8Array,
    signature: Uint8Array,
    identityPublic: Uint8Array
  ): Promise<boolean> {
    try {
      const verifyingKey = await window.crypto.subtle.importKey(
        'raw',
        identityPublic,
        {
          name: 'ECDSA',
          namedCurve: 'P-256'
        },
        false,
        ['verify']
      );
      
      return await window.crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: 'SHA-256'
        },
        verifyingKey,
        signature,
        preKeyPublic
      );
    } catch {
      return false;
    }
  }

  // X3DH Key Agreement
  private async performX3DH(
    identityKeyPair: IdentityKeyPair,
    ephemeralKeyPair: KeyPair,
    remoteIdentityKey: Uint8Array,
    remoteSignedPreKey: Uint8Array,
    remotePreKey?: Uint8Array
  ): Promise<Uint8Array> {
    const dh1 = await this.performDH(identityKeyPair.privateKey, remoteSignedPreKey);
    const dh2 = await this.performDH(ephemeralKeyPair.privateKey, remoteIdentityKey);
    const dh3 = await this.performDH(ephemeralKeyPair.privateKey, remoteSignedPreKey);
    
    let sharedSecret = new Uint8Array(dh1.length + dh2.length + dh3.length);
    sharedSecret.set(dh1, 0);
    sharedSecret.set(dh2, dh1.length);
    sharedSecret.set(dh3, dh1.length + dh2.length);
    
    if (remotePreKey) {
      const dh4 = await this.performDH(ephemeralKeyPair.privateKey, remotePreKey);
      const newSharedSecret = new Uint8Array(sharedSecret.length + dh4.length);
      newSharedSecret.set(sharedSecret, 0);
      newSharedSecret.set(dh4, sharedSecret.length);
      sharedSecret = newSharedSecret;
    }
    
    return await this.deriveRootKey(sharedSecret);
  }

  // Diffie-Hellman operation
  private async performDH(privateKey: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array> {
    const importedPrivateKey = await window.crypto.subtle.importKey(
      'pkcs8',
      privateKey,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      ['deriveBits']
    );
    
    const importedPublicKey = await window.crypto.subtle.importKey(
      'raw',
      publicKey,
      {
        name: 'ECDH',
        namedCurve: 'P-256'
      },
      false,
      []
    );
    
    const sharedSecret = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: importedPublicKey
      },
      importedPrivateKey,
      256
    );
    
    return new Uint8Array(sharedSecret);
  }

  // Key derivation functions
  private async deriveRootKey(sharedSecret: Uint8Array): Promise<Uint8Array> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      sharedSecret,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );
    
    const derivedKey = await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: new TextEncoder().encode('Signal_RootKey')
      },
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      true,
      ['sign']
    );
    
    const exported = await window.crypto.subtle.exportKey('raw', derivedKey);
    return new Uint8Array(exported);
  }



  private async deriveMessageKey(chainKey: Uint8Array): Promise<MessageKeys> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      chainKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const messageKeyData = await window.crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode('MessageKey')
    );
    
    const messageKeyBytes = new Uint8Array(messageKeyData);
    
    return {
      cipherKey: messageKeyBytes.slice(0, 32),
      macKey: messageKeyBytes.slice(32, 64),
      iv: messageKeyBytes.slice(64, 80)
    };
  }

  private async deriveRootAndChainKeys(
    rootKey: Uint8Array,
    dhOutput: Uint8Array
  ): Promise<{ newRootKey: Uint8Array; chainKey: Uint8Array }> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      rootKey,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );
    
    const derivedKeys = await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: dhOutput,
        info: new TextEncoder().encode('Signal_RootChainKeys')
      },
      key,
      { name: 'HMAC', hash: 'SHA-256' },
      true,
      ['sign']
    );
    
    const exported = await window.crypto.subtle.exportKey('raw', derivedKeys);
    const keyBytes = new Uint8Array(exported);
    
    return {
      newRootKey: keyBytes.slice(0, 32),
      chainKey: keyBytes.slice(32, 64)
    };
  }



  // Message encryption
  async encryptMessage(userId: string, plaintext: string): Promise<EncryptedMessage> {
    let sessionState = this.sessions.get(userId);
    
    if (!sessionState) {
      // Initialize session if it doesn't exist
      // In a real implementation, this would fetch the pre-key bundle from the server
      throw new Error('Session not found. Please establish a session first.');
    }
    
    if (!sessionState.sendingChain) {
      // Perform DH ratchet step
      await this.dhRatchetSend(sessionState);
    }
    
    // Derive message key
    const messageKeys = await this.deriveMessageKey(sessionState.sendingChain!.chainKey);
    
    // Advance chain key
    const newChainKey = await this.advanceChainKey(sessionState.sendingChain!.chainKey);
    sessionState.sendingChain!.chainKey = newChainKey;
    
    // Encrypt plaintext
    const ciphertext = await this.encryptWithMessageKey(plaintext, messageKeys);
    
    // Create header
    const header: MessageHeader = {
      dhPublicKey: sessionState.sendingChain!.dhKeyPair!.publicKey,
      previousCounter: sessionState.messageNumber,
      messageNumber: sessionState.sendingChain!.messageNumber
    };
    
    // Increment counters
    sessionState.sendingChain!.messageNumber++;
    sessionState.messageNumber++;
    
    // Persist sessions after encryption
    await this.persistSessions();
    
    return {
      header,
      ciphertext
    };
  }

  // Message decryption
  async decryptMessage(userId: string, encryptedMessage: EncryptedMessage): Promise<string> {
    const sessionState = this.sessions.get(userId);
    
    if (!sessionState) {
      throw new Error('Session not found');
    }
    
    const { header, ciphertext } = encryptedMessage;
    const dhPublicKeyStr = Array.from(header.dhPublicKey).join(',');
    
    // Check if we have a receiving chain for this DH public key
    let receivingChain = sessionState.receivingChains.get(dhPublicKeyStr);
    
    if (!receivingChain) {
      // Perform DH ratchet step
      await this.dhRatchetReceive(sessionState, header.dhPublicKey);
      receivingChain = sessionState.receivingChains.get(dhPublicKeyStr)!;
    }
    
    // Handle skipped messages
    const skippedMessageKey = `${dhPublicKeyStr}_${header.messageNumber}`;
    const messageKeys = sessionState.skippedMessages.get(skippedMessageKey);
    
    if (messageKeys) {
      sessionState.skippedMessages.delete(skippedMessageKey);
      return await this.decryptWithMessageKey(ciphertext, messageKeys);
    }
    
    // Skip messages if necessary
    if (header.messageNumber > receivingChain.messageNumber) {
      await this.skipMessages(sessionState, dhPublicKeyStr, receivingChain, header.messageNumber);
    }
    
    // Derive message key
    const currentMessageKeys = await this.deriveMessageKey(receivingChain.chainKey);
    
    // Advance chain key
    receivingChain.chainKey = await this.advanceChainKey(receivingChain.chainKey);
    receivingChain.messageNumber++;
    
    // Persist sessions after decryption
    await this.persistSessions();
    
    return await this.decryptWithMessageKey(ciphertext, currentMessageKeys);
  }

  // Helper functions
  private async dhRatchetSend(sessionState: SessionState): Promise<void> {
    const newKeyPair = await this.generateKeyPair();
    
    if (sessionState.sendingChain) {
      // Move current sending chain to receiving chains
      const dhPublicKeyStr = Array.from(sessionState.sendingChain.dhKeyPair!.publicKey).join(',');
      sessionState.receivingChains.set(dhPublicKeyStr, {
        chainKey: sessionState.sendingChain.chainKey,
        messageNumber: sessionState.sendingChain.messageNumber
      });
    }
    
    // Create new sending chain
    const dhOutput = await this.performDH(
      newKeyPair.privateKey,
      sessionState.remoteIdentityKey
    );
    
    const { newRootKey, chainKey } = await this.deriveRootAndChainKeys(
      sessionState.rootKey,
      dhOutput
    );
    
    sessionState.rootKey = newRootKey;
    sessionState.sendingChain = {
      chainKey,
      messageNumber: 0,
      dhKeyPair: newKeyPair
    };
  }

  private async dhRatchetReceive(
    sessionState: SessionState,
    remoteDHPublicKey: Uint8Array
  ): Promise<void> {
    if (!sessionState.sendingChain) {
      throw new Error('No sending chain available for DH ratchet');
    }
    
    const dhOutput = await this.performDH(
      sessionState.sendingChain.dhKeyPair!.privateKey,
      remoteDHPublicKey
    );
    
    const { newRootKey, chainKey } = await this.deriveRootAndChainKeys(
      sessionState.rootKey,
      dhOutput
    );
    
    sessionState.rootKey = newRootKey;
    
    const dhPublicKeyStr = Array.from(remoteDHPublicKey).join(',');
    sessionState.receivingChains.set(dhPublicKeyStr, {
      chainKey,
      messageNumber: 0
    });
  }

  private async skipMessages(
    sessionState: SessionState,
    dhPublicKeyStr: string,
    receivingChain: ChainState,
    targetMessageNumber: number
  ): Promise<void> {
    const skipCount = targetMessageNumber - receivingChain.messageNumber;
    
    if (skipCount > MAX_SKIP) {
      throw new Error('Too many skipped messages');
    }
    
    for (let i = 0; i < skipCount; i++) {
      const messageKeys = await this.deriveMessageKey(receivingChain.chainKey);
      const skippedMessageKey = `${dhPublicKeyStr}_${receivingChain.messageNumber}`;
      
      sessionState.skippedMessages.set(skippedMessageKey, messageKeys);
      
      receivingChain.chainKey = await this.advanceChainKey(receivingChain.chainKey);
      receivingChain.messageNumber++;
      
      // Limit cache size
      if (sessionState.skippedMessages.size > MAX_CACHE) {
        const firstKey = sessionState.skippedMessages.keys().next().value;
        if (firstKey !== undefined) {
          sessionState.skippedMessages.delete(firstKey);
        }
      }
    }
  }

  private async advanceChainKey(chainKey: Uint8Array): Promise<Uint8Array> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      chainKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const newChainKeyData = await window.crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode('ChainKey')
    );
    
    return new Uint8Array(newChainKeyData);
  }

  private async encryptWithMessageKey(
    plaintext: string,
    messageKeys: MessageKeys
  ): Promise<Uint8Array> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      messageKeys.cipherKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const plaintextBytes = new TextEncoder().encode(plaintext);
    
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: messageKeys.iv
      },
      key,
      plaintextBytes
    );
    
    return new Uint8Array(ciphertext);
  }

  private async decryptWithMessageKey(
    ciphertext: Uint8Array,
    messageKeys: MessageKeys
  ): Promise<string> {
    const key = await window.crypto.subtle.importKey(
      'raw',
      messageKeys.cipherKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: messageKeys.iv
      },
      key,
      ciphertext
    );
    
    return new TextDecoder().decode(plaintext);
  }



  // Group messaging
  async encryptGroupMessage(roomId: string, plaintext: string): Promise<any> {
    let groupSession = this.groupSessions.get(roomId);
    
    if (!groupSession) {
      // Create new group session
      const sessionKey = window.crypto.getRandomValues(new Uint8Array(32));
      const sessionId = Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      groupSession = {
        sessionKey,
        sessionId,
        messageNumber: 0
      };
      
      this.groupSessions.set(roomId, groupSession);
    }
    
    // Encrypt with AES-GCM
    const key = await window.crypto.subtle.importKey(
      'raw',
      groupSession.sessionKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );
    
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const aad = new TextEncoder().encode(`${roomId}_${groupSession.messageNumber}`);
    
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        additionalData: aad
      },
      key,
      plaintextBytes
    );
    
    groupSession.messageNumber++;
    
    // Persist sessions after group encryption
    await this.persistSessions();
    
    return {
      sessionId: groupSession.sessionId,
      messageNumber: groupSession.messageNumber - 1,
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext)),
      aad: Array.from(aad)
    };
  }

  async decryptGroupMessage(roomId: string, encryptedMessage: any): Promise<string> {
    const groupSession = this.groupSessions.get(roomId);
    
    if (!groupSession) {
      throw new Error('Group session not found');
    }
    
    const key = await window.crypto.subtle.importKey(
      'raw',
      groupSession.sessionKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    
    const plaintext = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(encryptedMessage.iv),
        additionalData: new Uint8Array(encryptedMessage.aad)
      },
      key,
      new Uint8Array(encryptedMessage.ciphertext)
    );
    
    // Persist sessions after group decryption
    await this.persistSessions();
    
    return new TextDecoder().decode(plaintext);
  }

  // Key management
  async getIdentityKeyPair(): Promise<IdentityKeyPair | null> {
    return this.identityKeyPair;
  }

  async getSignedPreKey(): Promise<{ keyId: number; publicKey: Uint8Array; signature: Uint8Array } | null> {
    if (!this.signedPreKey) return null;
    
    return {
      keyId: this.signedPreKey.keyId,
      publicKey: this.signedPreKey.keyPair.publicKey,
      signature: this.signedPreKey.signature
    };
  }

  async getPreKeys(): Promise<Array<{ keyId: number; publicKey: Uint8Array }>> {
    return this.preKeys.map(preKey => ({
      keyId: preKey.keyId,
      publicKey: preKey.keyPair.publicKey
    }));
  }

  // Storage methods for session persistence
  private async saveToStorage(): Promise<void> {
    try {
      // Save identity key pair
      if (this.identityKeyPair) {
        localStorage.setItem(
          this.storagePrefix + 'identity_key',
          JSON.stringify({
            publicKey: Array.from(this.identityKeyPair.publicKey),
            privateKey: Array.from(this.identityKeyPair.privateKey)
          })
        );
      }

      // Save signed pre-key
      if (this.signedPreKey) {
        localStorage.setItem(
          this.storagePrefix + 'signed_prekey',
          JSON.stringify({
            keyId: this.signedPreKey.keyId,
            publicKey: Array.from(this.signedPreKey.keyPair.publicKey),
            privateKey: Array.from(this.signedPreKey.keyPair.privateKey),
            signature: Array.from(this.signedPreKey.signature)
          })
        );
      }

      // Save pre-keys
      const preKeysData = this.preKeys.map(preKey => ({
        keyId: preKey.keyId,
        publicKey: Array.from(preKey.keyPair.publicKey),
        privateKey: Array.from(preKey.keyPair.privateKey)
      }));
      localStorage.setItem(this.storagePrefix + 'prekeys', JSON.stringify(preKeysData));

      // Save sessions
      const sessionsData: any = {};
      for (const [userId, session] of this.sessions.entries()) {
        sessionsData[userId] = this.serializeSession(session);
      }
      localStorage.setItem(this.storagePrefix + 'sessions', JSON.stringify(sessionsData));

      // Save group sessions
      const groupSessionsData: any = {};
      for (const [roomId, groupSession] of this.groupSessions.entries()) {
        groupSessionsData[roomId] = {
          sessionKey: Array.from(groupSession.sessionKey),
          sessionId: groupSession.sessionId,
          messageNumber: groupSession.messageNumber
        };
      }
      localStorage.setItem(this.storagePrefix + 'group_sessions', JSON.stringify(groupSessionsData));

      console.log('[Signal] Session data saved to storage');
    } catch (error) {
      console.error('[Signal] Failed to save to storage:', error);
    }
  }

  private async restoreFromStorage(): Promise<void> {
    try {
      // Restore identity key pair
      const identityKeyData = localStorage.getItem(this.storagePrefix + 'identity_key');
      if (identityKeyData) {
        const parsed = JSON.parse(identityKeyData);
        this.identityKeyPair = {
          publicKey: new Uint8Array(parsed.publicKey),
          privateKey: new Uint8Array(parsed.privateKey)
        };
      }

      // Restore signed pre-key
      const signedPreKeyData = localStorage.getItem(this.storagePrefix + 'signed_prekey');
      if (signedPreKeyData) {
        const parsed = JSON.parse(signedPreKeyData);
        this.signedPreKey = {
          keyId: parsed.keyId,
          keyPair: {
            publicKey: new Uint8Array(parsed.publicKey),
            privateKey: new Uint8Array(parsed.privateKey)
          },
          signature: new Uint8Array(parsed.signature)
        };
      }

      // Restore pre-keys
      const preKeysData = localStorage.getItem(this.storagePrefix + 'prekeys');
      if (preKeysData) {
        const parsed = JSON.parse(preKeysData);
        this.preKeys = parsed.map((preKey: any) => ({
          keyId: preKey.keyId,
          keyPair: {
            publicKey: new Uint8Array(preKey.publicKey),
            privateKey: new Uint8Array(preKey.privateKey)
          }
        }));
      }

      // Restore sessions
      const sessionsData = localStorage.getItem(this.storagePrefix + 'sessions');
      if (sessionsData) {
        const parsed = JSON.parse(sessionsData);
        for (const [userId, sessionData] of Object.entries(parsed)) {
          this.sessions.set(userId, this.deserializeSession(sessionData as any));
        }
      }

      // Restore group sessions
      const groupSessionsData = localStorage.getItem(this.storagePrefix + 'group_sessions');
      if (groupSessionsData) {
        const parsed = JSON.parse(groupSessionsData);
        for (const [roomId, groupSessionData] of Object.entries(parsed)) {
          const data = groupSessionData as any;
          this.groupSessions.set(roomId, {
            sessionKey: new Uint8Array(data.sessionKey),
            sessionId: data.sessionId,
            messageNumber: data.messageNumber
          });
        }
      }

      console.log('[Signal] Session data restored from storage');
    } catch (error) {
      console.error('[Signal] Failed to restore from storage:', error);
    }
  }

  private serializeSession(session: SessionState): any {
    const receivingChains: any = {};
    for (const [key, chain] of session.receivingChains.entries()) {
      receivingChains[key] = {
        chainKey: Array.from(chain.chainKey),
        messageNumber: chain.messageNumber,
        dhKeyPair: chain.dhKeyPair ? {
          publicKey: Array.from(chain.dhKeyPair.publicKey),
          privateKey: Array.from(chain.dhKeyPair.privateKey)
        } : undefined
      };
    }

    const skippedMessages: any = {};
    for (const [key, messageKeys] of session.skippedMessages.entries()) {
      skippedMessages[key] = {
        cipherKey: Array.from(messageKeys.cipherKey),
        macKey: Array.from(messageKeys.macKey),
        iv: Array.from(messageKeys.iv)
      };
    }

    return {
      localIdentityKey: Array.from(session.localIdentityKey),
      remoteIdentityKey: Array.from(session.remoteIdentityKey),
      rootKey: Array.from(session.rootKey),
      sendingChain: session.sendingChain ? {
        chainKey: Array.from(session.sendingChain.chainKey),
        messageNumber: session.sendingChain.messageNumber,
        dhKeyPair: session.sendingChain.dhKeyPair ? {
          publicKey: Array.from(session.sendingChain.dhKeyPair.publicKey),
          privateKey: Array.from(session.sendingChain.dhKeyPair.privateKey)
        } : undefined
      } : undefined,
      receivingChains,
      skippedMessages,
      sessionVersion: session.sessionVersion,
      messageNumber: session.messageNumber
    };
  }

  private deserializeSession(data: any): SessionState {
    const receivingChains = new Map<string, ChainState>();
    for (const [key, chain] of Object.entries(data.receivingChains)) {
      const chainData = chain as any;
      receivingChains.set(key, {
        chainKey: new Uint8Array(chainData.chainKey),
        messageNumber: chainData.messageNumber,
        dhKeyPair: chainData.dhKeyPair ? {
          publicKey: new Uint8Array(chainData.dhKeyPair.publicKey),
          privateKey: new Uint8Array(chainData.dhKeyPair.privateKey)
        } : undefined
      });
    }

    const skippedMessages = new Map<string, MessageKeys>();
    for (const [key, messageKeys] of Object.entries(data.skippedMessages)) {
      const messageKeysData = messageKeys as any;
      skippedMessages.set(key, {
        cipherKey: new Uint8Array(messageKeysData.cipherKey),
        macKey: new Uint8Array(messageKeysData.macKey),
        iv: new Uint8Array(messageKeysData.iv)
      });
    }

    return {
      localIdentityKey: new Uint8Array(data.localIdentityKey),
      remoteIdentityKey: new Uint8Array(data.remoteIdentityKey),
      rootKey: new Uint8Array(data.rootKey),
      sendingChain: data.sendingChain ? {
        chainKey: new Uint8Array(data.sendingChain.chainKey),
        messageNumber: data.sendingChain.messageNumber,
        dhKeyPair: data.sendingChain.dhKeyPair ? {
          publicKey: new Uint8Array(data.sendingChain.dhKeyPair.publicKey),
          privateKey: new Uint8Array(data.sendingChain.dhKeyPair.privateKey)
        } : undefined
      } : undefined,
      receivingChains,
      skippedMessages,
      sessionVersion: data.sessionVersion,
      messageNumber: data.messageNumber
    };
  }

  // Save sessions after each encryption/decryption operation
  private async persistSessions(): Promise<void> {
    await this.saveToStorage();
  }


}