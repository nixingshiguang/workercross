# WorkerCross - 安全的CORS代理服务

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

>  基于Cloudflare Workers的高性能、安全的CORS代理服务，解决前端跨域访问问题

##  项目简介

WorkerCross是一个专为解决前端跨域资源共享(CORS)问题而设计的代理服务。它运行在Cloudflare Workers平台上，提供高性能、低延迟的代理服务，同时具备完善的安全防护机制。

###  主要用途

- **解决CORS跨域问题**：让前端应用能够访问不支持CORS的第三方API
- **API聚合代理**：统一管理多个外部API的访问入口
- **开发环境支持**：为本地开发提供便捷的跨域解决方案
- **安全访问控制**：通过白名单机制控制可访问的域名和来源

###  核心特性

-  **多层安全防护**：域名白名单、来源验证、私有IP保护
-  **高性能**：基于Cloudflare全球CDN网络，响应速度快
-  **易于配置**：简单的配置文件，支持自定义安全策略
-  **完善监控**：详细的日志记录和错误处理
-  **成本低廉**：利用Cloudflare Workers免费额度
-  **全球部署**：自动在全球200+数据中心部署

###  与传统解决方案对比

| 特性 | WorkerCross | 传统CORS代理 | 浏览器插件 |
|------|-------------|--------------|------------|
| 安全性 |  多层防护 |  通常较弱 |  客户端控制 |
| 性能 |  全球CDN |  单点服务器 |  本地处理 |
| 稳定性 |  99.9%+ |  依赖服务器 |  依赖用户安装 |
| 成本 |  免费额度大 |  需要服务器 |  免费 |
| 部署难度 |  一键部署 |  需要运维 |  简单安装 |

##  快速开始

### 1. 克隆项目

```bash
git clone https://github.com/nixingshiguang/workercross.git
cd workercross
```

### 2. 配置服务

编辑 `worker.js` 文件中的配置项：

```javascript
const CONFIG = {
  // 允许的域名白名单
  ALLOWED_DOMAINS: [
    'api.github.com',
    'httpbin.org',
    'your-api-domain.com',  // 添加您的API域名
  ],

  // 允许的来源域名
  ALLOWED_ORIGINS: [
    'https://yourdomain.com',  // 添加您的网站域名
    'http://localhost:3000',   // 开发环境
  ],

  TIMEOUT: 30000,              // 30秒超时
  MAX_BODY_SIZE: 10 * 1024 * 1024,  // 10MB限制
};
```

### 3. 部署到Cloudflare Workers

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **创建**  **从hello world开始** **开始使用** **自定义修改项目名称** **部署**
4. 点击 **编辑代码** ，将 `worker.js` 的内容复制到编辑器中
5. 点击 **部署**

### 4. 测试服务

```bash
# 测试GET请求
curl "https://your-worker.workers.dev?url=https://httpbin.org/get"

# 测试POST请求
curl -X POST "https://your-worker.workers.dev?url=https://httpbin.org/post" \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
```

## 🔒 安全特性

1. **域名白名单**：只允许访问指定的域名
2. **来源验证**：CORS来源检查
3. **私有IP保护**：阻止访问内网地址
4. **请求大小限制**：防止大文件攻击
5. **超时控制**：防止长时间挂起
6. **安全头部**：添加安全相关的HTTP头

## 📝 详细配置

### 1. 域名白名单配置
```javascript
ALLOWED_DOMAINS: [
  'api.github.com',
  'httpbin.org',
  'jsonplaceholder.typicode.com',
  // 添加您需要代理的域名
]
```

### 2. CORS来源配置
```javascript
ALLOWED_ORIGINS: [
  'http://localhost:3000',
  'http://localhost:8000',
  'https://yourdomain.com',
  // 添加您的前端域名
]
```

### 3. 其他配置
- `TIMEOUT`: 请求超时时间（默认30秒）
- `MAX_BODY_SIZE`: 最大请求体大小（默认10MB）

## 💻 使用方法

### 基本用法
```javascript
// 前端JavaScript示例
const proxyUrl = 'https://your-worker.your-subdomain.workers.dev';
const targetUrl = 'https://api.github.com/users/octocat';

fetch(`${proxyUrl}?url=${encodeURIComponent(targetUrl)}`)
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

### POST请求示例
```javascript
const proxyUrl = 'https://your-worker.your-subdomain.workers.dev';
const targetUrl = 'https://httpbin.org/post';

fetch(`${proxyUrl}?url=${encodeURIComponent(targetUrl)}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: 'Hello World'
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

### React示例
```jsx
import React, { useState, useEffect } from 'react';

function ApiComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const proxyUrl = 'https://your-worker.workers.dev';
    const apiUrl = 'https://api.github.com/users/octocat';

    fetch(`${proxyUrl}?url=${encodeURIComponent(apiUrl)}`)
      .then(response => response.json())
      .then(data => {
        setData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>{data?.name}</h2>
      <p>{data?.bio}</p>
    </div>
  );
}
```

### Vue.js示例
```vue
<template>
  <div>
    <div v-if="loading">Loading...</div>
    <div v-else>
      <h2>{{ userData.name }}</h2>
      <p>{{ userData.bio }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      userData: null,
      loading: true
    }
  },
  async mounted() {
    try {
      const proxyUrl = 'https://your-worker.workers.dev';
      const apiUrl = 'https://api.github.com/users/octocat';

      const response = await fetch(`${proxyUrl}?url=${encodeURIComponent(apiUrl)}`);
      this.userData = await response.json();
    } catch (error) {
      console.error('Error:', error);
    } finally {
      this.loading = false;
    }
  }
}
</script>
```