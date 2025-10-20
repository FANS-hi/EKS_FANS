"""
FANS 경제 분석 시스템
경제 전망 (낙관/비관) 및 정책 성향 (시장주의/개입주의) 분석
"""

from sentiment_analyzer import SentimentAnalyzer

class EconomicAnalyzer:
    def __init__(self):
        self.sentiment_analyzer = SentimentAnalyzer()

        # 낙관적 키워드
        self.optimistic_keywords = [
            '성장', '상승', '회복', '호조', '개선', '증가', '확대',
            '긍정적', '호전', '반등', '활성화', '강세', '상승세',
            '개선세', '회복세', '성장세', '전망', '기대', '활황'
        ]

        # 비관적 키워드
        self.pessimistic_keywords = [
            '하락', '침체', '불황', '위기', '악화', '감소', '축소',
            '부정적', '둔화', '하락세', '침체', '위축', '약세', '하방',
            '우려', '리스크', '불안', '어려움', '부진', '타격'
        ]

        # 시장주의 키워드
        self.market_oriented_keywords = [
            '규제완화', '민영화', '자유시장', '경쟁', '효율성', '시장경제',
            '감세', '기업', '투자', '혁신', '성장', '자율', '개방',
            '민간', '자유무역', '개혁'
        ]

        # 개입주의 키워드
        self.intervention_keywords = [
            '규제', '정부지원', '보조금', '공공', '복지', '재분배',
            '증세', '통제', '관리', '개입', '공기업', '보호',
            '지원책', '정책', '대책', '지원금'
        ]

        # 경제 주체 키워드
        self.economic_entities = {
            '기업': ['기업', '회사', '대기업', '중소기업', '스타트업'],
            '소비자': ['소비자', '가계', '가정', '서민', '국민'],
            '정부': ['정부', '정책', '당국', '금융당국'],
            '시장': ['시장', '증시', '주가', '환율', '금리']
        }

    def analyze_economic_outlook(self, text: str) -> dict:
        """
        경제 전망 분석 (낙관적 vs 비관적)
        """
        optimistic_count = sum(text.count(kw) for kw in self.optimistic_keywords)
        pessimistic_count = sum(text.count(kw) for kw in self.pessimistic_keywords)

        total = optimistic_count + pessimistic_count
        if total == 0:
            return {
                'outlook': '중립',
                'score': 0.0,
                'optimistic_count': 0,
                'pessimistic_count': 0,
                'confidence': 0.0
            }

        # 낙관 비율 계산 (0.0 ~ 1.0)
        optimistic_ratio = optimistic_count / total

        # 점수 변환 (-5 ~ +5, 양수: 낙관, 음수: 비관)
        score = (optimistic_ratio - 0.5) * 10
        score = max(-5, min(5, score))

        # 전망 분류
        if score >= 2:
            outlook = '낙관적'
        elif score <= -2:
            outlook = '비관적'
        else:
            outlook = '중립'

        # 신뢰도 (키워드가 많을수록 높음)
        confidence = min(total / 10, 1.0)  # 10개 이상이면 1.0

        return {
            'outlook': outlook,
            'score': round(score, 2),
            'optimistic_count': optimistic_count,
            'pessimistic_count': pessimistic_count,
            'confidence': round(confidence, 2)
        }

    def analyze_policy_stance(self, text: str) -> dict:
        """
        정책 성향 분석 (시장주의 vs 개입주의)
        """
        market_count = sum(text.count(kw) for kw in self.market_oriented_keywords)
        intervention_count = sum(text.count(kw) for kw in self.intervention_keywords)

        total = market_count + intervention_count
        if total == 0:
            return {
                'stance': '중립',
                'score': 0.0,
                'market_count': 0,
                'intervention_count': 0,
                'confidence': 0.0
            }

        # 시장주의 비율 계산 (0.0 ~ 1.0)
        market_ratio = market_count / total

        # 점수 변환 (-5 ~ +5, 양수: 시장주의, 음수: 개입주의)
        score = (market_ratio - 0.5) * 10
        score = max(-5, min(5, score))

        # 성향 분류
        if score >= 2:
            stance = '시장주의'
        elif score <= -2:
            stance = '개입주의'
        else:
            stance = '중립'

        # 신뢰도
        confidence = min(total / 10, 1.0)

        return {
            'stance': stance,
            'score': round(score, 2),
            'market_count': market_count,
            'intervention_count': intervention_count,
            'confidence': round(confidence, 2)
        }

    def analyze_entity_sentiment(self, text: str) -> dict:
        """
        경제 주체별 감성 분석
        """
        result = {}

        sentences = text.split('.')

        for entity_name, keywords in self.economic_entities.items():
            mentions = []

            for sent in sentences:
                for keyword in keywords:
                    if keyword in sent:
                        sentiment = self.sentiment_analyzer.analyze(sent)
                        mentions.append({
                            'sentence': sent.strip(),
                            'keyword': keyword,
                            'sentiment': sentiment['sentiment'],
                            'score': sentiment['score']
                        })
                        break

            if mentions:
                avg_score = sum(m['score'] for m in mentions) / len(mentions)
                positive_count = sum(1 for m in mentions if m['sentiment'] == 'positive')
                negative_count = sum(1 for m in mentions if m['sentiment'] == 'negative')
                neutral_count = sum(1 for m in mentions if m['sentiment'] == 'neutral')

                result[entity_name] = {
                    'count': len(mentions),
                    'avg_score': round(avg_score, 2),
                    'positive': positive_count,
                    'negative': negative_count,
                    'neutral': neutral_count
                }

        return result

    def comprehensive_analysis(self, text: str) -> dict:
        """
        종합 경제 분석
        """
        outlook = self.analyze_economic_outlook(text)
        policy = self.analyze_policy_stance(text)
        entity_sentiment = self.analyze_entity_sentiment(text)

        return {
            'economic_outlook': outlook,
            'policy_stance': policy,
            'entity_sentiment': entity_sentiment
        }


if __name__ == "__main__":
    analyzer = EconomicAnalyzer()

    test_article = """
    국내 경제가 회복세를 보이고 있다. 정부는 새로운 성장 동력 확보를 위해
    규제완화 정책을 추진하고 있으며, 기업들의 투자도 증가하고 있다.
    증시는 상승세를 이어가며 활황을 보이고 있다.
    다만 일부 전문가들은 가계 부채 증가와 금리 상승에 대한 우려를 표명했다.
    정부는 서민 지원을 위한 보조금 지급을 검토 중이다.
    """

    print("=" * 60)
    print("경제 분석 테스트")
    print("=" * 60)

    result = analyzer.comprehensive_analysis(test_article)

    print("\n📈 경제 전망:")
    print(f"  전망: {result['economic_outlook']['outlook']}")
    print(f"  점수: {result['economic_outlook']['score']}/5")
    print(f"  낙관 키워드: {result['economic_outlook']['optimistic_count']}개")
    print(f"  비관 키워드: {result['economic_outlook']['pessimistic_count']}개")
    print(f"  신뢰도: {result['economic_outlook']['confidence']}")

    print("\n📊 정책 성향:")
    print(f"  성향: {result['policy_stance']['stance']}")
    print(f"  점수: {result['policy_stance']['score']}/5")
    print(f"  시장주의 키워드: {result['policy_stance']['market_count']}개")
    print(f"  개입주의 키워드: {result['policy_stance']['intervention_count']}개")
    print(f"  신뢰도: {result['policy_stance']['confidence']}")

    if result['entity_sentiment']:
        print("\n💬 경제 주체별 감성:")
        for entity, data in result['entity_sentiment'].items():
            print(f"\n  {entity}:")
            print(f"    언급 횟수: {data['count']}")
            print(f"    평균 감성: {data['avg_score']:.2f}")
            print(f"    긍정: {data['positive']}, 중립: {data['neutral']}, 부정: {data['negative']}")
