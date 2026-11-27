import winston from 'winston';

/**
 * Safely serializes log metadata, replacing circular references and formatting Error/BigInt values.
 */
export const safeJsonStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') {
        return currentValue.toString();
      }
      if (currentValue instanceof Error) {
        const errorObj: Record<string, unknown> = {
          name: currentValue.name,
          message: currentValue.message,
          stack: currentValue.stack,
        };
        for (const prop of Object.keys(currentValue)) {
          errorObj[prop] = (currentValue as unknown as Record<string, unknown>)[prop];
        }
        return errorObj;
      }
      if (typeof currentValue === 'object' && currentValue !== null) {
        if (seen.has(currentValue)) {
          return '[Circular]';
        }
        seen.add(currentValue);
      }
      return currentValue;
    });
  } catch {
    return String(value);
  }
};

export const createLogger = (serviceName: string) => {
  const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  );

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: serviceName },
    format,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            (info) => {
              const { timestamp, level, message, service, ...meta } = info;
              return `[${timestamp}] [${service}] ${level}: ${message} ${
                Object.keys(meta).length ? safeJsonStringify(meta) : ''
              }`;
            }
          )
        ),
      }),
    ],
  });
};
