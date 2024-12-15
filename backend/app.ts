import express from 'express';
import { createServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import { WebSocketService } from './services/websocket.service';
import { createSymbolsRouter } from './routes/symbols';

dotenv.config();

// Initialize Express app
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432')
});

// Initialize WebSocket service
const wsService = new WebSocketService(pool);

// Routes
app.use('/api', createSymbolsRouter(pool));

// WebSocket connection handling
wss.on('connection', (ws) => {
    const sessionId = generateSessionId();
    console.log(`New client connected with session ID: ${sessionId}`);
    wsService.handleConnection(ws, sessionId);
});

function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
