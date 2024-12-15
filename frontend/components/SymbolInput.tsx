import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { SymbolType, SymbolName, symbolMap, isValidSymbol } from '../utils/symbols';

interface SymbolInputProps {
    onSymbolSubmit: (symbol: SymbolType) => void;
    disabled?: boolean;
}

export const SymbolInput: React.FC<SymbolInputProps> = ({ onSymbolSubmit, disabled }) => {
    const [selectedSymbol, setSelectedSymbol] = useState<SymbolType | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedSymbol) {
            onSymbolSubmit(selectedSymbol);
            setSelectedSymbol(null);
        }
    };

    const handleSymbolSelect = (symbol: SymbolType) => {
        setSelectedSymbol(symbol);
    };

    return (
        <div className="w-full max-w-md mx-auto p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Card Symbol
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                        {(Object.entries(symbolMap) as [string, SymbolName][]).map(([value, name]) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => handleSymbolSelect(parseInt(value) as SymbolType)}
                                disabled={disabled}
                                className={`
                                    p-4 rounded-lg border-2 transition-all duration-200
                                    ${selectedSymbol === parseInt(value)
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                    }
                                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                                `}
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-1">
                                        {name === 'Hearts' && '♥️'}
                                        {name === 'Diamonds' && '♦️'}
                                        {name === 'Clubs' && '♣️'}
                                        {name === 'Spades' && '♠️'}
                                    </div>
                                    <div className="text-sm font-medium text-gray-700">{name}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={disabled || !selectedSymbol}
                    className={`
                        w-full flex justify-center py-2 px-4 border border-transparent rounded-md 
                        shadow-sm text-sm font-medium text-white transition-colors duration-200
                        ${disabled || !selectedSymbol
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                        }
                    `}
                >
                    Submit {selectedSymbol ? symbolMap[selectedSymbol] : ''}
                </button>
            </form>
        </div>
    );
};
