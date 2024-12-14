import { Pool } from 'pg';
import { BaseRepository } from './base.repository';

export interface CardSymbol {
    id: string;
    sessionId: string;
    symbol: string;
    timestamp: Date;
    sequencePosition: number;
}

export class CardSeriesRepository extends BaseRepository {
    constructor(pool: Pool) {
        super(pool);
    }

    async addSymbol(sessionId: string, symbol: string, position: number): Promise<string> {
        return this.withTransaction(async (client) => {
            const result = await client.query(
                'INSERT INTO card_series (session_id, symbol, sequence_position) VALUES ($1, $2, $3) RETURNING id',
                [sessionId, symbol, position]
            );
            return result.rows[0].id;
        });
    }

    async getSymbolCount(sessionId: string): Promise<number> {
        const result = await this.pool.query(
            'SELECT COUNT(*) FROM card_series WHERE session_id = $1',
            [sessionId]
        );
        return parseInt(result.rows[0].count);
    }

    async getSymbolsForSession(sessionId: string, limit?: number): Promise<CardSymbol[]> {
        const query = limit 
            ? 'SELECT * FROM card_series WHERE session_id = $1 ORDER BY sequence_position LIMIT $2'
            : 'SELECT * FROM card_series WHERE session_id = $1 ORDER BY sequence_position';
        
        const params = limit ? [sessionId, limit] : [sessionId];
        const result = await this.pool.query(query, params);
        
        return result.rows.map(row => ({
            id: row.id,
            sessionId: row.session_id,
            symbol: row.symbol,
            timestamp: row.timestamp,
            sequencePosition: row.sequence_position
        }));
    }

    async getLatestSymbols(sessionId: string, count: number): Promise<CardSymbol[]> {
        const result = await this.pool.query(
            'SELECT * FROM card_series WHERE session_id = $1 ORDER BY sequence_position DESC LIMIT $2',
            [sessionId, count]
        );
        
        return result.rows.map(row => ({
            id: row.id,
            sessionId: row.session_id,
            symbol: row.symbol,
            timestamp: row.timestamp,
            sequencePosition: row.sequence_position
        }));
    }
}
