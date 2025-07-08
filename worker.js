/**
 * 从环境变量解析域名列表
 * @param {string} envValue - 环境变量值，用逗号分隔的域名列表
 * @returns {string[]} 域名数组
 */
function parseDomainsFromEnv(envValue) {
  if (!envValue) return [];
  return envValue.split(',').map(domain => domain.trim()).filter(domain => domain.length > 0);
}

/**
 * 获取配置项，优先从环境变量获取
 * @param {object} env - 环境变量对象
 * @returns {object} 配置对象
 */
function getConfig(env = {}) {
  // 默认配置
  const defaultConfig = {
    // 允许的域名白名单（为了安全，建议限制允许访问的域名）
    ALLOWED_DOMAINS: [
      // 添加您需要代理的域名
    ],

    // 允许的来源域名（CORS）
    ALLOWED_ORIGINS: [
      // 添加您的前端域名
    ],

    // 请求超时时间（默认30秒）
    TIMEOUT: 30,

    // 最大请求体大小（默认10MB）
    MAX_BODY_SIZE: 10 * 1024 * 1024,
  };

  // 从环境变量获取额外的域名配置
  const envAllowedDomains = parseDomainsFromEnv(env.ALLOWED_DOMAINS);
  const envAllowedOrigins = parseDomainsFromEnv(env.ALLOWED_ORIGINS);

  // 合并域名配置（环境变量的域名会添加到默认配置中）
  const allowedDomains = [...defaultConfig.ALLOWED_DOMAINS, ...envAllowedDomains];
  const allowedOrigins = [...defaultConfig.ALLOWED_ORIGINS, ...envAllowedOrigins];

  // 从环境变量获取超时时间（秒），如果没有则使用默认值
  const timeoutSeconds = env.TIMEOUT ? parseInt(env.TIMEOUT, 10) : defaultConfig.TIMEOUT;
  const timeout = isNaN(timeoutSeconds) ? defaultConfig.TIMEOUT * 1000 : timeoutSeconds * 1000; // 转换为毫秒

  // 从环境变量获取最大请求体大小（MB），如果没有则使用默认值
  const maxBodySizeMB = env.MAX_BODY_SIZE ? parseInt(env.MAX_BODY_SIZE, 10) : (defaultConfig.MAX_BODY_SIZE / (1024 * 1024));
  const maxBodySize = isNaN(maxBodySizeMB) ? defaultConfig.MAX_BODY_SIZE : maxBodySizeMB * 1024 * 1024; // 转换为字节

  return {
    ALLOWED_DOMAINS: allowedDomains,
    ALLOWED_ORIGINS: allowedOrigins,
    TIMEOUT: timeout,
    MAX_BODY_SIZE: maxBodySize,
  };
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

/**
 * 处理请求的主函数
 * @param {Request} request
 * @param {object} env - 环境变量
 */
async function handleRequest(request, env = {}) {
  try {
    // 获取配置（优先从环境变量获取）
    const CONFIG = getConfig(env);

    // 记录请求信息（用于调试）
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return handlePreflight(request, CONFIG);
    }

    // 解析和验证请求
    const { targetUrl, isValid, error } = parseAndValidateRequest(request, CONFIG);

    if (!isValid) {
      return createErrorResponse(error, 400);
    }

    // 检查CORS
    const corsError = checkCORS(request, CONFIG);
    if (corsError) {
      return createErrorResponse(corsError, 403);
    }

    // 执行代理请求
    const response = await proxyRequest(request, targetUrl, CONFIG);

    return response;

  } catch (error) {
    console.error('Request handling error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * 解析和验证请求
 * @param {Request} request
 * @param {object} config - 配置对象
 */
function parseAndValidateRequest(request, config) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  // 检查是否提供了目标URL
  if (!targetUrl) {
    return {
      isValid: false,
      error: 'Missing required parameter: url'
    };
  }

  // 验证URL格式
  let parsedTargetUrl;
  try {
    parsedTargetUrl = new URL(targetUrl);
  } catch (e) {
    return {
      isValid: false,
      error: 'Invalid URL format'
    };
  }

  // 检查协议
  if (!['http:', 'https:'].includes(parsedTargetUrl.protocol)) {
    return {
      isValid: false,
      error: 'Only HTTP and HTTPS protocols are allowed'
    };
  }

  // 检查域名白名单
  if (config.ALLOWED_DOMAINS.length > 0 &&
      !config.ALLOWED_DOMAINS.includes(parsedTargetUrl.hostname)) {
    return {
      isValid: false,
      error: `Domain ${parsedTargetUrl.hostname} is not allowed`
    };
  }

  // 防止访问内网地址
  if (isPrivateIP(parsedTargetUrl.hostname)) {
    return {
      isValid: false,
      error: 'Access to private IP addresses is not allowed'
    };
  }

  return {
    isValid: true,
    targetUrl: parsedTargetUrl.toString()
  };
}

/**
 * 检查CORS权限
 * @param {Request} request
 * @param {object} config - 配置对象
 */
function checkCORS(request, config) {
  const origin = request.headers.get('Origin');

  // 如果没有Origin头，可能是同源请求或服务器端请求
  if (!origin) {
    return null;
  }

  // 检查来源是否在允许列表中
  if (config.ALLOWED_ORIGINS.length > 0 &&
      !config.ALLOWED_ORIGINS.includes(origin) &&
      !config.ALLOWED_ORIGINS.includes('*')) {
    return `Origin ${origin} is not allowed`;
  }

  return null;
}

/**
 * 处理预检请求
 * @param {Request} request
 * @param {object} config - 配置对象
 */
function handlePreflight(request, config) {
  const origin = request.headers.get('Origin');

  // 检查来源
  if (config.ALLOWED_ORIGINS.length > 0 &&
      !config.ALLOWED_ORIGINS.includes(origin) &&
      !config.ALLOWED_ORIGINS.includes('*')) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    }
  });
}

/**
 * 执行代理请求
 * @param {Request} originalRequest
 * @param {string} targetUrl
 * @param {object} config - 配置对象
 */
async function proxyRequest(originalRequest, targetUrl, config) {
  // 创建AbortController用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.TIMEOUT);

  try {
    // 过滤和清理请求头
    const cleanHeaders = cleanRequestHeaders(originalRequest.headers);

    // 检查请求体大小
    const contentLength = originalRequest.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > config.MAX_BODY_SIZE) {
      return createErrorResponse('Request body too large', 413);
    }

    // 创建代理请求
    const proxyRequest = new Request(targetUrl, {
      method: originalRequest.method,
      headers: cleanHeaders,
      body: originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD'
            ? originalRequest.body : null,
      signal: controller.signal,
      redirect: 'follow'
    });

    // 发送请求
    const response = await fetch(proxyRequest);

    // 清除超时
    clearTimeout(timeoutId);

    // 创建响应
    return createProxyResponse(response, originalRequest, config);

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      return createErrorResponse('Request timeout', 408);
    }

    console.error('Proxy request error:', error);
    return createErrorResponse('Failed to fetch target URL', 502);
  }
}

/**
 * 清理请求头
 * @param {Headers} headers
 */
function cleanRequestHeaders(headers) {
  const cleanHeaders = new Headers();

  // 需要过滤的头部
  const forbiddenHeaders = [
    'host',
    'origin',
    'referer',
    'cookie',
    'set-cookie',
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'cf-ray',
    'cf-visitor'
  ];

  for (const [key, value] of headers.entries()) {
    if (!forbiddenHeaders.includes(key.toLowerCase())) {
      cleanHeaders.set(key, value);
    }
  }

  return cleanHeaders;
}

/**
 * 创建代理响应
 * @param {Response} response
 * @param {Request} originalRequest
 * @param {object} config - 配置对象
 */
function createProxyResponse(response, originalRequest, config) {
  const origin = originalRequest.headers.get('Origin');

  // 过滤响应头
  const responseHeaders = new Headers();

  // 复制安全的响应头
  const allowedResponseHeaders = [
    'content-type',
    'content-length',
    'content-encoding',
    'cache-control',
    'expires',
    'last-modified',
    'etag'
  ];

  for (const [key, value] of response.headers.entries()) {
    if (allowedResponseHeaders.includes(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  }

  // 添加CORS头
  responseHeaders.set('Access-Control-Allow-Origin',
    config.ALLOWED_ORIGINS.includes('*') ? '*' : (origin || '*'));
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Type');

  // 添加安全头
  responseHeaders.set('X-Content-Type-Options', 'nosniff');
  responseHeaders.set('X-Frame-Options', 'DENY');
  responseHeaders.set('X-XSS-Protection', '1; mode=block');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  });
}

/**
 * 创建错误响应
 * @param {string} message
 * @param {number} status
 */
function createErrorResponse(message, status = 400) {
  return new Response(JSON.stringify({
    error: message,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    }
  });
}

/**
 * 检查是否为私有IP地址
 * @param {string} hostname
 */
function isPrivateIP(hostname) {
  // IPv4私有地址范围
  const privateIPv4Ranges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^0\./
  ];

  // 检查是否为IP地址
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    return privateIPv4Ranges.some(range => range.test(hostname));
  }

  // 检查本地主机名
  const localHostnames = ['localhost', '0.0.0.0'];
  if (localHostnames.includes(hostname.toLowerCase())) {
    return true;
  }

  return false;
}
