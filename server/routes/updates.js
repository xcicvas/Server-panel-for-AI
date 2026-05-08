const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

router.get('/', (req, res) => {
    const updates = [
        { name: 'openssl', version: '1.1.1w', size: '2.3 MB', security: true },
        { name: 'bash', version: '5.1.16', size: '1.5 MB', security: true },
        { name: 'curl', version: '8.4.0', size: '0.8 MB', security: false },
        { name: 'git', version: '2.42.0', size: '5.2 MB', security: false }
    ];
    res.json({ updates });
});

module.exports = router;
