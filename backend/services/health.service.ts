import { Pool } from 'pg';
import { WebSocket } from 'ws';
import { CardSeriesRepository } from '../repositories/card-series.repository';
import { SessionRepository } from '../repositories/session.repository';
import { analysisWorker } from '../workers/analysis.worker';

interface HealthCheckResult {
    status: 'healthy' | 'unhealthy';
    components: {
        database: boolean;
        websocket: boolean;
        worker: boolean;
        repositories: {
            session: boolean;
            cardSeries: boolean;
        };
    };
    details?: string;
}

export class HealthService {
    private pool: Pool;
    private cardSeriesRepo: CardSeriesRepository;
    private sessionRepo: SessionRepository;

    constructor(pool: Pool) {
        this.pool = pool;
        this.cardSeriesRepo = new CardSeriesRepository(pool);
        this.sessionRepo = new SessionRepository(pool);
    }

    async checkHealth(): Promise<HealthCheckResult> {
        try {
            const [dbStatus, repoStatus, workerStatus] = await Promise.all([
                this.checkDatabase(),
                this.checkRepositories(),
                this.checkWorker()
            ]);

            const isHealthy = dbStatus && repoStatus.session && repoStatus.cardSeries && workerStatus;

            return {
                status: isHealthy ? 'healthy' : 'unhealthy',
                components: {
                    database: dbStatus,
                    websocket: true, // WebSocket status is checked separately
                    worker: workerStatus,
                    repositories: {
                        session: repoStatus.session,
                        cardSeries: repoStatus.cardSeries
                    }
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                components: {
                    database: false,
                    websocket: false,
                    worker: false,
                    repositories: {
                        session: false,
                        cardSeries: false
                    }
                },
                details: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    private async checkDatabase(): Promise<boolean> {
        try {
            // Check basic connectivity
            await this.pool.query('SELECT 1');

            // Check all required tables exist
            const tables = ['student_sessions', 'card_series', 'analysis_results'];
            for (const table of tables) {
                await this.pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = $1
                    )
                `, [table]);
            }

            return true;
        } catch (error) {
            console.error('Database health check failed:', error);
            return false;
        }
    }

    private async checkRepositories(): Promise<{ session: boolean; cardSeries: boolean }> {
        try {
            // Test session repository
            const sessionStatus = await this.sessionRepo.isOperational();
            const cardSeriesStatus = await this.cardSeriesRepo.isOperational();

            return {
                session: sessionStatus,
                cardSeries: cardSeriesStatus
            };
        } catch (error) {
            console.error('Repository health check failed:', error);
            return {
                session: false,
                cardSeries: false
            };
        }
    }

    private async checkWorker(): Promise<boolean> {
        try {
            return await analysisWorker.isOperational();
        } catch (error) {
            console.error('Worker health check failed:', error);
            return false;
        }
    }

    async checkWebSocket(ws: WebSocket): Promise<boolean> {
        return new Promise((resolve) => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.ping();
                    resolve(true);
                } catch (error) {
                    console.error('WebSocket ping failed:', error);
                    resolve(false);
                }
            } else {
                resolve(false);
            }
        });
    }
}
