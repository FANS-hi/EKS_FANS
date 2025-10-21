import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './User';

@Entity('user_recommendations')
export class UserRecommendation {
    @PrimaryColumn({ type: 'bigint', name: 'user_id' })
    userId: number;

    @Column({ type: 'jsonb', name: 'recommended_article_ids' })
    recommendedArticleIds: number[];

    @Column({ type: 'jsonb', name: 'recommendation_scores' })
    recommendationScores: object;

    @CreateDateColumn({ type: 'timestamptz', name: 'generated_at' })
    generatedAt: Date;

    @Column({ type: 'timestamptz', name: 'expires_at' })
    expiresAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;

    // 관계 설정
    @OneToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;
}
