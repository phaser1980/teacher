import { WebSocket } from 'ws';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { CardSeriesRepository } from '../repositories/card-series.repository';
import { SessionRepository } from '../repositories/session.repository';
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
    private sessionRepo: SessionRepository;

    constructor(pool: Pool) {
        this.eventEmitter = new EventEmitter();
        this.cardSeriesRepo = new CardSeriesRepository(pool);
        this.sessionRepo = new SessionRepository(pool);
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
                    await this.handleNewSymbol(sessionId, data, ws);
                    break;
                case 'END_SESSION':
                    await this.handleEndSession(sessionId, ws);
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

    private async handleNewSymbol(sessionId: string, data: any, ws: WebSocket) {
        const { symbol, position } = data;
        
        // Check if session exists and is active
        let isActive = await this.sessionRepo.isSessionActive(sessionId);
        
        // If no active session, create one
        if (!isActive) {
            const newSessionId = await this.sessionRepo.createSession();
            sessionId = newSessionId;
            
            // Notify client of new session
            ws.send(JSON.stringify({
                type: 'SESSION_STARTED',
                sessionId: newSessionId
            }));
        }
        
        // Add symbol to database
        await this.cardSeriesRepo.addSymbol(sessionId, symbol, position);

        // Notify client of successful symbol addition
        ws.send(JSON.stringify({
            type: 'SYMBOL_ADDED',
            symbol,
            position
        }));

        // Check if we have enough symbols for analysis
        const symbolCount = await this.cardSeriesRepo.getSymbolCount(sessionId);
        
        if (symbolCount >= 100) {
            // Queue analysis job
            await analysisWorker.queueAnalysis(sessionId, symbolCount);
        }
    }

    private async handleEndSession(sessionId: string, ws: WebSocket) {
        const isActive = await this.sessionRepo.isSessionActive(sessionId);
        
        if (isActive) {
            await this.sessionRepo.endSession(sessionId);
            
            ws.send(JSON.stringify({
                type: 'SESSION_ENDED',
                sessionId
            }));
        } else {
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'No active session found'
            }));
        }
    }

    private cleanup(sessionId: string) {
        this.clients.delete(sessionId);
    }
}
