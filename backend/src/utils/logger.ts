import { format, createLogger, transports } from "winston";
import { key } from "../config/key";
import { MongoDB } from "winston-mongodb";

const { combine, timestamp, label, colorize, printf } = format;

const customFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const logger = createLogger({
  level: "info",
  format: combine(
    colorize({ all: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    customFormat
  ),
  defaultMeta: { service: "content-recommendation" },
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "combine.log" }),
  ],
  // Uncomment if needed:
  exceptionHandlers: [
    new transports.Console(),
    new MongoDB({
      db: key.MONGO_URI!,
      options: {},
      collection: "exceptions"
    })
  ],
  rejectionHandlers: [
    new transports.Console(),
    new MongoDB({
      db: key.MONGO_URI!,
      options: {},
      collection: "rejections"
    })
  ]
});
if (process.env.NODE_ENV !== "production") {
  logger.add(new transports.Console({ format: format.simple() }));
}

export { logger as Logger }