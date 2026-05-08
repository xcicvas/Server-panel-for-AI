const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

const logPaths = {
    syslog: '/var/log/syslog',
    auth: '/var/log/auth.log',
    dmesg: '/var/log/dmesg',
    nginx: '/var/log/nginx/access.log',
    mysql: '/var/log/mysql/error.log'
};

router.get('/', (req, res) => {
    const { type = 'syslog', lines = 100 } = req.query;
    
    let logPath = logPaths[type];
    
    if (!logPath) {
        return res.json({ error: '不支持的日志类型' });
    }
    
    const cmd = `tail -n ${lines} "${logPath}" 2>/dev/null || echo "无法读取日志文件"`;
    
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
            return res.json({ 
                content: `日志路径: ${logPath}\n无法读取该日志文件，可能需要 sudo 权限\n\n提示: 尝试将当前用户加入相应的日志组`,
                error: '读取失败'
            });
        }
        res.json({ content: stdout || '无日志内容' });
    });
});

module.exports = router;
