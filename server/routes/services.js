const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');

router.get('/', (req, res) => {
    try {
        const services = [];
        try {
            const output = execSync('systemctl list-units --type=service --all --no-pager --no-legend', { encoding: 'utf-8' });
            const lines = output.trim().split('\n');
            lines.forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 4 && parts[0]) {
                    services.push({
                        name: parts[0].replace('.service', ''),
                        status: parts[2] === 'active' ? 'running' : 'stopped',
                        active: parts[2] === 'active',
                        description: parts.slice(4).join(' ')
                    });
                }
            });
        } catch (e) {}
        res.json({ services });
    } catch (error) {
        res.status(500).json({ error: '获取服务列表失败' });
    }
});

router.post('/:name', (req, res) => {
    const serviceName = req.params.name.replace('.service', '');
    const { action } = req.body;
    if (!['start', 'stop', 'restart'].includes(action)) {
        return res.status(400).json({ success: false, message: '无效的操作' });
    }
    try {
        execSync(`systemctl ${action} ${serviceName}.service`, { encoding: 'utf-8', timeout: 30000 });
        res.json({ success: true, message: `服务 ${serviceName} 已${action === 'start' ? '启动' : action === 'stop' ? '停止' : '重启'}` });
    } catch (error) {
        res.status(500).json({ success: false, message: `服务操作失败: ${error.message}` });
    }
});

module.exports = router;
