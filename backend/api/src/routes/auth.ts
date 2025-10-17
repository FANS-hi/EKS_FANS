import { Router, Request, Response } from 'express';
import { validate } from 'class-validator';
import { AuthService } from '../services/authService';
import {
  RegisterDto,
  LoginDto,
  PasswordResetRequestDto,
  PasswordResetDto,
  DeleteAccountDto,
} from '../dto/auth.dto';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import logger from '../config/logger';

const router = Router();
const authService = new AuthService();

/* ==================== multer (프로필 이미지) ==================== */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    if (ok) {
      cb(null, ok);
    } else {
      cb(new Error('이미지 파일만 업로드 가능합니다.'));
    }
  },
});

/* ==================== 회원가입/로그인 ==================== */
router.post('/register', async (req, res) => {
  try {
    const dto = Object.assign(new RegisterDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: errors.map(e => ({ field: e.property, message: Object.values(e.constraints || {})[0] })),
      });
    }
    const result = await authService.register(dto);
    return res.status(201).json({
      success: true,
      message: result.message,
      data: {
        user: result.user,
        token: result.token
      }
    });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '회원가입 실패' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const dto = Object.assign(new LoginDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) return res.status(400).json({ success: false, error: '입력 데이터 오류' });

    const result = await authService.login(dto);
    (req.session as any).userId = result.user.id;
    (req.session as any).username = result.user.username;
    (req.session as any).isAuthenticated = true;

    return res.json({
      success: true,
      message: result.message,
      data: { user: result.user, token: result.token },
    });
  } catch (e: any) {
    return res.status(401).json({ success: false, error: e.message || '로그인 실패' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false, error: '로그아웃 실패' });
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: '로그아웃 완료' });
  });
});

/* ==================== 비밀번호 재설정 ==================== */
router.post('/request-password-reset', async (req, res) => {
  try {
    const dto = Object.assign(new PasswordResetRequestDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) return res.status(400).json({ success: false, error: '이메일 오류' });
    const result = await authService.requestPasswordReset(dto.email);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '요청 실패' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const dto = Object.assign(new PasswordResetDto(), req.body);
    const errors = await validate(dto);
    if (errors.length > 0) return res.status(400).json({ success: false, error: '입력 오류' });
    const result = await authService.resetPassword(dto);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '실패' });
  }
});

/* ==================== 소셜 로그인 ==================== */
// SPA에서 Kakao/Naver 로그인 시작 URL을 먼저 요청할 수 있도록 별도 엔드포인트 제공
router.get('/kakao/start', async (req, res) => {
  try {
    const authUrl = await authService.startKakaoLogin(req.session);
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return res.json({ success: true, data: { redirectUrl: authUrl } });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '카카오 로그인 초기화 실패' });
  }
});

// 카카오 시작 → 즉시 redirect
router.get('/kakao', async (req, res) => {
  try {
    const authUrl = await authService.startKakaoLogin(req.session);
    return res.redirect(authUrl);
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '카카오 로그인 실패' });
  }
});

router.get('/kakao/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const result = await authService.handleKakaoCallback(req.session, String(code), String(state || ''));
    (req.session as any).userId = result.user.id;
    (req.session as any).username = result.user.username;
    (req.session as any).isAuthenticated = true;

    const frontendUrl = process.env.FRONTEND_URL || 'https://www.fans.ai.kr';
    return res.redirect(`${frontendUrl}/login-success?token=${encodeURIComponent(result.token)}`);
  } catch (e: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.fans.ai.kr';

    // 신규 사용자인 경우 등록 페이지로 리다이렉트
    if (e.message.startsWith('NEW_USER:')) {
      const userData = e.message.substring(9); // 'NEW_USER:' 제거
      return res.redirect(`${frontendUrl}/register?kakao=${encodeURIComponent(userData)}`);
    }

    return res.redirect(`${frontendUrl}/login-error?error=${encodeURIComponent(e.message)}`);
  }
});

router.get('/naver/start', async (req, res) => {
  try {
    const authUrl = await authService.startNaverLogin(req.session);
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    return res.json({ success: true, data: { redirectUrl: authUrl } });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '네이버 로그인 초기화 실패' });
  }
});

// 네이버 시작 → 즉시 redirect
router.get('/naver', async (req, res) => {
  try {
    const authUrl = await authService.startNaverLogin(req.session);
    return res.redirect(authUrl);
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '네이버 로그인 실패' });
  }
});

router.get('/naver/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send('Missing code');

    const result = await authService.handleNaverCallback(req.session, String(code), String(state || ''));
    (req.session as any).userId = result.user.id;
    (req.session as any).username = result.user.username;
    (req.session as any).isAuthenticated = true;

    const frontendUrl = process.env.FRONTEND_URL || 'https://www.fans.ai.kr';
    return res.redirect(`${frontendUrl}/login-success?token=${encodeURIComponent(result.token)}`);
  } catch (e: any) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://www.fans.ai.kr';

    // 신규 네이버 사용자인 경우 회원가입 페이지로 리다이렉트
    if (e.message.startsWith('NEW_USER:')) {
      const userData = e.message.substring(9);
      return res.redirect(`${frontendUrl}/register?naver=${encodeURIComponent(userData)}`);
    }

    return res.redirect(`${frontendUrl}/login-error?error=${encodeURIComponent(e.message)}`);
  }
});

/* ==================== 토큰 검증 (❗프론트에서 사용) ==================== */
router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? '';
    const token = (req.body && req.body.token) || bearer;
    if (!token) return res.status(400).json({ success: false, error: '토큰이 필요합니다.' });

    const user = await authService.verifyToken(token);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.userName,
          phone: user.tel,
          profileImage: user.profileImage,
          emailVerified: user.emailVerified,
          provider: user.provider,
          socialToken: user.socialToken,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin,
        },
      },
    });
  } catch (e: any) {
    return res.status(401).json({ success: false, error: '유효하지 않은 토큰입니다.' });
  }
});

/* ==================== 프로필 ==================== */
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.getUserProfile(userId);
    if (!user) return res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });

    return res.json({
      success: true,
      data: {
        user: {
          ...user,
          hasPassword: !!user.passwordHash, // 비밀번호 설정 여부 추가
        }
      },
    });
  } catch (e: any) {
    logger.error('Profile API error:', e);
    return res.status(500).json({ success: false, error: '프로필 조회 중 오류가 발생했습니다.' });
  }
});

router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.updateUserProfile(userId, req.body);
    return res.json({ success: true, message: '프로필이 성공적으로 업데이트되었습니다.', data: { user } });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '프로필 업데이트 실패' });
  }
});

/* ==================== 프로필 이미지 ==================== */
router.post(
  '/upload-profile-image',
  authenticateToken,
  upload.single('profileImage'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.userId;
      if (!req.file) return res.status(400).json({ success: false, error: '이미지 필요' });

      const relativePath = `/uploads/profiles/${req.file.filename}`;
      const user = await authService.updateUserProfile(userId, { profileImage: relativePath });
      return res.json({ success: true, data: { profileImage: relativePath, user } });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e.message || '업로드 실패' });
    }
  }
);

router.delete('/delete-profile-image', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.userId;
    const user = await authService.getUserProfile(userId);
    if (user?.profileImage) {
      const imagePath = path.join(__dirname, '../../', user.profileImage);
      if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    }
    await authService.updateUserProfile(userId, { profileImage: null });
    return res.json({ success: true, message: '프로필 이미지 삭제 완료' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e.message || '삭제 실패' });
  }
});

/* ==================== 프로필 셋업 ==================== */
router.post('/setup-profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { age, gender, location, preferredCategories, preferredSources } = req.body;

    // user_preferences 테이블에 프로필 정보 저장
    const result = await authService.setupUserProfile(userId, {
      age,
      gender,
      location,
      preferredCategories,
      preferredSources
    });

    return res.json({
      success: true,
      message: '프로필 설정이 완료되었습니다.',
      data: result
    });
  } catch (e: any) {
    return res.status(400).json({
      success: false,
      error: e.message || '프로필 설정 실패'
    });
  }
});

router.get('/preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const preferences = await authService.getUserPreferences(userId);

    return res.json({
      success: true,
      data: preferences
    });
  } catch (e: any) {
    return res.status(500).json({
      success: false,
      error: '사용자 선호도 조회 중 오류가 발생했습니다.'
    });
  }
});

router.put('/preferences', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { age, gender, location, preferredCategories, preferredSources } = req.body;

    const result = await authService.updateUserPreferences(userId, {
      age,
      gender,
      location,
      preferredCategories,
      preferredSources
    });

    return res.json({
      success: true,
      message: '선호도가 업데이트되었습니다.',
      data: result
    });
  } catch (e: any) {
    return res.status(400).json({
      success: false,
      error: e.message || '선호도 업데이트 실패'
    });
  }
});

/* ==================== 이메일 인증 ==================== */
router.post('/send-verification-email', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { type } = req.body; // 'password' 또는 'delete'

    if (!type || !['password', 'delete'].includes(type)) {
      return res.status(400).json({ success: false, error: '유효하지 않은 인증 타입입니다.' });
    }

    const result = await authService.sendVerificationEmail(userId, type);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '인증 이메일 발송 실패' });
  }
});

router.post('/verify-email-code', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, code, type } = req.body;

    if (!email || !code || !type) {
      return res.status(400).json({ success: false, error: '필수 정보가 누락되었습니다.' });
    }

    const result = await authService.verifyEmailCode(email, code, type);
    if (result.valid) {
      return res.json({ success: true, message: '인증이 완료되었습니다.' });
    } else {
      return res.status(400).json({ success: false, error: '인증코드가 올바르지 않거나 만료되었습니다.' });
    }
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '인증 실패' });
  }
});

/* ==================== 비밀번호 변경 ==================== */
router.post('/change-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword, confirmPassword, verificationCode } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword || !verificationCode) {
      return res.status(400).json({ success: false, error: '필수 정보가 누락되었습니다.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: '새 비밀번호가 일치하지 않습니다.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }

    // 인증코드 검증은 프론트엔드에서 먼저 수행된다고 가정
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '비밀번호 변경 실패' });
  }
});

/* ==================== 소셜 로그인 사용자 비밀번호 설정/변경 ==================== */
router.post('/set-social-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, error: '새 비밀번호를 입력해주세요.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: '새 비밀번호가 일치하지 않습니다.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: '비밀번호는 최소 8자 이상이어야 합니다.' });
    }

    // 이메일 인증 없이 현재 비밀번호 확인만으로 변경
    const result = await authService.setSocialUserPassword(userId, currentPassword || null, newPassword);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '비밀번호 설정/변경 실패' });
  }
});

/* ==================== 회원탈퇴 ==================== */
router.delete('/delete-account', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const dto = Object.assign(new DeleteAccountDto(), req.body);
    const result = await authService.deleteAccount(userId, dto);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '회원탈퇴 실패' });
  }
});

/* ==================== 소셜 로그인 회원탈퇴 (인증코드 없이) ==================== */
router.delete('/delete-social-account', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { confirmText } = req.body;

    if (!confirmText) {
      return res.status(400).json({ success: false, error: '확인 문구가 필요합니다.' });
    }

    const result = await authService.deleteSocialAccount(userId, confirmText);
    return res.json({ success: true, message: result.message });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e.message || '소셜 계정 탈퇴 실패' });
  }
});

export default router;
