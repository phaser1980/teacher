import { WebSocket } from 'ws';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import { CardSeriesRepository } from '../repositories/card-series.repository';
import { SessionRepository } from '../repositories/session.repository';
import { HealthService } from './health.service';
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
    private healthService: HealthService;
    private readonly ANALYSIS_THRESHOLD = 100;
    private readonly INITIAL_SYMBOLS_REQUIRED = 5;

    constructor(pool: Pool) {
        this.eventEmitter = new EventEmitter();
        this.cardSeriesRepo = new CardSeriesRepository(pool);
        this.sessionRepo = new SessionRepository(pool);
        this.healthService = new HealthService(pool);
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

        this.eventEmitter.on('analysisProgress', (sessionId: string, progress: number) => {
            const client = this.clients.get(sessionId);
            if (client && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'ANALYSIS_PROGRESS',
                    progress
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
                case 'INITIAL_SYMBOLS':
                    await this.handleInitialSymbols(sessionId, data.symbols, ws);
                    break;
                case 'NEW_SYMBOL':
                    await this.handleNewSymbol(sessionId, data, ws);
                    break;
                case 'UNDO_SYMBOL':
                    await this.handleUndoSymbol(sessionId, ws);
                    break;
                case 'TRIGGER_ANALYSIS':
                    await this.handleManualAnalysisTrigger(sessionId, ws);
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

    private async handleInitialSymbols(sessionId: string, symbols: number[], ws: WebSocket) {
        // Validate symbols
        if (!Array.isArray(symbols) || symbols.length !== this.INITIAL_SYMBOLS_REQUIRED) {
            throw new Error(`Exactly ${this.INITIAL_SYMBOLS_REQUIRED} symbols are required`);
        }

        if (!symbols.every(s => s >= 1 && s <= 4)) {
            throw new Error('Invalid symbol values. Must be between 1 and 4');
        }

        // Perform health check
        const healthResult = await this.healthService.checkHealth();
        const wsHealth = await this.healthService.checkWebSocket(ws);

        // Send health check results
        ws.send(JSON.stringify({
            type: 'HEALTH_CHECK_RESULT',
            status: healthResult.status,
            wsStatus: wsHealth,
            components: healthResult.components
        }));

        if (healthResult.status === 'unhealthy' || !wsHealth) {
            throw new Error('System health check failed. Please try again later.');
        }

        // Create new session and store initial symbols
        const newSessionId = await this.sessionRepo.createSession();
        
        // Store symbols in sequence
        for (let i = 0; i < symbols.length; i++) {
            await this.cardSeriesRepo.addSymbol(newSessionId, symbols[i], i + 1);
        }

        // Notify client of successful session creation
        ws.send(JSON.stringify({
            type: 'SESSION_STARTED',
            sessionId: newSessionId,
            initialSymbols: symbols
        }));

        return newSessionId;
    }

    private async handleNewSymbol(sessionId: string, data: any, ws: WebSocket) {
        const { symbol, position } = data;
        
        // Check if session exists and is active
        let isActive = await this.sessionRepo.isSessionActive(sessionId);
        
        if (!isActive) {
            throw new Error('No active session found. Please start a new session.');
        }
        
        // Add symbol to database
        await this.cardSeriesRepo.addSymbol(sessionId, symbol, position);

        // Get current symbol count
        const symbolCount = await this.cardSeriesRepo.getSymbolCount(sessionId);

        // Notify client of successful symbol addition and count
        ws.send(JSON.stringify({
            type: 'SYMBOL_ADDED',
            symbol,
            position,
            symbolCount
        }));

        // Check if we've reached the analysis threshold
        if (symbolCount >= this.ANALYSIS_THRESHOLD) {
            await this.triggerAnalysis(sessionId, symbolCount, ws);
        }
    }

    private async handleUndoSymbol(sessionId: string, ws: WebSocket) {
        // Check if session exists and is active
        let isActive = await this.sessionRepo.isSessionActive(sessionId);
        
        if (!isActive) {
            throw new Error('No active session found.');
        }

        // Get current symbol count
        const symbolCount = await this.cardSeriesRepo.getSymbolCount(sessionId);
        
        if (symbolCount === 0) {
            throw new Error('No symbols to undo.');
        }

        // Remove the last symbol
        await this.cardSeriesRepo.removeLastSymbol(sessionId);

        // Get updated symbol count
        const updatedCount = symbolCount - 1;

        // Notify client of successful symbol removal
        ws.send(JSON.stringify({
            type: 'SYMBOL_UNDONE',
            symbolCount: updatedCount
        }));
    }

    private async handleManualAnalysisTrigger(sessionId: string, ws: WebSocket) {
        const symbolCount = await this.cardSeriesRepo.getSymbolCount(sessionId);
        
        if (symbolCount === 0) {
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'No symbols found for analysis'
            }));
            return;
        }

        await this.triggerAnalysis(sessionId, symbolCount, ws);
    }

    private async triggerAnalysis(sessionId: string, symbolCount: number, ws: WebSocket) {
        try {
            // Queue the analysis job
            const job = await analysisWorker.queueAnalysis(sessionId, symbolCount);
            
            // Notify client that analysis has started
            ws.send(JSON.stringify({
                type: 'ANALYSIS_STARTED',
                jobId: job.id,
                symbolCount
            }));

            // Monitor job progress
            job.progress().then(progress => {
                this.eventEmitter.emit('analysisProgress', sessionId, progress);
            });
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'ERROR',
                message: 'Failed to start analysis'
            }));
            throw error;
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
