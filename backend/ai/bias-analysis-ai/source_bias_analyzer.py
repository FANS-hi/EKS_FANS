"""
FANS 언론사별 편향성 분석 시스템
언론사별 상대적 정치 성향을 분석하고 점수화
"""

from sentiment_analyzer import SentimentAnalyzer
from typing import Dict, Optional

class SourceBiasAnalyzer:
    def __init__(self):
        self.sentiment_analyzer = SentimentAnalyzer()

        # 알려진 주요 언론사 정치 성향 프로필 (-10: 진보, 0: 중도, +10: 보수)
        self.source_profiles = {
            '조선일보': {'base_score': 7.5, 'leaning': '보수'},
            '중앙일보': {'base_score': 5.0, 'leaning': '보수'},
            '동아일보': {'base_score': 6.0, 'leaning': '보수'},
            '문화일보': {'base_score': 5.5, 'leaning': '보수'},
            '세계일보': {'base_score': 4.0, 'leaning': '중도우'},

            '한겨레': {'base_score': -7.0, 'leaning': '진보'},
            '경향신문': {'base_score': -6.5, 'leaning': '진보'},
            '한국일보': {'base_score': -3.0, 'leaning': '중도좌'},

            '연합뉴스': {'base_score': 0.0, 'leaning': '중립'},
            'YTN': {'base_score': 0.5, 'leaning': '중립'},
            'JTBC': {'base_score': -2.0, 'leaning': '중도좌'},

            '한국경제': {'base_score': 4.0, 'leaning': '중도우'},
            '매일경제': {'base_score': 3.5, 'leaning': '중도우'},
            '머니투데이': {'base_score': 2.0, 'leaning': '중도'},

            '기타': {'base_score': 0.0, 'leaning': '중립'}
        }

        # 정치 관련 키워드
        self.political_keywords = [
            '정부', '여당', '야당', '국회', '의원', '장관', '대통령', '총리',
            '더불어민주당', '민주당', '국민의힘', '정치', '선거', '투표',
            '정책', '법안', '국정', '행정부', '입법부'
        ]

        # 보수 성향 키워드
        self.conservative_keywords = [
            '자유민주주의', '시장경제', '안보', '동맹', '북한위협', '좌파',
            '반시장', '규제완화', '감세', '성장', '기업'
        ]

        # 진보 성향 키워드
        self.progressive_keywords = [
            '평화', '복지', '평등', '노동', '인권', '환경', '우파',
            '재벌개혁', '증세', '분배', '민생', '서민'
        ]

    def is_political_article(self, text: str) -> bool:
        """정치 기사인지 판단"""
        count = sum(1 for keyword in self.political_keywords if keyword in text)
        return count >= 2

    def calculate_content_bias(self, text: str) -> float:
        """기사 내용 기반 편향성 점수 (-5 ~ +5)"""
        if not self.is_political_article(text):
            return 0.0

        # 보수/진보 키워드 빈도 계산
        conservative_count = sum(text.count(kw) for kw in self.conservative_keywords)
        progressive_count = sum(text.count(kw) for kw in self.progressive_keywords)

        # 정부/야당 감성 분석
        gov_sentiment = 0.0
        opp_sentiment = 0.0
        gov_mentions = 0
        opp_mentions = 0

        sentences = text.split('.')
        for sent in sentences:
            if any(kw in sent for kw in ['정부', '여당', '집권']):
                sentiment = self.sentiment_analyzer.analyze(sent)
                gov_sentiment += sentiment['score']
                gov_mentions += 1

            if any(kw in sent for kw in ['야당', '국민의힘']):
                sentiment = self.sentiment_analyzer.analyze(sent)
                opp_sentiment += sentiment['score']
                opp_mentions += 1

        # 평균 계산
        if gov_mentions > 0:
            gov_sentiment /= gov_mentions
        if opp_mentions > 0:
            opp_sentiment /= opp_mentions

        # 종합 점수 계산
        keyword_bias = 0.0
        if conservative_count + progressive_count > 0:
            keyword_bias = (conservative_count - progressive_count) / (conservative_count + progressive_count) * 3

        sentiment_bias = 0.0
        if gov_mentions > 0 and opp_mentions > 0:
            sentiment_bias = (gov_sentiment - opp_sentiment) * 2

        # 최종 점수 (-5 ~ +5)
        content_bias = keyword_bias + sentiment_bias
        return max(-5, min(5, content_bias))

    def calculate_final_bias(self, source_name: str, text: str) -> Dict:
        """
        언론사와 내용을 종합하여 최종 편향성 계산
        언론사 기본 점수 (75%) + 기사 내용 점수 (25%)
        """
        # "기타-" prefix 처리
        actual_source_name = source_name
        if source_name.startswith('기타-'):
            # 주요 "기타-" 언론사 개별 처리
            known_others = {
                '기타-오마이뉴스': {'base_score': -5.0, 'leaning': '진보'},
                '기타-프레시안': {'base_score': -5.5, 'leaning': '진보'},
                '기타-조선비즈': {'base_score': 6.0, 'leaning': '보수'},
                '기타-이데일리': {'base_score': 3.0, 'leaning': '중도우'},
                '기타-뉴시스': {'base_score': 0.0, 'leaning': '중립'},
                '기타-뉴스1': {'base_score': 0.0, 'leaning': '중립'},
                '기타-아시아경제': {'base_score': 2.5, 'leaning': '중도'},
                '기타-서울경제': {'base_score': 3.5, 'leaning': '중도우'},
            }

            if source_name in known_others:
                source_profile = known_others[source_name]
            else:
                # 알려지지 않은 "기타-" 언론사는 중립으로 처리
                source_profile = self.source_profiles['기타']
        else:
            # 일반 언론사
            source_profile = self.source_profiles.get(source_name, self.source_profiles['기타'])

        base_score = source_profile['base_score']

        # 기사 내용 편향성
        content_bias = self.calculate_content_bias(text)

        # 가중 평균 (언론사 75%, 내용 25%)
        final_score = (base_score * 0.75) + (content_bias * 0.25)

        # 점수 범위 조정 (-10 ~ +10)
        final_score = max(-10, min(10, final_score))

        # 성향 분류
        if final_score <= -5:
            leaning = '진보'
        elif final_score <= -2:
            leaning = '중도좌'
        elif final_score < 2:
            leaning = '중립'
        elif final_score < 5:
            leaning = '중도우'
        else:
            leaning = '보수'

        # 신뢰도 계산
        is_political = self.is_political_article(text)
        confidence = 0.85 if is_political else 0.50

        return {
            'bias_score': round(final_score, 2),
            'political_leaning': leaning,
            'confidence': confidence,
            'source_base_score': base_score,
            'content_bias': round(content_bias, 2),
            'is_political': is_political
        }


if __name__ == "__main__":
    analyzer = SourceBiasAnalyzer()

    test_cases = [
        ("조선일보", "정부의 경제 정책이 시장경제 원칙에 부합한다. 자유민주주의 가치를 지켜야 한다."),
        ("한겨레", "정부의 일방적인 정책 추진으로 서민 생활이 어려워지고 있다. 복지 확대가 시급하다."),
        ("연합뉴스", "국회에서 예산안이 통과되었다. 여야가 합의했다."),
        ("머니투데이", "코스피가 상승했다. 외국인 투자자들의 매수세가 이어졌다.")
    ]

    print("=" * 80)
    print("언론사별 편향성 분석 테스트")
    print("=" * 80)

    for source, article in test_cases:
        result = analyzer.calculate_final_bias(source, article)
        print(f"\n언론사: {source}")
        print(f"기사: {article[:50]}...")
        print(f"편향성 점수: {result['bias_score']}/10 ({result['political_leaning']})")
        print(f"언론사 기본 점수: {result['source_base_score']}")
        print(f"기사 내용 편향: {result['content_bias']}")
        print(f"정치 기사: {result['is_political']}")
        print(f"신뢰도: {result['confidence']}")
