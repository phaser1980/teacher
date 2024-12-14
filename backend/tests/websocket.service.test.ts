import { WebSocket } from 'ws';
import { Pool } from 'pg';
import { WebSocketService } from '../services/websocket.service';

jest.mock('pg');
jest.mock('ws');

describe('WebSocketService', () => {
    let wsService: WebSocketService;
    let mockPool: jest.Mocked<Pool>;
    let mockWs: jest.Mocked<WebSocket>;

    beforeEach(() => {
        mockPool = new Pool() as jest.Mocked<Pool>;
        mockWs = new WebSocket('ws://localhost') as jest.Mocked<WebSocket>;
        wsService = new WebSocketService(mockPool);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('handleConnection', () => {
        it('should set up event listeners for the connection', () => {
            const sessionId = 'test-session';
            wsService.handleConnection(mockWs, sessionId);

            expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
        });
    });

    describe('handleMessage', () => {
        const sessionId = 'test-session';
        const mockClient = {
            query: jest.fn(),
            release: jest.fn(),
        };

        beforeEach(() => {
            mockPool.connect = jest.fn().mockResolvedValue(mockClient);
        });

        it('should handle NEW_SYMBOL message type', async () => {
            const message = {
                type: 'NEW_SYMBOL',
                symbol: 'A',
                position: 1
            };

            mockClient.query
                .mockResolvedValueOnce(undefined) // INSERT query
                .mockResolvedValueOnce({ rows: [{ count: '99' }] }); // COUNT query

            wsService.handleConnection(mockWs, sessionId);
            await mockWs.emit('message', JSON.stringify(message));

            expect(mockClient.query).toHaveBeenCalledWith(
                'INSERT INTO card_series (session_id, symbol, sequence_position) VALUES ($1, $2, $3)',
                [sessionId, 'A', 1]
            );
        });

        it('should trigger analysis when symbol count reaches 100', async () => {
            const message = {
                type: 'NEW_SYMBOL',
                symbol: 'A',
                position: 100
            };

            mockClient.query
                .mockResolvedValueOnce(undefined) // INSERT query
                .mockResolvedValueOnce({ rows: [{ count: '100' }] }); // COUNT query

            wsService.handleConnection(mockWs, sessionId);
            await mockWs.emit('message', JSON.stringify(message));

            // Verify that analysis is triggered
            expect(mockClient.query).toHaveBeenCalledWith(
                'SELECT COUNT(*) FROM card_series WHERE session_id = $1',
                [sessionId]
            );
        });

        it('should handle database errors gracefully', async () => {
            const message = {
                type: 'NEW_SYMBOL',
                symbol: 'A',
                position: 1
            };

            mockClient.query.mockRejectedValue(new Error('Database error'));

            wsService.handleConnection(mockWs, sessionId);
            await mockWs.emit('message', JSON.stringify(message));

            expect(mockWs.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'ERROR',
                    message: 'Database operation failed'
                })
            );
        });
    });
});
