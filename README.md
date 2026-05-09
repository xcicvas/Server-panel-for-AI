# AI-written Server Panel

一个现代化的服务器管理面板，通过直观的 Web UI 界面实时监控服务器状态和管理系统资源。

---

## 功能特性

### 核心监控
- **仪表盘** - 实时监控 CPU、内存、磁盘使用情况，附带服务器心情显示和健康评分
- **进程管理** - 查看、搜索、过滤、终止运行中的进程
- **网络监控** - 查看端口监听状态和网络连接信息
- **磁盘清理** - 扫描大文件，提供清理建议

### 系统管理
- **服务管理** - 查看、启动、停止、重启系统服务
- **定时任务** - 管理 crontab 定时任务
- **日志查看** - 实时查看系统日志
- **文件管理** - 浏览服务器文件系统

### 数据可视化
- **活动热力图** - 可视化服务器近期负载变化
- **排行榜** - CPU/内存使用 Top 10 进程
- **历史对比** - 资源使用历史数据对比
- **资源预测** - 基于历史数据的资源使用预测

### 趣味功能
- **服务器心情** - 根据资源使用情况动态显示服务器状态
- **服务器成就** - 解锁各种有趣的服务器状态成就
- **宠物模式** - 可爱的服务器宠物陪伴
- **黑历史记录** - 记录服务器曾经的高负载时刻
- **弹幕吐槽** - 当资源使用率过高时自动发送弹幕提醒
- **凌晨梦境模式** - 凌晨 2-6 点自动切换夜间主题

### 主题支持
- 浅色主题
- 深色主题
- 粉色主题

---

## 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装依赖

```bash
cd AI‑writtenServerpanel
npm install
```

### 启动服务

```bash
# 开发模式
npm start

# 或使用 PM2 管理（推荐）
npm install -g pm2
pm2 start server/index.js --name server-panel
```

### 访问面板

打开浏览器访问：http://localhost:3000

---

## 项目结构

```
Server-panel-for-AI/
├── server/                    # 后端服务
│   ├── index.js              # Express 服务器入口
│   └── routes/               # API 路由模块
│       ├── system.js         # 系统信息（CPU/内存/磁盘）
│       ├── processes.js      # 进程管理
│       ├── network.js        # 网络信息
│       ├── services.js       # 服务管理
│       ├── alerts.js         # 告警系统
│       ├── cron.js           # 定时任务
│       ├── logs.js           # 日志查看
│       ├── timeline.js       # 时间线数据
│       ├── docker.js         # Docker 容器管理
│       ├── files.js          # 文件系统访问
│       ├── cleanup.js        # 磁盘清理
│       ├── connections.js    # 连接统计
│       ├── updates.js        # 系统更新检查
│       ├── configs.js        # 配置文件查看
│       └── benchmark.js      # 性能基准测试
├── public/                   # 前端静态资源
│   ├── index.html            # 主页面（单页应用）
│   ├── css/
│   │   └── style.css         # 全局样式（含主题变量）
│   └── js/
│       └── app.js            # 前端逻辑（Socket.IO 实时更新）
├── package.json              # 项目依赖配置
├── LICENSE                   # MIT 开源协议
└── README.md                 # 项目说明文档
```

---

## API 接口

### 系统信息

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/system/info` | GET | 系统基本信息（主机名、平台、运行时间） |
| `/api/system/cpu` | GET | CPU 使用情况（使用率、核心数、型号） |
| `/api/system/memory` | GET | 内存使用情况（已用/可用/总量） |
| `/api/system/disk` | GET | 磁盘使用情况（已用/可用/总量） |
| `/api/system/network` | GET | 网络接口信息 |

### 进程管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/processes` | GET | 获取进程列表（支持 search 参数过滤） |
| `/api/processes/kill/:pid` | POST | 终止指定进程 |

### 服务管理

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/services` | GET | 获取服务列表 |
| `/api/services/:name/start` | POST | 启动服务 |
| `/api/services/:name/stop` | POST | 停止服务 |
| `/api/services/:name/restart` | POST | 重启服务 |

### 告警系统

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/alerts/rules` | GET | 获取告警规则列表 |
| `/api/alerts/rules` | POST | 添加告警规则 |
| `/api/alerts/rules/:id` | PUT | 更新告警规则 |
| `/api/alerts/rules/:id` | DELETE | 删除告警规则 |
| `/api/alerts/check` | POST | 手动检查告警状态 |

### 定时任务

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/cron` | GET | 获取 crontab 列表 |
| `/api/cron` | POST | 添加定时任务 |
| `/api/cron/:id` | DELETE | 删除定时任务 |

### 日志与时间线

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/logs` | GET | 获取系统日志 |
| `/api/timeline` | GET | 获取时间线数据 |

### 高级功能

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/docker/containers` | GET | 获取 Docker 容器列表 |
| `/api/files/list` | GET | 列出目录内容 |
| `/api/files/read` | GET | 读取文件内容 |
| `/api/cleanup` | GET | 扫描大文件 |
| `/api/connections` | GET | 获取网络连接统计 |
| `/api/updates` | GET | 检查系统更新 |
| `/api/configs` | GET | 查看配置文件 |
| `/api/benchmark` | GET/POST | 性能基准测试 |

### 认证接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/auth/login` | POST | 登录（需要密码） |
| `/api/auth/logout` | POST | 退出登录 |
| `/api/auth/status` | GET | 获取登录状态 |
| `/api/auth/change-password` | POST | 修改密码 |

---

## 主题配置

面板支持三种主题模式，可通过页面右上角的主题切换按钮切换：

1. **Light（浅色主题）** - 默认清爽的浅色配色
2. **Dark（深色主题）** - 护眼的深色配色
3. **Pink（粉色主题）** - 可爱的粉色配色

主题设置会自动保存到浏览器本地存储（LocalStorage）。

---

## 凌晨梦境模式

面板会在凌晨 2:00 - 6:00 自动切换到夜间主题模式，为您的深夜运维提供更舒适的视觉体验。

---

## 安全警告

**重要提示：本项目约 90% 的代码由 AI 生成**

虽然已包含基础安全措施，但仍可能存在未知的安全漏洞。

### 使用建议
- **请勿在生产环境中使用此面板**
- 仅监听本地接口（127.0.0.1）
- 不要暴露到公网
- 定期检查代码和依赖的安全性
- 对敏感操作保持警惕

---

## License

MIT License

详见 [LICENSE](LICENSE) 文件

---

## 贡献

欢迎提交 Issue 和 Pull Request！

---

**版本**: v1.0.0
**最后更新**: 2026年5月
