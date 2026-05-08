const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');

router.get('/', (req, res) => {
    try {
        const ports = [];
        try {
            const output = execSync('ss -tuln', { encoding: 'utf-8' });
            const lines = output.trim().split('\n');
            lines.slice(1).forEach(line => {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    const localAddr = parts[4];
                    const lastColon = localAddr.lastIndexOf(':');
                    const addr = localAddr.substring(0, lastColon);
                    const port = parseInt(localAddr.substring(lastColon + 1));
                    if (!isNaN(port)) {
                        ports.push({
                            protocol: parts[0].replace('LISTEN', '').toLowerCase(),
                            localAddress: addr || '0.0.0.0',
                            localPort: port,
                            state: 'LISTENING'
                        });
                    }
                }
            });
        } catch (e) {}
        res.json({ ports, connections: [] });
    } catch (error) {
        res.status(500).json({ error: '获取网络信息失败' });
    }
});

module.exports = router;
