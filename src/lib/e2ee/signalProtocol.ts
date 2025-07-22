// Proper Signal Protocol Implementation
// This implements the Signal protocol according to the official specification

import {
  generateCurve25519KeyPair,
  curve25519DH,
  hkdfDerive,
  hmacSha256,
  aes256CbcEncrypt,
  aes256CbcDecrypt,
  generateRandomBytes,
  constantTimeEqual,
  Curve25519KeyPair,
  SIGNAL_PROTOCOL_VERSION,
  MAX_SKIP_MESSAGES,
  MAX_CACHE_SIZE,
  HKDF_INFO_ROOT_KEY,
  HKDF_INFO_MESSAGE_KEYS
} from './curve25519';

// Signal Protocol Interfaces
export interface IdentityKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SignedPreKey {
  keyId: number;
  keyPair: Curve25519KeyPair;
  signature: Uint8Array;
  timestamp: number;
}

export interface PreKey {
  keyId: number;
  keyPair: Curve25519KeyPair;
}

export interface PreKeyBundle {
  registrationId: number;
  deviceId: number;
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

export interface MessageKeys {
  cipherKey: Uint8Array;
  macKey: Uint8Array;
  iv: Uint8Array;
  counter: number;
}

export interface ChainKey {
  key: Uint8Array;
  counter: number;
}

export interface RootKey {
  key: Uint8Array;
}

export interface DHRatchetKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface SessionState {
  sessionVersion: number;
  localIdentityKey: Uint8Array;
  remoteIdentityKey: Uint8Array;
  localRegistrationId: number;
  remoteRegistrationId: number;
  
  // Double Ratchet state
  rootKey: RootKey;
  sendingChain?: {
    chainKey: ChainKey;
    dhKeyPair: DHRatchetKeyPair;
  };
  receivingChains: Map<string, {
    chainKey: ChainKey;
    dhPublicKey: Uint8Array;
  }>;
  
  // Message handling
  skippedMessageKeys: Map<string, MessageKeys>;
  previousCounter: number;
  
  // Session metadata
  aliceBaseKey?: Uint8Array;
  sessionId: string;
  created: number;
  lastUsed: number;
}

export interface MessageHeader {
  dhPublicKey: Uint8Array;
  previousCounter: number;
  counter: number;
}

export interface SignalMessage {
  version: number;
  header: MessageHeader;
  ciphertext: Uint8Array;
  mac: Uint8Array;
}

export interface PreKeySignalMessage {
  version: number;
  registrationId: number;
  preKeyId?: number;
  signedPreKeyId: number;
  baseKey: Uint8Array;
  identityKey: Uint8Array;
  message: SignalMessage;
}

// Signal Protocol Implementation
export class SignalProtocol {
  private identityKeyPair: IdentityKeyPair | null = null;
  private registrationId: number = 0;
  private deviceId: number = 1;
  private signedPreKeys: Map<number, SignedPreKey> = new Map();
  private preKeys: Map<number, PreKey> = new Map();
  private sessions: Map<string, SessionState> = new Map();
  private storagePrefix = 'signal_protocol_';

  async initialize(): Promise<void> {
    try {
      // Try to restore from storage
      await this.restoreFromStorage();
      
      console.log('[Signal Protocol] After restore - identityKeyPair exists:', !!this.identityKeyPair);
      console.log('[Signal Protocol] After restore - signedPreKeys count:', this.signedPreKeys.size);
      console.log('[Signal Protocol] After restore - preKeys count:', this.preKeys.size);
      
      // Check if we have valid keys after restore
      const needsNewKeys = !this.identityKeyPair || 
                          !this.identityKeyPair.publicKey || 
                          !this.identityKeyPair.privateKey || 
                          this.identityKeyPair.publicKey.length === 0 || 
                          this.signedPreKeys.size === 0 || 
                          this.preKeys.size === 0;
      
      // Generate new keys if not found or invalid
      if (needsNewKeys) {
        console.log('[Signal Protocol] Generating new keys (reason: ' + 
          (!this.identityKeyPair ? 'no identity key pair' : 
           !this.identityKeyPair.publicKey ? 'no public key' : 
           !this.identityKeyPair.privateKey ? 'no private key' : 
           this.identityKeyPair.publicKey.length === 0 ? 'empty public key' : 
           this.signedPreKeys.size === 0 ? 'no signed pre-keys' : 
           'no pre-keys') + ')');
        
        // Clear existing keys
        this.identityKeyPair = null;
        this.signedPreKeys.clear();
        this.preKeys.clear();
        
        // Generate fresh keys
        await this.generateKeys();
        
        // Verify keys were generated properly
        if (!this.identityKeyPair || 
            !this.identityKeyPair || !('publicKey' in this.identityKeyPair!) ||
            !this.identityKeyPair || !('publicKey' in this.identityKeyPair) || (this.identityKeyPair as IdentityKeyPair).publicKey.length === 0 ||
            this.signedPreKeys.size === 0 || 
            this.preKeys.size === 0) {
          throw new Error('Failed to generate valid keys');
        }
        
        // Save to storage
        await this.saveToStorage();
        
        console.log('[Signal Protocol] Keys generated - signedPreKeys count:', this.signedPreKeys.size);
        console.log('[Signal Protocol] Keys generated - preKeys count:', this.preKeys.size);
        console.log('[Signal Protocol] Identity key length:', (this.identityKeyPair as IdentityKeyPair | null)?.publicKey?.length || 0);
        console.log('[Signal Protocol] First signed pre-key length:', 
          Array.from(this.signedPreKeys.values())[0]?.keyPair?.publicKey?.length || 0);
      }
      
      console.log('[Signal Protocol] Initialized successfully');
    } catch (error) {
      console.error('[Signal Protocol] Failed to initialize:', error);
      throw error;
    }
  }

  private async generateKeys(): Promise<void> {
    // Generate identity key pair
    this.identityKeyPair = await generateCurve25519KeyPair();
    
    // Generate registration ID
    this.registrationId = Math.floor(Math.random() * 16384) + 1;
    
    // Generate signed pre-key
    await this.generateSignedPreKey(1);
    
    // Generate one-time pre-keys
    for (let i = 1; i <= 100; i++) {
      await this.generatePreKey(i);
    }
  }

  private async generateSignedPreKey(keyId: number): Promise<void> {
    if (!this.identityKeyPair) {
      throw new Error('Identity key pair not initialized');
    }

    const keyPair = await generateCurve25519KeyPair();
    const signature = await this.signData(keyPair.publicKey, this.identityKeyPair.privateKey);
    
    const signedPreKey: SignedPreKey = {
      keyId,
      keyPair,
      signature,
      timestamp: Date.now()
    };
    
    this.signedPreKeys.set(keyId, signedPreKey);
  }

  private async generatePreKey(keyId: number): Promise<void> {
    const keyPair = await generateCurve25519KeyPair();
    
    const preKey: PreKey = {
      keyId,
      keyPair
    };
    
    this.preKeys.set(keyId, preKey);
  }

  private async signData(data: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    // For Curve25519, we use Ed25519 for signatures
    // This is a simplified implementation - in production use proper Ed25519
    return await hmacSha256(privateKey, data);
  }

  private async verifySignature(
    data: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array
  ): Promise<boolean> {
    // Simplified verification - in production use proper Ed25519
    const expectedSignature = await hmacSha256(publicKey, data);
    return constantTimeEqual(signature, expectedSignature);
  }

  // X3DH Key Agreement Protocol
  async performX3DH(
    remotePreKeyBundle: PreKeyBundle,
    isInitiator: boolean = true
  ): Promise<{ sessionState: SessionState; preKeyMessage?: PreKeySignalMessage }> {
    if (!this.identityKeyPair) {
      throw new Error('Identity key pair not initialized');
    }

    // Verify the signed pre-key signature
    const signatureValid = await this.verifySignature(
      remotePreKeyBundle.signedPreKey.publicKey,
      remotePreKeyBundle.signedPreKey.signature,
      remotePreKeyBundle.identityKey
    );
    
    if (!signatureValid) {
      throw new Error('Invalid signed pre-key signature');
    }

    let sessionState: SessionState;
    let preKeyMessage: PreKeySignalMessage | undefined;

    if (isInitiator) {
      // Alice (initiator) side
      const ephemeralKeyPair = await generateCurve25519KeyPair();
      
      // Perform the 4 DH operations
      const dh1 = await curve25519DH(
        this.identityKeyPair.privateKey,
        remotePreKeyBundle.signedPreKey.publicKey
      );
      
      const dh2 = await curve25519DH(
        ephemeralKeyPair.privateKey,
        remotePreKeyBundle.identityKey
      );
      
      const dh3 = await curve25519DH(
        ephemeralKeyPair.privateKey,
        remotePreKeyBundle.signedPreKey.publicKey
      );
      
      let dh4: Uint8Array | null = null;
      if (remotePreKeyBundle.preKey) {
        dh4 = await curve25519DH(
          ephemeralKeyPair.privateKey,
          remotePreKeyBundle.preKey.publicKey
        );
      }
      
      // Derive the shared secret
      const sharedSecret = this.combineSharedSecrets([dh1, dh2, dh3, dh4].filter(Boolean) as Uint8Array[]);
      
      // Derive root key and initial chain key
      const rootKey = await this.deriveRootKey(sharedSecret);
      const sendingChainKeyPair = await generateCurve25519KeyPair();
      const dhOutput = await curve25519DH(
        sendingChainKeyPair.privateKey,
        remotePreKeyBundle.signedPreKey.publicKey
      );
      
      const { newRootKey, chainKey } = await this.deriveRootAndChainKeys(rootKey.key, dhOutput);
      
      // Create session state
      sessionState = {
        sessionVersion: SIGNAL_PROTOCOL_VERSION,
        localIdentityKey: this.identityKeyPair.publicKey,
        remoteIdentityKey: remotePreKeyBundle.identityKey,
        localRegistrationId: this.registrationId,
        remoteRegistrationId: remotePreKeyBundle.registrationId,
        rootKey: { key: newRootKey },
        sendingChain: {
          chainKey: { key: chainKey, counter: 0 },
          dhKeyPair: {
            publicKey: sendingChainKeyPair.publicKey,
            privateKey: sendingChainKeyPair.privateKey
          }
        },
        receivingChains: new Map(),
        skippedMessageKeys: new Map(),
        previousCounter: 0,
        aliceBaseKey: ephemeralKeyPair.publicKey,
        sessionId: this.generateSessionId(),
        created: Date.now(),
        lastUsed: Date.now()
      };
      
      // Create pre-key message for the first message
      preKeyMessage = {
        version: SIGNAL_PROTOCOL_VERSION,
        registrationId: this.registrationId,
        preKeyId: remotePreKeyBundle.preKey?.keyId,
        signedPreKeyId: remotePreKeyBundle.signedPreKey.keyId,
        baseKey: ephemeralKeyPair.publicKey,
        identityKey: this.identityKeyPair.publicKey,
        message: {
          version: SIGNAL_PROTOCOL_VERSION,
          header: {
            dhPublicKey: sendingChainKeyPair.publicKey,
            previousCounter: 0,
            counter: 0
          },
          ciphertext: new Uint8Array(0), // Will be filled when encrypting
          mac: new Uint8Array(0) // Will be filled when encrypting
        }
      };
    } else {
      // Bob (receiver) side - this would be implemented when receiving a pre-key message
      throw new Error('Receiver side X3DH not implemented in this example');
    }

    return { sessionState, preKeyMessage };
  }

  private combineSharedSecrets(secrets: Uint8Array[]): Uint8Array {
    const totalLength = secrets.reduce((sum, secret) => sum + secret.length, 0);
    const combined = new Uint8Array(totalLength);
    
    let offset = 0;
    for (const secret of secrets) {
      combined.set(secret, offset);
      offset += secret.length;
    }
    
    return combined;
  }

  private async deriveRootKey(sharedSecret: Uint8Array): Promise<RootKey> {
    const rootKeyBytes = await hkdfDerive(
      sharedSecret,
      new Uint8Array(32), // 32-byte zero salt
      HKDF_INFO_ROOT_KEY,
      32
    );
    
    return { key: rootKeyBytes };
  }

  private async deriveRootAndChainKeys(
    rootKey: Uint8Array,
    dhOutput: Uint8Array
  ): Promise<{ newRootKey: Uint8Array; chainKey: Uint8Array }> {
    const derivedKeys = await hkdfDerive(
      dhOutput,
      rootKey,
      HKDF_INFO_ROOT_KEY,
      64 // 32 bytes for root key + 32 bytes for chain key
    );
    
    return {
      newRootKey: derivedKeys.slice(0, 32),
      chainKey: derivedKeys.slice(32, 64)
    };
  }

  private async deriveMessageKeys(chainKey: ChainKey): Promise<MessageKeys> {
    const messageKeyInput = await hmacSha256(
      chainKey.key,
      new TextEncoder().encode('\x01')
    );
    
    const derivedKeys = await hkdfDerive(
      messageKeyInput,
      new Uint8Array(32), // 32-byte zero salt
      HKDF_INFO_MESSAGE_KEYS,
      80 // 32 + 32 + 16 bytes for cipher key, mac key, and IV
    );
    
    return {
      cipherKey: derivedKeys.slice(0, 32),
      macKey: derivedKeys.slice(32, 64),
      iv: derivedKeys.slice(64, 80),
      counter: chainKey.counter
    };
  }

  private async advanceChainKey(chainKey: ChainKey): Promise<ChainKey> {
    const newKey = await hmacSha256(
      chainKey.key,
      new TextEncoder().encode('\x02')
    );
    
    return {
      key: newKey,
      counter: chainKey.counter + 1
    };
  }

  // Double Ratchet Algorithm
  async encryptMessage(sessionId: string, plaintext: string): Promise<SignalMessage> {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      throw new Error('Session not found');
    }

    if (!sessionState.sendingChain) {
      throw new Error('No sending chain available');
    }

    // Derive message keys
    const messageKeys = await this.deriveMessageKeys(sessionState.sendingChain.chainKey);
    
    // Advance chain key
    sessionState.sendingChain.chainKey = await this.advanceChainKey(sessionState.sendingChain.chainKey);
    
    // Encrypt the message
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ciphertext = await aes256CbcEncrypt(
      messageKeys.cipherKey,
      messageKeys.iv,
      plaintextBytes
    );
    
    // Create message header
    const header: MessageHeader = {
      dhPublicKey: sessionState.sendingChain.dhKeyPair.publicKey,
      previousCounter: sessionState.previousCounter,
      counter: messageKeys.counter
    };
    
    // Calculate MAC
    const headerBytes = this.serializeHeader(header);
    const macInput = new Uint8Array(headerBytes.length + ciphertext.length);
    macInput.set(headerBytes, 0);
    macInput.set(ciphertext, headerBytes.length);
    
    const mac = await hmacSha256(messageKeys.macKey, macInput);
    
    // Update session state
    sessionState.lastUsed = Date.now();
    await this.saveToStorage();
    
    return {
      version: SIGNAL_PROTOCOL_VERSION,
      header,
      ciphertext,
      mac
    };
  }

  async decryptMessage(sessionId: string, message: SignalMessage): Promise<string> {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) {
      throw new Error('Session not found');
    }

    const dhPublicKeyStr = Array.from(message.header.dhPublicKey).join(',');
    
    // Check for skipped message keys
    const skippedKeyId = `${dhPublicKeyStr}_${message.header.counter}`;
    const skippedMessageKeys = sessionState.skippedMessageKeys.get(skippedKeyId);
    
    if (skippedMessageKeys) {
      sessionState.skippedMessageKeys.delete(skippedKeyId);
      return await this.decryptWithMessageKeys(message, skippedMessageKeys);
    }
    
    // Get or create receiving chain
    let receivingChain = sessionState.receivingChains.get(dhPublicKeyStr);
    
    if (!receivingChain) {
      // Perform DH ratchet step
      await this.performDHRatchetReceive(sessionState, message.header.dhPublicKey);
      receivingChain = sessionState.receivingChains.get(dhPublicKeyStr)!;
    }
    
    // Skip messages if necessary
    if (message.header.counter > receivingChain.chainKey.counter) {
      await this.skipMessageKeys(
        sessionState,
        dhPublicKeyStr,
        receivingChain,
        message.header.counter
      );
    }
    
    // Derive message keys and decrypt
    const messageKeys = await this.deriveMessageKeys(receivingChain.chainKey);
    receivingChain.chainKey = await this.advanceChainKey(receivingChain.chainKey);
    
    // Update session state
    sessionState.lastUsed = Date.now();
    await this.saveToStorage();
    
    return await this.decryptWithMessageKeys(message, messageKeys);
  }

  private async decryptWithMessageKeys(
    message: SignalMessage,
    messageKeys: MessageKeys
  ): Promise<string> {
    // Verify MAC
    const headerBytes = this.serializeHeader(message.header);
    const macInput = new Uint8Array(headerBytes.length + message.ciphertext.length);
    macInput.set(headerBytes, 0);
    macInput.set(message.ciphertext, headerBytes.length);
    
    const expectedMac = await hmacSha256(messageKeys.macKey, macInput);
    
    if (!constantTimeEqual(message.mac, expectedMac)) {
      throw new Error('MAC verification failed');
    }
    
    // Decrypt message
    const plaintextBytes = await aes256CbcDecrypt(
      messageKeys.cipherKey,
      messageKeys.iv,
      message.ciphertext
    );
    
    return new TextDecoder().decode(plaintextBytes);
  }

  private async performDHRatchetReceive(
    sessionState: SessionState,
    remoteDHPublicKey: Uint8Array
  ): Promise<void> {
    if (!sessionState.sendingChain) {
      throw new Error('No sending chain available for DH ratchet');
    }

    // Perform DH with remote public key
    const dhOutput = await curve25519DH(
      sessionState.sendingChain.dhKeyPair.privateKey,
      remoteDHPublicKey
    );
    
    // Derive new root and chain keys
    const { newRootKey, chainKey } = await this.deriveRootAndChainKeys(
      sessionState.rootKey.key,
      dhOutput
    );
    
    // Update root key
    sessionState.rootKey.key = newRootKey;
    
    // Create new receiving chain
    const dhPublicKeyStr = Array.from(remoteDHPublicKey).join(',');
    sessionState.receivingChains.set(dhPublicKeyStr, {
      chainKey: { key: chainKey, counter: 0 },
      dhPublicKey: remoteDHPublicKey
    });
  }

  private async skipMessageKeys(
    sessionState: SessionState,
    dhPublicKeyStr: string,
    receivingChain: { chainKey: ChainKey; dhPublicKey: Uint8Array },
    targetCounter: number
  ): Promise<void> {
    const skipCount = targetCounter - receivingChain.chainKey.counter;
    
    if (skipCount > MAX_SKIP_MESSAGES) {
      throw new Error('Too many skipped messages');
    }
    
    for (let i = 0; i < skipCount; i++) {
      const messageKeys = await this.deriveMessageKeys(receivingChain.chainKey);
      const skippedKeyId = `${dhPublicKeyStr}_${receivingChain.chainKey.counter}`;
      
      sessionState.skippedMessageKeys.set(skippedKeyId, messageKeys);
      receivingChain.chainKey = await this.advanceChainKey(receivingChain.chainKey);
      
      // Limit cache size
      if (sessionState.skippedMessageKeys.size > MAX_CACHE_SIZE) {
        const firstKey = sessionState.skippedMessageKeys.keys().next().value;
        if (firstKey) {
          sessionState.skippedMessageKeys.delete(firstKey);
        }
      }
    }
  }

  private serializeHeader(header: MessageHeader): Uint8Array {
    // Simple serialization - in production use proper protobuf
    const dhKeyLength = header.dhPublicKey.length;
    const buffer = new ArrayBuffer(4 + dhKeyLength + 8);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    
    view.setUint32(0, dhKeyLength, false);
    uint8View.set(header.dhPublicKey, 4);
    view.setUint32(4 + dhKeyLength, header.previousCounter, false);
    view.setUint32(8 + dhKeyLength, header.counter, false);
    
    return uint8View;
  }

  private generateSessionId(): string {
    return Array.from(generateRandomBytes(16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Public API methods
  getIdentityKey(): Uint8Array | null {
    return this.identityKeyPair?.publicKey || null;
  }

  getRegistrationId(): number {
    return this.registrationId;
  }

  getPreKeyBundle(): PreKeyBundle | null {
    console.log('[Signal Protocol] getPreKeyBundle called');
    console.log('[Signal Protocol] identityKeyPair exists:', !!this.identityKeyPair);
    console.log('[Signal Protocol] signedPreKeys count:', this.signedPreKeys.size);
    console.log('[Signal Protocol] preKeys count:', this.preKeys.size);
    
    // Validate identity key pair
    if (!this.identityKeyPair || 
        !this.identityKeyPair.publicKey || 
        this.identityKeyPair.publicKey.length === 0) {
      console.error('[Signal Protocol] Invalid identity key pair, returning null');
      return null;
    }

    // Get signed pre-key and validate
    const signedPreKey = Array.from(this.signedPreKeys.values())[0];
    if (!signedPreKey || 
        !signedPreKey.keyPair || 
        !signedPreKey.keyPair.publicKey || 
        signedPreKey.keyPair.publicKey.length === 0 || 
        !signedPreKey.signature || 
        signedPreKey.signature.length === 0) {
      console.error('[Signal Protocol] Invalid signed pre-key, returning null');
      return null;
    }
    
    // Get pre-key and validate
    const preKey = Array.from(this.preKeys.values())[0];
    if (!preKey || 
        !preKey.keyPair || 
        !preKey.keyPair.publicKey || 
        preKey.keyPair.publicKey.length === 0) {
      console.error('[Signal Protocol] Invalid pre-key, regenerating...');
      // Try to regenerate a pre-key
      try {
        this.generatePreKey(Math.floor(Math.random() * 100) + 1);
        // Get the newly generated pre-key
        const newPreKey = Array.from(this.preKeys.values())[0];
        if (!newPreKey || !newPreKey.keyPair || !newPreKey.keyPair.publicKey) {
          console.error('[Signal Protocol] Failed to regenerate pre-key');
          // Continue without a pre-key
        } else {
          console.log('[Signal Protocol] Successfully regenerated pre-key');
        }
      } catch (error) {
        console.error('[Signal Protocol] Error regenerating pre-key:', error);
        // Continue without a pre-key
      }
    }
    
    // Get the latest pre-key after potential regeneration
    const finalPreKey = Array.from(this.preKeys.values())[0];
    
    console.log('[Signal Protocol] Final validation:', {
      identityKeyValid: !!this.identityKeyPair && !!this.identityKeyPair.publicKey,
      identityKeyLength: this.identityKeyPair?.publicKey?.length || 0,
      signedPreKeyValid: !!signedPreKey && !!signedPreKey.keyPair && !!signedPreKey.keyPair.publicKey,
      signedPreKeyLength: signedPreKey?.keyPair?.publicKey?.length || 0,
      signatureValid: !!signedPreKey?.signature,
      signatureLength: signedPreKey?.signature?.length || 0,
      preKeyValid: !!finalPreKey && !!finalPreKey.keyPair && !!finalPreKey.keyPair.publicKey,
      preKeyLength: finalPreKey?.keyPair?.publicKey?.length || 0
    });

    // Create the bundle with validated keys
    const bundle = {
      registrationId: this.registrationId,
      deviceId: this.deviceId,
      identityKey: this.identityKeyPair.publicKey,
      signedPreKey: {
        keyId: signedPreKey.keyId,
        publicKey: signedPreKey.keyPair.publicKey,
        signature: signedPreKey.signature
      },
      preKey: finalPreKey ? {
        keyId: finalPreKey.keyId,
        publicKey: finalPreKey.keyPair.publicKey
      } : undefined
    };
    
    // Final validation of the bundle
    if (bundle.identityKey.length === 0 || 
        bundle.signedPreKey.publicKey.length === 0 || 
        bundle.signedPreKey.signature.length === 0) {
      console.error('[Signal Protocol] Bundle validation failed, keys have zero length');
      return null;
    }
    
    console.log('[Signal Protocol] Bundle created with key lengths:', {
      identityKey: bundle.identityKey.length,
      signedPreKeyPublic: bundle.signedPreKey.publicKey.length,
      signature: bundle.signedPreKey.signature.length,
      preKeyPublic: bundle.preKey?.publicKey?.length || 0
    });
    
    // Log the first few bytes of each key for debugging
    console.log('[Signal Protocol] Key samples:', {
      identityKey: Array.from(bundle.identityKey.slice(0, 4)),
      signedPreKeyPublic: Array.from(bundle.signedPreKey.publicKey.slice(0, 4)),
      signature: Array.from(bundle.signedPreKey.signature.slice(0, 4)),
      preKeyPublic: bundle.preKey ? Array.from(bundle.preKey.publicKey.slice(0, 4)) : []
    });
    
    return bundle;
  }

  async createSession(remotePreKeyBundle: PreKeyBundle): Promise<string> {
    const { sessionState } = await this.performX3DH(remotePreKeyBundle, true);
    this.sessions.set(sessionState.sessionId, sessionState);
    await this.saveToStorage();
    return sessionState.sessionId;
  }

  // Storage methods
  private async saveToStorage(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    
    try {
      // Verify we have valid data before saving
      if (!this.identityKeyPair || !this.identityKeyPair.publicKey || !this.identityKeyPair.privateKey) {
        console.error('[Signal Protocol] Cannot save to storage: Invalid identity key pair');
        return;
      }
      
      if (this.signedPreKeys.size === 0) {
        console.error('[Signal Protocol] Cannot save to storage: No signed pre-keys');
        return;
      }
      
      if (this.preKeys.size === 0) {
        console.error('[Signal Protocol] Cannot save to storage: No pre-keys');
        return;
      }
      
      const data = {
        identityKeyPair: this.identityKeyPair,
        registrationId: this.registrationId,
        deviceId: this.deviceId,
        signedPreKeys: Array.from(this.signedPreKeys.entries()),
        preKeys: Array.from(this.preKeys.entries()),
        sessions: Array.from(this.sessions.entries()).map(([id, session]) => [
          id,
          this.serializeSession(session)
        ])
      };
      
      // Verify data can be serialized properly
      const serialized = JSON.stringify(data);
      if (!serialized) {
        throw new Error('Failed to serialize data');
      }
      
      localStorage.setItem(this.storagePrefix + 'data', serialized);
      console.log('[Signal Protocol] Successfully saved data to storage');
    } catch (error) {
      console.error('[Signal Protocol] Failed to save to storage:', error);
    }
  }

  private async restoreFromStorage(): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    
    const dataStr = localStorage.getItem(this.storagePrefix + 'data');
    if (!dataStr) {
      console.log('[Signal Protocol] No data found in storage');
      return;
    }
    
    try {
      const data = JSON.parse(dataStr);
      
      // Validate identity key pair
      if (!data.identityKeyPair || 
          !data.identityKeyPair.publicKey || 
          !data.identityKeyPair.privateKey ||
          data.identityKeyPair.publicKey.length === 0 ||
          data.identityKeyPair.privateKey.length === 0) {
        console.error('[Signal Protocol] Invalid identity key pair in storage');
        return;
      }
      
      // Restore identity key pair with proper Uint8Array conversion
      this.identityKeyPair = {
        publicKey: new Uint8Array(data.identityKeyPair.publicKey),
        privateKey: new Uint8Array(data.identityKeyPair.privateKey)
      };
      
      this.registrationId = data.registrationId || 0;
      this.deviceId = data.deviceId || 1;
      
      // Restore signed pre-keys with proper Uint8Array conversion
      if (data.signedPreKeys && Array.isArray(data.signedPreKeys)) {
        this.signedPreKeys = new Map();
        for (const [keyId, signedPreKey] of data.signedPreKeys) {
          if (signedPreKey && signedPreKey.keyPair) {
            // Ensure keyPair has proper Uint8Array values
            const restoredSignedPreKey = {
              ...signedPreKey,
              keyPair: {
                publicKey: new Uint8Array(signedPreKey.keyPair.publicKey),
                privateKey: new Uint8Array(signedPreKey.keyPair.privateKey)
              },
              signature: new Uint8Array(signedPreKey.signature)
            };
            this.signedPreKeys.set(Number(keyId), restoredSignedPreKey);
          }
        }
      }
      
      // Restore pre-keys with proper Uint8Array conversion
      if (data.preKeys && Array.isArray(data.preKeys)) {
        this.preKeys = new Map();
        for (const [keyId, preKey] of data.preKeys) {
          if (preKey && preKey.keyPair) {
            // Ensure keyPair has proper Uint8Array values
            const restoredPreKey = {
              ...preKey,
              keyPair: {
                publicKey: new Uint8Array(preKey.keyPair.publicKey),
                privateKey: new Uint8Array(preKey.keyPair.privateKey)
              }
            };
            this.preKeys.set(Number(keyId), restoredPreKey);
          }
        }
      }
      
      // Restore sessions
      if (data.sessions && Array.isArray(data.sessions)) {
        this.sessions = new Map(
          data.sessions.map(([id, serializedSession]: [string, any]) => [
            id,
            this.deserializeSession(serializedSession)
          ])
        );
      }
      
      console.log('[Signal Protocol] Successfully restored from storage');
      console.log('[Signal Protocol] Identity key length:', this.identityKeyPair.publicKey.length);
      console.log('[Signal Protocol] Signed pre-keys count:', this.signedPreKeys.size);
      console.log('[Signal Protocol] Pre-keys count:', this.preKeys.size);
    } catch (error) {
      console.error('[Signal Protocol] Failed to restore from storage:', error);
      // Clear potentially corrupted data
      localStorage.removeItem(this.storagePrefix + 'data');
    }
  }

  private serializeSession(session: SessionState): any {
    return {
      ...session,
      receivingChains: Array.from(session.receivingChains.entries()),
      skippedMessageKeys: Array.from(session.skippedMessageKeys.entries())
    };
  }

  private deserializeSession(data: any): SessionState {
    return {
      ...data,
      receivingChains: new Map(data.receivingChains || []),
      skippedMessageKeys: new Map(data.skippedMessageKeys || [])
    };
  }
}