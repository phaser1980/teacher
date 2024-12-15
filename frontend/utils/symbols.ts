export const symbolMap = {
    1: 'Hearts',
    2: 'Diamonds',
    3: 'Clubs',
    4: 'Spades'
} as const;

export type SymbolType = 1 | 2 | 3 | 4;
export type SymbolName = 'Hearts' | 'Diamonds' | 'Clubs' | 'Spades';

// Strict validation for card symbols
export const isValidSymbol = (symbol: number): symbol is SymbolType => 
    Number.isInteger(symbol) && symbol >= 1 && symbol <= 4;

export const mapSymbol = (symbol: number): SymbolName => {
    if (!isValidSymbol(symbol)) {
        console.error(`Invalid card symbol: ${symbol}. Must be 1 (Hearts), 2 (Diamonds), 3 (Clubs), or 4 (Spades)`);
        throw new Error('Invalid card symbol');
    }
    return symbolMap[symbol];
};

// Reverse mapping for UI input
export const symbolNameToNumber: Record<SymbolName, SymbolType> = {
    'Hearts': 1,
    'Diamonds': 2,
    'Clubs': 3,
    'Spades': 4
};

export interface ModelPrediction {
    symbol: SymbolType;
    confidence: number;
}

export interface ModelPerformance {
    modelName: string;
    accuracy: number;
    predictions: ModelPrediction[];
    rngHypothesis?: string;
    lastUpdated?: Date;
}

export interface SessionThresholds {
    basic: number;
    intermediate: number;
    advanced: number;
}

export interface SessionMetrics {
    totalSymbols: number;
    analysisRuns: number;
    averageConfidence: number;
    lastSymbol?: SymbolType;
    streak?: number;
}

// Strict error types for card symbol handling
export interface SymbolError {
    code: 'INVALID_CARD_SYMBOL' | 'TRANSMISSION_ERROR';
    message: string;
    symbol?: number;
    timestamp: Date;
}

// Symbol statistics tracking strictly for card symbols
export class SymbolStats {
    private symbolCounts: Map<SymbolType, number> = new Map();
    private totalSymbols: number = 0;

    addSymbol(symbol: number): void {
        if (!isValidSymbol(symbol)) {
            throw new Error(`Invalid card symbol: ${symbol}. Must be 1 (Hearts), 2 (Diamonds), 3 (Clubs), or 4 (Spades)`);
        }
        this.symbolCounts.set(symbol, (this.symbolCounts.get(symbol) || 0) + 1);
        this.totalSymbols++;
    }

    getDistribution(): Record<SymbolName, number> {
        const distribution: Record<SymbolName, number> = {
            'Hearts': 0,
            'Diamonds': 0,
            'Clubs': 0,
            'Spades': 0
        };
        
        this.symbolCounts.forEach((count, symbol) => {
            distribution[symbolMap[symbol]] = count / this.totalSymbols;
        });
        
        return distribution;
    }

    getStreak(symbol: SymbolType): number {
        return this.symbolCounts.get(symbol) || 0;
    }

    reset(): void {
        this.symbolCounts.clear();
        this.totalSymbols = 0;
    }
}

// Batch processing utilities for better performance
export const mapSymbols = (symbols: number[]): string[] => 
    symbols.map(mapSymbol);

// Data conversion utilities for API integration
export const convertToJSON = (symbols: number[]): { symbols: number[] } => ({ 
    symbols: symbols.filter(isValidSymbol) 
});

export const convertFromJSON = (data: { symbols: number[] }): number[] => 
    data.symbols.filter(isValidSymbol);

// Cache for symbol validation results
const validSymbolCache = new Map<number, boolean>();

export const isValidSymbolCache = (symbol: number): boolean => {
    if (validSymbolCache.has(symbol)) {
        return validSymbolCache.get(symbol)!;
    }
    const isValid = isValidSymbol(symbol);
    validSymbolCache.set(symbol, isValid);
    return isValid;
};
