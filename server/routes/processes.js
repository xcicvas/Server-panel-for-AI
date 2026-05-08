const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');

router.get('/', (req, res) => {
    try {
        const output = execSync('ps aux --sort=-%cpu | head -50', { encoding: 'utf-8' });
        const lines = output.trim().split('\n');
        const processes = [];

        lines.slice(1).forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 11) {
                const pid = parseInt(parts[1]);
                if (pid === 0 || pid === 2) return;
                processes.push({
                    pid: pid,
                    user: parts[0],
                    cpu: parseFloat(parts[2]),
                    memory: parseFloat(parts[3]),
                    vsz: parts[4],
                    rss: parts[5],
                    tty: parts[6],
                    stat: parts[7],
                    start: parts[8],
                    time: parts[9],
                    command: parts.slice(10).join(' ')
                });
            }
        });
        res.json({ processes });
    } catch (error) {
        res.status(500).json({ error: '获取进程列表失败' });
    }
});

router.delete('/:pid', (req, res) => {
    const pid = parseInt(req.params.pid);
    if (isNaN(pid) || pid <= 1) {
        return res.status(400).json({ success: false, message: '无效的进程ID' });
    }
    try {
        process.kill(pid, 'SIGTERM');
        res.json({ success: true, message: `进程 ${pid} 已终止` });
    } catch (error) {
        res.status(500).json({ success: false, message: `终止进程失败: ${error.message}` });
    }
});

module.exports = router;
