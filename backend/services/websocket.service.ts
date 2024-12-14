import { WebSocket, Server } from 'ws';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import Bull from 'bull';
import { SymbolRepository } from '../repositories/symbol.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AnalysisRepository } from '../repositories/analysis.repository';

interface AnalysisResult {
    modelName: string;
    prediction: number[];
    confidence: number;
    possibleRngSeed?: string;
}

interface AnalysisUpdate {
    modelName: string;
    progress: number;
    phase: string;
    intermediateResults?: any;
}

interface RNGProgress {
    progress: number;
    detectedPatterns: number;
    confidenceTrend: number;
    currentPhase: string;
}

interface WebSocketMessage {
    type: 'SUBMIT_SYMBOL' | 'REQUEST_ANALYSIS' | 'START_SESSION';
    payload: any;
}

export class WebSocketService {
    private clients: Map<string, WebSocket> = new Map();
    private analysisQueue: Bull.Queue;
    private symbolRepo: SymbolRepository;
    private sessionRepo: SessionRepository;
    private analysisRepo: AnalysisRepository;
    private readonly ANALYSIS_THRESHOLD = 5;

    constructor(pool: Pool) {
        this.symbolRepo = new SymbolRepository(pool);
        this.sessionRepo = new SessionRepository(pool);
        this.analysisRepo = new AnalysisRepository(pool);
        this.analysisQueue = new Bull('analysis', {
            redis: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        this.setupQueueHandlers();
    }

    public initialize(wss: Server) {
        wss.on('connection', (ws: WebSocket) => {
            const sessionId = this.generateSessionId();
            this.clients.set(sessionId, ws);

            ws.on('message', async (message: string) => {
                try {
                    const data: WebSocketMessage = JSON.parse(message);
                    await this.handleMessage(sessionId, data);
                } catch (error) {
                    console.error('Error handling message:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });

            ws.on('close', () => {
                this.clients.delete(sessionId);
            });

            ws.on('error', async (error) => {
                await this.handleError(ws, error);
            });

            // Send session ID to client
            ws.send(JSON.stringify({
                type: 'SESSION_CREATED',
                sessionId
            }));
        });
    }

    private async handleMessage(sessionId: string, message: WebSocketMessage) {
        const ws = this.clients.get(sessionId);
        if (!ws) return;

        switch (message.type) {
            case 'SUBMIT_SYMBOL':
                await this.handleSymbolSubmission(sessionId, message.payload.symbol);
                break;
            case 'REQUEST_ANALYSIS':
                await this.triggerAnalysis(sessionId);
                break;
            case 'START_SESSION':
                await this.startNewSession(sessionId);
                break;
        }
    }

    private async handleSymbolSubmission(sessionId: string, symbol: number) {
        const ws = this.clients.get(sessionId);
        if (!ws) return;

        try {
            // Store symbol
            await this.symbolRepo.addSymbol(sessionId, symbol);
            
            // Get symbol count for session
            const count = await this.symbolRepo.getSymbolCount(sessionId);
            
            // Send progress update
            ws.send(JSON.stringify({
                type: 'PROGRESS_UPDATE',
                count,
                threshold: this.ANALYSIS_THRESHOLD,
                milestones: {
                    basic: count >= 5,
                    intermediate: count >= 20,
                    advanced: count >= 50
                }
            }));

            // Trigger analysis if threshold reached
            if (count >= this.ANALYSIS_THRESHOLD) {
                await this.triggerAnalysis(sessionId);
            }

            // Send session status update
            await this.sendSessionStatus(sessionId);
        } catch (error) {
            console.error('Error handling symbol submission:', error);
            this.sendError(ws, 'Failed to process symbol');
        }
    }

    private async sendSessionStatus(sessionId: string) {
        const ws = this.clients.get(sessionId);
        if (!ws) return;

        const status = await this.sessionRepo.getSessionStatus(sessionId);
        const analysisHistory = await this.analysisRepo.getSessionHistory(sessionId);

        ws.send(JSON.stringify({
            type: 'SESSION_STATUS',
            status,
            history: analysisHistory,
            metrics: {
                totalSymbols: status.symbolCount,
                analysisRuns: analysisHistory.length,
                averageConfidence: this.calculateAverageConfidence(analysisHistory)
            }
        }));
    }

    private calculateAverageConfidence(history: any[]): number {
        if (!history.length) return 0;
        return history.reduce((acc, curr) => acc + curr.confidence, 0) / history.length;
    }

    private async triggerAnalysis(sessionId: string) {
        const symbols = await this.symbolRepo.getSymbols(sessionId);
        
        // Add analysis job to queue
        await this.analysisQueue.add({
            sessionId,
            symbols
        });
    }

    private setupQueueHandlers() {
        this.analysisQueue.on('completed', async (job, result) => {
            const { sessionId } = job.data;
            const ws = this.clients.get(sessionId);
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                // Store analysis results
                await this.analysisRepo.saveResults(sessionId, result);
                
                // Send results to client
                ws.send(JSON.stringify({
                    type: 'ANALYSIS_RESULTS',
                    results: result
                }));
            }
        });

        this.analysisQueue.on('progress', async (job, progress) => {
            const { sessionId } = job.data;
            const ws = this.clients.get(sessionId);

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'ANALYSIS_UPDATE',
                    update: progress
                }));
            }
        });

        // Monitor RNG discovery progress
        setInterval(async () => {
            for (const [sessionId, ws] of this.clients.entries()) {
                if (ws.readyState === WebSocket.OPEN) {
                    const rngProgress = await this.analysisRepo.getRNGProgress(sessionId);
                    if (rngProgress) {
                        ws.send(JSON.stringify({
                            type: 'RNG_PROGRESS',
                            progress: rngProgress
                        }));
                    }
                }
            }
        }, 2000); // Update every 2 seconds
    }

    private async handleError(ws: WebSocket, error: any) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        const errorCode = error.code || 'UNKNOWN_ERROR';
        
        // Log error for debugging
        console.error(`WebSocket error [${errorCode}]:`, error);
        
        // Send structured error to client
        ws.send(JSON.stringify({
            type: 'ERROR',
            error: {
                code: errorCode,
                message: errorMessage,
                timestamp: new Date().toISOString(),
                retryable: this.isRetryableError(errorCode)
            }
        }));
    }

    private isRetryableError(errorCode: string): boolean {
        const retryableCodes = ['TIMEOUT', 'NETWORK_ERROR', 'TEMPORARY_FAILURE'];
        return retryableCodes.includes(errorCode);
    }

    private generateSessionId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    private sendError(ws: WebSocket, message: string) {
        ws.send(JSON.stringify({
            type: 'ERROR',
            message
        }));
    }

    private async startNewSession(sessionId: string) {
        // Start a new session
        await this.sessionRepo.startSession(sessionId);
    }
}
