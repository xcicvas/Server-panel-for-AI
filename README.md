# Server Panel

一个现代化的服务器管理面板，通过直观的 Web UI 界面监控服务器状态、执行命令和管理资源。

## 功能特性

- 仪表盘 - 实时监控 CPU、内存、磁盘使用情况
- 终端 - Web 终端，在线执行 Shell 命令
- 进程管理 - 查看、搜索、终止运行中的进程
- 网络 - 查看端口监听状态
- 服务 - 管理系统服务（启动/停止/重启）
- 告警系统 - 自定义阈值，资源超标时自动提醒

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

### 访问面板

打开浏览器访问：http://localhost:3000

## 项目结构

```
├── server/
│   ├── index.js          # Express 服务器
│   └── routes/           # API 路由
│       ├── system.js     # 系统信息
│       ├── processes.js  # 进程管理
│       ├── network.js    # 网络信息
│       ├── services.js   # 服务管理
│       └── alerts.js     # 告警系统
├── public/
│   ├── index.html        # 主页面
│   ├── css/style.css     # 样式
│   └── js/app.js         # 前端逻辑
├── package.json
└── LICENSE               # MIT 协议
```

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/system/info | GET | 系统基本信息 |
| /api/system/cpu | GET | CPU 信息 |
| /api/system/memory | GET | 内存信息 |
| /api/system/disk | GET | 磁盘信息 |
| /api/processes | GET | 进程列表 |
| /api/network | GET | 网络端口 |
| /api/services | GET | 服务列表 |
| /api/alerts/rules | GET | 告警规则 |
| /api/alerts/check | POST | 检查告警 |

## 安全说明

- 终端命令白名单限制
- 危险命令自动拦截（如 rm -rf）
- 仅允许只读操作

## License

MIT License - 详见 LICENSE 文件
