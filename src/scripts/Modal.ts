export const updatePresence = (ws: WebSocket | null | undefined, { status, status_text }: { status: string, status_text?: string }) => {
    ws?.send(JSON.stringify({
        op: 5,
        data: {
            status, status_text
        }
    }));
}