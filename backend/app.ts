import express from 'express';
import { createServer } from 'http';
import { WebSocket, Server as WebSocketServer } from 'ws';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
    console.log('New client connected');
    
    ws.on('message', async (message: string) => {
        const data = JSON.parse(message);
        
        if (data.type === 'NEW_SYMBOL') {
            // Store new symbol
            const { sessionId, symbol, position } = data;
            try {
                await pool.query(
                    'INSERT INTO card_series (session_id, symbol, sequence_position) VALUES ($1, $2, $3) RETURNING id',
                    [sessionId, symbol, position]
                );
                
                // Trigger analysis if we have enough symbols
                const symbolCount = await getSymbolCount(sessionId);
                if (symbolCount >= 100) {
                    performAnalysis(sessionId, ws);
                }
            } catch (error) {
                console.error('Error storing symbol:', error);
            }
        }
    });
});

async function getSymbolCount(sessionId: string): Promise<number> {
    const result = await pool.query(
        'SELECT COUNT(*) FROM card_series WHERE session_id = $1',
        [sessionId]
    );
    return parseInt(result.rows[0].count);
}

async function performAnalysis(sessionId: string, ws: WebSocket) {
    try {
        // Get all symbols for this session
        const result = await pool.query(
            'SELECT symbol FROM card_series WHERE session_id = $1 ORDER BY sequence_position',
            [sessionId]
        );
        
        const symbols = result.rows.map(row => row.symbol);
        
        // Run different analysis models
        const analyses = [
            analyzeMarkovChain(symbols),
            analyzeEntropy(symbols),
            analyzePotentialRNG(symbols)
        ];
        
        // Send results back to client
        ws.send(JSON.stringify({
            type: 'ANALYSIS_RESULTS',
            results: analyses
        }));
    } catch (error) {
        console.error('Error performing analysis:', error);
    }
}

function analyzeMarkovChain(symbols: string[]) {
    // Implementation of Markov Chain analysis
    // This would analyze transition probabilities between symbols
    return {
        type: 'MARKOV_CHAIN',
        // Analysis results here
    };
}

function analyzeEntropy(symbols: string[]) {
    // Implementation of entropy analysis
    // This would calculate the randomness of the sequence
    return {
        type: 'ENTROPY',
        // Analysis results here
    };
}

function analyzePotentialRNG(symbols: string[]) {
    // Implementation of RNG detection
    // This would attempt to identify the RNG algorithm and potential seed
    return {
        type: 'RNG_DETECTION',
        // Analysis results here
    };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
