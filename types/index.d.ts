interface WindowAPI {
    notificationApi: {
        sendNotification: ({message, title, url, avatar}: {message?: string, title?: string, url?: string, avatar?: string}) => void;
    }
}

export declare global {
    interface Window {
        WindowAPI: WindowAPI;
    }
}