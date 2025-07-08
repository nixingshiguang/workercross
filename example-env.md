# 环境变量配置示例

## 支持的环境变量

| 环境变量 | 类型 | 默认值 | 说明 |
|---------|------|--------|------|
| `TEST_MODE` | 布尔值 | `false` | 测试模式，启用时允许所有域名和来源 |
| `ALLOWED_DOMAINS` | 字符串 | - | 允许的域名白名单，用逗号分隔，会添加到默认配置中 |
| `ALLOWED_ORIGINS` | 字符串 | - | 允许的来源域名，用逗号分隔，会添加到默认配置中 |
| `TIMEOUT` | 数字 | 30 | 请求超时时间（秒），会替换默认值 |
| `MAX_BODY_SIZE` | 数字 | 10 | 最大请求体大小（MB），会替换默认值 |

## 在Cloudflare Workers中设置环境变量

### 1. 通过Dashboard设置

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 选择您的Worker
3. 进入 **Settings** → **Variables**
4. 在 **Environment Variables** 部分添加变量

### 2. 通过Wrangler CLI设置

在 `wrangler.toml` 文件中设置：

```toml
name = "workercross"
main = "worker.js"
compatibility_date = "2023-12-01"

[vars]
TEST_MODE = "false"
ALLOWED_DOMAINS = "api.github.com,httpbin.org"
ALLOWED_ORIGINS = "https://myapp.com,http://localhost:3000"
TIMEOUT = "30"
MAX_BODY_SIZE = "10"
```

## 配置示例

### 开发环境配置（测试模式）
```bash
# 启用测试模式 - 允许所有域名和来源
TEST_MODE=true
TIMEOUT=60
MAX_BODY_SIZE=20
```

### 开发环境配置（正常模式）
```bash
TEST_MODE=false
ALLOWED_DOMAINS=httpbin.org,jsonplaceholder.typicode.com
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080
TIMEOUT=30
MAX_BODY_SIZE=5
```

### 生产环境配置
```bash
# 不设置TEST_MODE或设置为false
ALLOWED_DOMAINS=api.mycompany.com,cdn.mycompany.com
ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com
TIMEOUT=60
MAX_BODY_SIZE=50
```

### 演示环境配置
```bash
# 演示环境可能需要访问多个不确定的域名
TEST_MODE=true
TIMEOUT=45
MAX_BODY_SIZE=10
```

## TEST_MODE 详细说明

### 启用测试模式
```bash
TEST_MODE=true
```

**效果：**
- `ALLOWED_DOMAINS` 自动设置为 `['*']`
- `ALLOWED_ORIGINS` 自动设置为 `['*']`
- 允许访问任意域名
- 允许任意来源的请求
- 控制台会输出警告信息

### 关闭测试模式
```bash
TEST_MODE=false
# 或者不设置TEST_MODE变量
```

**效果：**
- 使用正常的域名白名单验证
- 使用正常的CORS来源验证
- 按照配置的安全策略运行

## 安全注意事项

### ⚠️ 测试模式风险
- **开放代理风险**：允许访问任意URL
- **SSRF攻击风险**：可能被用来攻击内网服务
- **资源滥用风险**：可能被恶意使用

### 🛡️ 安全建议
1. **仅在开发/测试环境使用测试模式**
2. **生产环境必须关闭测试模式**
3. **定期检查环境变量配置**
4. **监控异常流量和访问模式**

## 配置验证

代码会自动验证环境变量：
- `TEST_MODE` 支持 `'true'`、`true`、`'false'`、`false` 等值
- 域名列表会过滤掉空字符串
- 数值会进行类型检查，无效值会使用默认配置
- `TIMEOUT` 会自动转换为毫秒
- `MAX_BODY_SIZE` 会自动转换为字节

## 故障排除

### 常见问题

1. **TEST_MODE 不生效**
   - 检查环境变量值是否为 `'true'` 或 `true`
   - 确认环境变量已正确设置并重新部署

2. **域名仍然被拒绝**
   - 确认 `TEST_MODE=true` 已设置
   - 检查控制台是否有测试模式的警告信息

3. **生产环境意外开启测试模式**
   - 立即设置 `TEST_MODE=false` 或删除该环境变量
   - 重新部署Worker
   - 检查访问日志是否有异常
