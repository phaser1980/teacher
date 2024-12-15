import React, { useEffect, useState } from 'react';
import { SymbolInput } from '../components/SymbolInput';
import { ModelFeedback } from '../components/ModelFeedback';
import { ProgressTracker } from '../components/ProgressTracker';
import { useWebSocket } from '../hooks/useWebSocket';

interface AnalysisResult {
    modelName: string;
    prediction: number[];
    confidence: number;
    possibleRngSeed?: string;
}

export default function Home() {
    const [symbols, setSymbols] = useState<number[]>([]);
    const [symbolCount, setSymbolCount] = useState(0);
    const [threshold] = useState(5);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [results, setResults] = useState<AnalysisResult[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);

    const handleWebSocketMessage = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
            case 'SESSION_CREATED':
                setSessionId(data.sessionId);
                break;
            case 'PROGRESS_UPDATE':
                setSymbolCount(data.count);
                break;
            case 'ANALYSIS_RESULTS':
                setResults(data.results);
                setIsAnalyzing(false);
                break;
            case 'ERROR':
                console.error('WebSocket error:', data.message);
                // Handle error appropriately
                break;
        }
    };

    const { sendMessage, connectionStatus } = useWebSocket({
        url: 'ws://localhost:3001',
        onMessage: handleWebSocketMessage
    });

    const handleSymbolSubmit = (symbol: number) => {
        if (!sessionId) return;

        sendMessage({
            type: 'SUBMIT_SYMBOL',
            payload: { symbol }
        });

        setSymbols(prev => [...prev, symbol]);
    };

    const startNewSession = () => {
        sendMessage({
            type: 'START_SESSION',
            payload: {}
        });
    };

    useEffect(() => {
        if (connectionStatus === 'connected') {
            startNewSession();
        }
    }, [connectionStatus]);

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <header className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Card Game Analysis
                    </h1>
                    <p className="text-gray-600">
                        Enter card symbols to analyze patterns and predictions
                    </p>
                </header>

                <main className="space-y-8">
                    {connectionStatus === 'connected' ? (
                        <>
                            <SymbolInput
                                onSymbolSubmit={handleSymbolSubmit}
                                disabled={isAnalyzing}
                            />

                            <ProgressTracker
                                symbolCount={symbolCount}
                                threshold={threshold}
                                symbols={symbols}
                            />

                            {results.length > 0 && (
                                <ModelFeedback
                                    predictions={results}
                                    isLoading={isAnalyzing}
                                />
                            )}
                        </>
                    ) : (
                        <div className="text-center p-4">
                            <p className="text-gray-600">
                                Connecting to server...
                            </p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
