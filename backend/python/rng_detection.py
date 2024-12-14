import sys
import json
import numpy as np
from typing import List, Dict, Any

class RNGDetector:
    def __init__(self, symbols: List[str]):
        self.symbols = symbols
        self.numeric_sequence = self._convert_to_numeric()
        
    def _convert_to_numeric(self) -> np.ndarray:
        """Convert symbol sequence to numeric values"""
        unique_symbols = list(set(self.symbols))
        symbol_to_num = {s: i for i, s in enumerate(unique_symbols)}
        return np.array([symbol_to_num[s] for s in self.symbols])
    
    def detect_lcg(self) -> Dict[str, Any]:
        """Detect Linear Congruential Generator parameters"""
        if len(self.numeric_sequence) < 4:
            return {"detected": False, "confidence": 0}
            
        # Try to detect LCG parameters (a, c, m)
        differences = np.diff(self.numeric_sequence)
        unique_diffs = np.unique(differences)
        
        if len(unique_diffs) == 1:
            # Likely a simple increment
            return {
                "detected": True,
                "type": "linear_increment",
                "increment": unique_diffs[0],
                "confidence": 0.9
            }
            
        # Check for multiplicative pattern
        ratios = self.numeric_sequence[1:] / self.numeric_sequence[:-1]
        unique_ratios = np.unique(ratios.round(decimals=5))
        
        if len(unique_ratios) == 1:
            return {
                "detected": True,
                "type": "multiplicative",
                "multiplier": unique_ratios[0],
                "confidence": 0.85
            }
            
        return {"detected": False, "confidence": 0}
    
    def detect_mersenne_twister(self) -> Dict[str, Any]:
        """Detect potential Mersenne Twister patterns"""
        if len(self.numeric_sequence) < 624:  # MT19937 needs 624 values
            return {"detected": False, "confidence": 0}
            
        # Check for period length
        fft = np.fft.fft(self.numeric_sequence)
        power = np.abs(fft) ** 2
        period_candidates = np.where(power > np.mean(power) + 2 * np.std(power))[0]
        
        if 624 in period_candidates or 397 in period_candidates:
            return {
                "detected": True,
                "type": "mersenne_twister",
                "confidence": 0.7
            }
            
        return {"detected": False, "confidence": 0}
    
    def analyze(self) -> Dict[str, Any]:
        """Run all RNG detection algorithms"""
        lcg_result = self.detect_lcg()
        mt_result = self.detect_mersenne_twister()
        
        # Determine the most likely RNG type
        if lcg_result["detected"] and lcg_result["confidence"] > 0.8:
            return {
                "rng_type": "LCG",
                "confidence": lcg_result["confidence"],
                "details": lcg_result
            }
        elif mt_result["detected"]:
            return {
                "rng_type": "MT19937",
                "confidence": mt_result["confidence"],
                "details": mt_result
            }
        
        return {
            "rng_type": "unknown",
            "confidence": 0,
            "details": {
                "lcg_analysis": lcg_result,
                "mt_analysis": mt_result
            }
        }

def main():
    # Read input from Node.js
    input_data = json.loads(sys.argv[1])
    
    # Analyze the sequence
    detector = RNGDetector(input_data)
    result = detector.analyze()
    
    # Output results back to Node.js
    print(json.dumps(result))

if __name__ == "__main__":
    main()
