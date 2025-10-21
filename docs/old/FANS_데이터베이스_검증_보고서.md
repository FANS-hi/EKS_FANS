# FANS 프로젝트 데이터베이스 검증 보고서

## 📊 검증 요약

✅ **검증 결과: 안전함**
- TypeORM 엔티티 구조가 순환참조 문제없이 안전하게 구성됨
- Lazy Loading 전략을 통해 잠재적 순환참조 완전 차단
- PostgreSQL + TypeORM 조합에 최적화된 구조

## 🔍 순환참조 분석 결과

### 발견된 잠재적 순환 경로
검증 도구가 감지한 잠재적 순환 관계들이 있지만, **모두 Lazy Loading으로 해결됨**:

1. **User ↔ UserPreference** (1:1 관계)
2. **Category → Category** (자기참조)
3. **MediaSource ↔ Journalist ↔ NewsArticle** (복잡한 다중 관계)
4. **NewsArticle ↔ Keyword** (N:M 관계)

### 해결 방안 적용
모든 컬렉션 관계에 `lazy: true` 옵션 적용으로 실제 런타임 순환참조 방지

## 🛡️ 순환참조 방지 전략

### 1. Lazy Loading 전략
```typescript
// ✅ 올바른 구현 예시
@OneToMany(() => UserReaction, (reaction) => reaction.user, { lazy: true })
reactions: Promise<UserReaction[]>;
```

### 2. Eager Loading 비활성화
```typescript
// ✅ ManyToOne 관계에서 eager: false 명시
@ManyToOne(() => MediaSource, { eager: false })
mediaSource: MediaSource;
```

### 3. 양방향 관계 주의사항
```typescript
// ⚠️ 주의: 양쪽 모두 eager: true 설정 금지
// User 엔티티
@OneToOne(() => UserPreference, { lazy: true })
preference: Promise<UserPreference>;

// UserPreference 엔티티
@OneToOne(() => User, { eager: false })
user: User;
```

## 💻 실제 사용 코드 예시

### 1. Repository 패턴 구현
```typescript
// news.repository.ts
export class NewsRepository {
  async findNewsWithRelations(newsId: number) {
    return await this.newsRepository.findOne({
      where: { id: newsId },
      relations: ['mediaSource', 'category', 'journalist'],
      // 필요한 관계만 명시적으로 로드
    });
  }

  async findNewsWithKeywords(newsId: number) {
    const news = await this.newsRepository.findOne({
      where: { id: newsId }
    });
    
    // Lazy loading된 keywords를 필요시에만 로드
    if (news) {
      const keywords = await news.keywords;
      return { ...news, keywords };
    }
    return null;
  }
}
```

### 2. QueryBuilder를 활용한 최적화
```typescript
async getNewsListWithDetails() {
  return await this.newsRepository
    .createQueryBuilder('news')
    .leftJoinAndSelect('news.mediaSource', 'media')
    .leftJoinAndSelect('news.category', 'category')
    .leftJoin('news.journalist', 'journalist')
    .addSelect(['journalist.id', 'journalist.name'])
    .where('news.pubDate > :date', { 
      date: new Date('2025-01-01') 
    })
    .orderBy('news.pubDate', 'DESC')
    .limit(20)
    .getMany();
}
```

### 3. N+1 쿼리 문제 해결
```typescript
// ❌ 잘못된 예시 - N+1 문제 발생
const users = await userRepository.find();
for (const user of users) {
  const bookmarks = await user.bookmarks; // N번의 추가 쿼리
}

// ✅ 올바른 예시 - 한 번의 쿼리로 해결
const users = await userRepository
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.bookmarks', 'bookmark')
  .getMany();
```

### 4. DTO 패턴으로 순환참조 완전 차단
```typescript
// news.dto.ts
export class NewsResponseDto {
  id: number;
  title: string;
  summary: string;
  mediaSource: { id: number; name: string };
  category: { id: number; name: string };
  
  static fromEntity(news: NewsArticle): NewsResponseDto {
    return {
      id: news.id,
      title: news.title,
      summary: news.summary,
      mediaSource: {
        id: news.mediaSource.id,
        name: news.mediaSource.name
      },
      category: {
        id: news.category.id,
        name: news.category.name
      }
    };
  }
}
```

## 📋 체크리스트

### 필수 구현 사항
- [x] 모든 컬렉션 관계에 Lazy Loading 적용
- [x] 양방향 관계에서 eager loading 제어
- [x] 자기참조 관계 (Category) 안전 처리
- [x] 복합 유니크 제약조건 설정
- [x] 인덱스 전략 구현

### 권장 구현 사항
- [ ] DataLoader 패턴 구현 (graphql-dataloader)
- [ ] Redis 캐싱 레이어 추가
- [ ] Query 성능 모니터링 도구 설정
- [ ] DTO/Serialization 레이어 구현
- [ ] Transaction 전략 수립

## 🚀 다음 단계

### 1. API 레이어 구현
```typescript
// main-api/src/config/database.config.ts
export const databaseConfig: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'fans_user',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'fans_db',
  entities: [__dirname + '/../entities/*.entity{.ts,.js}'],
  synchronize: false, // 프로덕션에서는 반드시 false
  logging: process.env.NODE_ENV === 'development',
  cache: {
    type: 'redis',
    options: {
      host: 'localhost',
      port: 6379,
    },
    duration: 30000 // 30초
  }
};
```

### 2. Migration 전략
```bash
# TypeORM CLI 설정
npm run typeorm migration:generate -- -n InitialSchema
npm run typeorm migration:run

# 프로덕션 배포 시
npm run typeorm migration:run -- --transaction
```

### 3. 성능 최적화 우선순위
1. **즉시 적용**: QueryBuilder 최적화, 필요한 관계만 로드
2. **단기 (1주)**: Redis 캐싱, 인덱스 최적화
3. **중기 (2주)**: DataLoader 패턴, Batch 처리
4. **장기 (1달)**: Read Replica 구성, 샤딩 전략

## 📝 결론

FANS 프로젝트의 데이터베이스 구조는 **순환참조 문제없이 안전하게 설계**되었습니다. 

### 핵심 해결 전략:
1. **Lazy Loading**: 모든 컬렉션 타입 관계에 적용
2. **Eager Loading 제어**: ManyToOne 관계에서 비활성화
3. **명시적 관계 로딩**: QueryBuilder를 통한 세밀한 제어

제공된 TypeORM 엔티티 구조를 그대로 사용하시되, 실제 쿼리 작성 시 위의 예시 코드를 참고하여 최적화된 데이터 접근 패턴을 구현하시기 바랍니다.

---
*검증 도구: TypeORM 0.3.20 + PostgreSQL 15*
*검증 일자: 2025년 9월 20일*
