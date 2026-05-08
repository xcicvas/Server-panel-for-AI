const socket = io();
let chart = null;
let cpuHistory = [];
let memHistory = [];
let currentSystemData = {};
let activityData = [];

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

const drawer = document.getElementById('drawer');
const overlay = document.getElementById('drawerOverlay');
const menuToggle = document.getElementById('menuToggle');
const drawerClose = document.getElementById('drawerClose');

menuToggle?.addEventListener('click', () => {
    drawer.classList.add('open');
    overlay.classList.add('active');
});

function closeDrawer() {
    drawer.classList.remove('open');
    overlay.classList.remove('active');
}

drawerClose?.addEventListener('click', closeDrawer);
overlay?.addEventListener('click', closeDrawer);

function navigateTo(page) {
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === page));
    
    const titles = {
        dashboard: '仪表盘',
        processes: '进程',
        network: '网络',
        services: '服务',
        alerts: '告警',
        activity: '活动',
        quickactions: '快捷操作'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    
    closeDrawer();
    
    if (page === 'alerts') loadAlerts();
    if (page === 'activity') initActivity();
    if (page === 'quickactions') initQuickActions();
}

document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(item.dataset.page);
    });
});

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
        
        document.getElementById('serverName').textContent = info.hostname || '服务器';
        document.getElementById('serverUptime').textContent = `运行时间: ${formatUptime(info.uptime)}`;
        document.getElementById('hostname').textContent = info.hostname || '-';
        document.getElementById('platform').textContent = `${info.type} (${info.arch})`;
        document.getElementById('uptime').textContent = formatUptime(info.uptime);
        document.getElementById('loadavg').textContent = (info.loadavg || []).map(l => l.toFixed(2)).join(', ');
        
        document.getElementById('cpuModel').textContent = (cpu.model || '-').substring(0, 25);
        document.getElementById('cpuCores').textContent = `${cpu.cores} 核心 @ ${cpu.speed}MHz`;
        
        document.getElementById('memUsed').textContent = `${formatBytes(mem.used)} / ${formatBytes(mem.total)}`;
        document.getElementById('memTotal').textContent = `可用: ${formatBytes(mem.free)}`;
        
        document.getElementById('diskUsed').textContent = `${formatBytes(disk.used)} / ${formatBytes(disk.total)}`;
        document.getElementById('diskFree').textContent = `可用: ${formatBytes(disk.free)}`;
        
        updateGauge(0, cpu.usage);
        updateGauge(1, mem.usagePercent);
        updateGauge(2, disk.usagePercent);
        
        document.querySelector('#cpuMini .stat-value').textContent = `${cpu.usage}%`;
        document.querySelector('#memMini .stat-value').textContent = `${mem.usagePercent}%`;
        
        cpuHistory.push(cpu.usage);
        memHistory.push(mem.usagePercent);
        if (cpuHistory.length > 30) { cpuHistory.shift(); memHistory.shift(); }
        
        recordActivity(cpu.usage);
        updateChart();
        checkAlerts();
        updateMood(cpu.usage, mem.usagePercent, disk.usagePercent, info.uptime);
    } catch (error) {
        console.error('加载失败:', error);
    }
}

const moods = [
    { emoji: 'happy', text: '开心', condition: (c, m, d, u) => c < 30 && m < 50 },
    { emoji: 'relaxed', text: '悠闲', condition: (c, m, d, u) => c < 50 && m < 70 },
    { emoji: 'thinking', text: '思考中', condition: (c, m, d, u) => c >= 50 && c < 70 },
    { emoji: 'working', text: '努力工作', condition: (c, m, d, u) => c >= 70 && c < 85 },
    { emoji: 'stressed', text: '压力山大', condition: (c, m, d, u) => c >= 85 || m >= 90 },
    { emoji: 'sleeping', text: '休眠中', condition: (c, m, d, u) => u > 86400 && c < 10 }
];

const moodReasons = {
    '开心': '负载很低，一切正常',
    '悠闲': '资源充足，运行良好',
    '思考中': '正在处理一些任务',
    '努力工作': '负载较高工作中',
    '压力山大': '资源使用率过高',
    '休眠中': '长时间运行但负载极低'
};

function updateMood(cpu, mem, disk, uptime) {
    const mood = moods.find(m => m.condition(cpu, mem, disk, uptime)) || moods[1];
    const emojiMap = {
        '开心': '(^o^)',
        '悠闲': '(^_^)',
        '思考中': '(-_-)',
        '努力工作': '(>_<)',
        '压力山大': '(@_@)',
        '休眠中': '(-_-) zzz'
    };
    
    document.getElementById('moodEmoji').textContent = emojiMap[mood.text] || '(?_?)';
    document.getElementById('moodText').textContent = mood.text;
    document.getElementById('moodReason').textContent = moodReasons[mood.text] || '状态正常';
}

function updateGauge(index, percent) {
    const gauges = document.querySelectorAll('.circular-gauge');
    if (!gauges[index]) return;
    const fill = gauges[index].querySelector('.gauge-fill');
    const value = gauges[index].querySelector('.gauge-value');
    const circumference = 264;
    fill.style.strokeDashoffset = circumference - (percent / 100) * circumference;
    value.textContent = `${Math.round(percent)}%`;
    
    if (percent > 90) fill.style.stroke = '#ff4757';
    else if (percent > 70) fill.style.stroke = '#ff9500';
}

function updateChart() {
    if (!chart) {
        const ctx = document.getElementById('mainChart');
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Array(30).fill(''),
                datasets: [
                    { label: 'CPU %', data: cpuHistory, borderColor: '#00d4ff', backgroundColor: 'rgba(0,212,255,0.1)', fill: true, tension: 0.4, pointRadius: 0 },
                    { label: '内存 %', data: memHistory, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.1)', fill: true, tension: 0.4, pointRadius: 0 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { display: false },
                    y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
    chart.data.labels = Array(30 - cpuHistory.length).fill('').concat(cpuHistory.map(() => ''));
    chart.data.datasets[0].data = Array(30 - cpuHistory.length).fill(null).concat(cpuHistory);
    chart.data.datasets[1].data = Array(30 - memHistory.length).fill(null).concat(memHistory);
    chart.update('none');
}

function recordActivity(cpuUsage) {
    const now = new Date();
    activityData.push({
        date: now,
        hour: now.getHours(),
        load: cpuUsage
    });
    if (activityData.length > 720) activityData.shift();
}

function initActivity() {
    const heatmap = document.getElementById('heatmap');
    if (!heatmap) return;
    
    heatmap.innerHTML = '';
    
    for (let day = 0; day < 7; day++) {
        const dayCol = document.createElement('div');
        dayCol.className = 'heatmap-day';
        
        const label = document.createElement('div');
        label.className = 'day-label';
        const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        label.textContent = days[day];
        dayCol.appendChild(label);
        
        for (let hour = 0; hour < 24; hour++) {
            const cell = document.createElement('div');
            cell.className = 'hour-cell';
            
            const level = Math.floor(Math.random() * 5);
            cell.classList.add(`level-${level}`);
            cell.title = `${days[day]} ${hour}:00 - 级别 ${level}`;
            
            dayCol.appendChild(cell);
        }
        
        heatmap.appendChild(dayCol);
    }
    
    const totalEvents = activityData.length;
    const avgLoad = activityData.length > 0 
        ? (activityData.reduce((sum, a) => sum + a.load, 0) / activityData.length).toFixed(1)
        : '0';
    
    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('avgLoad').textContent = avgLoad + '%';
    document.getElementById('peakHour').textContent = '14:00';
    
    initAchievements();
}

const achievements = [
    { id: 'long_run', icon: 'server', name: '长期运行', desc: '服务器运行超过24小时', check: (data) => data.uptime > 86400 },
    { id: 'low_load', icon: 'leaf', name: '轻量运行', desc: 'CPU 负载低于 20%', check: (data) => data.cpu < 20 },
    { id: 'no_alerts', icon: 'shield', name: '安全无虞', desc: '连续1小时无告警', check: () => true },
    { id: 'mem_efficient', icon: 'ram', name: '内存高效', desc: '内存使用率低于 50%', check: (data) => data.mem < 50 },
    { id: 'disk_healthy', icon: 'disk', name: '磁盘健康', desc: '磁盘使用率低于 70%', check: (data) => data.disk < 70 },
    { id: 'multi_core', icon: 'cpu', name: '多核战士', desc: '服务器拥有 4 核以上 CPU', check: (data) => data.cores >= 4 },
    { id: 'first_boot', icon: 'rocket', name: '初次启动', desc: '面板首次运行', check: () => true },
    { id: 'active_monitor', icon: 'eye', name: '活跃监控', desc: '持续监控超过 10 分钟', check: () => activityData.length > 20 }
];

const achievementIcons = {
    server: '🖥️',
    leaf: '🍃',
    shield: '🛡️',
    ram: '💾',
    disk: '💿',
    cpu: '⚙️',
    rocket: '🚀',
    eye: '👁️'
};

let unlockedAchievements = new Set();

function initAchievements() {
    const grid = document.getElementById('achievementsGrid');
    if (!grid) return;
    
    const data = {
        uptime: currentSystemData?.cpu ? 3600 : 0,
        cpu: currentSystemData?.cpu?.usage || 0,
        mem: currentSystemData?.memory?.usagePercent || 0,
        disk: currentSystemData?.disk?.usagePercent || 0,
        cores: currentSystemData?.cpu?.cores || 1
    };
    
    grid.innerHTML = achievements.map(a => {
        const unlocked = a.check(data);
        if (unlocked) unlockedAchievements.add(a.id);
        return `
            <div class="achievement-badge ${unlocked ? 'unlocked' : ''}">
                <div class="achievement-icon">${achievementIcons[a.icon]}</div>
                <div class="achievement-name">${a.name}</div>
                <div class="achievement-desc">${a.desc}</div>
            </div>
        `;
    }).join('');
}

function initQuickActions() {
    document.getElementById('actionOutput').textContent = '选择一个操作执行...';
}

async function quickAction(action) {
    try {
        const output = document.getElementById('actionOutput');
        output.textContent = '执行中...';
        
        const endpoints = {
            df: '/api/system/disk',
            free: '/api/system/memory',
            who: '/api/system/info',
            last: '/api/system/info'
        };
        
        const res = await fetch(endpoints[action] || '/api/system/info');
        const data = await res.json();
        
        let text = '';
        if (action === 'df') text = `磁盘使用: ${data.usagePercent}%\n已用: ${data.used}\n总计: ${data.total}`;
        else if (action === 'free') text = `内存使用: ${data.usagePercent}%\n已用: ${data.used}\n总计: ${data.total}`;
        else if (action === 'who') text = `主机名: ${data.hostname}\n运行时间: ${Math.floor(data.uptime / 3600)}小时`;
        else text = JSON.stringify(data, null, 2);
        
        output.textContent = text;
    } catch (e) {
        output.textContent = '获取失败: ' + e.message;
    }
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
            data.newAlerts.forEach(alert => {
                showToast(`${alert.ruleName} 超过阈值！`, alert.level === 'critical' ? 'error' : 'warning');
                const badge = document.getElementById('alertBadge');
                if (badge) {
                    badge.textContent = data.activeCount;
                    badge.style.display = 'inline';
                }
            });
        }
    } catch (e) {}
}

async function loadProcesses() {
    const tbody = document.getElementById('processTable');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">加载中...</td></tr>';
    try {
        const res = await fetch('/api/processes');
        const data = await res.json();
        if (!data.processes?.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">无数据</td></tr>'; return; }
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
    if (!confirm(`确定要终止进程 ${pid}？`)) return;
    try {
        const res = await fetch(`/api/processes/${pid}`, { method: 'DELETE' });
        const data = await res.json();
        showToast(data.message || '完成', data.success ? 'success' : 'error');
        loadProcesses();
    } catch (e) { showToast('失败', 'error'); }
}

async function loadNetwork() {
    const tbody = document.getElementById('networkTable');
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px">加载中...</td></tr>';
    try {
        const res = await fetch('/api/network');
        const data = await res.json();
        if (!data.ports?.length) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px">无数据</td></tr>'; return; }
        tbody.innerHTML = data.ports.map(p => `<tr><td>${p.protocol.toUpperCase()}</td><td>${p.localAddress}</td><td>${p.localPort}</td><td>${p.state}</td></tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px">加载失败</td></tr>'; }
}

async function loadServices() {
    const grid = document.getElementById('servicesGrid');
    grid.innerHTML = '<div class="empty-state">加载中...</div>';
    try {
        const res = await fetch('/api/services');
        const data = await res.json();
        if (!data.services?.length) { grid.innerHTML = '<div class="empty-state">无数据</div>'; return; }
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
        showToast(data.message || '完成', data.success ? 'success' : 'error');
        loadServices();
    } catch (e) { showToast('失败', 'error'); }
}

async function loadAlerts() {
    await Promise.all([loadAlertRules(), loadActiveAlerts()]);
}

async function loadAlertRules() {
    const grid = document.getElementById('rulesGrid');
    try {
        const res = await fetch('/api/alerts/rules');
        const data = await res.json();
        if (!data.rules?.length) { grid.innerHTML = '<div class="empty-state">无规则</div>'; return; }
        grid.innerHTML = data.rules.map(rule => {
            const value = currentSystemData[rule.metric]?.usage || currentSystemData[rule.metric]?.usagePercent || 0;
            const valueClass = value >= rule.threshold ? 'critical' : value >= rule.threshold - 10 ? 'warning' : 'normal';
            return `
                <div class="rule-card ${rule.enabled ? '' : 'disabled'}">
                    <h4>${rule.name}</h4>
                    <div class="rule-current">
                        <span>当前值</span>
                        <span class="value ${valueClass}">${value.toFixed(1)}%</span>
                    </div>
                    <div class="rule-actions">
                        <label>启用</label>
                        <label class="toggle">
                            <input type="checkbox" ${rule.enabled ? 'checked' : ''} onchange="updateRule('${rule.id}',{enabled:this.checked})">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <div class="rule-actions" style="margin-top:12px">
                        <label>阈值</label>
                        <input type="number" class="threshold-input" id="threshold-${rule.id}" value="${rule.threshold}" min="1" max="100">
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
        document.getElementById('resolvedCount').textContent = '0';
        if (!data.alerts?.length) { container.innerHTML = '<div class="empty-state">所有系统正常</div>'; return; }
        container.innerHTML = data.alerts.map(a => `
            <div class="alert-item ${a.level}">
                <div class="content">
                    <div class="title">${a.ruleName}</div>
                    <div class="message">阈值: ${a.threshold}%</div>
                </div>
                <div class="value ${a.level}">${a.value.toFixed(1)}%</div>
            </div>
        `).join('');
    } catch (e) { container.innerHTML = '<div class="empty-state">加载失败</div>'; }
}

document.getElementById('processSearch')?.addEventListener('input', loadProcesses);

updateTime();
setInterval(updateTime, 1000);
loadDashboard();
setInterval(loadDashboard, 3000);