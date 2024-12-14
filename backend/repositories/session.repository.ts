import { Pool } from 'pg';
import { BaseRepository } from './base.repository';

export interface Session {
    sessionId: string;
    startTime: Date;
    endTime: Date | null;
}

export class SessionRepository extends BaseRepository {
    constructor(pool: Pool) {
        super(pool);
    }

    async createSession(): Promise<string> {
        return this.withTransaction(async (client) => {
            const result = await client.query(
                'INSERT INTO student_sessions (start_time) VALUES (CURRENT_TIMESTAMP) RETURNING session_id'
            );
            return result.rows[0].session_id;
        });
    }

    async endSession(sessionId: string): Promise<void> {
        await this.withTransaction(async (client) => {
            await client.query(
                'UPDATE student_sessions SET end_time = CURRENT_TIMESTAMP WHERE session_id = $1 AND end_time IS NULL',
                [sessionId]
            );
        });
    }

    async getActiveSession(sessionId: string): Promise<Session | null> {
        const result = await this.pool.query(
            'SELECT session_id, start_time, end_time FROM student_sessions WHERE session_id = $1 AND end_time IS NULL',
            [sessionId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            sessionId: row.session_id,
            startTime: row.start_time,
            endTime: row.end_time
        };
    }

    async isSessionActive(sessionId: string): Promise<boolean> {
        const result = await this.pool.query(
            'SELECT 1 FROM student_sessions WHERE session_id = $1 AND end_time IS NULL',
            [sessionId]
        );
        return result.rows.length > 0;
    }
}
