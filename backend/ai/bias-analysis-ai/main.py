"""
FANS 편향성 분석 AI 서비스
- 감성 분석, 키워드 추출, 정치 분석 통합
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import logging
from datetime import datetime

from sentiment_analyzer import SentimentAnalyzer
from keyword_extractor import KeywordExtractor
from political_analyzer import PoliticalAnalyzer
from source_bias_analyzer import SourceBiasAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FANS Bias Analysis AI", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.fans.ai.kr"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sentiment_analyzer = SentimentAnalyzer()
keyword_extractor = KeywordExtractor()
political_analyzer = PoliticalAnalyzer()
source_bias_analyzer = SourceBiasAnalyzer()

class AnalysisRequest(BaseModel):
    text: str
    article_id: Optional[int] = None
    source_name: Optional[str] = None

class SentimentResponse(BaseModel):
    sentiment: str
    confidence: float
    score: float
    positive_count: int
    negative_count: int

class KeywordResponse(BaseModel):
    keywords: List[Dict[str, float]]

class PoliticalResponse(BaseModel):
    party_analysis: Dict[str, Dict]
    bias_score: float
    stance: str

class FullAnalysisResponse(BaseModel):
    sentiment: SentimentResponse
    keywords: List[tuple]
    political: Optional[PoliticalResponse]
    processed_at: str

@app.on_event("startup")
async def startup_event():
    logger.info("FANS Bias Analysis AI v2.0 시작")

@app.get("/")
def read_root():
    return {
        "service": "FANS Bias Analysis AI",
        "version": "2.0.0",
        "status": "running",
        "features": ["sentiment", "keywords", "political_bias"]
    }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/analyze/sentiment")
async def analyze_sentiment(request: AnalysisRequest):
    try:
        result = sentiment_analyzer.analyze(request.text)
        return SentimentResponse(**result)
    except Exception as e:
        logger.error(f"감성 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/keywords")
async def analyze_keywords(request: AnalysisRequest):
    try:
        keywords = keyword_extractor.extract(request.text, top_n=10)
        return {"keywords": [{"word": k, "score": float(s)} for k, s in keywords]}
    except Exception as e:
        logger.error(f"키워드 추출 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/political")
async def analyze_political(request: AnalysisRequest):
    try:
        party_analysis = political_analyzer.analyze_party_mentions(request.text)
        bias = political_analyzer.calculate_bias_score(request.text)

        return {
            "party_analysis": party_analysis,
            "bias_score": bias['bias_score'],
            "stance": bias['stance'],
            "ruling_sentiment": bias['ruling_sentiment'],
            "opposition_sentiment": bias['opposition_sentiment']
        }
    except Exception as e:
        logger.error(f"정치 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/full")
async def analyze_full(request: AnalysisRequest):
    try:
        sentiment = sentiment_analyzer.analyze(request.text)
        keywords = keyword_extractor.extract(request.text, top_n=10)

        # 언론사 기반 편향성 분석 (새로운 방식)
        source_name = request.source_name or '기타'
        source_bias = source_bias_analyzer.calculate_final_bias(source_name, request.text)

        bias_score = source_bias['bias_score']
        stance = source_bias['political_leaning']
        confidence = source_bias['confidence']

        # 기존 정치 분석도 포함 (참고용)
        party_analysis = political_analyzer.analyze_party_mentions(request.text)
        political_result = None
        if party_analysis:
            political_result = {
                "party_analysis": party_analysis,
                "source_base_score": source_bias['source_base_score'],
                "content_bias": source_bias['content_bias']
            }

        return {
            "article_id": request.article_id,
            "sentiment": sentiment,
            "keywords": [{"word": k, "score": float(s)} for k, s in keywords],
            "political": political_result,
            "bias_score": bias_score,
            "political_leaning": stance,
            "confidence": confidence,
            "is_political": source_bias['is_political'],
            "processed_at": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"전체 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)