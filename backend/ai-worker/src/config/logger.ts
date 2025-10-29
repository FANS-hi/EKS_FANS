/**
 * 간단한 로거
 */

const logger = {
  info: (...args: any[]) => {
    console.log(`[INFO] ${new Date().toISOString()}`, ...args);
  },
  warn: (...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()}`, ...args);
  },
  error: (...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()}`, ...args);
  },
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()}`, ...args);
    }
  },
};

export default logger;
