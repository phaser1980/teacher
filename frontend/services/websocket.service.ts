import { toast } from 'react-toastify';
import { ModelPerformance, SessionMetrics, SymbolStats } from '../utils/symbols';

type WebSocketMessageHandlers = {
    onStatsUpdate?: (stats: SymbolStats) => void;
    onModelUpdate?: (performance: ModelPerformance) => void;
    onMetricsUpdate?: (metrics: SessionMetrics) => void;
    onError?: (error: Error) => void;
};

export class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private handlers: WebSocketMessageHandlers = {};

    constructor(private sessionId: string) {}

    connect(handlers: WebSocketMessageHandlers) {
        this.handlers = handlers;
        this.establishConnection();
    }

    private establishConnection() {
        try {
            this.ws = new WebSocket(`ws://localhost:3000/ws/session/${this.sessionId}`);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                    this.handlers.onError?.(new Error('Failed to parse WebSocket message'));
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.handlers.onError?.(new Error('WebSocket connection error'));
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.attemptReconnect();
            };
        } catch (error) {
            console.error('Failed to establish WebSocket connection:', error);
            this.attemptReconnect();
        }
    }

    private handleMessage(data: any) {
        switch (data.type) {
            case 'STATS_UPDATE':
                if (this.handlers.onStatsUpdate) {
                    const stats = new SymbolStats();
                    data.symbols.forEach((symbol: number) => stats.addSymbol(symbol));
                    this.handlers.onStatsUpdate(stats);
                }
                break;

            case 'MODEL_UPDATE':
                if (this.handlers.onModelUpdate) {
                    this.handlers.onModelUpdate(data.performance);
                }
                if (data.performance.rngHypothesis) {
                    toast.info(`New RNG Hypothesis: ${data.performance.rngHypothesis}`, {
                        position: "top-right",
                        autoClose: 5000,
                    });
                }
                break;

            case 'METRICS_UPDATE':
                this.handlers.onMetricsUpdate?.(data.metrics);
                
                // Check for milestone achievements
                if (data.metrics.milestoneAchieved) {
                    toast.success(`${data.metrics.milestoneAchieved} milestone reached! 🎉`, {
                        position: "top-right",
                        autoClose: 5000,
                    });
                }
                break;

            case 'ERROR':
                toast.error(`Error: ${data.message}`, {
                    position: "top-right",
                    autoClose: 5000,
                });
                this.handlers.onError?.(new Error(data.message));
                break;

            default:
                console.warn('Unknown message type:', data.type);
        }
    }

    private attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.establishConnection();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            toast.error('Failed to maintain WebSocket connection. Please refresh the page.', {
                position: "top-right",
                autoClose: false,
            });
        }
    }

    sendMessage(type: string, payload: any) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        } else {
            console.warn('WebSocket is not connected. Message not sent:', { type, payload });
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
