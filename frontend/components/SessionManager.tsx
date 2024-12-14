import React, { useState, useEffect } from 'react';
import { WebSocket } from 'ws';

interface SessionState {
    sessionId: string | null;
    symbols: number[];
    isActive: boolean;
}

const SessionManager: React.FC = () => {
    const [state, setState] = useState<SessionState>({
        sessionId: null,
        symbols: [],
        isActive: false
    });
    const [ws, setWs] = useState<WebSocket | null>(null);

    useEffect(() => {
        // Initialize WebSocket connection
        const socket = new WebSocket('ws://localhost:3000');

        socket.onopen = () => {
            console.log('WebSocket Connected');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        setWs(socket);

        return () => {
            socket.close();
        };
    }, []);

    const handleWebSocketMessage = (data: any) => {
        switch (data.type) {
            case 'SESSION_STARTED':
                setState(prev => ({
                    ...prev,
                    sessionId: data.sessionId,
                    isActive: true
                }));
                break;
            case 'SYMBOL_ADDED':
                setState(prev => ({
                    ...prev,
                    symbols: [...prev.symbols, data.symbol]
                }));
                break;
            case 'SESSION_ENDED':
                setState({
                    sessionId: null,
                    symbols: [],
                    isActive: false
                });
                break;
            case 'ERROR':
                console.error('Server error:', data.message);
                break;
        }
    };

    const handleSymbolInput = (symbol: number) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return;
        }

        ws.send(JSON.stringify({
            type: 'NEW_SYMBOL',
            symbol,
            position: state.symbols.length + 1
        }));
    };

    const handleClearSession = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN || !state.sessionId) {
            return;
        }

        ws.send(JSON.stringify({
            type: 'END_SESSION',
            sessionId: state.sessionId
        }));
    };

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className="text-xl font-bold">
                    {state.isActive 
                        ? `Session Active: ${state.sessionId}` 
                        : "No Active Session"}
                </h1>
            </div>

            <div className="mb-4 space-x-2">
                {[1, 2, 3, 4].map((symbol) => (
                    <button
                        key={symbol}
                        onClick={() => handleSymbolInput(symbol)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                        disabled={!state.isActive}
                    >
                        {symbol === 1 ? '♥' : 
                         symbol === 2 ? '♦' : 
                         symbol === 3 ? '♣' : '♠'}
                    </button>
                ))}
            </div>

            <div className="mb-4">
                <h2 className="text-lg font-semibold">Sequence:</h2>
                <div className="mt-2 p-2 bg-gray-100 rounded">
                    {state.symbols.map((symbol, index) => (
                        <span key={index} className="mr-2">
                            {symbol === 1 ? '♥' : 
                             symbol === 2 ? '♦' : 
                             symbol === 3 ? '♣' : '♠'}
                        </span>
                    ))}
                </div>
            </div>

            <button
                onClick={handleClearSession}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
                disabled={!state.isActive}
            >
                Clear Session
            </button>
        </div>
    );
};

export default SessionManager;
