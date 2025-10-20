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
from economic_analyzer import EconomicAnalyzer
from social_analyzer import SocialAnalyzer

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
economic_analyzer = EconomicAnalyzer()
social_analyzer = SocialAnalyzer()

class AnalysisRequest(BaseModel):
    text: str
    article_id: Optional[int] = None
    source_name: Optional[str] = None
    category: Optional[str] = None  # 정치, 경제, 사회 등

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
        category = request.category or '기타'

        # 기본 응답 구조
        response = {
            "article_id": request.article_id,
            "category": category,
            "sentiment": sentiment,
            "keywords": [{"word": k, "score": float(s)} for k, s in keywords],
            "processed_at": datetime.now().isoformat()
        }

        # 카테고리별 분석
        if category == '정치':
            # 정치: 언론사 편향성 + 정당 분석
            source_name = request.source_name or '기타'
            source_bias = source_bias_analyzer.calculate_final_bias(source_name, request.text)

            party_analysis = political_analyzer.analyze_party_mentions(request.text)

            response.update({
                "bias_score": source_bias['bias_score'],
                "political_leaning": source_bias['political_leaning'],
                "confidence": source_bias['confidence'],
                "is_political": source_bias['is_political'],
                "source_base_score": source_bias['source_base_score'],
                "content_bias": source_bias['content_bias'],
                "party_analysis": party_analysis if party_analysis else None
            })

        elif category == '경제':
            # 경제: 경제 전망 + 정책 성향
            economic_result = economic_analyzer.comprehensive_analysis(request.text)

            response.update({
                "economic_analysis": {
                    "outlook": economic_result['economic_outlook']['outlook'],
                    "outlook_score": economic_result['economic_outlook']['score'],
                    "policy_stance": economic_result['policy_stance']['stance'],
                    "policy_score": economic_result['policy_stance']['score'],
                    "entity_sentiment": economic_result['entity_sentiment']
                }
            })

        elif category == '사회':
            # 사회: 사회 가치관 + 이슈별 분석
            social_result = social_analyzer.comprehensive_analysis(request.text)

            response.update({
                "social_analysis": {
                    "values": social_result['social_values']['values'],
                    "values_score": social_result['social_values']['score'],
                    "issue_analysis": social_result['issue_analysis']
                }
            })

        else:
            # 기타 카테고리: 기본 언론사 편향성만
            source_name = request.source_name or '기타'
            source_bias = source_bias_analyzer.calculate_final_bias(source_name, request.text)

            response.update({
                "bias_score": source_bias['bias_score'],
                "political_leaning": source_bias['political_leaning'],
                "confidence": source_bias['confidence']
            })

        return response

    except Exception as e:
        logger.error(f"전체 분석 오류: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)