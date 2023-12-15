import localForage from 'localforage';

export const getCachedMessages = async (roomId: string): Promise<any[] | null> => {
    try {
        const cachedData: string | null = await localForage.getItem(`room_messages_${roomId}`);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error('Error while getting cached messages:', error);
        return null;
    }
};

export const cacheMessages = async (roomId: string, messages: any[]): Promise<void> => {
    try {
        await localForage.setItem(`room_messages_${roomId}`, JSON.stringify(messages));
    } catch (error) {
        console.error('Error while caching messages:', error);
    }
};

export const clearCache = async (): Promise<void> => {
    try {
        await localForage.clear();
    } catch (error) {
        console.error('Error while clearing cache:', error);
    }
};
