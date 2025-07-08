# TEST_MODE 功能测试示例

## 测试场景

### 1. 正常模式测试

**环境变量配置：**
```bash
# 不设置TEST_MODE或设置为false
ALLOWED_DOMAINS=httpbin.org
ALLOWED_ORIGINS=http://localhost:3000
```

**测试请求：**
```bash
# 应该成功 - 域名在白名单中
curl "https://your-worker.workers.dev?url=https://httpbin.org/get"

# 应该失败 - 域名不在白名单中
curl "https://your-worker.workers.dev?url=https://api.github.com/users/octocat"
```

**预期结果：**
- 第一个请求成功返回数据
- 第二个请求返回错误：`Domain api.github.com is not allowed`

### 2. 测试模式测试

**环境变量配置：**
```bash
TEST_MODE=true
```

**测试请求：**
```bash
# 应该成功 - 测试模式允许所有域名
curl "https://your-worker.workers.dev?url=https://httpbin.org/get"

# 应该成功 - 测试模式允许所有域名
curl "https://your-worker.workers.dev?url=https://api.github.com/users/octocat"

# 应该成功 - 测试模式允许所有域名
curl "https://your-worker.workers.dev?url=https://jsonplaceholder.typicode.com/posts/1"
```

**预期结果：**
- 所有请求都应该成功
- 控制台应该显示警告信息：`⚠️ TEST_MODE enabled: Allowing all domains and origins`

### 3. CORS 测试

**正常模式 CORS 测试：**
```javascript
// 在 http://localhost:3000 页面中执行
fetch('https://your-worker.workers.dev?url=https://httpbin.org/get')
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error));

// 在其他域名页面中执行（应该失败）
fetch('https://your-worker.workers.dev?url=https://httpbin.org/get')
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('CORS Error:', error));
```

**测试模式 CORS 测试：**
```javascript
// 在任意域名页面中执行（都应该成功）
fetch('https://your-worker.workers.dev?url=https://httpbin.org/get')
  .then(response => response.json())
  .then(data => console.log('Success:', data))
  .catch(error => console.error('Error:', error));
```

## 测试步骤

### 步骤1：部署基础版本
1. 部署Worker代码
2. 不设置任何环境变量
3. 测试默认行为

### 步骤2：配置正常模式
1. 设置环境变量：
   ```bash
   ALLOWED_DOMAINS=httpbin.org,jsonplaceholder.typicode.com
   ALLOWED_ORIGINS=http://localhost:3000
   ```
2. 重新部署
3. 测试白名单功能

### 步骤3：启用测试模式
1. 设置环境变量：
   ```bash
   TEST_MODE=true
   ```
2. 重新部署
3. 测试是否允许所有域名

### 步骤4：验证安全性
1. 关闭测试模式：
   ```bash
   TEST_MODE=false
   ```
2. 重新部署
3. 确认恢复正常的安全限制

## 验证清单

- [ ] 正常模式下，只允许白名单域名
- [ ] 正常模式下，只允许白名单来源
- [ ] 测试模式下，允许所有域名
- [ ] 测试模式下，允许所有来源
- [ ] 测试模式下，控制台显示警告信息
- [ ] 关闭测试模式后，恢复正常限制
- [ ] 环境变量配置正确生效
- [ ] 部署后配置立即生效

## 常见问题

### Q: 设置了TEST_MODE=true但仍然被拒绝？
A: 检查以下几点：
1. 环境变量是否正确设置
2. 是否重新部署了Worker
3. 检查控制台是否有警告信息

### Q: 如何确认测试模式已启用？
A: 查看Cloudflare Workers的日志，应该能看到：
```
⚠️ TEST_MODE enabled: Allowing all domains and origins
```

### Q: 测试模式下还需要设置其他环境变量吗？
A: 不需要设置ALLOWED_DOMAINS和ALLOWED_ORIGINS，但可以设置TIMEOUT和MAX_BODY_SIZE。

### Q: 生产环境误开启测试模式怎么办？
A: 立即执行以下步骤：
1. 删除TEST_MODE环境变量或设置为false
2. 重新部署Worker
3. 检查访问日志
4. 设置正确的域名白名单
