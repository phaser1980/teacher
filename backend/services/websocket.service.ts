import { WebSocket } from 'ws';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { CardSeriesRepository } from '../repositories/card-series.repository';
import { analysisWorker } from '../workers/analysis.worker';

interface AnalysisResult {
    type: string;
    data: any;
    confidence: number;
    timestamp: Date;
}

export class WebSocketService {
    private clients: Map<string, WebSocket> = new Map();
    private eventEmitter: EventEmitter;
    private cardSeriesRepo: CardSeriesRepository;

    constructor(pool: Pool) {
        this.eventEmitter = new EventEmitter();
        this.cardSeriesRepo = new CardSeriesRepository(pool);
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
                    message: this.getDetailedErrorMessage(error)
                }));
            }
        });
    }

    private getDetailedErrorMessage(error: any): string {
        if (error instanceof Error) {
            return `Operation failed: ${error.message}`;
        }
        return 'An unexpected error occurred';
    }

    private async handleMessage(sessionId: string, data: any, ws: WebSocket) {
        try {
            switch (data.type) {
                case 'NEW_SYMBOL':
                    await this.handleNewSymbol(sessionId, data);
                    break;
                case 'START_SESSION':
                    await this.handleStartSession(sessionId);
                    break;
                case 'END_SESSION':
                    await this.handleEndSession(sessionId);
                    break;
                default:
                    throw new Error(`Unknown message type: ${data.type}`);
            }
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: this.getDetailedErrorMessage(error)
            }));
            console.error('Operation failed:', error);
        }
    }

    private async handleNewSymbol(sessionId: string, data: any) {
        const { symbol, position } = data;
        
        // Add symbol to database
        await this.cardSeriesRepo.addSymbol(sessionId, symbol, position);

        // Check if we have enough symbols for analysis
        const symbolCount = await this.cardSeriesRepo.getSymbolCount(sessionId);
        
        if (symbolCount >= 100) {
            // Queue analysis job
            await analysisWorker.queueAnalysis(sessionId, symbolCount);
        }
    }

    private async handleStartSession(sessionId: string) {
        // Implementation moved to repository layer
    }

    private async handleEndSession(sessionId: string) {
        // Implementation moved to repository layer
    }

    private cleanup(sessionId: string) {
        this.clients.delete(sessionId);
    }
}
