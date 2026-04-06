const pino = require('pino');

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';

const logger = pino({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    base: {
        env: process.env.NODE_ENV,
    },
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
});

module.exports = logger;
