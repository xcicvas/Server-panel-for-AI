const express = require('express');
const router = express.Router();
const fs = require('fs');

router.get('/', (req, res) => {
    const { path: filePath } = req.query;
    
    if (!filePath) {
        return res.json({ error: '请提供配置文件路径' });
    }
    
    const allowedPaths = [
        '/etc/nginx/nginx.conf',
        '/etc/my.cnf',
        '/etc/ssh/sshd_config',
        '/etc/systemd/system.conf',
        '/etc/hosts',
        '/etc/passwd',
        '/etc/fstab'
    ];
    
    if (!allowedPaths.some(p => filePath.startsWith(p) || filePath === p)) {
        return res.json({ error: '路径不在允许范围内' });
    }
    
    try {
        if (!fs.existsSync(filePath)) {
            return res.json({ error: '文件不存在或无权限访问' });
        }
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content: content.substring(0, 5000) });
    } catch (e) {
        res.json({ error: '无法读取文件: ' + e.message });
    }
});

module.exports = router;
