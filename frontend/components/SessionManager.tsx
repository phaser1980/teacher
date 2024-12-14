import React, { useState, useEffect } from 'react';
import { WebSocket } from 'ws';

interface SessionState {
    sessionId: string | null;
    symbols: number[];
    isActive: boolean;
    symbolCount: number;
}

interface AnalysisState {
    isAnalyzing: boolean;
    progress: number;
    results: any | null;
    canTriggerManually: boolean;
}

interface HealthState {
    status: 'pending' | 'checking' | 'healthy' | 'unhealthy';
    details: any;
}

const SessionManager: React.FC = () => {
    const [state, setState] = useState<SessionState>({
        sessionId: null,
        symbols: [],
        isActive: false,
        symbolCount: 0
    });

    const [analysis, setAnalysis] = useState<AnalysisState>({
        isAnalyzing: false,
        progress: 0,
        results: null,
        canTriggerManually: false
    });

    const [health, setHealth] = useState<HealthState>({
        status: 'pending',
        details: null
    });

    const [initialSymbols, setInitialSymbols] = useState<number[]>([]);
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
            case 'HEALTH_CHECK_RESULT':
                setHealth({
                    status: data.status,
                    details: data.components
                });
                break;

            case 'SESSION_STARTED':
                setState(prev => ({
                    ...prev,
                    sessionId: data.sessionId,
                    isActive: true,
                    symbols: data.initialSymbols || [],
                    symbolCount: data.initialSymbols?.length || 0
                }));
                setInitialSymbols([]);
                break;

            case 'SYMBOL_ADDED':
                setState(prev => ({
                    ...prev,
                    symbols: [...prev.symbols, data.symbol],
                    symbolCount: data.symbolCount
                }));
                setAnalysis(prev => ({
                    ...prev,
                    canTriggerManually: data.symbolCount > 0
                }));
                break;

            case 'SYMBOL_UNDONE':
                setState(prev => ({
                    ...prev,
                    symbols: prev.symbols.slice(0, -1),
                    symbolCount: data.symbolCount
                }));
                setAnalysis(prev => ({
                    ...prev,
                    canTriggerManually: data.symbolCount > 0
                }));
                break;

            case 'ANALYSIS_STARTED':
                setAnalysis(prev => ({
                    ...prev,
                    isAnalyzing: true,
                    progress: 0,
                    results: null
                }));
                break;

            case 'ANALYSIS_PROGRESS':
                setAnalysis(prev => ({
                    ...prev,
                    progress: data.progress
                }));
                break;

            case 'ANALYSIS_RESULTS':
                setAnalysis(prev => ({
                    ...prev,
                    isAnalyzing: false,
                    results: data.data
                }));
                break;

            case 'SESSION_ENDED':
                setState({
                    sessionId: null,
                    symbols: [],
                    isActive: false,
                    symbolCount: 0
                });
                setAnalysis({
                    isAnalyzing: false,
                    progress: 0,
                    results: null,
                    canTriggerManually: false
                });
                setHealth({
                    status: 'pending',
                    details: null
                });
                break;

            case 'ERROR':
                console.error('Server error:', data.message);
                break;
        }
    };

    const handleInitialSymbol = (symbol: number) => {
        if (!ws || ws.readyState !== WebSocket.OPEN || initialSymbols.length >= 5) {
            return;
        }

        const newSymbols = [...initialSymbols, symbol];
        setInitialSymbols(newSymbols);

        if (newSymbols.length === 5) {
            setHealth({ status: 'checking', details: null });
            ws.send(JSON.stringify({
                type: 'INITIAL_SYMBOLS',
                symbols: newSymbols
            }));
        }
    };

    const handleSymbolInput = (symbol: number) => {
        if (!ws || ws.readyState !== WebSocket.OPEN || !state.sessionId) {
            return;
        }

        ws.send(JSON.stringify({
            type: 'NEW_SYMBOL',
            symbol,
            position: state.symbols.length + 1
        }));
    };

    const handleUndoSymbol = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN || !state.sessionId) {
            return;
        }

        ws.send(JSON.stringify({
            type: 'UNDO_SYMBOL',
            sessionId: state.sessionId
        }));
    };

    const handleManualAnalysisTrigger = () => {
        if (!ws || ws.readyState !== WebSocket.OPEN || !state.sessionId) {
            return;
        }

        ws.send(JSON.stringify({
            type: 'TRIGGER_ANALYSIS',
            sessionId: state.sessionId
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

    if (!state.isActive) {
        return (
            <div className="p-4">
                <h1 className="text-xl font-bold mb-4">Enter Last 5 Results</h1>
                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                        Enter the last 5 symbols from your game to start a new session
                    </p>
                    <div className="space-x-2">
                        {[1, 2, 3, 4].map((symbol) => (
                            <button
                                key={symbol}
                                onClick={() => handleInitialSymbol(symbol)}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                                disabled={initialSymbols.length >= 5 || health.status === 'checking'}
                            >
                                {symbol === 1 ? '♥' : 
                                 symbol === 2 ? '♦' : 
                                 symbol === 3 ? '♣' : '♠'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-4">
                    <h2 className="text-lg font-semibold">Initial Sequence:</h2>
                    <div className="mt-2 p-2 bg-gray-100 rounded">
                        {initialSymbols.map((symbol, index) => (
                            <span key={index} className="mr-2">
                                {symbol === 1 ? '♥' : 
                                 symbol === 2 ? '♦' : 
                                 symbol === 3 ? '♣' : '♠'}
                            </span>
                        ))}
                    </div>
                </div>

                {health.status === 'checking' && (
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold">Running Health Check...</h3>
                        <div className="mt-2 p-2 bg-yellow-100 rounded">
                            <p>Verifying system components...</p>
                        </div>
                    </div>
                )}

                {health.status === 'unhealthy' && (
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold text-red-600">System Health Check Failed</h3>
                        <div className="mt-2 p-2 bg-red-100 rounded">
                            <pre className="text-sm">
                                {JSON.stringify(health.details, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <h1 className="text-xl font-bold">
                    Session Active: {state.sessionId}
                </h1>
                <p className="text-sm text-gray-600">
                    Symbols Collected: {state.symbolCount}
                </p>
            </div>

            <div className="mb-4 space-x-2">
                {[1, 2, 3, 4].map((symbol) => (
                    <button
                        key={symbol}
                        onClick={() => handleSymbolInput(symbol)}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
                        disabled={!state.isActive || analysis.isAnalyzing}
                    >
                        {symbol === 1 ? '♥' : 
                         symbol === 2 ? '♦' : 
                         symbol === 3 ? '♣' : '♠'}
                    </button>
                ))}
                <button
                    onClick={handleUndoSymbol}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-gray-400"
                    disabled={!state.isActive || analysis.isAnalyzing || state.symbolCount === 0}
                >
                    Undo
                </button>
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

            {analysis.isAnalyzing && (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold">Analysis Progress</h3>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${analysis.progress}%` }}
                        ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                        {analysis.progress}% Complete
                    </p>
                </div>
            )}

            {analysis.results && (
                <div className="mb-4">
                    <h3 className="text-lg font-semibold">Analysis Results</h3>
                    <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
                        {JSON.stringify(analysis.results, null, 2)}
                    </pre>
                </div>
            )}

            <div className="space-x-2">
                {analysis.canTriggerManually && !analysis.isAnalyzing && (
                    <button
                        onClick={handleManualAnalysisTrigger}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                    >
                        Start Analysis
                    </button>
                )}
                <button
                    onClick={handleClearSession}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
                    disabled={!state.isActive || analysis.isAnalyzing}
                >
                    Clear Session
                </button>
            </div>
        </div>
    );
};

export default SessionManager;
