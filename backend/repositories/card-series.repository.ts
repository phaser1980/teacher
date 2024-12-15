import { Pool } from 'pg';
import { BaseRepository } from './base.repository';

export type CardSymbolValue = 1 | 2 | 3 | 4;

export interface CardSymbol {
    id: string;
    sessionId: string;
    symbol: CardSymbolValue;
    timestamp: Date;
    sequencePosition: number;
}

const isValidCardSymbol = (symbol: number): symbol is CardSymbolValue =>
    Number.isInteger(symbol) && symbol >= 1 && symbol <= 4;

export class CardSeriesRepository extends BaseRepository {
    constructor(pool: Pool) {
        super(pool);
    }

    async addSymbol(sessionId: string, symbol: number, position: number): Promise<string> {
        if (!isValidCardSymbol(symbol)) {
            throw new Error(`Invalid card symbol: ${symbol}. Must be a number between 1 and 4.`);
        }

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
        
        return result.rows.map(row => {
            const symbol = parseInt(row.symbol);
            if (!isValidCardSymbol(symbol)) {
                throw new Error(`Invalid symbol found in database: ${symbol}`);
            }
            return {
                id: row.id,
                sessionId: row.session_id,
                symbol,
                timestamp: row.timestamp,
                sequencePosition: row.sequence_position
            };
        });
    }

    async getLatestSymbols(sessionId: string, count: number): Promise<CardSymbol[]> {
        const result = await this.pool.query(
            'SELECT * FROM card_series WHERE session_id = $1 ORDER BY sequence_position DESC LIMIT $2',
            [sessionId, count]
        );
        
        return result.rows.map(row => {
            const symbol = parseInt(row.symbol);
            if (!isValidCardSymbol(symbol)) {
                throw new Error(`Invalid symbol found in database: ${symbol}`);
            }
            return {
                id: row.id,
                sessionId: row.session_id,
                symbol,
                timestamp: row.timestamp,
                sequencePosition: row.sequence_position
            };
        });
    }

    async getLastSymbol(sessionId: string): Promise<CardSymbol | null> {
        const result = await this.pool.query(
            'SELECT * FROM card_series WHERE session_id = $1 ORDER BY sequence_position DESC LIMIT 1',
            [sessionId]
        );
        
        if (result.rows.length === 0) return null;
        
        const row = result.rows[0];
        const symbol = parseInt(row.symbol);
        if (!isValidCardSymbol(symbol)) {
            throw new Error(`Invalid symbol found in database: ${symbol}`);
        }
        
        return {
            id: row.id,
            sessionId: row.session_id,
            symbol,
            timestamp: row.timestamp,
            sequencePosition: row.sequence_position
        };
    }
}
