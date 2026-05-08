const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.get('/files', (req, res) => {
    const cmd = 'find / -type f -size +100M 2>/dev/null | head -20';
    exec(cmd, { timeout: 30000 }, (error, stdout) => {
        if (error) {
            return res.json({ error: '扫描失败', files: [] });
        }
        const files = stdout.trim().split('\n').filter(Boolean).map(f => ({
            path: f,
            size: '未知'
        }));
        res.json({ files });
    });
});

router.get('/logs', (req, res) => {
    const cmd = 'du -sh /var/log/* 2>/dev/null | sort -rh | head -10';
    exec(cmd, { timeout: 10000 }, (error, stdout) => {
        const logSizes = error ? [] : stdout.trim().split('\n').filter(Boolean);
        res.json({ logSizes });
    });
});

router.get('/summary', (req, res) => {
    const os = require('os');
    const disk = {
        used: 0,
        total: 100,
        usagePercent: 50
    };
    res.json({ disk });
});

module.exports = router;
