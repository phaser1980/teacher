import { WebSocket } from 'ws';
import { Pool } from 'pg';
import { EventEmitter } from 'events';

interface AnalysisResult {
    type: string;
    data: any;
    confidence: number;
    timestamp: Date;
}

export class WebSocketService {
    private clients: Map<string, WebSocket> = new Map();
    private eventEmitter: EventEmitter;
    private pool: Pool;

    constructor(pool: Pool) {
        this.pool = pool;
        this.eventEmitter = new EventEmitter();
        this.setupEventListeners();
    }

    private setupEventListeners() {
        this.eventEmitter.on('analysisComplete', (sessionId: string, results: AnalysisResult[]) => {
            const client = this.clients.get(sessionId);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'ANALYSIS_RESULTS',
                    data: results
                }));
            }
        });
    }

    public handleConnection(ws: WebSocket, sessionId: string) {
        this.clients.set(sessionId, ws);

        ws.on('error', (error) => {
            console.error(`WebSocket error for session ${sessionId}:`, error);
            this.cleanup(sessionId);
        });

        ws.on('close', () => {
            console.log(`Client disconnected: ${sessionId}`);
            this.cleanup(sessionId);
        });

        ws.on('message', async (message: string) => {
            try {
                const data = JSON.parse(message);
                await this.handleMessage(sessionId, data, ws);
            } catch (error) {
                console.error('Error handling message:', error);
                ws.send(JSON.stringify({
                    type: 'ERROR',
                    message: 'Failed to process message'
                }));
            }
        });
    }

    private async handleMessage(sessionId: string, data: any, ws: WebSocket) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');

            switch (data.type) {
                case 'NEW_SYMBOL':
                    await this.handleNewSymbol(sessionId, data, client);
                    break;
                case 'START_SESSION':
                    await this.handleStartSession(sessionId, client);
                    break;
                case 'END_SESSION':
                    await this.handleEndSession(sessionId, client);
                    break;
                default:
                    throw new Error('Unknown message type');
            }

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Database operation failed'
            }));
            console.error('Database operation failed:', error);
        } finally {
            client.release();
        }
    }

    private async handleNewSymbol(sessionId: string, data: any, client: any) {
        const { symbol, position } = data;
        
        // Insert new symbol with prepared statement
        await client.query(
            'INSERT INTO card_series (session_id, symbol, sequence_position) VALUES ($1, $2, $3)',
            [sessionId, symbol, position]
        );

        // Check if we have enough symbols for analysis
        const result = await client.query(
            'SELECT COUNT(*) FROM card_series WHERE session_id = $1',
            [sessionId]
        );

        const symbolCount = parseInt(result.rows[0].count);
        if (symbolCount >= 100) {
            // Trigger async analysis
            this.triggerAnalysis(sessionId);
        }
    }

    private async handleStartSession(sessionId: string, client: any) {
        await client.query(
            'INSERT INTO student_sessions (session_id, start_time) VALUES ($1, CURRENT_TIMESTAMP)',
            [sessionId]
        );
    }

    private async handleEndSession(sessionId: string, client: any) {
        await client.query(
            'UPDATE student_sessions SET end_time = CURRENT_TIMESTAMP WHERE session_id = $1',
            [sessionId]
        );
    }

    private cleanup(sessionId: string) {
        this.clients.delete(sessionId);
    }

    private async triggerAnalysis(sessionId: string) {
        // This would be replaced with a proper job queue implementation
        setImmediate(async () => {
            try {
                const symbols = await this.getSymbolsForSession(sessionId);
                const results = await this.runAnalysis(symbols);
                this.eventEmitter.emit('analysisComplete', sessionId, results);
            } catch (error) {
                console.error('Analysis failed:', error);
            }
        });
    }

    private async getSymbolsForSession(sessionId: string): Promise<string[]> {
        const result = await this.pool.query(
            'SELECT symbol FROM card_series WHERE session_id = $1 ORDER BY sequence_position',
            [sessionId]
        );
        return result.rows.map(row => row.symbol);
    }

    private async runAnalysis(symbols: string[]): Promise<AnalysisResult[]> {
        // Placeholder for actual analysis implementation
        return [
            {
                type: 'BASIC_PATTERN',
                data: { pattern: 'placeholder' },
                confidence: 0.8,
                timestamp: new Date()
            }
        ];
    }
}
