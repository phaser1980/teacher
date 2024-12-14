import React from 'react';

interface Milestone {
    basic: boolean;
    intermediate: boolean;
    advanced: boolean;
}

interface SessionMetrics {
    totalSymbols: number;
    analysisRuns: number;
    averageConfidence: number;
}

interface ProgressTrackerProps {
    symbolCount: number;
    threshold: number;
    symbols: number[];
    milestones: Milestone;
    sessionMetrics?: SessionMetrics;
    analysisUpdate?: {
        modelName: string;
        progress: number;
        phase: string;
    };
    rngProgress?: {
        progress: number;
        detectedPatterns: number;
        confidenceTrend: number;
        currentPhase: string;
    };
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
    symbolCount,
    threshold,
    symbols,
    milestones,
    sessionMetrics,
    analysisUpdate,
    rngProgress
}) => {
    const progress = (symbolCount / threshold) * 100;

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
            {/* Progress Bar */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">
                        Analysis Progress
                    </span>
                    <span className="text-sm font-medium text-gray-700">
                        {symbolCount} / {threshold} symbols
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    ></div>
                </div>
            </div>

            {/* Milestones */}
            <div className="grid grid-cols-3 gap-4">
                <div className={`p-3 rounded-lg border ${milestones.basic ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <h4 className="text-sm font-medium text-gray-700">Basic Analysis</h4>
                    <p className="text-xs text-gray-500">5+ symbols</p>
                    {milestones.basic && (
                        <span className="text-xs text-green-600">✓ Activated</span>
                    )}
                </div>
                <div className={`p-3 rounded-lg border ${milestones.intermediate ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <h4 className="text-sm font-medium text-gray-700">Intermediate</h4>
                    <p className="text-xs text-gray-500">20+ symbols</p>
                    {milestones.intermediate && (
                        <span className="text-xs text-green-600">✓ Activated</span>
                    )}
                </div>
                <div className={`p-3 rounded-lg border ${milestones.advanced ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                    <h4 className="text-sm font-medium text-gray-700">Advanced</h4>
                    <p className="text-xs text-gray-500">50+ symbols</p>
                    {milestones.advanced && (
                        <span className="text-xs text-green-600">✓ Activated</span>
                    )}
                </div>
            </div>

            {/* Recent Symbols */}
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">Recent Symbols</h3>
                <div className="flex flex-wrap gap-2">
                    {symbols.slice(-10).map((symbol, index) => (
                        <div
                            key={index}
                            className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-lg shadow-sm"
                        >
                            <span className="text-sm font-medium text-gray-700">
                                {symbol}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Analysis Updates */}
            {analysisUpdate && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-medium text-blue-700">
                        {analysisUpdate.modelName} Analysis
                    </h4>
                    <p className="text-xs text-blue-600 mt-1">
                        Phase: {analysisUpdate.phase}
                    </p>
                    <div className="mt-2 w-full bg-blue-200 rounded-full h-1.5">
                        <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${analysisUpdate.progress}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {/* RNG Progress */}
            {rngProgress && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <h4 className="text-sm font-medium text-purple-700">
                        RNG Pattern Discovery
                    </h4>
                    <div className="mt-2 space-y-2">
                        <div className="flex justify-between text-xs text-purple-600">
                            <span>Progress</span>
                            <span>{rngProgress.progress.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between text-xs text-purple-600">
                            <span>Patterns Found</span>
                            <span>{rngProgress.detectedPatterns}</span>
                        </div>
                        <div className="flex justify-between text-xs text-purple-600">
                            <span>Confidence Trend</span>
                            <span>{(rngProgress.confidenceTrend * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Session Metrics */}
            {sessionMetrics && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-medium text-gray-500">Total Symbols</h4>
                        <p className="text-lg font-semibold text-gray-700">{sessionMetrics.totalSymbols}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-medium text-gray-500">Analysis Runs</h4>
                        <p className="text-lg font-semibold text-gray-700">{sessionMetrics.analysisRuns}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-xs font-medium text-gray-500">Avg Confidence</h4>
                        <p className="text-lg font-semibold text-gray-700">
                            {(sessionMetrics.averageConfidence * 100).toFixed(1)}%
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
