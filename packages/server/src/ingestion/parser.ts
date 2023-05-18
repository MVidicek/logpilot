import { LogLevel, ParsedLog } from '../types/log';

// Nginx combined log format:
// 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.1" 200 2326 "http://www.example.com/start.html" "Mozilla/4.08"
const NGINX_REGEX =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+(\S+)"\s+(\d{3})\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"/;

// Apache Common Log Format:
// 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.1" 200 2326
const APACHE_COMMON_REGEX =
  /^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+(\S+)"\s+(\d{3})\s+(\d+)/;

// Syslog RFC 5424:
// <34>1 2023-06-01T12:00:00.000Z hostname app-name 1234 - - message
const SYSLOG_RFC5424_REGEX =
  /^<(\d{1,3})>(\d)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S*)\s*(.*)/;

// Syslog RFC 3164 (BSD):
// <34>Oct  1 12:00:00 hostname app[1234]: message
const SYSLOG_BSD_REGEX =
  /^<(\d{1,3})>(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+(\S+)\s+(\S+?)(?:\[(\d+)\])?:\s*(.*)/;

const SYSLOG_SEVERITY_MAP: Record<number, LogLevel> = {
  0: 'fatal',  // Emergency
  1: 'fatal',  // Alert
  2: 'fatal',  // Critical
  3: 'error',  // Error
  4: 'warn',   // Warning
  5: 'info',   // Notice
  6: 'info',   // Informational
  7: 'debug',  // Debug
};

function httpStatusToLevel(status: number): LogLevel {
  if (status >= 500) return 'error';
  if (status >= 400) return 'warn';
  return 'info';
}

function parseNginxTimestamp(raw: string): Date {
  // 10/Oct/2000:13:55:36 -0700
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  };
  const match = raw.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})/);
  if (!match) return new Date();
  const [, day, mon, year, time, tz] = match;
  const monthNum = months[mon] || '01';
  return new Date(`${year}-${monthNum}-${day}T${time}${tz.slice(0, 3)}:${tz.slice(3)}`);
}

export function detectFormat(raw: string): 'json' | 'nginx' | 'apache' | 'syslog_rfc5424' | 'syslog_bsd' | 'plain' {
  const trimmed = raw.trim();

  // JSON detection
  if (trimmed.startsWith('{')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, continue
    }
  }

  // Syslog RFC 5424
  if (SYSLOG_RFC5424_REGEX.test(trimmed)) return 'syslog_rfc5424';

  // Syslog BSD
  if (SYSLOG_BSD_REGEX.test(trimmed)) return 'syslog_bsd';

  // Nginx (superset of Apache common, check first since it has more fields)
  if (NGINX_REGEX.test(trimmed)) return 'nginx';

  // Apache Common
  if (APACHE_COMMON_REGEX.test(trimmed)) return 'apache';

  return 'plain';
}

export function parseJSON(raw: string): ParsedLog {
  const obj = JSON.parse(raw);

  // Extract level from common field names
  const levelRaw = (
    obj.level || obj.severity || obj.loglevel || obj.log_level || 'info'
  ).toString().toLowerCase();

  const level = normalizeLevel(levelRaw);

  // Extract message from common field names
  const message = (
    obj.message || obj.msg || obj.text || obj.log || JSON.stringify(obj)
  ).toString();

  // Extract timestamp
  let timestamp: Date | null = null;
  const tsRaw = obj.timestamp || obj.time || obj.ts || obj['@timestamp'] || obj.datetime;
  if (tsRaw) {
    const parsed = new Date(typeof tsRaw === 'number' ? tsRaw * 1000 : tsRaw);
    if (!isNaN(parsed.getTime())) timestamp = parsed;
  }

  // Extract source
  const source = (
    obj.source || obj.service || obj.app || obj.application || obj.hostname || ''
  ).toString();

  // Remaining fields as metadata
  const skipKeys = new Set([
    'level', 'severity', 'loglevel', 'log_level',
    'message', 'msg', 'text', 'log',
    'timestamp', 'time', 'ts', '@timestamp', 'datetime',
    'source', 'service', 'app', 'application', 'hostname',
  ]);

  const metadata: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (!skipKeys.has(key) && val !== undefined && val !== null) {
      metadata[key] = typeof val === 'string' ? val : JSON.stringify(val);
    }
  }

  return { timestamp, level, message, source, metadata };
}

export function parseNginx(raw: string): ParsedLog {
  const match = raw.match(NGINX_REGEX);
  if (!match) {
    return { timestamp: null, level: 'info', message: raw, source: '', metadata: {} };
  }

  const [, remoteAddr, , remoteUser, timeLocal, method, path, protocol, statusStr, bytesStr, referer, userAgent] = match;
  const status = parseInt(statusStr, 10);
  const bytes = parseInt(bytesStr, 10);
  const timestamp = parseNginxTimestamp(timeLocal);

  return {
    timestamp,
    level: httpStatusToLevel(status),
    message: `${method} ${path} ${status}`,
    source: remoteAddr,
    metadata: {
      remote_addr: remoteAddr,
      remote_user: remoteUser === '-' ? '' : remoteUser,
      method,
      path,
      protocol,
      status: statusStr,
      bytes_sent: bytesStr,
      referer: referer === '-' ? '' : referer,
      user_agent: userAgent,
      bytes: bytes.toString(),
    },
  };
}

export function parseApache(raw: string): ParsedLog {
  const match = raw.match(APACHE_COMMON_REGEX);
  if (!match) {
    return { timestamp: null, level: 'info', message: raw, source: '', metadata: {} };
  }

  const [, remoteAddr, , remoteUser, timeLocal, method, path, protocol, statusStr, bytesStr] = match;
  const status = parseInt(statusStr, 10);
  const timestamp = parseNginxTimestamp(timeLocal);

  return {
    timestamp,
    level: httpStatusToLevel(status),
    message: `${method} ${path} ${status}`,
    source: remoteAddr,
    metadata: {
      remote_addr: remoteAddr,
      remote_user: remoteUser === '-' ? '' : remoteUser,
      method,
      path,
      protocol,
      status: statusStr,
      bytes_sent: bytesStr,
    },
  };
}

export function parseSyslogRFC5424(raw: string): ParsedLog {
  const match = raw.match(SYSLOG_RFC5424_REGEX);
  if (!match) {
    return { timestamp: null, level: 'info', message: raw, source: '', metadata: {} };
  }

  const [, priStr, version, timestamp, hostname, appName, procId, msgId, , message] = match;
  const pri = parseInt(priStr, 10);
  const severity = pri & 0x07;
  const facility = pri >> 3;

  let ts: Date | null = null;
  if (timestamp !== '-') {
    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) ts = parsed;
  }

  return {
    timestamp: ts,
    level: SYSLOG_SEVERITY_MAP[severity] || 'info',
    message: message || '',
    source: hostname === '-' ? '' : hostname,
    metadata: {
      facility: facility.toString(),
      severity: severity.toString(),
      app_name: appName === '-' ? '' : appName,
      proc_id: procId === '-' ? '' : procId,
      msg_id: msgId === '-' ? '' : msgId,
      version,
    },
  };
}

export function parseSyslogBSD(raw: string): ParsedLog {
  const match = raw.match(SYSLOG_BSD_REGEX);
  if (!match) {
    return { timestamp: null, level: 'info', message: raw, source: '', metadata: {} };
  }

  const [, priStr, month, day, time, hostname, appName, pid, message] = match;
  const pri = parseInt(priStr, 10);
  const severity = pri & 0x07;
  const facility = pri >> 3;

  // Construct approximate timestamp (no year in BSD syslog)
  const year = new Date().getFullYear();
  const ts = new Date(`${month} ${day}, ${year} ${time}`);

  return {
    timestamp: isNaN(ts.getTime()) ? null : ts,
    level: SYSLOG_SEVERITY_MAP[severity] || 'info',
    message: message || '',
    source: hostname,
    metadata: {
      facility: facility.toString(),
      severity: severity.toString(),
      app_name: appName,
      pid: pid || '',
    },
  };
}

export function normalizeLevel(raw: string): LogLevel {
  const lower = raw.toLowerCase().trim();
  switch (lower) {
    case 'debug':
    case 'trace':
    case 'verbose':
      return 'debug';
    case 'info':
    case 'information':
    case 'notice':
      return 'info';
    case 'warn':
    case 'warning':
      return 'warn';
    case 'error':
    case 'err':
      return 'error';
    case 'fatal':
    case 'critical':
    case 'crit':
    case 'alert':
    case 'emerg':
    case 'emergency':
    case 'panic':
      return 'fatal';
    default:
      return 'info';
  }
}

export function parse(raw: string): ParsedLog {
  const format = detectFormat(raw);
  switch (format) {
    case 'json':
      return parseJSON(raw);
    case 'nginx':
      return parseNginx(raw);
    case 'apache':
      return parseApache(raw);
    case 'syslog_rfc5424':
      return parseSyslogRFC5424(raw);
    case 'syslog_bsd':
      return parseSyslogBSD(raw);
    case 'plain':
    default:
      return {
        timestamp: null,
        level: 'info',
        message: raw,
        source: '',
        metadata: {},
      };
  }
}
