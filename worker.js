// 配置项
const CONFIG = {
  // 允许的域名白名单（为了安全，建议限制允许访问的域名）
  ALLOWED_DOMAINS: [
    'api.github.com',
    'httpbin.org',
    'jsonplaceholder.typicode.com',
    // 添加您需要代理的域名
  ],

  // 允许的来源域名（CORS）
  ALLOWED_ORIGINS: [
    'http://localhost:3000',
    'http://localhost:8000',
    'https://yourdomain.com',
    // 添加您的前端域名
  ],

  // 请求超时时间（毫秒）
  TIMEOUT: 30000,

  // 最大请求体大小（字节）
  MAX_BODY_SIZE: 10 * 1024 * 1024, // 10MB
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * 处理请求的主函数
 * @param {Request} request
 */
async function handleRequest(request) {
  try {
    // 记录请求信息（用于调试）
    console.log(`[${new Date().toISOString()}] ${request.method} ${request.url}`);

    // 处理预检请求
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }

    // 解析和验证请求
    const { targetUrl, isValid, error } = parseAndValidateRequest(request);

    if (!isValid) {
      return createErrorResponse(error, 400);
    }

    // 检查CORS
    const corsError = checkCORS(request);
    if (corsError) {
      return createErrorResponse(corsError, 403);
    }

    // 执行代理请求
    const response = await proxyRequest(request, targetUrl);

    return response;

  } catch (error) {
    console.error('Request handling error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

/**
 * 解析和验证请求
 * @param {Request} request
 */
function parseAndValidateRequest(request) {
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
  if (CONFIG.ALLOWED_DOMAINS.length > 0 &&
      !CONFIG.ALLOWED_DOMAINS.includes(parsedTargetUrl.hostname)) {
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
 */
function checkCORS(request) {
  const origin = request.headers.get('Origin');

  // 如果没有Origin头，可能是同源请求或服务器端请求
  if (!origin) {
    return null;
  }

  // 检查来源是否在允许列表中
  if (CONFIG.ALLOWED_ORIGINS.length > 0 &&
      !CONFIG.ALLOWED_ORIGINS.includes(origin) &&
      !CONFIG.ALLOWED_ORIGINS.includes('*')) {
    return `Origin ${origin} is not allowed`;
  }

  return null;
}

/**
 * 处理预检请求
 * @param {Request} request
 */
function handlePreflight(request) {
  const origin = request.headers.get('Origin');

  // 检查来源
  if (CONFIG.ALLOWED_ORIGINS.length > 0 &&
      !CONFIG.ALLOWED_ORIGINS.includes(origin) &&
      !CONFIG.ALLOWED_ORIGINS.includes('*')) {
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
 */
async function proxyRequest(originalRequest, targetUrl) {
  // 创建AbortController用于超时控制
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);

  try {
    // 过滤和清理请求头
    const cleanHeaders = cleanRequestHeaders(originalRequest.headers);

    // 检查请求体大小
    const contentLength = originalRequest.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > CONFIG.MAX_BODY_SIZE) {
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
    return createProxyResponse(response, originalRequest);

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
 */
function createProxyResponse(response, originalRequest) {
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
    CONFIG.ALLOWED_ORIGINS.includes('*') ? '*' : (origin || '*'));
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
