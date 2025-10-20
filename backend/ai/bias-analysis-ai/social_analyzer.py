"""
FANS 사회 분석 시스템
사회 가치관 (진보/보수) 및 이슈별 관점 분석
"""

from sentiment_analyzer import SentimentAnalyzer

class SocialAnalyzer:
    def __init__(self):
        self.sentiment_analyzer = SentimentAnalyzer()

        # 진보적 가치관 키워드
        self.progressive_keywords = [
            '인권', '다양성', '평등', '환경', '포용', '소수자',
            '젠더', '양성평등', '성평등', '개혁', '진보', '변화',
            '개방', '자유', '민주', '참여', '연대', '공동체',
            '복지', '분배', '정의', '공정', '차별금지'
        ]

        # 보수적 가치관 키워드
        self.conservative_keywords = [
            '전통', '질서', '안전', '책임', '가족', '보수',
            '안정', '치안', '범죄', '처벌', '강력', '엄벌',
            '규율', '질서', '국가', '애국', '준법', '윤리',
            '전통가치', '가정', '경쟁', '능력'
        ]

        # 사회 이슈별 키워드
        self.social_issues = {
            '환경': {
                'keywords': ['환경', '기후', '탄소', '온실가스', '재생에너지', '친환경', '녹색'],
                'progressive': ['기후위기', '탄소중립', '재생에너지', '환경보호', '지속가능'],
                'conservative': ['경제성', '비용', '산업', '일자리', '현실성']
            },
            '인권': {
                'keywords': ['인권', '차별', '평등', '소수자', '이주민', '난민', '장애인'],
                'progressive': ['인권', '평등', '다양성', '포용', '차별금지', '권리'],
                'conservative': ['질서', '안전', '범죄', '불법', '통제']
            },
            '노동': {
                'keywords': ['노동', '근로자', '노조', '파업', '임금', '근로시간', '노동권'],
                'progressive': ['노동권', '생활임금', '근로조건', '노조', '단결권'],
                'conservative': ['경영권', '생산성', '효율', '경쟁력']
            },
            '교육': {
                'keywords': ['교육', '학교', '학생', '입시', '대학', '학력', '교사'],
                'progressive': ['평등', '무상교육', '공교육', '교육격차', '기회균등'],
                'conservative': ['경쟁', '수월성', '자사고', '특목고', '능력']
            },
            '복지': {
                'keywords': ['복지', '연금', '의료', '주거', '기본소득', '수당', '지원'],
                'progressive': ['보편복지', '기본소득', '무상', '확대', '권리'],
                'conservative': ['재정', '부담', '선별', '효율', '자립']
            }
        }

    def analyze_social_values(self, text: str) -> dict:
        """
        사회 가치관 분석 (진보 vs 보수)
        """
        progressive_count = sum(text.count(kw) for kw in self.progressive_keywords)
        conservative_count = sum(text.count(kw) for kw in self.conservative_keywords)

        total = progressive_count + conservative_count
        if total == 0:
            return {
                'values': '중립',
                'score': 0.0,
                'progressive_count': 0,
                'conservative_count': 0,
                'confidence': 0.0
            }

        # 진보 비율 계산 (0.0 ~ 1.0)
        progressive_ratio = progressive_count / total

        # 점수 변환 (-5 ~ +5, 양수: 진보, 음수: 보수)
        score = (progressive_ratio - 0.5) * 10
        score = max(-5, min(5, score))

        # 가치관 분류
        if score >= 2:
            values = '진보적'
        elif score <= -2:
            values = '보수적'
        else:
            values = '중립'

        # 신뢰도
        confidence = min(total / 10, 1.0)

        return {
            'values': values,
            'score': round(score, 2),
            'progressive_count': progressive_count,
            'conservative_count': conservative_count,
            'confidence': round(confidence, 2)
        }

    def analyze_issue(self, text: str, issue_name: str) -> dict:
        """
        특정 이슈에 대한 관점 분석
        """
        if issue_name not in self.social_issues:
            return None

        issue = self.social_issues[issue_name]

        # 이슈 관련 내용인지 확인
        issue_count = sum(text.count(kw) for kw in issue['keywords'])
        if issue_count == 0:
            return None

        # 진보/보수 성향 키워드 카운트
        progressive_count = sum(text.count(kw) for kw in issue['progressive'])
        conservative_count = sum(text.count(kw) for kw in issue['conservative'])

        total = progressive_count + conservative_count
        if total == 0:
            perspective = '중립'
            score = 0.0
        else:
            # 진보 비율
            progressive_ratio = progressive_count / total
            score = (progressive_ratio - 0.5) * 10
            score = max(-5, min(5, score))

            if score >= 2:
                perspective = '진보적'
            elif score <= -2:
                perspective = '보수적'
            else:
                perspective = '중립'

        # 신뢰도
        confidence = min(issue_count / 5, 1.0)

        return {
            'issue': issue_name,
            'perspective': perspective,
            'score': round(score, 2),
            'issue_mentions': issue_count,
            'progressive_count': progressive_count,
            'conservative_count': conservative_count,
            'confidence': round(confidence, 2)
        }

    def analyze_all_issues(self, text: str) -> dict:
        """
        모든 이슈에 대한 분석
        """
        results = {}

        for issue_name in self.social_issues.keys():
            analysis = self.analyze_issue(text, issue_name)
            if analysis:
                results[issue_name] = analysis

        return results

    def comprehensive_analysis(self, text: str) -> dict:
        """
        종합 사회 분석
        """
        values = self.analyze_social_values(text)
        issues = self.analyze_all_issues(text)

        return {
            'social_values': values,
            'issue_analysis': issues
        }


if __name__ == "__main__":
    analyzer = SocialAnalyzer()

    test_article = """
    정부가 기후위기 대응을 위한 탄소중립 정책을 발표했다.
    환경단체들은 재생에너지 확대와 환경보호 정책을 환영했으나,
    일부에서는 산업계에 미칠 경제적 부담을 우려하고 있다.

    또한 인권위원회는 차별금지법 제정의 필요성을 강조했다.
    소수자와 이주민의 인권 보호가 시급하다는 입장이다.
    다만 일각에서는 사회 질서와 안전 문제를 지적했다.

    노동계는 최저임금 인상과 노동권 강화를 요구하고 있으며,
    경영계는 기업의 경쟁력과 경영권 보호를 주장했다.
    """

    print("=" * 60)
    print("사회 분석 테스트")
    print("=" * 60)

    result = analyzer.comprehensive_analysis(test_article)

    print("\n🌈 사회 가치관:")
    print(f"  가치관: {result['social_values']['values']}")
    print(f"  점수: {result['social_values']['score']}/5")
    print(f"  진보 키워드: {result['social_values']['progressive_count']}개")
    print(f"  보수 키워드: {result['social_values']['conservative_count']}개")
    print(f"  신뢰도: {result['social_values']['confidence']}")

    if result['issue_analysis']:
        print("\n📌 이슈별 분석:")
        for issue_name, data in result['issue_analysis'].items():
            print(f"\n  {issue_name}:")
            print(f"    관점: {data['perspective']}")
            print(f"    점수: {data['score']}/5")
            print(f"    언급 횟수: {data['issue_mentions']}")
            print(f"    진보 키워드: {data['progressive_count']}개")
            print(f"    보수 키워드: {data['conservative_count']}개")
            print(f"    신뢰도: {data['confidence']}")
