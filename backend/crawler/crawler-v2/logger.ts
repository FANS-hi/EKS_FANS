/**
 * 간단한 로거 (상대경로 의존성 제거용)
 * Winston 대신 console 기반
 */

const logger = {
  info: (msg: string, ...args: any[]) => {
    console.log(`[INFO] ${msg}`, ...args);
  },

  warn: (msg: string, ...args: any[]) => {
    console.warn(`[WARN] ${msg}`, ...args);
  },

  error: (msg: string, ...args: any[]) => {
    console.error(`[ERROR] ${msg}`, ...args);
  },

  debug: (msg: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEBUG] ${msg}`, ...args);
    }
  }
};

export default logger;
