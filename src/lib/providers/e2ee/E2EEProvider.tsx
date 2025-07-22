import {
  createContext,
  createSignal,
  useContext,
  createEffect,
  ParentComponent,
} from "solid-js";
import { e2eeService } from "../../e2ee/E2EEService";
import { useAuth } from "../auth/AuthProvider";

type E2EEContextType = {
  isE2EEInitialized: () => boolean;
  setIsE2EEInitialized: (initialized: boolean) => void;
  initializeE2EE: () => Promise<boolean>;
  checkUserE2EEStatus: (userId: string) => Promise<{ initialized: boolean }>;
  getE2EEStatusForRoom: (roomType: number, recipients?: string[]) => 'enabled' | 'partial' | 'disabled';
  encryptMessage: (roomType: number, roomId: string, content: string, recipientId?: string) => Promise<string>;
  decryptMessage: (roomType: number, roomId: string, encryptedContent: string, senderId?: string) => Promise<string>;
  loading: () => boolean;
};

const E2EEContext = createContext<E2EEContextType>();

export const E2EEProvider: ParentComponent = (props) => {
  const auth = useAuth();
  const [isE2EEInitialized, setIsE2EEInitialized] = createSignal(false);
  const [loading, setLoading] = createSignal(false);

  // Initialize E2EE when user is authenticated
  createEffect(() => {
    const user = auth?.user();
    console.log('[E2EE Provider] Auth effect triggered:', {
      user: !!user,
      isAuthenticated: auth?.isAuthenticated(),
      isE2EEInitialized: isE2EEInitialized(),
      loading: loading()
    });
    if (user && auth?.isAuthenticated() && !isE2EEInitialized() && !loading()) {
      console.log('[E2EE Provider] Starting E2EE initialization...');
      checkAndInitializeE2EE();
    }
  });

  const checkAndInitializeE2EE = async () => {
    // Prevent multiple simultaneous initialization attempts
    if (loading() || isE2EEInitialized()) {
      return;
    }

    try {
      setLoading(true);
      console.log('[E2EE Provider] Checking E2EE status...');
      
      // Check if E2EE service is already initialized
      if (e2eeService.isE2EEInitialized()) {
        setIsE2EEInitialized(true);
        console.log('[E2EE Provider] E2EE service already initialized');
        return;
      }

      // Check if E2EE is already initialized on server
      const status = await e2eeService.checkE2EEStatus();
      if (status.initialized) {
        // Initialize the service with existing keys
        const success = await e2eeService.initialize();
        setIsE2EEInitialized(success);
        console.log('[E2EE Provider] E2EE initialized with existing keys');
        return;
      }

      // Auto-initialize E2EE for new users
      console.log('[E2EE Provider] Initializing E2EE for new user...');
      const success = await e2eeService.initialize();
      setIsE2EEInitialized(success);
      
      if (success) {
        console.log('[E2EE Provider] E2EE initialized successfully');
      } else {
        console.warn('[E2EE Provider] Failed to initialize E2EE');
      }
    } catch (error) {
      console.error('[E2EE Provider] Error during E2EE initialization:', error);
      setIsE2EEInitialized(false);
    } finally {
      setLoading(false);
    }
  };

  const initializeE2EE = async (): Promise<boolean> => {
    try {
      setLoading(true);
      const success = await e2eeService.initialize();
      setIsE2EEInitialized(success);
      return success;
    } catch (error) {
      console.error('[E2EE Provider] Manual E2EE initialization failed:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const checkUserE2EEStatus = async (userId: string): Promise<{ initialized: boolean }> => {
    try {
      return await e2eeService.checkUserE2EEStatus(userId);
    } catch (error) {
      console.error('[E2EE Provider] Failed to check user E2EE status:', error);
      return { initialized: false };
    }
  };

  const getE2EEStatusForRoom = (roomType: number, recipients?: string[]): 'enabled' | 'partial' | 'disabled' => {
    if (!isE2EEInitialized()) {
      return 'disabled';
    }
    
    return e2eeService.getE2EEStatusForRoom(roomType, recipients);
  };

  const encryptMessage = async (
    roomType: number,
    roomId: string,
    content: string,
    recipientId?: string
  ): Promise<string> => {
    try {
      if (!isE2EEInitialized()) {
        console.warn('[E2EE Provider] E2EE not initialized, sending plaintext');
        return content;
      }

      // Room type 0 = PM (not encrypted), Room type 1 = GROUP_PM, Room type 2 = TEXT_ROOM
      if (roomType === 0) {
        // Direct PMs are not encrypted
        console.log('[E2EE Provider] Direct PM detected - sending as plaintext (not encrypted)');
        return content;
      } else if (roomType === 1 || roomType === 2) {
        // Group message encryption (for both GROUP_PM and TEXT_ROOM)
        return await e2eeService.encryptGroupMessage(roomId, content);
      }

      // For other room types, return plaintext
      return content;
    } catch (error) {
      console.error('[E2EE Provider] Failed to encrypt message:', error);
      // Fallback to plaintext if encryption fails
      return content;
    }
  };

  const decryptMessage = async (
    roomType: number,
    roomId: string,
    encryptedContent: string,
    senderId?: string
  ): Promise<string> => {
    try {
      if (!isE2EEInitialized()) {
        return encryptedContent;
      }

      // Room type 0 = PM (not encrypted), Room type 1 = GROUP_PM, Room type 2 = TEXT_ROOM
      if (roomType === 0) {
        // Direct PMs are not encrypted, return as-is
        return encryptedContent;
      } else if (roomType === 1 || roomType === 2) {
        // Group message decryption (for both GROUP_PM and TEXT_ROOM)
        return await e2eeService.decryptGroupMessage(roomId, encryptedContent);
      }

      // For other room types, return as-is
      return encryptedContent;
    } catch (error) {
      console.error('[E2EE Provider] Failed to decrypt message:', error);
      // Fallback to original content if decryption fails
      return encryptedContent;
    }
  };

  const contextValue: E2EEContextType = {
    isE2EEInitialized,
    setIsE2EEInitialized,
    initializeE2EE,
    checkUserE2EEStatus,
    getE2EEStatusForRoom,
    encryptMessage,
    decryptMessage,
    loading,
  };

  return (
    <E2EEContext.Provider value={contextValue}>
      {props.children}
    </E2EEContext.Provider>
  );
};

export const useE2EE = () => {
  const context = useContext(E2EEContext);
  if (!context) {
    throw new Error("useE2EE must be used within an E2EEProvider");
  }
  return context;
};