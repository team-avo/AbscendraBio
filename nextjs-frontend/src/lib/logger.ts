import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

const baseLogger = pino({
    level: process.env.NEXT_PUBLIC_LOG_LEVEL || 'info',
    browser: {
        asObject: true,
    },
});

export interface Logger {
    info(msg: string, obj?: any): void;
    error(msg: string, obj?: any): void;
    warn(msg: string, obj?: any): void;
    debug(msg: string, obj?: any): void;
    trace(msg: string, obj?: any): void;
}

const logger: Logger = {
    info: (msg: string, obj?: any) => obj ? baseLogger.info(obj, msg) : baseLogger.info(msg),
    error: (msg: string, obj?: any) => obj ? baseLogger.error(obj, msg) : baseLogger.error(msg),
    warn: (msg: string, obj?: any) => obj ? baseLogger.warn(obj, msg) : baseLogger.warn(msg),
    debug: (msg: string, obj?: any) => obj ? baseLogger.debug(obj, msg) : baseLogger.debug(msg),
    trace: (msg: string, obj?: any) => obj ? baseLogger.trace(obj, msg) : baseLogger.trace(msg),
};

export default logger;
