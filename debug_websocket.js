// Debug script to log raw WebSocket data
// Run this in the browser console to see what data is actually being received

console.log('Starting WebSocket debug...');

// Override WebSocket to intercept messages
const originalWebSocket = window.WebSocket;
window.WebSocket = function(url, protocols) {
    const ws = new originalWebSocket(url, protocols);
    
    const originalOnMessage = ws.onmessage;
    ws.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('[DEBUG] Raw WebSocket message:', data);
            
            // Check for MESSAGE_CREATE events specifically
            if (data.op === 0 && data.d) {
                console.log('[DEBUG] Event data:', data.d);
                
                // Log type and system_type fields specifically
                if (data.d.type !== undefined) {
                    console.log('[DEBUG] type field:', data.d.type, typeof data.d.type);
                }
                if (data.d.system_type !== undefined) {
                    console.log('[DEBUG] system_type field:', data.d.system_type, typeof data.d.system_type);
                }
                if (data.d.system_data !== undefined) {
                    console.log('[DEBUG] system_data field:', data.d.system_data, typeof data.d.system_data);
                }
                if (data.d.author_id !== undefined) {
                    console.log('[DEBUG] author_id field:', data.d.author_id, typeof data.d.author_id);
                }
            }
        } catch (e) {
            console.log('[DEBUG] Non-JSON WebSocket message:', event.data);
        }
        
        // Call original handler
        if (originalOnMessage) {
            originalOnMessage.call(this, event);
        }
    };
    
    return ws;
};

console.log('WebSocket debug setup complete. Create a system message to see the raw data.');