import Bull from 'bull';
import { PythonShell } from 'python-shell';
import path from 'path';
import { Pool } from 'pg';
import { CardSeriesRepository } from '../repositories/card-series.repository';

interface AnalysisJob {
    sessionId: string;
    symbolCount: number;
}

interface AnalysisResult {
    type: string;
    confidence: number;
    details: any;
    timestamp: Date;
}

class AnalysisWorker {
    private analysisQueue: Bull.Queue<AnalysisJob>;
    private cardSeriesRepo: CardSeriesRepository;

    constructor(redisUrl: string, dbPool: Pool) {
        this.analysisQueue = new Bull('analysis', redisUrl);
        this.cardSeriesRepo = new CardSeriesRepository(dbPool);
        this.setupWorker();
    }

    private setupWorker() {
        this.analysisQueue.process(async (job) => {
            const { sessionId, symbolCount } = job.data;
            
            try {
                // Get the latest symbols for analysis
                const symbols = await this.cardSeriesRepo.getLatestSymbols(sessionId, symbolCount);
                const symbolSequence = symbols.map(s => s.symbol);

                // Run different types of analysis in parallel
                const [entropyResult, rngResult, patternResult] = await Promise.all([
                    this.runEntropyAnalysis(symbolSequence),
                    this.detectRNGType(symbolSequence),
                    this.analyzePatterns(symbolSequence)
                ]);

                // Store results in database
                await this.storeResults(sessionId, [
                    entropyResult,
                    rngResult,
                    patternResult
                ]);

                return {
                    entropy: entropyResult,
                    rng: rngResult,
                    pattern: patternResult
                };
            } catch (error) {
                console.error('Analysis failed:', error);
                throw error;
            }
        });
    }

    private async runEntropyAnalysis(symbols: string[]): Promise<AnalysisResult> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../python/entropy_analysis.py');
            
            PythonShell.run(scriptPath, {
                mode: 'json',
                args: [JSON.stringify(symbols)]
            }).then(results => {
                const result = results[0];
                resolve({
                    type: 'ENTROPY',
                    confidence: result.confidence,
                    details: result.details,
                    timestamp: new Date()
                });
            }).catch(reject);
        });
    }

    private async detectRNGType(symbols: string[]): Promise<AnalysisResult> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../python/rng_detection.py');
            
            PythonShell.run(scriptPath, {
                mode: 'json',
                args: [JSON.stringify(symbols)]
            }).then(results => {
                const result = results[0];
                resolve({
                    type: 'RNG_DETECTION',
                    confidence: result.confidence,
                    details: {
                        rngType: result.rng_type,
                        possibleSeed: result.seed,
                        matchScore: result.match_score
                    },
                    timestamp: new Date()
                });
            }).catch(reject);
        });
    }

    private async analyzePatterns(symbols: string[]): Promise<AnalysisResult> {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(__dirname, '../python/pattern_analysis.py');
            
            PythonShell.run(scriptPath, {
                mode: 'json',
                args: [JSON.stringify(symbols)]
            }).then(results => {
                const result = results[0];
                resolve({
                    type: 'PATTERN',
                    confidence: result.confidence,
                    details: {
                        patterns: result.patterns,
                        predictions: result.predictions
                    },
                    timestamp: new Date()
                });
            }).catch(reject);
        });
    }

    private async storeResults(sessionId: string, results: AnalysisResult[]) {
        // TODO: Implement storing results in the database
        // This would use a new AnalysisResultRepository
    }

    public async queueAnalysis(sessionId: string, symbolCount: number) {
        return this.analysisQueue.add({
            sessionId,
            symbolCount
        }, {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });
    }
}

// Create and export the worker instance
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export const analysisWorker = new AnalysisWorker(redisUrl, dbPool);
