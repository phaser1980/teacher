export type CardSymbol = 1 | 2 | 3 | 4;
export type CardSymbolName = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';

export const CARD_SYMBOLS = {
    1: 'Hearts',
    2: 'Diamonds',
    3: 'Clubs',
    4: 'Spades'
} as const;

export const isValidCardSymbol = (symbol: number): symbol is CardSymbol =>
    Number.isInteger(symbol) && symbol >= 1 && symbol <= 4;

export interface SymbolSubmission {
    symbol: CardSymbol;
    timestamp: Date;
}

export interface AnalysisResult {
    modelName: string;
    prediction: CardSymbol[];
    confidence: number;
    possibleRngSeed?: string;
}

export interface SessionMetrics {
    totalSymbols: number;
    analysisRuns: number;
    averageConfidence: number;
    lastSymbol?: CardSymbol;
    streak?: number;
}

export interface WebSocketMessage {
    type: 'SUBMIT_SYMBOL' | 'REQUEST_ANALYSIS' | 'START_SESSION' | 'RESUME_SESSION';
    payload: {
        symbol?: CardSymbol;
        previousSessionId?: string;
    };
}
