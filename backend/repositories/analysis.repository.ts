import { Pool } from 'pg';
import { BaseRepository } from './base.repository';

export interface AnalysisResult {
    id: string;
    session_id: string;
    analysis_type: string;
    confidence: number;
    details: any;
    timestamp: Date;
}

export class AnalysisRepository extends BaseRepository {
    constructor(pool: Pool) {
        super(pool);
    }

    async saveAnalysisResult(
        sessionId: string,
        analysisType: string,
        confidence: number,
        details: any
    ): Promise<AnalysisResult> {
        const query = `
            INSERT INTO analysis_results (session_id, analysis_type, confidence, details)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const values = [sessionId, analysisType, confidence, details];
        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async getAnalysisResults(sessionId: string): Promise<AnalysisResult[]> {
        const query = `
            SELECT * FROM analysis_results
            WHERE session_id = $1
            ORDER BY timestamp DESC
        `;
        const result = await this.pool.query(query, [sessionId]);
        return result.rows;
    }

    async getLatestAnalysis(
        sessionId: string,
        analysisType: string
    ): Promise<AnalysisResult | null> {
        const query = `
            SELECT * FROM analysis_results
            WHERE session_id = $1 AND analysis_type = $2
            ORDER BY timestamp DESC
            LIMIT 1
        `;
        const result = await this.pool.query(query, [sessionId, analysisType]);
        return result.rows[0] || null;
    }

    async deleteAnalysisResults(sessionId: string): Promise<void> {
        const query = `
            DELETE FROM analysis_results
            WHERE session_id = $1
        `;
        await this.pool.query(query, [sessionId]);
    }
}
