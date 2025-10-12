import nodemailer from 'nodemailer';
import logger from '../config/logger';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error('EMAIL_USER and EMAIL_PASSWORD must be set in environment variables');
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // 이메일 인증 코드 전송
  async sendVerificationCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '[FANS] 이메일 인증 코드',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">FANS 이메일 인증</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
              안녕하세요! FANS 회원가입을 위한 이메일 인증 코드입니다.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; background-color: #e3f2fd; padding: 15px 25px; border-radius: 8px; display: inline-block;">
                ${code}
              </span>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">
              위 인증 코드를 입력하여 이메일 인증을 완료해주세요.<br>
              <strong>인증 코드는 5분 후 만료됩니다.</strong>
            </p>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            본 이메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`이메일 인증 코드 전송 완료: ${email}`);
    } catch (error) {
      logger.error('이메일 전송 실패:', error);
      throw new Error('이메일 전송에 실패했습니다.');
    }
  }

  // 비밀번호 재설정 코드 전송
  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '[FANS] 비밀번호 재설정 코드',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">FANS 비밀번호 재설정</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
              비밀번호 재설정을 위한 인증 코드입니다.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #dc3545; letter-spacing: 5px; background-color: #f8d7da; padding: 15px 25px; border-radius: 8px; display: inline-block;">
                ${code}
              </span>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">
              위 인증 코드를 입력하여 비밀번호를 재설정해주세요.<br>
              <strong>인증 코드는 10분 후 만료됩니다.</strong>
            </p>
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="font-size: 14px; color: #856404; margin: 0;">
                <strong>보안 안내:</strong> 본인이 요청하지 않은 경우, 이 이메일을 무시하시고 계정 보안을 위해 비밀번호를 변경해주세요.
              </p>
            </div>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            본 이메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`비밀번호 재설정 코드 전송 완료: ${email}`);
    } catch (error) {
      logger.error('이메일 전송 실패:', error);
      throw new Error('이메일 전송에 실패했습니다.');
    }
  }

  // 인증 이메일 전송 (비밀번호 변경/회원탈퇴)
  async sendVerificationEmail(email: string, subject: string, message: string, code: string): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `[FANS] ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">FANS 인증코드</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
              ${subject}를 위한 인증코드입니다.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #dc3545; letter-spacing: 5px; background-color: #f8d7da; padding: 15px 25px; border-radius: 8px; display: inline-block;">
                ${code}
              </span>
            </div>
            <p style="font-size: 14px; color: #666; text-align: center;">
              위 인증 코드를 입력해주세요.<br>
              <strong>인증 코드는 5분 후 만료됩니다.</strong>
            </p>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            본 이메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`인증 이메일 전송 완료: ${email}`);
    } catch (error) {
      logger.error('인증 이메일 전송 실패:', error);
      throw new Error('이메일 전송에 실패했습니다.');
    }
  }

  // 환영 이메일 전송
  async sendWelcomeEmail(email: string, username: string): Promise<void> {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: '[FANS] 회원가입을 환영합니다!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; text-align: center;">FANS에 오신 것을 환영합니다!</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="font-size: 16px; color: #555; margin-bottom: 20px;">
              안녕하세요, <strong>${username}</strong>님!
            </p>
            <p style="font-size: 14px; color: #666; line-height: 1.6;">
              FANS 회원가입이 성공적으로 완료되었습니다.<br>
              이제 AI 기반 뉴스 요약과 개인화된 뉴스 피드를 이용하실 수 있습니다.
            </p>
            <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #1976d2; margin-top: 0;">FANS 주요 기능</h3>
              <ul style="color: #555; margin: 0; padding-left: 20px;">
                <li>AI 기반 뉴스 요약</li>
                <li>개인화된 뉴스 피드</li>
                <li>실시간 주식 정보</li>
                <li>카테고리별 뉴스 필터링</li>
              </ul>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || 'https://minwoo.shop'}" 
                 style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                FANS 시작하기
              </a>
            </div>
          </div>
          <p style="font-size: 12px; color: #999; text-align: center;">
            본 이메일은 발신 전용입니다. 문의사항이 있으시면 고객센터로 연락해주세요.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      logger.info(`환영 이메일 전송 완료: ${email}`);
    } catch (error) {
      logger.error('환영 이메일 전송 실패:', error);
      // 환영 이메일 실패는 치명적이지 않으므로 에러를 던지지 않음
    }
  }
}
