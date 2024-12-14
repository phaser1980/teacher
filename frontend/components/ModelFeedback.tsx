import React from 'react';
import { Line } from 'react-chartjs-2';

interface PredictionData {
    modelName: string;
    prediction: number[];
    confidence: number;
    possibleRngSeed?: string;
}

interface ModelFeedbackProps {
    predictions: PredictionData[];
    isLoading: boolean;
}

export const ModelFeedback: React.FC<ModelFeedbackProps> = ({ predictions, isLoading }) => {
    if (isLoading) {
        return (
            <div className="w-full max-w-2xl mx-auto p-4">
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
            {predictions.map((pred, idx) => (
                <div key={idx} className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                        {pred.modelName} Analysis
                    </h3>
                    
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-500">Confidence</span>
                            <span className="text-sm font-medium text-gray-900">
                                {(pred.confidence * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${pred.confidence * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-500">Predictions</h4>
                        <div className="grid grid-cols-4 gap-2">
                            {pred.prediction.map((prob, i) => (
                                <div key={i} className="text-center p-2 bg-gray-50 rounded">
                                    <div className="text-sm font-medium text-gray-900">
                                        {(prob * 100).toFixed(1)}%
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        Option {i + 1}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {pred.possibleRngSeed && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded">
                            <p className="text-sm text-yellow-800">
                                Possible RNG Type: {pred.possibleRngSeed}
                            </p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
