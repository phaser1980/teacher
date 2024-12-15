import express from 'express';
import { Pool } from 'pg';
import { Router } from 'express';

export const createSymbolsRouter = (pool: Pool): Router => {
    const router = Router();

    // POST route to add a symbol
    router.post('/symbol', async (req, res) => {
        try {
            const { session_id, symbol, sequence_position } = req.body;

            // Validate input
            if (!session_id || !symbol || sequence_position === undefined) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Validate symbol is between 1-4
            if (![1, 2, 3, 4].includes(Number(symbol))) {
                return res.status(400).json({ error: 'Symbol must be between 1 and 4' });
            }

            // Check if session exists
            const sessionCheck = await pool.query(
                'SELECT session_id FROM student_sessions WHERE session_id = $1',
                [session_id]
            );

            if (sessionCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Session not found' });
            }

            // Insert symbol
            await pool.query(
                `INSERT INTO card_series (session_id, symbol, sequence_position) 
                 VALUES ($1, $2, $3)`,
                [session_id, symbol.toString(), sequence_position]
            );

            res.status(201).json({ 
                message: 'Symbol added successfully',
                data: {
                    session_id,
                    symbol,
                    sequence_position
                }
            });
        } catch (error) {
            console.error('Error adding symbol:', error);
            res.status(500).json({ error: 'Failed to add symbol' });
        }
    });

    // GET route to retrieve symbols for a session
    router.get('/symbols/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            
            const result = await pool.query(
                `SELECT * FROM card_series 
                 WHERE session_id = $1 
                 ORDER BY sequence_position ASC`,
                [sessionId]
            );

            res.json(result.rows);
        } catch (error) {
            console.error('Error retrieving symbols:', error);
            res.status(500).json({ error: 'Failed to retrieve symbols' });
        }
    });

    return router;
};
