import { useState, useEffect, useCallback } from 'react';

interface WebSocketHookProps {
    url: string;
    onMessage: (event: MessageEvent) => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket({ url, onMessage }: WebSocketHookProps) {
    const [ws, setWs] = useState<WebSocket | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [reconnectAttempt, setReconnectAttempt] = useState(0);
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_INTERVAL = 3000;

    const connect = useCallback(() => {
        try {
            const socket = new WebSocket(url);

            socket.onopen = () => {
                console.log('WebSocket connected');
                setConnectionStatus('connected');
                setReconnectAttempt(0);
            };

            socket.onmessage = onMessage;

            socket.onclose = () => {
                console.log('WebSocket disconnected');
                setConnectionStatus('disconnected');
                setWs(null);

                // Attempt to reconnect
                if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
                    setTimeout(() => {
                        setReconnectAttempt(prev => prev + 1);
                        connect();
                    }, RECONNECT_INTERVAL);
                }
            };

            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            setWs(socket);
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            setConnectionStatus('disconnected');
        }
    }, [url, onMessage, reconnectAttempt]);

    useEffect(() => {
        connect();

        return () => {
            if (ws) {
                ws.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback((message: any) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket is not connected');
        }
    }, [ws]);

    return {
        sendMessage,
        connectionStatus,
        reconnectAttempt
    };
}
