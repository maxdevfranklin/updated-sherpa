/**
 * Simple logger utility for consistent logging across the application
 */
export const logger = {
  log: (message: string, ...args: any[]) => {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, ...args);
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[${new Date().toISOString()}] WARN: ${message}`, ...args);
  },
  
  info: (message: string, ...args: any[]) => {
    console.info(`[${new Date().toISOString()}] INFO: ${message}`, ...args);
  }
};