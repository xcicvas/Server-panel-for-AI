const express = require('express');
const router = express.Router();
const os = require('os');

router.get('/', (req, res) => {
    const events = [];
    const now = new Date();
    
    events.push({
        time: now.toLocaleString('zh-CN'),
        title: '面板启动',
        desc: `服务器管理面板已启动运行`,
        type: 'success'
    });
    
    events.push({
        time: new Date(now - 30000).toLocaleString('zh-CN'),
        title: '系统状态检查',
        desc: `主机名: ${os.hostname()}, 运行时间: ${Math.floor(os.uptime() / 3600)}小时`,
        type: 'info'
    });
    
    events.push({
        time: new Date(now - 60000).toLocaleString('zh-CN'),
        title: '监控服务',
        desc: '持续监控服务器 CPU、内存、磁盘状态',
        type: 'info'
    });
    
    events.push({
        time: new Date(now - 120000).toLocaleString('zh-CN'),
        title: '告警检查',
        desc: '检查系统资源使用情况',
        type: 'info'
    });
    
    const loadavg = os.loadavg();
    if (loadavg[0] > 2) {
        events.push({
            time: new Date(now - 180000).toLocaleString('zh-CN'),
            title: '负载警告',
            desc: `系统负载较高: ${loadavg[0].toFixed(2)}`,
            type: 'warning'
        });
    }
    
    const freeMem = os.freemem();
    const totalMem = os.totalmem();
    const memPercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);
    if (memPercent > 80) {
        events.push({
            time: new Date(now - 240000).toLocaleString('zh-CN'),
            title: '内存使用警告',
            desc: `内存使用率: ${memPercent}%`,
            type: 'warning'
        });
    }
    
    events.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    res.json({ events });
});

module.exports = router;
