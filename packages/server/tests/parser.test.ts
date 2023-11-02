import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  parse,
  parseJSON,
  parseNginx,
  parseApache,
  parseSyslogRFC5424,
  parseSyslogBSD,
  normalizeLevel,
} from '../src/ingestion/parser';

describe('detectFormat', () => {
  it('detects JSON format', () => {
    expect(detectFormat('{"level":"info","message":"hello"}')).toBe('json');
  });

  it('detects nginx format', () => {
    const line =
      '192.168.1.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /api/health HTTP/1.1" 200 2326 "http://example.com" "Mozilla/5.0"';
    expect(detectFormat(line)).toBe('nginx');
  });

  it('detects apache common format', () => {
    const line =
      '192.168.1.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326';
    expect(detectFormat(line)).toBe('apache');
  });

  it('detects syslog RFC 5424', () => {
    const line =
      '<34>1 2023-06-01T12:00:00.000Z myhost app-name 1234 - - Application started';
    expect(detectFormat(line)).toBe('syslog_rfc5424');
  });

  it('detects syslog BSD', () => {
    const line = '<34>Oct  1 12:00:00 myhost myapp[1234]: Process started';
    expect(detectFormat(line)).toBe('syslog_bsd');
  });

  it('returns plain for unrecognized format', () => {
    expect(detectFormat('just a plain log message')).toBe('plain');
  });

  it('returns plain for invalid JSON', () => {
    expect(detectFormat('{not valid json')).toBe('plain');
  });
});

describe('parseJSON', () => {
  it('extracts level, message, and timestamp', () => {
    const result = parseJSON(
      '{"level":"error","message":"Something broke","timestamp":"2023-10-01T12:00:00Z"}'
    );
    expect(result.level).toBe('error');
    expect(result.message).toBe('Something broke');
    expect(result.timestamp).toEqual(new Date('2023-10-01T12:00:00Z'));
  });

  it('normalizes level names', () => {
    expect(parseJSON('{"severity":"WARNING","msg":"test"}').level).toBe('warn');
    expect(parseJSON('{"loglevel":"CRITICAL","message":"test"}').level).toBe('fatal');
  });

  it('extracts metadata from extra fields', () => {
    const result = parseJSON(
      '{"level":"info","message":"test","userId":"123","requestId":"abc"}'
    );
    expect(result.metadata).toEqual({ userId: '123', requestId: 'abc' });
  });

  it('extracts source from common field names', () => {
    expect(parseJSON('{"message":"test","service":"api"}').source).toBe('api');
    expect(parseJSON('{"message":"test","app":"worker"}').source).toBe('worker');
  });

  it('handles @timestamp format', () => {
    const result = parseJSON(
      '{"message":"test","@timestamp":"2023-10-01T12:00:00Z"}'
    );
    expect(result.timestamp).toEqual(new Date('2023-10-01T12:00:00Z'));
  });
});

describe('parseNginx', () => {
  it('parses nginx combined log format', () => {
    const line =
      '192.168.1.100 - admin [10/Oct/2023:14:30:00 +0200] "POST /api/users HTTP/1.1" 201 456 "http://app.example.com/register" "Mozilla/5.0"';
    const result = parseNginx(line);

    expect(result.level).toBe('info');
    expect(result.message).toBe('POST /api/users 201');
    expect(result.source).toBe('192.168.1.100');
    expect(result.metadata.method).toBe('POST');
    expect(result.metadata.path).toBe('/api/users');
    expect(result.metadata.status).toBe('201');
    expect(result.metadata.user_agent).toBe('Mozilla/5.0');
  });

  it('maps 5xx status to error level', () => {
    const line =
      '10.0.0.1 - - [10/Oct/2023:14:30:00 +0200] "GET /crash HTTP/1.1" 500 0 "-" "curl/7.0"';
    const result = parseNginx(line);
    expect(result.level).toBe('error');
  });

  it('maps 4xx status to warn level', () => {
    const line =
      '10.0.0.1 - - [10/Oct/2023:14:30:00 +0200] "GET /notfound HTTP/1.1" 404 0 "-" "curl/7.0"';
    const result = parseNginx(line);
    expect(result.level).toBe('warn');
  });
});

describe('parseApache', () => {
  it('parses apache common log format', () => {
    const line =
      '127.0.0.1 - frank [10/Oct/2023:13:55:36 -0700] "GET /apache_pb.gif HTTP/1.1" 200 2326';
    const result = parseApache(line);

    expect(result.level).toBe('info');
    expect(result.message).toBe('GET /apache_pb.gif 200');
    expect(result.metadata.remote_addr).toBe('127.0.0.1');
    expect(result.metadata.bytes_sent).toBe('2326');
  });
});

describe('parseSyslogRFC5424', () => {
  it('parses RFC 5424 syslog messages', () => {
    const line =
      '<165>1 2023-06-01T12:00:00.123Z myserver myapp 1234 ID47 - Application started successfully';
    const result = parseSyslogRFC5424(line);

    expect(result.level).toBe('info'); // severity 5 = notice -> info
    expect(result.message).toBe('Application started successfully');
    expect(result.source).toBe('myserver');
    expect(result.metadata.app_name).toBe('myapp');
    expect(result.timestamp).toEqual(new Date('2023-06-01T12:00:00.123Z'));
  });

  it('maps severity correctly', () => {
    // <11> = facility 1, severity 3 (error)
    const line = '<11>1 2023-06-01T12:00:00Z host app - - - Error occurred';
    const result = parseSyslogRFC5424(line);
    expect(result.level).toBe('error');
  });

  it('handles nil values', () => {
    const line = '<14>1 - - - - - - Just a message';
    const result = parseSyslogRFC5424(line);
    expect(result.source).toBe('');
    expect(result.timestamp).toBeNull();
  });
});

describe('parseSyslogBSD', () => {
  it('parses BSD syslog messages', () => {
    const line = '<34>Oct  1 12:00:00 myhost myapp[1234]: Process started';
    const result = parseSyslogBSD(line);

    expect(result.message).toBe('Process started');
    expect(result.source).toBe('myhost');
    expect(result.metadata.app_name).toBe('myapp');
    expect(result.metadata.pid).toBe('1234');
  });
});

describe('normalizeLevel', () => {
  it('normalizes common level names', () => {
    expect(normalizeLevel('DEBUG')).toBe('debug');
    expect(normalizeLevel('INFO')).toBe('info');
    expect(normalizeLevel('information')).toBe('info');
    expect(normalizeLevel('WARNING')).toBe('warn');
    expect(normalizeLevel('warn')).toBe('warn');
    expect(normalizeLevel('ERROR')).toBe('error');
    expect(normalizeLevel('err')).toBe('error');
    expect(normalizeLevel('FATAL')).toBe('fatal');
    expect(normalizeLevel('CRITICAL')).toBe('fatal');
    expect(normalizeLevel('panic')).toBe('fatal');
    expect(normalizeLevel('notice')).toBe('info');
    expect(normalizeLevel('trace')).toBe('debug');
  });

  it('defaults to info for unknown levels', () => {
    expect(normalizeLevel('something')).toBe('info');
    expect(normalizeLevel('')).toBe('info');
  });
});

describe('parse (auto-detect)', () => {
  it('auto-detects and parses JSON', () => {
    const result = parse('{"level":"error","message":"boom"}');
    expect(result.level).toBe('error');
    expect(result.message).toBe('boom');
  });

  it('auto-detects and parses nginx', () => {
    const line =
      '10.0.0.1 - - [10/Oct/2023:14:30:00 +0200] "GET / HTTP/1.1" 200 1234 "-" "curl"';
    const result = parse(line);
    expect(result.message).toBe('GET / 200');
  });

  it('returns plain text for unrecognized formats', () => {
    const result = parse('just some text');
    expect(result.level).toBe('info');
    expect(result.message).toBe('just some text');
  });
});
