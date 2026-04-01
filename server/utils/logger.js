import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sistema de logging estructurado para MateBudy
 * Reemplaza console.log con logs estructurados y nivelados
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

const LOG_COLORS = {
  error: '\x1b[31m',  // Rojo
  warn: '\x1b[33m',   // Amarillo
  info: '\x1b[36m',   // Cyan
  http: '\x1b[32m',   // Verde
  verbose: '\x1b[35m', // Magenta
  debug: '\x1b[34m',  // Azul
  silly: '\x1b[90m',  // Gris
  reset: '\x1b[0m',
};

class Logger {
  constructor(options = {}) {
    this.level = options.level || process.env.LOG_LEVEL || 'info';
    this.logFile = options.logFile || process.env.LOG_FILE;
    this.service = options.service || 'matebudy-server';
    this.levelNum = LOG_LEVELS[this.level] ?? LOG_LEVELS.info;
    
    // Crear directorio de logs si no existe
    if (this.logFile) {
      const logDir = path.dirname(this.logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * Formatea el mensaje de log
   */
  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: this.service,
      message,
      ...meta,
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Escribe el log en consola y archivo
   */
  _log(level, message, meta = {}) {
    const levelNum = LOG_LEVELS[level] ?? LOG_LEVELS.info;
    
    // Verificar si el nivel debe ser logueado
    if (levelNum > this.levelNum) {
      return;
    }

    const formattedMessage = this._formatMessage(level, message, meta);
    const color = LOG_COLORS[level] || LOG_COLORS.reset;
    
    // Log en consola con colores
    const consoleMessage = `${color}[${level.toUpperCase()}]${LOG_COLORS.reset} ${new Date().toISOString()} - ${message}${
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    }`;
    
    if (level === 'error') {
      console.error(consoleMessage);
    } else if (level === 'warn') {
      console.warn(consoleMessage);
    } else {
      console.log(consoleMessage);
    }

    // Log en archivo
    if (this.logFile) {
      this._writeToFile(formattedMessage);
    }
  }

  /**
   * Escribe en el archivo de log
   */
  _writeToFile(message) {
    try {
      const logLine = message + '\n';
      fs.appendFileSync(this.logFile, logLine, 'utf8');
    } catch (error) {
      console.error('[Logger] Error writing to log file:', error);
    }
  }

  /**
   * Logs de error
   */
  error(message, meta = {}) {
    this._log('error', message, meta);
  }

  /**
   * Logs de advertencia
   */
  warn(message, meta = {}) {
    this._log('warn', message, meta);
  }

  /**
   * Logs de información general
   */
  info(message, meta = {}) {
    this._log('info', message, meta);
  }

  /**
   * Logs de peticiones HTTP
   */
  http(message, meta = {}) {
    this._log('http', message, meta);
  }

  /**
   * Logs verbosos
   */
  verbose(message, meta = {}) {
    this._log('verbose', message, meta);
  }

  /**
   * Logs de debug
   */
  debug(message, meta = {}) {
    this._log('debug', message, meta);
  }

  /**
   * Logs muy detallados
   */
  silly(message, meta = {}) {
    this._log('silly', message, meta);
  }

  /**
   * Crea un logger hijo con contexto adicional
   */
  child(context) {
    return new ChildLogger(this, context);
  }
}

class ChildLogger {
  constructor(parent, context) {
    this.parent = parent;
    this.context = context || {};
  }

  _withContext(meta) {
    return { ...this.context, ...meta };
  }

  error(message, meta = {}) {
    this.parent.error(message, this._withContext(meta));
  }

  warn(message, meta = {}) {
    this.parent.warn(message, this._withContext(meta));
  }

  info(message, meta = {}) {
    this.parent.info(message, this._withContext(meta));
  }

  http(message, meta = {}) {
    this.parent.http(message, this._withContext(meta));
  }

  verbose(message, meta = {}) {
    this.parent.verbose(message, this._withContext(meta));
  }

  debug(message, meta = {}) {
    this.parent.debug(message, this._withContext(meta));
  }

  silly(message, meta = {}) {
    this.parent.silly(message, this._withContext(meta));
  }
}

/**
 * Middleware de logging para Express
 */
export function createExpressLogger(logger) {
  return function expressLogger(req, res, next) {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.http(`${req.method} ${req.url}`, {
        method: req.method,
        url: req.url,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
    });

    next();
  };
}

/**
 * Manejador de errores global con logging
 */
export function createErrorHandler(logger) {
  return function errorHandler(err, req, res, next) {
    logger.error('Error no manejado', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
    });

    // No enviar stack trace en producción
    const errorResponse = {
      error: err.message || 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    };

    res.status(err.status || 500).json(errorResponse);
  };
}

// Logger por defecto
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  logFile: process.env.LOG_FILE,
  service: 'matebudy-server',
});

export default defaultLogger;
export { Logger };
