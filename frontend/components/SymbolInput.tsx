import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

interface SymbolInputProps {
    onSymbolSubmit: (symbol: number) => void;
    disabled?: boolean;
}

export const SymbolInput: React.FC<SymbolInputProps> = ({ onSymbolSubmit, disabled }) => {
    const [inputValue, setInputValue] = useState<string>('');
    const [error, setError] = useState<string>('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const num = parseInt(inputValue);
        
        if (isNaN(num) || num < 1 || num > 52) {
            setError('Please enter a valid card number (1-52)');
            return;
        }

        onSymbolSubmit(num);
        setInputValue('');
        setError('');
    };

    return (
        <div className="w-full max-w-md mx-auto p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="symbol" className="block text-sm font-medium text-gray-700">
                        Enter Card Symbol (1-52)
                    </label>
                    <div className="mt-1">
                        <input
                            type="number"
                            id="symbol"
                            min="1"
                            max="52"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            disabled={disabled}
                            className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Enter number 1-52"
                        />
                    </div>
                    {error && (
                        <p className="mt-2 text-sm text-red-600">
                            {error}
                        </p>
                    )}
                </div>
                <button
                    type="submit"
                    disabled={disabled}
                    className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                        ${disabled 
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        }`}
                >
                    Submit
                </button>
            </form>
        </div>
    );
};
