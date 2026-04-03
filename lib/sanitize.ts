// 敏感信息过滤器 — 双层过滤（Skill 本地 + API 服务端）

interface SanitizeResult {
  clean: string;
  redactedCount: number;
}

const PATTERNS: { name: string; regex: RegExp; replace: string | ((m: string) => string) }[] = [
  // API Key / Token / Secret / Password
  {
    name: "api_key",
    regex: /(?:api[_-]?key|token|secret|password|credential|auth[_-]?token)\s*[:=]\s*['"]?[A-Za-z0-9_\-./+=]{16,}['"]?/gi,
    replace: "[REDACTED_KEY]",
  },
  // Bearer Token
  {
    name: "bearer",
    regex: /Bearer\s+[A-Za-z0-9_\-./+=]{20,}/gi,
    replace: "Bearer [REDACTED]",
  },
  // AWS Access Key
  {
    name: "aws_key",
    regex: /AKIA[0-9A-Z]{16}/g,
    replace: "[REDACTED_AWS_KEY]",
  },
  // 私钥文件
  {
    name: "private_key",
    regex: /-----BEGIN [\w\s]+ PRIVATE KEY-----[\s\S]*?-----END [\w\s]+ PRIVATE KEY-----/g,
    replace: "[REDACTED_PRIVATE_KEY]",
  },
  // 数据库连接串
  {
    name: "db_url",
    regex: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s'")\]}>]+/gi,
    replace: "[REDACTED_DB_URL]",
  },
  // 用户主目录路径
  {
    name: "home_path",
    regex: /\/(?:home|Users)\/[a-zA-Z0-9._-]+/g,
    replace: "/home/[USER]",
  },
  // Windows 用户路径
  {
    name: "windows_path",
    regex: /C:\\Users\\[a-zA-Z0-9._-]+/gi,
    replace: "C:\\Users\\[USER]",
  },
  // 内网 IP
  {
    name: "internal_ip",
    regex: /(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}/g,
    replace: "[INTERNAL_IP]",
  },
  // 邮箱地址
  {
    name: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replace: "[EMAIL]",
  },
  // .env 变量赋值（整行）
  {
    name: "env_var",
    regex: /^[A-Z_]{2,}=.{8,}$/gm,
    replace: "[REDACTED_ENV]",
  },
];

/** 过滤文本中的敏感信息，返回清洗后的文本和被过滤的数量 */
export function sanitize(text: string): SanitizeResult {
  let clean = text;
  let redactedCount = 0;
  for (const p of PATTERNS) {
    const matches = clean.match(p.regex);
    if (matches) redactedCount += matches.length;
    if (typeof p.replace === "function") {
      clean = clean.replace(p.regex, p.replace);
    } else {
      clean = clean.replace(p.regex, p.replace);
    }
  }
  return { clean, redactedCount };
}

/** 批量过滤对象中所有字符串字段 */
export function sanitizeFields<T extends Record<string, unknown>>(obj: T): { cleaned: T; totalRedacted: number } {
  let totalRedacted = 0;
  const cleaned = { ...obj };
  for (const key of Object.keys(cleaned)) {
    if (typeof cleaned[key] === "string") {
      const { clean, redactedCount } = sanitize(cleaned[key] as string);
      (cleaned as Record<string, unknown>)[key] = clean;
      totalRedacted += redactedCount;
    }
  }
  return { cleaned, totalRedacted };
}
