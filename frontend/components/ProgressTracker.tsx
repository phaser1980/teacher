import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { mapSymbol, SessionThresholds, SessionMetrics, SymbolStats } from '../utils/symbols';

interface ProgressTrackerProps {
    sessionId: string;
    recentSymbols: number[];
    metrics: SessionMetrics;
}

interface MilestoneNotifications {
    basic: boolean;
    intermediate: boolean;
    advanced: boolean;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
    sessionId,
    recentSymbols,
    metrics
}) => {
    const [thresholds, setThresholds] = useState<SessionThresholds | null>(null);
    const [symbolStats, setSymbolStats] = useState<SymbolStats>(new SymbolStats());
    const [milestoneNotified, setMilestoneNotified] = useState<MilestoneNotifications>({
        basic: false,
        intermediate: false,
        advanced: false
    });

    const fetchThresholds = useCallback(async () => {
        try {
            const response = await fetch(`/api/session/${sessionId}/thresholds`);
            if (!response.ok) throw new Error('Failed to fetch thresholds');
            const data = await response.json();
            setThresholds(data);
        } catch (error) {
            toast.error('Failed to load milestone thresholds');
            console.error('Threshold fetch error:', error);
        }
    }, [sessionId]);

    const fetchSymbolStats = useCallback(async () => {
        try {
            const response = await fetch(`/api/session/${sessionId}/stats`);
            if (!response.ok) throw new Error('Failed to fetch symbol statistics');
            const data = await response.json();
            const stats = new SymbolStats();
            data.symbols.forEach((symbol: number) => stats.addSymbol(symbol));
            setSymbolStats(stats);
        } catch (error) {
            console.error('Stats fetch error:', error);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchThresholds();
        fetchSymbolStats();
        
        // WebSocket subscription for real-time updates
        const ws = new WebSocket(`ws://localhost:3000/ws/session/${sessionId}`);
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'STATS_UPDATE') {
                setSymbolStats(new SymbolStats().addSymbols(data.symbols));
            }
        };

        return () => ws.close();
    }, [sessionId, fetchThresholds, fetchSymbolStats]);

    // Check for milestone achievements
    useEffect(() => {
        if (!thresholds) return;

        const checkMilestone = (level: keyof MilestoneNotifications, threshold: number) => {
            if (metrics.totalSymbols >= threshold && !milestoneNotified[level]) {
                toast.success(`${level.charAt(0).toUpperCase() + level.slice(1)} milestone reached!`, {
                    icon: '🎉'
                });
                setMilestoneNotified(prev => ({ ...prev, [level]: true }));
            }
        };

        checkMilestone('basic', thresholds.basic);
        checkMilestone('intermediate', thresholds.intermediate);
        checkMilestone('advanced', thresholds.advanced);
    }, [metrics.totalSymbols, thresholds, milestoneNotified]);

    const getMilestoneStatus = (threshold: number) => 
        metrics.totalSymbols >= threshold ? 'text-green-600 font-bold' : 'text-gray-600';

    const distribution = symbolStats.getDistribution();

    return (
        <div className="bg-white p-4 rounded-lg shadow-md space-y-6">
            <div>
                <h2 className="text-xl font-bold mb-4">Session Progress</h2>
                
                <div className="mb-4">
                    <h3 className="font-semibold mb-2">Recent Symbols</h3>
                    <div className="flex gap-2 flex-wrap">
                        {recentSymbols.slice(-10).map((symbol, idx) => (
                            <span 
                                key={idx} 
                                className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                                title={`Position: ${recentSymbols.length - (10 - idx)}`}
                            >
                                {mapSymbol(symbol)}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Symbol Distribution */}
                <div className="mb-4">
                    <h3 className="font-semibold mb-2">Symbol Distribution</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(distribution).map(([symbol, frequency]) => (
                            <div key={symbol} className="flex justify-between items-center">
                                <span>{symbol}</span>
                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full"
                                        style={{ width: `${frequency * 100}%` }}
                                    />
                                </div>
                                <span className="text-sm text-gray-600">
                                    {(frequency * 100).toFixed(1)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Session Metrics */}
                <div className="mb-4">
                    <h3 className="font-semibold mb-2">Session Metrics</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm text-gray-600">Total Symbols</div>
                            <div className="text-xl font-bold">{metrics.totalSymbols}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm text-gray-600">Analysis Runs</div>
                            <div className="text-xl font-bold">{metrics.analysisRuns}</div>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-sm text-gray-600">Avg. Confidence</div>
                            <div className="text-xl font-bold">
                                {(metrics.averageConfidence * 100).toFixed(1)}%
                            </div>
                        </div>
                        {metrics.streak && (
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <div className="text-sm text-gray-600">Current Streak</div>
                                <div className="text-xl font-bold">{metrics.streak}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Milestones */}
                {thresholds && (
                    <div>
                        <h3 className="font-semibold mb-2">Milestones</h3>
                        <div className="space-y-3">
                            {Object.entries(thresholds).map(([level, threshold]) => (
                                <div 
                                    key={level}
                                    className={`p-3 rounded-lg border transition-colors ${
                                        metrics.totalSymbols >= threshold 
                                            ? 'bg-green-50 border-green-200' 
                                            : 'bg-gray-50 border-gray-200'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h4 className="font-medium capitalize">{level}</h4>
                                            <p className="text-sm text-gray-500">{threshold} symbols</p>
                                        </div>
                                        {metrics.totalSymbols >= threshold && (
                                            <span className="text-green-600">✓</span>
                                        )}
                                    </div>
                                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                                        <div
                                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                            style={{ 
                                                width: `${Math.min((metrics.totalSymbols / threshold) * 100, 100)}%` 
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
