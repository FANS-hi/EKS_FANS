"""
FANS 키워드 추출 시스템
TF-IDF 기반 키워드 추출 + kiwipiepy 형태소 분석
"""

from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
from kiwipiepy import Kiwi

class KeywordExtractor:
    def __init__(self):
        self.vectorizer = None
        self.kiwi = Kiwi()

        # 한국어 불용어 리스트 (무의미한 단어들)
        self.stopwords = {
            # 동사
            '있다', '하다', '되다', '이다', '아니다', '그렇다', '없다', '같다', '싶다',
            '보다', '만들다', '받다', '주다', '가다', '오다', '말다', '알다', '모르다',
            '듣다', '묻다', '놓다', '나다', '살다', '쓰다', '찾다', '생각하다', '느끼다',

            # 형용사
            '크다', '작다', '많다', '적다', '좋다', '나쁘다', '높다', '낮다',

            # 대명사/지시어
            '이', '그', '저', '이것', '그것', '저것', '여기', '거기', '저기',
            '이런', '그런', '저런', '이렇게', '그렇게', '저렇게',
            '누구', '무엇', '어디', '언제', '어떻게', '왜',

            # 조사 (명사 추출 시 자동 제거되지만 명시)
            '은', '는', '이', '가', '을', '를', '에', '에서', '으로', '로',
            '의', '와', '과', '도', '만', '까지', '부터', '보다',

            # 기타 불용어
            '것', '수', '등', '때', '년', '월', '일', '시', '분',
            '전', '후', '중', '간', '내', '외', '상', '하', '좌', '우',
            '각', '매', '약', '및', '또는', '즉', '단', '예',

            # 뉴스 기사 특유 불용어
            '기자', '취재', '보도', '사진', '영상', '출처', '자료', '제공',
            '통해', '대해', '위해', '따르면', '밝혔다', '전했다', '말했다',
        }

    def _extract_nouns(self, text: str) -> list:
        """
        형태소 분석으로 명사만 추출
        - 명사(NNG, NNP, NNB) 품사만 추출
        - 불용어 제거
        - 2글자 이상만 유지
        """
        try:
            # 품사 태깅 (Kiwi.tokenize)
            tokens = self.kiwi.tokenize(text)

            # 명사만 추출 (NNG: 일반명사, NNP: 고유명사, NNB: 의존명사)
            nouns = [
                token.form for token in tokens
                if token.tag in ['NNG', 'NNP', 'NNB']  # 명사만
                and len(token.form) >= 2  # 2글자 이상
                and token.form not in self.stopwords  # 불용어 제외
                and not token.form.isdigit()  # 숫자 제외
            ]

            return nouns

        except Exception as e:
            print(f"명사 추출 오류: {e}")
            return []

    def extract(self, text: str, top_n: int = 10) -> list:
        """
        단일 텍스트에서 키워드 추출
        """
        try:
            # 1. 명사 추출
            nouns = self._extract_nouns(text)

            if not nouns:
                return []

            # 2. 명사들을 공백으로 연결 (TF-IDF 입력용)
            preprocessed_text = ' '.join(nouns)

            # 3. TF-IDF로 키워드 점수 계산
            vectorizer = TfidfVectorizer(
                max_features=100,
                min_df=1,
                ngram_range=(1, 1)  # 단일 명사만 (이미 전처리 완료)
            )
            tfidf_matrix = vectorizer.fit_transform([preprocessed_text])
            feature_names = vectorizer.get_feature_names_out()
            scores = tfidf_matrix.toarray()[0]

            # 4. 키워드 점수 정렬
            keyword_scores = [(feature_names[i], scores[i])
                            for i in range(len(scores)) if scores[i] > 0]
            keyword_scores.sort(key=lambda x: x[1], reverse=True)

            return keyword_scores[:top_n]

        except Exception as e:
            print(f"키워드 추출 오류: {e}")
            return []

    def extract_from_multiple(self, texts: list, top_n: int = 10) -> dict:
        """
        여러 텍스트에서 키워드 추출
        """
        try:
            # 1. 각 텍스트에서 명사 추출
            preprocessed_texts = []
            for text in texts:
                nouns = self._extract_nouns(text)
                preprocessed_texts.append(' '.join(nouns))

            # 2. TF-IDF
            vectorizer = TfidfVectorizer(
                max_features=100,
                min_df=1,
                ngram_range=(1, 1)
            )
            tfidf_matrix = vectorizer.fit_transform(preprocessed_texts)
            feature_names = vectorizer.get_feature_names_out()

            # 3. 각 텍스트별 키워드 추출
            result = {}
            for idx, text in enumerate(texts):
                scores = tfidf_matrix[idx].toarray()[0]
                keyword_scores = [(feature_names[i], scores[i])
                                for i in range(len(scores)) if scores[i] > 0]
                keyword_scores.sort(key=lambda x: x[1], reverse=True)
                result[idx] = keyword_scores[:top_n]

            return result

        except Exception as e:
            print(f"키워드 추출 오류: {e}")
            return {}


if __name__ == "__main__":
    extractor = KeywordExtractor()

    test_text = """
    정부는 오늘 새로운 경제 정책을 발표했다.
    이번 정책은 경제 성장과 일자리 창출을 목표로 한다.
    야당은 정부의 정책에 대해 비판적인 입장을 보이고 있다.
    전문가들은 이 정책의 효과에 대해 의견이 엇갈리고 있다.
    민주당과 국민의힘이 국회에서 예산안을 논의하고 있으며,
    복지 확대와 일자리 창출이 핵심 쟁점이다.
    """

    print("=" * 60)
    print("키워드 추출 테스트 (형태소 분석 적용)")
    print("=" * 60)

    # 명사 추출 확인
    nouns = extractor._extract_nouns(test_text)
    print(f"\n추출된 명사: {nouns}")

    # 키워드 추출
    keywords = extractor.extract(test_text, top_n=10)

    print(f"\n추출된 키워드 (상위 10개):")
    for i, (keyword, score) in enumerate(keywords, 1):
        print(f"{i}. {keyword}: {score:.3f}")
