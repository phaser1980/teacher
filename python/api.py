from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from models.lstm_model import LSTMPredictor
from models.arima_model import ARIMAPredictor
from models.monte_carlo import MonteCarloSimulator
from models.rng_discovery import RNGDiscovery

app = FastAPI()

class SymbolSequence(BaseModel):
    symbols: List[int]
    session_id: str
    analysis_type: Optional[str] = "all"

class PredictionResponse(BaseModel):
    model_name: str
    prediction: List[float]
    confidence: float
    possible_rng_seed: Optional[str]

@app.post("/analyze", response_model=List[PredictionResponse])
async def analyze_symbols(sequence: SymbolSequence):
    if len(sequence.symbols) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 symbols for analysis")
    
    results = []
    
    # Placeholder responses until models are implemented
    results.append(PredictionResponse(
        model_name="LSTM",
        prediction=[0.25, 0.25, 0.25, 0.25],
        confidence=0.85,
        possible_rng_seed=None
    ))
    
    results.append(PredictionResponse(
        model_name="Monte Carlo",
        prediction=[0.20, 0.30, 0.30, 0.20],
        confidence=0.75,
        possible_rng_seed="xorshift128+"
    ))
    
    return results

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
