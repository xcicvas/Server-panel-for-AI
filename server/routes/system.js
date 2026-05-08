const express = require('express');
const router = express.Router();
const os = require('os');
const { execSync } = require('child_process');

router.get('/info', (req, res) => {
    try {
        const info = {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            uptime: os.uptime(),
            loadavg: os.loadavg(),
            type: os.type(),
            release: os.release(),
            totalMemory: os.totalmem(),
            freeMemory: os.freemem()
        };
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: '获取系统信息失败' });
    }
});

router.get('/cpu', (req, res) => {
    try {
        let cpuModel = 'Unknown';
        let cpuCores = os.cpus().length;
        let cpuSpeed = os.cpus()[0]?.speed || 0;

        try {
            const cpuInfo = execSync('cat /proc/cpuinfo | grep "model name" | head -1', { encoding: 'utf-8' });
            const match = cpuInfo.match(/model name\s*:\s*(.+)/);
            if (match) cpuModel = match[1].trim();
        } catch (e) {}

        let usage = 0;
        try {
            const stats1 = os.cpus();
            const total1 = stats1.reduce((acc, cpu) => acc + cpu.times.user + cpu.times.idle + cpu.times.sys + cpu.times.irq, 0);
            const idle1 = stats1.reduce((acc, cpu) => acc + cpu.times.idle, 0);
            const start = Date.now();
            while (Date.now() - start < 50) {}
            const stats2 = os.cpus();
            const total2 = stats2.reduce((acc, cpu) => acc + cpu.times.user + cpu.times.idle + cpu.times.sys + cpu.times.irq, 0);
            const idle2 = stats2.reduce((acc, cpu) => acc + cpu.times.idle, 0);
            usage = Math.round((1 - (idle2 - idle1) / (total2 - total1)) * 100);
        } catch (e) {}

        res.json({ model: cpuModel, cores: cpuCores, speed: cpuSpeed, usage: usage });
    } catch (error) {
        res.status(500).json({ error: '获取CPU信息失败' });
    }
});

router.get('/memory', (req, res) => {
    try {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usagePercent = Math.round((used / total) * 100);
        res.json({ total, used, free, usagePercent });
    } catch (error) {
        res.status(500).json({ error: '获取内存信息失败' });
    }
});

router.get('/disk', (req, res) => {
    try {
        const output = execSync("df -k / | tail -1", { encoding: 'utf-8' });
        const parts = output.trim().split(/\s+/);
        const total = parseInt(parts[1]) * 1024;
        const used = parseInt(parts[2]) * 1024;
        const free = parseInt(parts[3]) * 1024;
        const usagePercent = parseInt(parts[4]);
        res.json({ total, used, free, usagePercent });
    } catch (error) {
        res.status(500).json({ error: '获取磁盘信息失败' });
    }
});

module.exports = router;
