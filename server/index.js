const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');

const systemRoutes = require('./routes/system');
const processRoutes = require('./routes/processes');
const networkRoutes = require('./routes/network');
const serviceRoutes = require('./routes/services');
const alertRoutes = require('./routes/alerts');
const cronRoutes = require('./routes/cron');
const logsRoutes = require('./routes/logs');
const timelineRoutes = require('./routes/timeline');
const dockerRoutes = require('./routes/docker');
const filesRoutes = require('./routes/files');
const cleanupRoutes = require('./routes/cleanup');
const connectionsRoutes = require('./routes/connections');
const updatesRoutes = require('./routes/updates');
const configsRoutes = require('./routes/configs');
const benchmarkRoutes = require('./routes/benchmark');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'server-panel-secret-key-change-in-production';

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

const authMiddleware = (req, res, next) => {
    const path = req.path;
    if (path === '/auth/login' || path === '/auth/status' || path === '/auth/logout') {
        return next();
    }
    if (req.session && req.session.authenticated) {
        return next();
    }
    res.status(401).json({ error: '未登录', code: 'UNAUTHORIZED' });
};

app.use('/api', authMiddleware);

app.post('/api/auth/login', (req, res) => {
    const { password } = req.body;
    if (!password) {
        return res.status(400).json({ error: '请输入密码' });
    }
    if (password === ADMIN_PASSWORD) {
        req.session.authenticated = true;
        req.session.loginTime = new Date().toISOString();
        return res.json({ success: true, message: '登录成功' });
    }
    res.status(401).json({ error: '密码错误' });
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: '已退出登录' });
});

app.get('/api/auth/status', (req, res) => {
    res.json({
        authenticated: req.session.authenticated || false,
        loginTime: req.session.loginTime || null
    });
});

app.post('/api/auth/change-password', (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!req.session.authenticated) {
        return res.status(401).json({ error: '未登录' });
    }
    if (oldPassword !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: '原密码错误' });
    }
    if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: '新密码长度至少6位' });
    }
    res.json({ success: true, message: '密码修改成功（本次会话有效，重启后需使用新密码）' });
});

app.use('/api/system', systemRoutes);
app.use('/api/processes', processRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/docker', dockerRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/configs', configsRoutes);
app.use('/api/benchmark', benchmarkRoutes);

const ALLOWED_COMMANDS = [
    'ls', 'll', 'la', 'pwd', 'cd', 'cat', 'grep', 'find', 'which',
    'whoami', 'hostname', 'uname', 'date', 'cal', 'df', 'du', 'free',
    'top', 'htop', 'ps', 'pidof', 'pgrep', 'kill', 'killall',
    'netstat', 'ss', 'ping', 'traceroute', 'nslookup', 'dig', 'curl', 'wget',
    'tar', 'zip', 'unzip', 'gzip', 'gunzip',
    'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'touch', 'chmod', 'chown',
    'head', 'tail', 'less', 'more', 'sort', 'uniq', 'wc', 'cut', 'awk', 'sed',
    'apt', 'apt-get', 'yum', 'dnf', 'pacman', 'systemctl', 'service',
    'docker', 'docker ps', 'docker images', 'docker logs',
    'journalctl', 'dmesg', 'uptime', 'load', 'ifconfig', 'ip', 'route'
];

function isCommandAllowed(cmd) {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed.includes('rm -rf') || trimmed.includes('> /dev/') || 
        trimmed.includes('fork') || trimmed.includes('dd if=') ||
        trimmed.includes('shutdown') || trimmed.includes('reboot') ||
        trimmed.includes('init 0') || trimmed.includes('init 6') ||
        trimmed.includes('poweroff') || trimmed.includes('halt')) {
        return false;
    }
    
    const parts = trimmed.split(/\s+/);
    const baseCmd = parts[0];
    
    return ALLOWED_COMMANDS.some(allowed => 
        allowed === baseCmd || trimmed.startsWith(allowed + ' ')
    );
}

function transformCommand(cmd) {
    const trimmed = cmd.trim();
    if (trimmed === 'top') return 'top -bn1 | head -20';
    if (trimmed === 'htop') return 'top -bn1 | head -20';
    if (trimmed === 'ping') return 'ping -c 3 localhost';
    return trimmed;
}

io.on('connection', (socket) => {
    console.log('Terminal connected:', socket.id);
    
    socket.on('command', (data) => {
        const { command } = data;
        
        if (!command || typeof command !== 'string') {
            socket.emit('output', { error: '无效命令' });
            return;
        }
        
        const trimmed = command.trim();
        if (!trimmed) {
            socket.emit('output', { error: '请输入命令' });
            return;
        }
        
        if (!isCommandAllowed(trimmed)) {
            socket.emit('output', { error: '命令不允许执行 (安全限制)' });
            return;
        }
        
        const { spawn } = require('child_process');
        const cmd = transformCommand(trimmed);
        
        console.log(`[CMD] Executing: ${cmd}`);
        
        let proc;
        const shell = cmd.startsWith('sudo') || cmd.includes('|') || cmd.includes('&&') || cmd.includes('||');
        
        try {
            proc = spawn(shell ? '/bin/sh' : '/bin/bash', ['-c', cmd], {
                cwd: process.env.HOME || '/root',
                env: process.env,
                maxBuffer: 1024 * 1024 * 10
            });
        } catch (e) {
            console.error('[CMD] Spawn error:', e.message);
            socket.emit('output', { error: `命令执行失败: ${e.message}` });
            return;
        }
        
        const timeout = setTimeout(() => {
            console.warn(`[CMD] Timeout: ${cmd}`);
            if (proc) {
                proc.kill('SIGKILL');
            }
        }, 30000);

        proc.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[CMD] stdout: ${output.substring(0, 100)}...`);
            socket.emit('output', { stdout: output });
        });

        proc.stderr.on('data', (data) => {
            const output = data.toString();
            console.log(`[CMD] stderr: ${output.substring(0, 100)}...`);
            socket.emit('output', { stderr: output });
        });

        proc.on('close', (code) => {
            clearTimeout(timeout);
            console.log(`[CMD] Exit code: ${code}`);
            socket.emit('output', { done: true, exitCode: code });
        });

        proc.on('error', (err) => {
            clearTimeout(timeout);
            console.error('[CMD] Error:', err.message);
            socket.emit('output', { error: `执行错误: ${err.message}` });
        });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

server.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════════════════╗
║                                                      ║
║     🖥️  服务器管理面板已启动                           ║
║                                                      ║
║     📍 访问地址: http://localhost:${PORT}               ║
║                                                      ║
║     🔐 默认密码: ${ADMIN_PASSWORD}                          ║
║     💡 环境变量 ADMIN_PASSWORD 可修改默认密码           ║
║                                                      ║
║     ⚡ 按 Ctrl+C 停止服务器                           ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
    `);
});
