const socket = io();
let chart = null;
let cpuHistory = [];
let memoryHistory = [];
let currentSystemData = {};

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${minutes}分钟`;
    return `${minutes}分钟`;
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateTime() {
    document.getElementById('currentTime').textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function navigateTo(page) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
    document.querySelector('.page-title').textContent = document.querySelector(`.nav-item[data-page="${page}"]`).textContent.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').trim() || page;
    if (page === 'alerts') loadAlerts();
}

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.page); }));

async function loadDashboard() {
    try {
        const [infoRes, cpuRes, memRes, diskRes] = await Promise.all([
            fetch('/api/system/info'),
            fetch('/api/system/cpu'),
            fetch('/api/system/memory'),
            fetch('/api/system/disk')
        ]);
        
        const info = await infoRes.json();
        const cpu = await cpuRes.json();
        const mem = await memRes.json();
        const disk = await diskRes.json();
        
        currentSystemData = { cpu, memory: mem, disk };
        
        document.getElementById('hostname').textContent = info.hostname || '-';
        document.getElementById('platform').textContent = `${info.type} (${info.arch})`;
        document.getElementById('uptime').textContent = formatUptime(info.uptime);
        document.getElementById('loadavg').textContent = (info.loadavg || []).map(l => l.toFixed(2)).join(', ');
        
        document.getElementById('cpuModel').textContent = (cpu.model || '-').substring(0, 30);
        document.getElementById('cpuCores').textContent = cpu.cores || '-';
        document.getElementById('cpuSpeed').textContent = cpu.speed ? `${cpu.speed} MHz` : '-';
        updateProgress(0, cpu.usage);
        
        document.getElementById('memUsed').textContent = formatBytes(mem.used);
        document.getElementById('memFree').textContent = formatBytes(mem.free);
        document.getElementById('memTotal').textContent = formatBytes(mem.total);
        updateProgress(1, mem.usagePercent);
        
        document.getElementById('diskUsed').textContent = formatBytes(disk.used);
        document.getElementById('diskFree').textContent = formatBytes(disk.free);
        document.getElementById('diskTotal').textContent = formatBytes(disk.total);
        updateProgress(2, disk.usagePercent);
        
        cpuHistory.push(cpu.usage);
        memoryHistory.push(mem.usagePercent);
        if (cpuHistory.length > 30) { cpuHistory.shift(); memoryHistory.shift(); }
        
        updateChart();
        checkAlerts();
    } catch (error) {
        console.error('加载失败:', error);
    }
}

function updateProgress(index, percent) {
    const cards = document.querySelectorAll('.card');
    if (!cards[index]) return;
    const progress = cards[index].querySelector('.progress');
    const value = cards[index].querySelector('.value');
    const circumference = 283;
    progress.style.strokeDashoffset = circumference - (percent / 100) * circumference;
    value.textContent = `${Math.round(percent)}%`;
}

function updateChart() {
    if (!chart) {
        const ctx = document.getElementById('chart');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(30).fill(''),
                datasets: [
                    { label: 'CPU %', data: cpuHistory, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)', fill: true, tension: 0.4, pointRadius: 0 },
                    { label: '内存 %', data: memoryHistory, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', fill: true, tension: 0.4, pointRadius: 0 }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: { display: false },
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } }
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } }
            }
        });
    }
    chart.data.labels = Array(30 - cpuHistory.length).fill('').concat(cpuHistory.map(() => ''));
    chart.data.datasets[0].data = Array(30 - cpuHistory.length).fill(null).concat(cpuHistory);
    chart.data.datasets[1].data = Array(30 - memoryHistory.length).fill(null).concat(memoryHistory);
    chart.update('none');
}

async function checkAlerts() {
    try {
        const res = await fetch('/api/alerts/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentSystemData)
        });
        const data = await res.json();
        if (data.newAlerts?.length) {
            data.newAlerts.forEach(alert => showToast(alert.ruleName + ' 超过阈值!', alert.level === 'critical' ? 'error' : 'warning'));
        }
    } catch (e) {}
}

const cmdInput = document.getElementById('cmdInput');
const terminalOutput = document.getElementById('terminalOutput');

if (cmdInput) {
    cmdInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && cmdInput.value.trim()) {
            const cmd = cmdInput.value.trim();
            terminalOutput.innerHTML += `<div style="color:#00d4ff">$ ${cmd}</div>`;
            socket.emit('command', { command: cmd });
            cmdInput.value = '';
        }
    });
    
    socket.on('output', data => {
        if (data.stdout) terminalOutput.innerHTML += data.stdout.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        if (data.stderr) terminalOutput.innerHTML += `<div style="color:#ff4757">${data.stderr}</div>`;
        if (data.error) terminalOutput.innerHTML += `<div style="color:#ff4757">${data.error}</div>`;
        if (data.done) terminalOutput.innerHTML += `<div style="color:#00d4ff">$ </div>`;
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    });
}

async function loadProcesses() {
    const tbody = document.getElementById('processTable');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">加载中...</td></tr>';
    try {
        const res = await fetch('/api/processes');
        const data = await res.json();
        if (!data.processes?.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">暂无数据</td></tr>'; return; }
        const search = document.getElementById('processSearch')?.value.toLowerCase() || '';
        const filtered = data.processes.filter(p => p.command.toLowerCase().includes(search) || p.pid.toString().includes(search));
        tbody.innerHTML = filtered.slice(0, 50).map(p => `
            <tr>
                <td>${p.pid}</td>
                <td>${p.user}</td>
                <td style="color:${p.cpu > 80 ? '#ff4757' : '#00d4ff'}">${p.cpu.toFixed(1)}%</td>
                <td style="color:${p.memory > 80 ? '#ff9500' : '#a855f7'}">${p.memory.toFixed(1)}%</td>
                <td title="${p.command}">${p.command.substring(0, 40)}</td>
                <td><button onclick="killProcess(${p.pid})">终止</button></td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">加载失败</td></tr>'; }
}

async function killProcess(pid) {
    if (!confirm(`确定终止进程 ${pid}?`)) return;
    try {
        const res = await fetch(`/api/processes/${pid}`, { method: 'DELETE' });
        const data = await res.json();
        showToast(data.message || '操作完成', data.success ? 'success' : 'error');
        loadProcesses();
    } catch (e) { showToast('操作失败', 'error'); }
}

async function loadNetwork() {
    const tbody = document.getElementById('networkTable');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px">加载中...</td></tr>';
    try {
        const res = await fetch('/api/network');
        const data = await res.json();
        if (!data.ports?.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px">暂无数据</td></tr>'; return; }
        tbody.innerHTML = data.ports.map(p => `<tr><td>${p.protocol.toUpperCase()}</td><td>${p.localAddress}</td><td>${p.localPort}</td><td>${p.state}</td></tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px">加载失败</td></tr>'; }
}

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = '<div class="empty-state">加载中...</div>';
    try {
        const res = await fetch('/api/services');
        const data = await res.json();
        if (!data.services?.length) { grid.innerHTML = '<div class="empty-state">暂无数据</div>'; return; }
        grid.innerHTML = data.services.slice(0, 30).map(s => `
            <div class="service-card ${s.active ? 'running' : 'stopped'}">
                <h4>${s.name}</h4>
                <div class="status">${s.status}</div>
                <div class="service-actions">
                    ${!s.active ? `<button class="start" onclick="controlService('${s.name}','start')">启动</button>` : ''}
                    ${s.active ? `<button class="stop" onclick="controlService('${s.name}','stop')">停止</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (e) { grid.innerHTML = '<div class="empty-state">加载失败</div>'; }
}

async function controlService(name, action) {
    try {
        const res = await fetch(`/api/services/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
        const data = await res.json();
        showToast(data.message || '操作完成', data.success ? 'success' : 'error');
        loadServices();
    } catch (e) { showToast('操作失败', 'error'); }
}

async function loadAlerts() {
    await Promise.all([loadAlertRules(), loadActiveAlerts()]);
}

async function loadAlertRules() {
    const grid = document.getElementById('rulesGrid');
    try {
        const res = await fetch('/api/alerts/rules');
        const data = await res.json();
        if (!data.rules?.length) { grid.innerHTML = '<div class="empty-state">暂无规则</div>'; return; }
        grid.innerHTML = data.rules.map(rule => {
            const value = currentSystemData[rule.metric]?.usage || currentSystemData[rule.metric]?.usagePercent || 0;
            const valueClass = value >= rule.threshold ? 'critical' : value >= rule.threshold - 10 ? 'warning' : 'normal';
            return `
                <div class="rule-card ${rule.enabled ? '' : 'disabled'}">
                    <h4>${rule.name}</h4>
                    <div class="rule-current">
                        <span>当前值</span>
                        <span class="rule-current-value ${valueClass}">${value.toFixed(1)}%</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                        <span>启用</span>
                        <label class="toggle">
                            <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="updateRule('${rule.id}',{enabled:this.checked})">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span>阈值</span>
                        <div style="display:flex;gap:8px;align-items:center">
                            <input type="number" class="threshold-input" id="threshold-${rule.id}" value="${rule.threshold}" min="1" max="100">
                            <span>%</span>
                        </div>
                    </div>
                    <button class="btn-save" onclick="saveRule('${rule.id}')" style="width:100%;margin-top:12px">保存</button>
                </div>
            `;
        }).join('');
    } catch (e) { grid.innerHTML = '<div class="empty-state">加载失败</div>'; }
}

async function updateRule(id, updates) {
    try {
        await fetch(`/api/alerts/rules/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
        showToast('规则已更新', 'success');
    } catch (e) { showToast('更新失败', 'error'); }
}

async function saveRule(id) {
    const input = document.getElementById(`threshold-${id}`);
    if (input) { await updateRule(id, { threshold: parseInt(input.value) }); await loadAlertRules(); }
}

async function loadActiveAlerts() {
    const container = document.getElementById('activeAlerts');
    try {
        const res = await fetch('/api/alerts/active');
        const data = await res.json();
        const warnings = data.alerts.filter(a => a.level === 'warning').length;
        const criticals = data.alerts.filter(a => a.level === 'critical').length;
        document.getElementById('warningCount').textContent = warnings;
        document.getElementById('criticalCount').textContent = criticals;
        if (!data.alerts?.length) { container.innerHTML = '<div class="empty-state">系统运行正常</div>'; return; }
        container.innerHTML = data.alerts.map(a => `
            <div class="alert-item ${a.level}">
                <div class="alert-content">
                    <div class="alert-title">${a.ruleName}</div>
                    <div class="alert-message">超过阈值: ${a.threshold}%</div>
                </div>
                <div class="alert-value ${a.level}">${a.value.toFixed(1)}%</div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<div class="empty-state">加载失败</div>'; }
}

document.getElementById('processSearch')?.addEventListener('input', loadProcesses);

updateTime();
setInterval(updateTime, 1000);
loadDashboard();
setInterval(loadDashboard, 3000);
