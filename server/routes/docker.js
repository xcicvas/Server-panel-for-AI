const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.get('/check', (req, res) => {
    exec('which docker && docker --version', (error) => {
        res.json({ installed: !error });
    });
});

router.get('/', (req, res) => {
    exec('docker ps -a --format "{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.State}}"', (error, stdout) => {
        if (error) {
            return res.json({ error: 'Docker 未安装或未运行', containers: [] });
        }
        
        const containers = stdout.trim().split('\n').filter(Boolean).map(line => {
            const [id, name, image, status, state] = line.split('|');
            return {
                id,
                name,
                image,
                status,
                state: state === 'running' ? 'running' : 'stopped',
                cpu: '0',
                memory: '0'
            };
        });
        
        res.json({ containers });
    });
});

router.post('/', (req, res) => {
    const { id, action } = req.body;
    
    if (!id || !action) {
        return res.json({ success: false, message: '缺少参数' });
    }
    
    const validActions = ['start', 'stop', 'restart'];
    if (!validActions.includes(action)) {
        return res.json({ success: false, message: '无效的操作' });
    }
    
    exec(`docker ${action} ${id}`, (error, stdout, stderr) => {
        if (error) {
            return res.json({ success: false, message: stderr || error.message });
        }
        res.json({ success: true, message: `容器 ${action} 成功` });
    });
});

module.exports = router;
