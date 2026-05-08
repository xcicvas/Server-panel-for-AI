const express = require('express');
const router = express.Router();
const os = require('os');

let benchmarkResults = {
    cpu: null,
    memory: null,
    totalScore: null
};

router.get('/', (req, res) => {
    res.json(benchmarkResults);
});

router.get('/run', (req, res) => {
    const { type } = req.query;
    
    const start = Date.now();
    let score = 0;
    
    if (type === 'cpu') {
        let result = 0;
        for (let i = 0; i < 10000000; i++) {
            result += Math.sqrt(i) * Math.sin(i);
        }
        const elapsed = Date.now() - start;
        score = Math.round(100000 / elapsed * 100);
        benchmarkResults.cpu = { score, elapsed, timestamp: new Date().toISOString() };
    } else if (type === 'memory') {
        const size = 10000000;
        const arr = new Array(size);
        for (let i = 0; i < size; i++) arr[i] = i;
        const elapsed = Date.now() - start;
        score = Math.round(size / elapsed * 10);
        benchmarkResults.memory = { score, elapsed, timestamp: new Date().toISOString() };
    }
    
    if (benchmarkResults.cpu && benchmarkResults.memory) {
        benchmarkResults.totalScore = Math.round(
            (benchmarkResults.cpu.score + benchmarkResults.memory.score) / 2
        );
    }
    
    res.json({
        type,
        score,
        elapsed: Date.now() - start,
        timestamp: new Date().toLocaleString('zh-CN')
    });
});

router.post('/', (req, res) => {
    const { type, score } = req.body;
    
    if (type === 'cpu') {
        benchmarkResults.cpu = { score, timestamp: new Date().toISOString() };
    } else if (type === 'memory') {
        benchmarkResults.memory = { score, timestamp: new Date().toISOString() };
    }
    
    if (benchmarkResults.cpu && benchmarkResults.memory) {
        benchmarkResults.totalScore = Math.round(
            (benchmarkResults.cpu.score + benchmarkResults.memory.score) / 2
        );
    }
    
    res.json({
        type,
        score,
        totalScore: benchmarkResults.totalScore
    });
});

module.exports = router;
