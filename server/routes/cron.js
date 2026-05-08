const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const cronFile = path.join(__dirname, '../../data/cronjobs.json');

function loadCronjobs() {
    try {
        if (!fs.existsSync(path.dirname(cronFile))) {
            fs.mkdirSync(path.dirname(cronFile), { recursive: true });
        }
        if (fs.existsSync(cronFile)) {
            return JSON.parse(fs.readFileSync(cronFile, 'utf8'));
        }
    } catch (e) {}
    return [];
}

function saveCronjobs(jobs) {
    const dir = path.dirname(cronFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cronFile, JSON.stringify(jobs, null, 2));
}

router.get('/', (req, res) => {
    const jobs = loadCronjobs();
    res.json({ jobs });
});

router.post('/', (req, res) => {
    const { name, schedule, command } = req.body;
    if (!name || !schedule || !command) {
        return res.json({ success: false, message: '缺少必要参数' });
    }
    
    const jobs = loadCronjobs();
    const newJob = {
        id: Date.now().toString(),
        name,
        schedule,
        command,
        enabled: true,
        nextRun: calculateNextRun(schedule)
    };
    
    jobs.push(newJob);
    saveCronjobs(jobs);
    
    res.json({ success: true, message: '任务已添加' });
});

router.put('/:name', (req, res) => {
    const { name } = req.params;
    const { enabled, schedule, command } = req.body;
    
    const jobs = loadCronjobs();
    const job = jobs.find(j => j.name === name);
    
    if (!job) {
        return res.json({ success: false, message: '任务不存在' });
    }
    
    if (enabled !== undefined) job.enabled = enabled;
    if (schedule) job.schedule = schedule;
    if (command) job.command = command;
    if (schedule) job.nextRun = calculateNextRun(schedule);
    
    saveCronjobs(jobs);
    res.json({ success: true, message: '任务已更新' });
});

router.delete('/:name', (req, res) => {
    const { name } = req.params;
    let jobs = loadCronjobs();
    jobs = jobs.filter(j => j.name !== name);
    saveCronjobs(jobs);
    res.json({ success: true, message: '任务已删除' });
});

function calculateNextRun(schedule) {
    return new Date().toLocaleString('zh-CN');
}

module.exports = router;
