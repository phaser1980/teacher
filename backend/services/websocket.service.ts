import { WebSocket, Server } from 'ws';
import { Pool } from 'pg';
import Bull from 'bull';
import { throttle } from 'lodash';
import { SymbolRepository } from '../repositories/symbol.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AnalysisRepository } from '../repositories/analysis.repository';

interface AnalysisResult {
    modelName: string;
    prediction: number[];
    confidence: number;
    possibleRngSeed?: string;
}

interface SessionThresholds {
    basic: number;
    intermediate: number;
    advanced: number;
}

interface WebSocketMessage {
    type: 'SUBMIT_SYMBOL' | 'REQUEST_ANALYSIS' | 'START_SESSION' | 'RESUME_SESSION';
    payload: any;
}

export class WebSocketService {
    private clients: Map<string, WebSocket> = new Map();
    private analysisQueue: Bull.Queue;
    private symbolRepo: SymbolRepository;
    private sessionRepo: SessionRepository;
    private analysisRepo: AnalysisRepository;
    private readonly DEFAULT_THRESHOLDS: SessionThresholds = {
        basic: 5,
        intermediate: 20,
        advanced: 50
    };

    constructor(pool: Pool) {
        this.symbolRepo = new SymbolRepository(pool);
        this.sessionRepo = new SessionRepository(pool);
        this.analysisRepo = new AnalysisRepository(pool);
        this.analysisQueue = new Bull('analysis', {
            redis: process.env.REDIS_URL || 'redis://localhost:6379',
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000
                },
                removeOnComplete: false,
                removeOnFail: false
            }
        });
        this.setupQueueHandlers();
    }

    public initialize(wss: Server) {
        wss.on('connection', async (ws: WebSocket) => {
            const sessionId = this.generateSessionId();
            this.clients.set(sessionId, ws);

            ws.on('message', async (message: string) => {
                try {
                    const data: WebSocketMessage = JSON.parse(message);
                    await this.handleMessage(sessionId, data);
                } catch (error) {
                    await this.handleError(ws, error);
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
                sessionId,
                thresholds: this.DEFAULT_THRESHOLDS
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
            case 'RESUME_SESSION':
                await this.resumeSession(sessionId, message.payload.previousSessionId);
                break;
        }
    }

    private async handleSymbolSubmission(sessionId: string, symbol: number) {
        const ws = this.clients.get(sessionId);
        if (!ws) return;

        try {
            // Store symbol
            await this.symbolRepo.addSymbol(sessionId, symbol);
            
            // Get symbol count and thresholds
            const count = await this.symbolRepo.getSymbolCount(sessionId);
            const thresholds = await this.sessionRepo.getThresholds(sessionId) || this.DEFAULT_THRESHOLDS;
            
            // Send progress update
            ws.send(JSON.stringify({
                type: 'PROGRESS_UPDATE',
                count,
                thresholds,
                milestones: {
                    basic: count >= thresholds.basic,
                    intermediate: count >= thresholds.intermediate,
                    advanced: count >= thresholds.advanced
                }
            }));

            // Trigger analysis if any threshold is reached
            if (count >= thresholds.basic) {
                await this.triggerAnalysis(sessionId);
            }

            // Send session status update
            await this.sendSessionStatus(sessionId);
        } catch (error) {
            await this.handleError(ws, error);
        }
    }

    private async sendSessionStatus(sessionId: string) {
        const ws = this.clients.get(sessionId);
        if (!ws) return;

        try {
            const status = await this.sessionRepo.getSessionStatus(sessionId);
            const analysisHistory = await this.analysisRepo.getSessionHistory(sessionId);
            const thresholds = await this.sessionRepo.getThresholds(sessionId) || this.DEFAULT_THRESHOLDS;

            ws.send(JSON.stringify({
                type: 'SESSION_STATUS',
                status,
                history: analysisHistory,
                thresholds,
                metrics: {
                    totalSymbols: status.symbolCount,
                    analysisRuns: analysisHistory.length,
                    averageConfidence: this.calculateAverageConfidence(analysisHistory)
                }
            }));
        } catch (error) {
            await this.handleError(ws, error);
        }
    }

    private async triggerAnalysis(sessionId: string) {
        const symbols = await this.symbolRepo.getSymbols(sessionId);
        
        // Add analysis job to queue with retries
        await this.analysisQueue.add({
            sessionId,
            symbols
        });
    }

    private setupQueueHandlers() {
        // Handle completed jobs
        this.analysisQueue.on('completed', async (job, result) => {
            const { sessionId } = job.data;
            const ws = this.clients.get(sessionId);
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                await this.analysisRepo.saveResults(sessionId, result);
                ws.send(JSON.stringify({
                    type: 'ANALYSIS_RESULTS',
                    results: result
                }));
            }
        });

        // Handle failed jobs
        this.analysisQueue.on('failed', async (job, error) => {
            const { sessionId } = job.data;
            const ws = this.clients.get(sessionId);
            
            if (ws && ws.readyState === WebSocket.OPEN) {
                await this.handleError(ws, error);
            }
        });

        // Throttled RNG progress updates
        const sendRNGProgress = throttle(async (sessionId: string, ws: WebSocket) => {
            const progress = await this.analysisRepo.getRNGProgress(sessionId);
            if (progress && progress.progress > 0) {
                ws.send(JSON.stringify({
                    type: 'RNG_PROGRESS',
                    progress
                }));
            }
        }, 5000);

        // Monitor RNG discovery progress
        setInterval(async () => {
            for (const [sessionId, ws] of this.clients.entries()) {
                if (ws.readyState === WebSocket.OPEN) {
                    await sendRNGProgress(sessionId, ws);
                }
            }
        }, 5000);
    }

    private async resumeSession(sessionId: string, previousSessionId: string) {
        const ws = this.clients.get(sessionId);
        if (!ws) return;

        try {
            const sessionExists = await this.sessionRepo.sessionExists(previousSessionId);
            if (!sessionExists) {
                throw new Error('Session not found');
            }

            await this.sessionRepo.linkSessions(previousSessionId, sessionId);
            await this.sendSessionStatus(sessionId);
        } catch (error) {
            await this.handleError(ws, error);
        }
    }

    private async handleError(ws: WebSocket, error: any) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        const errorCode = error.code || 'UNKNOWN_ERROR';
        
        console.error(`WebSocket error [${errorCode}]:`, error);
        
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

    private calculateAverageConfidence(history: any[]): number {
        if (!history.length) return 0;
        return history.reduce((acc, curr) => acc + curr.confidence, 0) / history.length;
    }
}
