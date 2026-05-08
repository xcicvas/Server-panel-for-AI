const express = require('express');
const router = express.Router();

const alerts = [];
const alertHistory = [];
const alertRules = new Map([
    { id: 'cpu', name: 'CPU 使用率', metric: 'cpu', threshold: 80, enabled: true },
    { id: 'memory', name: '内存使用率', metric: 'memory', threshold: 85, enabled: true },
    { id: 'disk', name: '磁盘使用率', metric: 'disk', threshold: 90, enabled: true }
].reduce((m, r) => m.set(r.id, r), new Map()));

router.get('/rules', (req, res) => {
    res.json({ rules: Array.from(alertRules.values()) });
});

router.put('/rules/:id', (req, res) => {
    const rule = alertRules.get(req.params.id);
    if (!rule) return res.status(404).json({ error: '规则不存在' });
    Object.assign(rule, req.body);
    res.json({ success: true, rule });
});

router.get('/active', (req, res) => {
    res.json({ alerts: alerts.filter(a => !a.resolved) });
});

router.get('/history', (req, res) => {
    res.json({ alerts: alertHistory.slice(0, 50) });
});

router.delete('/history', (req, res) => {
    alertHistory.length = 0;
    res.json({ success: true });
});

router.post('/check', (req, res) => {
    const { cpu, memory, disk } = req.body;
    const newAlerts = [];
    
    alertRules.forEach((rule, id) => {
        if (!rule.enabled) return;
        let currentValue = 0;
        if (rule.metric === 'cpu') currentValue = cpu?.usage || 0;
        if (rule.metric === 'memory') currentValue = memory?.usagePercent || 0;
        if (rule.metric === 'disk') currentValue = disk?.usagePercent || 0;
        
        if (currentValue >= rule.threshold) {
            if (!alerts.find(a => a.ruleId === id && !a.resolved)) {
                const alert = {
                    id: Date.now(),
                    ruleId: id,
                    ruleName: rule.name,
                    metric: rule.metric,
                    value: currentValue,
                    threshold: rule.threshold,
                    level: currentValue >= rule.threshold + 10 ? 'critical' : 'warning',
                    timestamp: new Date().toISOString(),
                    resolved: false
                };
                alerts.unshift(alert);
                alertHistory.unshift({ ...alert });
                newAlerts.push(alert);
            }
        }
    });
    
    res.json({ success: true, newAlerts, activeCount: alerts.filter(a => !a.resolved).length });
});

router.post('/resolve/:id', (req, res) => {
    const alert = alerts.find(a => a.id === parseInt(req.params.id));
    if (!alert) return res.status(404).json({ error: '告警不存在' });
    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    res.json({ success: true });
});

module.exports = router;
