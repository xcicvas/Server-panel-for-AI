const express = require('express');
const router = express.Router();
const { execSync } = require('child_process');

const ALLOWED_COMMANDS = [
    'ls', 'll', 'pwd', 'cat', 'grep', 'find', 'whoami', 'hostname', 'uname', 'date', 'df', 'du', 'free',
    'ps', 'kill', 'netstat', 'ss', 'ping', 'curl', 'wget', 'tar', 'zip', 'unzip',
    'cp', 'mv', 'rm', 'mkdir', 'chmod', 'chown',
    'head', 'tail', 'sort', 'wc', 'awk', 'sed',
    'systemctl', 'service'
];

function isCommandAllowed(cmd) {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed.includes('rm -rf') || trimmed.includes('shutdown') || trimmed.includes('reboot')) {
        return false;
    }
    const baseCmd = trimmed.split(/\s+/)[0];
    return ALLOWED_COMMANDS.includes(baseCmd);
}

router.post('/execute', (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: '命令不能为空' });
    if (!isCommandAllowed(command)) {
        return res.status(403).json({ error: '命令不允许执行' });
    }
    try {
        const output = execSync(command, { encoding: 'utf-8', timeout: 10000 });
        res.json({ success: true, output });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;
