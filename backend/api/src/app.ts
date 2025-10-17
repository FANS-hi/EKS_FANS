import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import session from 'express-session';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import path from 'path';
const RedisStore = require('connect-redis').default || require('connect-redis');
import { AppDataSource } from './config/database';
import logger from './config/logger';
import aiRoutes from './routes/ai';
import newsRoutes from './routes/news';
import commonRoutes from './routes/common';
import marketSummaryRoutes from "./routes/marketSummary";
import authRoutes from './routes/auth';
import userInteractionsRoutes from './routes/userInteractions';
import subscriptionRoutes from './routes/subscription';
import commentsRoutes from './routes/comments';
const envPath = path.resolve(__dirname, '../.env');
logger.debug(`Loading .env from: ${envPath}`);
const dotenvResult = dotenv.config({ path: envPath });
logger.debug(`Dotenv result: ${dotenvResult.error ? dotenvResult.error.message : 'SUCCESS'}`);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(helmet({
  contentSecurityPolicy: false, // CSP 완전히 비활성화
  crossOriginResourcePolicy: false, // CORP 비활성화
}));
// CORS 설정 - 환경변수에서 허용 origin 가져오기
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Type', 'Content-Length']
}));
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis 클라이언트 설정
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
redisClient.on('connect', () => logger.info('✅ Redis connected'));

redisClient.connect().catch(console.error);

// Redis 세션 스토어 설정
const redisStore = new RedisStore({
  client: redisClient,
  prefix: 'fans:sess:',
});

// 세션 설정
app.use(session({
  store: redisStore,
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  name: 'fans.sid', // 명확한 쿠키 이름
  resave: false,
  saveUninitialized: true, // OAuth를 위해 true로 변경
  cookie: {
    secure: false, // CloudFront -> ALB는 HTTP이므로 false
    httpOnly: true,
    sameSite: 'lax', // OAuth redirect를 위해 lax
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
    path: '/',
    domain: undefined // 명시적으로 undefined
  }
}));

app.use(express.static(path.join(__dirname, '../public')));

// 이미지 파일에 CORS 헤더 추가
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static(path.join(__dirname, '../uploads')));

app.get('/', (req, res) => {
  res.json({
    message: 'FANS API Server',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      news: '/news',
      api: '/api'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FANS Main API'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userInteractionsRoutes);
app.use('/api/user', subscriptionRoutes);
app.use('/api', aiRoutes);
app.use('/api', commonRoutes);
app.use('/api', newsRoutes);
app.use("/api/market", marketSummaryRoutes);
app.use('/api', commentsRoutes);


async function startServer() {
  try {
    await AppDataSource.initialize();
    logger.info('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'https://www.fans.ai.kr'}`);
    });
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

startServer();

export default app;