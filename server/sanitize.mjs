import os from 'node:os';

const HOME = os.homedir();

/**
 * Redact common PII, credentials, and local user paths before exposing
 * markdown prompts, skills, or connector endpoints to the UI / model.
 */
export function sanitizeText(input = '') {
  if (!input || typeof input !== 'string') return '';
  let text = input;

  // 1. Replace local home directory path with ~
  if (HOME && HOME.length > 1) {
    text = text.split(HOME).join('~');
  }
  text = text.replace(/\/Users\/[^/\s"'`]+/g, '/Users/<user>');
  text = text.replace(/\/home\/[^/\s"'`]+/g, '/home/<user>');
  text = text.replace(/C:\\Users\\[^\\\s"'`]+/gi, 'C:\\Users\\<user>');

  // 2. Redact API keys, tokens, secrets, passwords
  text = text.replace(
    /\b(sk-[a-zA-Z0-9_-]{16,}|gh[pousr]_[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|xox[baprs]-[0-9a-zA-Z-]{10,}|Bearer\s+[a-zA-Z0-9._-]{16,})\b/g,
    '[REDACTED_TOKEN]',
  );
  text = text.replace(
    /((?:api[_-]?key|secret|password|passwd|pwd|token|cookie|authorization|access[_-]?key)\s*[:=]\s*["']?)([^\s"',;}\n]{6,})/gi,
    '$1[REDACTED]',
  );

  // 3. Redact email addresses
  text = text.replace(
    /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    '[REDACTED_EMAIL]',
  );

  // 4. Redact Chinese mobile phone numbers (11 digits starting with 1[3-9])
  text = text.replace(/(?<!\d)1[3-9]\d{9}(?!\d)/g, '[REDACTED_PHONE]');

  // 5. Redact 18-digit ID card numbers
  text = text.replace(/(?<!\d)[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/g, '[REDACTED_ID]');

  return text;
}

/**
 * Sanitize connector endpoint/command string so query tokens or CLI secret flags are never shown.
 */
export function sanitizeEndpoint(endpoint = '') {
  if (!endpoint || typeof endpoint !== 'string') return '';
  let out = sanitizeText(endpoint);

  // Mask URL query parameter values
  out = out.replace(/([?&][^=\s]+)=([^&\s]+)/g, '$1=[REDACTED]');

  // Mask CLI flags like --token xxx, --api-key=xxx, -p xxx
  out = out.replace(
    /(--?(?:token|key|api-key|secret|password|auth|cookie)(?:=|\s+))([^\s"']+)/gi,
    '$1[REDACTED]',
  );

  return out;
}

/**
 * Detect whether a skill or expert markdown appears to contain private/confidential personal docs.
 */
export function isPrivateContent(text = '') {
  if (!text) return false;
  return /绝密|主权档案|银行卡号|司法案件|个人财务/.test(text);
}
