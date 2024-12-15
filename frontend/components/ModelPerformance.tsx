import React, { useEffect } from 'react';
import { toast } from 'react-toastify';
import { ModelPerformance as ModelPerformanceType } from '../utils/symbols';

interface ModelPerformanceBoxProps {
    performance: ModelPerformanceType;
    onPredictionClick?: (symbol: number, confidence: number) => void;
}

export const ModelPerformanceBox: React.FC<ModelPerformanceBoxProps> = ({ 
    performance,
    onPredictionClick 
}) => {
    const { modelName, accuracy, predictions, rngHypothesis, lastUpdated } = performance;

    useEffect(() => {
        if (rngHypothesis) {
            toast.info(`New RNG Hypothesis: ${rngHypothesis}`, {
                position: "top-right",
                autoClose: 5000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
            });
        }
    }, [rngHypothesis]);

    const handlePredictionClick = (symbol: number, confidence: number) => {
        if (onPredictionClick) {
            onPredictionClick(symbol, confidence);
        }
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold">{modelName}</h3>
                {lastUpdated && (
                    <span className="text-xs text-gray-500" title="Last model update">
                        Updated: {new Date(lastUpdated).toLocaleTimeString()}
                    </span>
                )}
            </div>
            
            <div className="mb-4">
                <div className="text-sm text-gray-600">Accuracy</div>
                <div className="text-2xl font-bold text-blue-600">
                    {(accuracy * 100).toFixed(1)}%
                </div>
            </div>

            {rngHypothesis && (
                <div className="mb-4 group relative">
                    <div className="text-sm text-gray-600">RNG Hypothesis</div>
                    <div className="text-md font-semibold cursor-help">
                        {rngHypothesis}
                        <div className="invisible group-hover:visible absolute z-10 w-64 p-2 bg-gray-800 text-white text-sm rounded-md shadow-lg -mt-1 ml-2">
                            This is the potential Random Number Generator type identified by our analysis.
                            Click for more details about this RNG type.
                        </div>
                    </div>
                </div>
            )}

            <div>
                <div className="text-sm text-gray-600 mb-2">Predictions</div>
                <div className="space-y-2">
                    {predictions.map((pred, idx) => (
                        <div 
                            key={idx} 
                            className="flex justify-between items-center p-2 hover:bg-gray-50 rounded-md transition-colors"
                            onClick={() => handlePredictionClick(parseInt(pred.symbol), pred.confidence)}
                        >
                            <span className="font-medium cursor-pointer hover:text-blue-600">
                                {pred.symbol}
                            </span>
                            <div className="flex-1 mx-4">
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${(pred.confidence || 0) * 100}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-sm text-gray-600">
                                {((pred.confidence || 0) * 100).toFixed(1)}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {predictions.length === 0 && (
                <div className="text-center text-gray-500 py-4">
                    No predictions available yet
                </div>
            )}
        </div>
    );
};
