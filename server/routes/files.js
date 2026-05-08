const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

router.get('/', (req, res) => {
    let requestedPath = req.query.path || '/';
    
    requestedPath = path.normalize(requestedPath);
    
    if (requestedPath.startsWith('..')) {
        return res.json({ error: '禁止访问上级目录' });
    }
    
    if (!fs.existsSync(requestedPath)) {
        return res.json({ error: '路径不存在' });
    }
    
    try {
        const stats = fs.statSync(requestedPath);
        
        if (!stats.isDirectory()) {
            return res.json({ error: '请选择目录路径' });
        }
        
        const items = fs.readdirSync(requestedPath);
        const files = items.map(name => {
            try {
                const fullPath = path.join(requestedPath, name);
                const stat = fs.statSync(fullPath);
                return {
                    name,
                    type: stat.isDirectory() ? 'dir' : 'file',
                    size: stat.size,
                    mtime: stat.mtime.toLocaleString('zh-CN'),
                    mode: stat.mode.toString(8).slice(-3)
                };
            } catch (e) {
                return {
                    name,
                    type: 'unknown',
                    size: 0,
                    mtime: '-',
                    mode: '???'
                };
            }
        });
        
        files.sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
        });
        
        res.json({ files, path: requestedPath });
    } catch (e) {
        res.json({ error: '无法读取目录: ' + e.message });
    }
});

module.exports = router;
