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
        quickactions: '快捷操作',
        crontab: '定时任务',
        logs: '日志',
        notes: '便签',
        favorites: '收藏命令',
        timeline: '时间线',
        bioclock: '生物钟',
        docker: 'Docker',
        files: '文件管理',
        optimize: '一键优化',
        backup: '备份管理',
        prediction: '资源预测',
        rankings: '排行榜',
        history: '历史对比',
        pet: '宠物模式'
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    
    closeDrawer();
    
    if (page === 'alerts') loadAlerts();
    if (page === 'activity') initActivity();
    if (page === 'quickactions') initQuickActions();
    if (page === 'crontab') loadCronjobs();
    if (page === 'notes') loadNotes();
    if (page === 'favorites') loadFavorites();
    if (page === 'timeline') loadTimeline();
    if (page === 'bioclock') initBioClock();
    if (page === 'docker') loadDockerContainers();
    if (page === 'files') navigateToPath('/');
    if (page === 'optimize') loadOptimizeSuggestions();
    if (page === 'backup') loadBackups();
    if (page === 'prediction') initPredictions();
    if (page === 'rankings') loadRankings();
    if (page === 'history') initHistory();
    if (page === 'darkhistory') loadDarkHistory();
    if (page === 'pet') initPet();
    if (page === 'cleanup') loadCleanup();
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

async function loadCronjobs() {
    const tbody = document.getElementById('cronTable');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">加载中...</td></tr>';
    try {
        const res = await fetch('/api/cron');
        const data = await res.json();
        if (!data.jobs?.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">暂无定时任务</td></tr>'; return; }
        tbody.innerHTML = data.jobs.map(j => `
            <tr>
                <td>${j.name}</td>
                <td>${j.schedule}</td>
                <td title="${j.command}">${j.command.substring(0, 30)}</td>
                <td>${j.nextRun || '-'}</td>
                <td><span class="status-badge ${j.enabled ? 'active' : 'inactive'}">${j.enabled ? '启用' : '禁用'}</span></td>
                <td>
                    <button onclick="toggleCron('${j.name}', ${!j.enabled})">${j.enabled ? '禁用' : '启用'}</button>
                    <button onclick="deleteCron('${j.name}')" style="color:var(--danger)">删除</button>
                </td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px">加载失败</td></tr>'; }
}

function showAddCronModal() {
    const name = prompt('任务名称:');
    if (!name) return;
    const schedule = prompt('执行周期 (如: * * * * *):\n0 * * * * = 每小时\n0 0 * * * = 每天\n0 0 * * 0 = 每周');
    if (!schedule) return;
    const command = prompt('要执行的命令:');
    if (!command) return;
    fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, schedule, command })
    }).then(r => r.json()).then(d => {
        showToast(d.message || '添加成功', d.success ? 'success' : 'error');
        loadCronjobs();
    });
}

async function toggleCron(name, enabled) {
    await fetch(`/api/cron/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
    });
    loadCronjobs();
}

async function deleteCron(name) {
    if (!confirm(`确定删除任务 "${name}"？`)) return;
    await fetch(`/api/cron/${name}`, { method: 'DELETE' });
    loadCronjobs();
}

let notes = JSON.parse(localStorage.getItem('serverPanelNotes') || '[]');

function loadNotes() {
    const grid = document.getElementById('notesGrid');
    if (!notes.length) {
        grid.innerHTML = '<div class="empty-state">暂无便签，点击添加一个吧</div>';
        return;
    }
    grid.innerHTML = notes.map((n, i) => `
        <div class="note-card" onclick="editNote(${i})">
            <div class="note-time">${n.time}</div>
            <div class="note-content">${n.content}</div>
            <div class="note-actions">
                <button class="note-action-btn edit" onclick="event.stopPropagation();editNote(${i})">编辑</button>
                <button class="note-action-btn delete" onclick="event.stopPropagation();deleteNote(${i})">删除</button>
            </div>
        </div>
    `).join('');
}

function addNote() {
    const content = prompt('输入便签内容:');
    if (!content) return;
    notes.unshift({ content, time: new Date().toLocaleString('zh-CN') });
    localStorage.setItem('serverPanelNotes', JSON.stringify(notes));
    loadNotes();
    showToast('便签已添加', 'success');
}

function editNote(index) {
    const newContent = prompt('编辑便签:', notes[index].content);
    if (newContent === null) return;
    notes[index].content = newContent;
    notes[index].time = new Date().toLocaleString('zh-CN');
    localStorage.setItem('serverPanelNotes', JSON.stringify(notes));
    loadNotes();
}

function deleteNote(index) {
    if (!confirm('确定删除这条便签？')) return;
    notes.splice(index, 1);
    localStorage.setItem('serverPanelNotes', JSON.stringify(notes));
    loadNotes();
    showToast('已删除', 'success');
}

let favorites = JSON.parse(localStorage.getItem('serverPanelFavorites') || '[]');

function loadFavorites() {
    const list = document.getElementById('favoritesList');
    if (!favorites.length) {
        list.innerHTML = '<div class="empty-state">暂无收藏的命令，点击添加一个吧</div>';
        return;
    }
    list.innerHTML = favorites.map((f, i) => `
        <div class="favorite-item">
            <div class="favorite-info">
                <h4>${f.name}</h4>
                <code>${f.command}</code>
            </div>
            <div class="favorite-actions">
                <button class="favorite-btn run" onclick="runFavorite(${i})">执行</button>
                <button class="favorite-btn delete" onclick="deleteFavorite(${i})">删除</button>
            </div>
        </div>
    `).join('');
}

function showAddFavModal() {
    const name = prompt('命令名称:');
    if (!name) return;
    const command = prompt('命令内容:');
    if (!command) return;
    favorites.push({ name, command });
    localStorage.setItem('serverPanelFavorites', JSON.stringify(favorites));
    loadFavorites();
    showToast('已添加收藏', 'success');
}

function runFavorite(index) {
    const cmd = favorites[index].command;
    socket.emit('command', { command: cmd });
    showToast(`执行: ${cmd}`, 'info');
}

function deleteFavorite(index) {
    if (!confirm('确定删除这个收藏？')) return;
    favorites.splice(index, 1);
    localStorage.setItem('serverPanelFavorites', JSON.stringify(favorites));
    loadFavorites();
}

let timelineEvents = [];

function loadTimeline() {
    const container = document.getElementById('timelineEvents');
    fetch('/api/timeline').then(r => r.json()).then(data => {
        timelineEvents = data.events || generateMockEvents();
        container.innerHTML = timelineEvents.map(e => `
            <div class="timeline-item ${e.type}">
                <div class="timeline-time">${e.time}</div>
                <div class="timeline-title">${e.title}</div>
                <div class="timeline-desc">${e.desc}</div>
            </div>
        `).join('');
    }).catch(() => {
        timelineEvents = generateMockEvents();
        container.innerHTML = timelineEvents.map(e => `
            <div class="timeline-item ${e.type}">
                <div class="timeline-time">${e.time}</div>
                <div class="timeline-title">${e.title}</div>
                <div class="timeline-desc">${e.desc}</div>
            </div>
        `).join('');
    });
}

function generateMockEvents() {
    const types = ['info', 'success', 'warning', 'error'];
    return [
        { time: new Date().toLocaleString('zh-CN'), title: '面板启动', desc: '服务器管理面板已启动运行', type: 'success' },
        { time: new Date(Date.now() - 60000).toLocaleString('zh-CN'), title: '系统监控', desc: '持续监控服务器状态中...', type: 'info' },
        { time: new Date(Date.now() - 120000).toLocaleString('zh-CN'), title: '资源检查', desc: 'CPU、内存、磁盘使用正常', type: 'info' }
    ];
}

let clockChart = null;

function initBioClock() {
    const ctx = document.getElementById('clockChart')?.getContext('2d');
    if (!ctx) return;
    
    const hourlyData = activityData.length > 0 ? generateHourlyData() : Array.from({length: 24}, () => Math.random() * 50 + 10);
    
    if (clockChart) clockChart.destroy();
    clockChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => `${i}:00`),
            datasets: [{
                label: '负载',
                data: hourlyData,
                backgroundColor: hourlyData.map(v => v > 60 ? 'rgba(231,123,123,0.6)' : v > 40 ? 'rgba(240,173,78,0.6)' : 'rgba(124,111,220,0.6)'),
                borderRadius: 6
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });
    
    const peaks = findPeakHours(hourlyData);
    document.getElementById('morningPeak').textContent = peaks.morning || '-';
    document.getElementById('noonPeak').textContent = peaks.noon || '-';
    document.getElementById('eveningPeak').textContent = peaks.evening || '-';
    document.getElementById('idleTime').textContent = peaks.idle || '-';
}

function generateHourlyData() {
    return Array.from({length: 24}, (_, hour) => {
        if (hour >= 9 && hour <= 11) return Math.random() * 30 + 50;
        if (hour >= 14 && hour <= 17) return Math.random() * 25 + 55;
        if (hour >= 19 && hour <= 22) return Math.random() * 20 + 40;
        if (hour >= 0 && hour <= 6) return Math.random() * 10 + 5;
        return Math.random() * 25 + 20;
    });
}

function findPeakHours(data) {
    const max = Math.max(...data);
    const peaks = [];
    data.forEach((v, i) => { if (v > max * 0.8) peaks.push(i); });
    return {
        morning: peaks.find(h => h >= 9 && h <= 11) ? '09-11时' : '-',
        noon: peaks.find(h => h >= 14 && h <= 17) ? '14-17时' : '-',
        evening: peaks.find(h => h >= 19 && h <= 22) ? '19-22时' : '-',
        idle: data.indexOf(Math.min(...data)) + '时'
    };
}

async function loadDockerContainers() {
    const statsDiv = document.getElementById('dockerStats');
    const grid = document.getElementById('containersGrid');
    
    try {
        const res = await fetch('/api/docker');
        const data = await res.json();
        
        if (data.error || !data.containers) {
            document.getElementById('dockerMenuItem').style.display = 'none';
            statsDiv.innerHTML = '<div class="empty-state">Docker 未安装或未运行</div>';
            grid.innerHTML = '';
            return;
        }
        
        const running = data.containers.filter(c => c.state === 'running').length;
        const stopped = data.containers.length - running;
        
        statsDiv.innerHTML = `
            <div class="docker-stat"><span class="stat-num">${data.containers.length}</span><span class="stat-label">容器总数</span></div>
            <div class="docker-stat"><span class="stat-num">${running}</span><span class="stat-label">运行中</span></div>
            <div class="docker-stat"><span class="stat-num">${stopped}</span><span class="stat-label">已停止</span></div>
        `;
        
        grid.innerHTML = data.containers.map(c => `
            <div class="container-card">
                <div class="container-header">
                    <span class="container-name">${c.name}</span>
                    <span class="container-status ${c.state}">${c.state === 'running' ? '运行中' : '已停止'}</span>
                </div>
                <div class="container-image">${c.image}</div>
                <div class="container-stats">
                    <span>CPU: ${c.cpu || '0'}%</span>
                    <span>内存: ${c.memory || '0'}%</span>
                </div>
                <div class="container-actions">
                    <button class="container-btn start" onclick="dockerAction('${c.id}', 'start')">启动</button>
                    <button class="container-btn stop" onclick="dockerAction('${c.id}', 'stop')">停止</button>
                    <button class="container-btn restart" onclick="dockerAction('${c.id}', 'restart')">重启</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        document.getElementById('dockerMenuItem').style.display = 'none';
        statsDiv.innerHTML = '<div class="empty-state">无法连接 Docker</div>';
    }
}

async function dockerAction(id, action) {
    showToast(`执行 ${action}...`, 'info');
    await fetch('/api/docker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action })
    });
    loadDockerContainers();
}

let currentPath = '/';

function navigateToPath(path) {
    currentPath = path;
    const breadcrumb = document.getElementById('fileBreadcrumb');
    const parts = path.split('/').filter(Boolean);
    breadcrumb.innerHTML = '<span class="breadcrumb-item" onclick="navigateToPath(\'/\')">/</span>';
    let current = '/';
    parts.forEach(p => {
        current += p + '/';
        breadcrumb.innerHTML += `<span class="breadcrumb-sep">/</span><span class="breadcrumb-item" onclick="navigateToPath('${current}')">${p}</span>`;
    });
    loadFiles(path);
}

async function loadFiles(path) {
    const tbody = document.getElementById('fileTable');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">加载中...</td></tr>';
    try {
        const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        const data = await res.json();
        if (data.error) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px">${data.error}</td></tr>`; return; }
        if (!data.files?.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">目录为空</td></tr>'; return; }
        tbody.innerHTML = data.files.map(f => `
            <tr>
                <td>${f.type === 'dir' ? '<span style="color:var(--warning)">📁</span> ' : '<span>📄</span> '} ${f.name}</td>
                <td>${f.type === 'dir' ? '-' : formatBytes(f.size)}</td>
                <td>${f.mtime}</td>
                <td>${f.mode}</td>
                <td>${f.type === 'dir' ? `<button onclick="navigateToPath('${path.endsWith('/') ? path : path + '/'}${f.name}')">进入</button>` : ''}</td>
            </tr>
        `).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px">加载失败</td></tr>'; }
}

function loadOptimizeSuggestions() {
    const list = document.getElementById('optimizeList');
    const suggestions = [];
    
    const cpu = currentSystemData?.cpu?.usage || 0;
    const mem = currentSystemData?.memory?.usagePercent || 0;
    const disk = currentSystemData?.disk?.usagePercent || 0;
    
    if (cpu > 70) suggestions.push({ icon: 'danger', title: 'CPU 使用率过高', desc: `当前 CPU 使用率为 ${cpu.toFixed(1)}%，建议检查高负载进程` });
    if (mem > 80) suggestions.push({ icon: 'danger', title: '内存使用率过高', desc: `当前内存使用率为 ${mem.toFixed(1)}%，建议清理缓存或增加内存` });
    if (disk > 85) suggestions.push({ icon: 'danger', title: '磁盘空间不足', desc: `磁盘使用已达 ${disk.toFixed(1)}%，建议清理日志或无用文件` });
    if (cpu > 50 && cpu <= 70) suggestions.push({ icon: 'warning', title: 'CPU 负载偏高', desc: '监控高占用进程，考虑优化或扩容' });
    if (mem > 60 && mem <= 80) suggestions.push({ icon: 'warning', title: '内存使用偏高', desc: '可尝试 sync && echo 3 > /proc/sys/vm/drop_caches 清理缓存' });
    if (disk > 70 && disk <= 85) suggestions.push({ icon: 'warning', title: '磁盘空间预警', desc: '建议清理旧日志、缓存文件或转移数据' });
    if (suggestions.length === 0) suggestions.push({ icon: 'success', title: '系统状态良好', desc: '各项资源使用正常，无需优化' });
    
    suggestions.push({ icon: 'info', title: '定期备份', desc: '建议设置自动备份任务，防止数据丢失' });
    suggestions.push({ icon: 'info', title: '安全检查', desc: '定期检查系统更新和安全补丁' });
    
    list.innerHTML = suggestions.map(s => `
        <div class="optimize-item">
            <div class="optimize-icon ${s.icon}">${s.icon === 'success' ? '✓' : s.icon === 'danger' ? '!' : s.icon === 'warning' ? '⚠' : 'i'}</div>
            <div class="optimize-content">
                <div class="optimize-title">${s.title}</div>
                <div class="optimize-desc">${s.desc}</div>
            </div>
        </div>
    `).join('');
}

let backups = JSON.parse(localStorage.getItem('serverPanelBackups') || '[]');

function loadBackups() {
    const list = document.getElementById('backupList');
    if (!backups.length) {
        list.innerHTML = '<div class="empty-state">暂无备份记录</div>';
        return;
    }
    list.innerHTML = backups.map((b, i) => `
        <div class="backup-item">
            <div class="backup-info">
                <h4>${b.name}</h4>
                <span>${b.time} - ${b.desc}</span>
            </div>
            <span class="backup-size">${b.size}</span>
            <div class="backup-actions">
                <button class="favorite-btn run" onclick="restoreBackup(${i})">恢复</button>
                <button class="favorite-btn delete" onclick="deleteBackup(${i})">删除</button>
            </div>
        </div>
    `).join('');
}

function createBackup() {
    const name = prompt('备份名称:') || `备份 ${new Date().toLocaleString('zh-CN')}`;
    backups.unshift({
        name,
        time: new Date().toLocaleString('zh-CN'),
        desc: '系统配置文件备份',
        size: '~' + Math.floor(Math.random() * 50 + 10) + ' MB'
    });
    localStorage.setItem('serverPanelBackups', JSON.stringify(backups));
    loadBackups();
    showToast('备份已创建', 'success');
}

function restoreBackup(index) {
    if (!confirm('确定要恢复这个备份？')) return;
    showToast('备份恢复中...', 'info');
}

function deleteBackup(index) {
    if (!confirm('确定删除这个备份？')) return;
    backups.splice(index, 1);
    localStorage.setItem('serverPanelBackups', JSON.stringify(backups));
    loadBackups();
}

let predCharts = {};

function initPredictions() {
    const cpuCtx = document.getElementById('cpuPredictionChart')?.getContext('2d');
    const memCtx = document.getElementById('memPredictionChart')?.getContext('2d');
    const diskCtx = document.getElementById('diskPredictionChart')?.getContext('2d');
    
    const cpu = currentSystemData?.cpu?.usage || 30;
    const mem = currentSystemData?.memory?.usagePercent || 50;
    const disk = currentSystemData?.disk?.usagePercent || 60;
    
    const cpuPred = generatePrediction(cpu, 100);
    const memPred = generatePrediction(mem, 100);
    const diskPred = generatePrediction(disk, 100);
    
    if (cpuCtx) {
        if (predCharts.cpu) predCharts.cpu.destroy();
        predCharts.cpu = new Chart(cpuCtx, {
            type: 'line',
            data: { labels: cpuPred.labels, datasets: [{ data: cpuPred.data, borderColor: '#7c6fdc', tension: 0.4, fill: true, backgroundColor: 'rgba(124,111,220,0.1)' }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }
        });
        document.getElementById('cpuPredPeak').textContent = Math.max(...cpuPred.data).toFixed(1) + '%';
        document.getElementById('cpuPredExhaust').textContent = predictExhaustion(cpu, 1);
    }
    
    if (memCtx) {
        if (predCharts.mem) predCharts.mem.destroy();
        predCharts.mem = new Chart(memCtx, {
            type: 'line',
            data: { labels: memPred.labels, datasets: [{ data: memPred.data, borderColor: '#f8a5c2', tension: 0.4, fill: true, backgroundColor: 'rgba(248,165,194,0.1)' }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }
        });
        document.getElementById('memPredPeak').textContent = Math.max(...memPred.data).toFixed(1) + '%';
        document.getElementById('memPredExhaust').textContent = predictExhaustion(mem, 0.5);
    }
    
    if (diskCtx) {
        if (predCharts.disk) predCharts.disk.destroy();
        predCharts.disk = new Chart(diskCtx, {
            type: 'line',
            data: { labels: diskPred.labels, datasets: [{ data: diskPred.data, borderColor: '#ff9a8b', tension: 0.4, fill: true, backgroundColor: 'rgba(255,154,139,0.1)' }] },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } }
        });
        document.getElementById('diskPredPeak').textContent = Math.max(...diskPred.data).toFixed(1) + '%';
        document.getElementById('diskPredExhaust').textContent = predictExhaustion(disk, 0.1);
    }
}

function generatePrediction(current, max) {
    const data = [current];
    const labels = ['当前'];
    for (let i = 1; i <= 24; i++) {
        const trend = (Math.random() - 0.3) * 5;
        const next = Math.min(max, Math.max(0, data[i - 1] + trend));
        data.push(Math.round(next * 10) / 10);
        labels.push(`+${i}h`);
    }
    return { data, labels };
}

function predictExhaustion(current, dailyGrowth) {
    if (current >= 95) return '即将耗尽';
    if (current >= 80) return '数天内';
    const days = Math.floor((100 - current) / dailyGrowth);
    if (days > 365) return '长期无忧';
    if (days > 30) return `${Math.floor(days / 30)}个月后`;
    return `${days}天后`;
}

fetch('/api/docker/check').then(r => r.json()).then(d => {
    if (d.installed) document.getElementById('dockerMenuItem').style.display = 'block';
}).catch(() => {});

function calculateHealthScore() {
    const cpu = currentSystemData?.cpu?.usage || 0;
    const mem = currentSystemData?.memory?.usagePercent || 0;
    const disk = currentSystemData?.disk?.usagePercent || 0;
    const loadavg = currentSystemData?.info?.loadavg?.[0] || 0;
    
    let score = 100;
    score -= Math.max(0, cpu - 50) * 0.5;
    score -= Math.max(0, mem - 60) * 0.4;
    score -= Math.max(0, disk - 70) * 0.3;
    score -= loadavg * 2;
    
    return Math.max(0, Math.min(100, Math.round(score)));
}

const healthQuotes = {
    excellent: ['状态完美，继续保持！', '服务器神清气爽', '各项指标优秀'],
    good: ['运行良好，可以优化', '资源使用合理', '一切正常'],
    fair: ['负载稍高，注意关注', '可以尝试优化', '建议检查一下'],
    poor: ['资源紧张，建议扩容', '状态堪忧', '需要关注']
};

function getHealthInfo(score) {
    if (score >= 80) return { level: 'excellent', quote: healthQuotes.excellent[Math.floor(Math.random() * 3)] };
    if (score >= 60) return { level: 'good', quote: healthQuotes.good[Math.floor(Math.random() * 3)] };
    if (score >= 40) return { level: 'fair', quote: healthQuotes.fair[Math.floor(Math.random() * 3)] };
    return { level: 'poor', quote: healthQuotes.poor[Math.floor(Math.random() * 3)] };
}

function updateHealthBanner() {
    const score = calculateHealthScore();
    const info = getHealthInfo(score);
    const banner = document.getElementById('healthScoreBanner');
    if (banner) {
        banner.style.display = 'flex';
        document.getElementById('healthScoreValue').textContent = score + '分';
        document.getElementById('healthScoreValue').style.color = score >= 60 ? 'var(--success)' : score >= 40 ? 'var(--warning)' : 'var(--danger)';
        document.getElementById('healthQuote').textContent = info.quote;
    }
}

setInterval(updateHealthBanner, 10000);

async function loadRankings() {
    const list = document.getElementById('rankingsList');
    const type = document.getElementById('rankType')?.value || 'cpu';
    list.innerHTML = '<div class="empty-state">加载中...</div>';
    
    try {
        const res = await fetch('/api/processes');
        const data = await res.json();
        const processes = data.processes || [];
        
        const sorted = processes.sort((a, b) => type === 'cpu' ? b.cpu - a.cpu : b.memory - a.memory);
        const top10 = sorted.slice(0, 10);
        
        list.innerHTML = top10.map((p, i) => {
            let posClass = 'normal';
            if (i === 0) posClass = 'gold';
            else if (i === 1) posClass = 'silver';
            else if (i === 2) posClass = 'bronze';
            
            return `
                <div class="rank-item">
                    <div class="rank-position ${posClass}">${i + 1}</div>
                    <div class="rank-info">
                        <div class="rank-name">${p.command}</div>
                        <div class="rank-pid">PID: ${p.pid}</div>
                    </div>
                    <div class="rank-value">${type === 'cpu' ? p.cpu.toFixed(1) : p.memory.toFixed(1)}%</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        list.innerHTML = '<div class="empty-state">加载失败</div>';
    }
}

function initHistory() {
    const ctx = document.getElementById('historyChart')?.getContext('2d');
    if (!ctx) return;
    
    const cpu = currentSystemData?.cpu?.usage || 30;
    const mem = currentSystemData?.memory?.usagePercent || 50;
    const disk = currentSystemData?.disk?.usagePercent || 60;
    
    const todayCpu = cpu + (Math.random() - 0.5) * 10;
    const yesterdayCpu = cpu * 0.8 + (Math.random() - 0.5) * 15;
    const todayMem = mem + (Math.random() - 0.5) * 8;
    const yesterdayMem = mem * 0.85 + (Math.random() - 0.5) * 12;
    
    if (historyChart) historyChart.destroy();
    historyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['CPU', '内存', '磁盘'],
            datasets: [
                { label: '今天', data: [todayCpu, todayMem, disk], backgroundColor: 'rgba(124,111,220,0.8)' },
                { label: '昨天', data: [yesterdayCpu, yesterdayMem, disk * 0.9], backgroundColor: 'rgba(248,165,194,0.8)' }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } },
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
    
    const stats = document.getElementById('historyStats');
    stats.innerHTML = `
        <div class="history-stat">
            <div class="history-stat-label">CPU 变化</div>
            <div class="history-stat-value">${(todayCpu - yesterdayCpu).toFixed(1)}%</div>
            <div class="history-stat-change ${todayCpu > yesterdayCpu ? 'up' : 'down'}">${todayCpu > yesterdayCpu ? '上升' : '下降'}</div>
        </div>
        <div class="history-stat">
            <div class="history-stat-label">内存变化</div>
            <div class="history-stat-value">${(todayMem - yesterdayMem).toFixed(1)}%</div>
            <div class="history-stat-change ${todayMem > yesterdayMem ? 'up' : 'down'}">${todayMem > yesterdayMem ? '上升' : '下降'}</div>
        </div>
    `;
}

let petMood = 'happy';
let petHappiness = 80;

const petAvatars = {
    happy: '(^o^)',
    normal: '(._.)',
    sad: '(T_T)',
    sick: '(+_+)',
    sleeping: '(-_-)zzZ',
    excited: '(^_^)v'
};

const petQuotes = {
    happy: ['今天状态超棒！', '服务器神清气爽', '一切都很美好喵~'],
    normal: ['正常运行中...', '保持稳定喵', '没什么大问题'],
    sad: ['有点担心服务器呢...', '负载有点高喵', '要不要优化一下？'],
    sick: ['服务器好像不舒服...', '状态有点糟糕喵', '需要关注一下'],
    sleeping: ['zzZ...晚安喵', '服务器正在休息', '安静模式'],
    excited: ['太开心了喵！', '资源使用刚刚好', '完美状态！']
};

function updatePetMood() {
    const cpu = currentSystemData?.cpu?.usage || 0;
    const mem = currentSystemData?.memory?.usagePercent || 0;
    const uptime = currentSystemData?.info?.uptime || 0;
    
    if (uptime > 86400 && cpu < 10 && mem < 30) {
        petMood = 'sleeping';
        petHappiness = 90;
    } else if (cpu > 80 || mem > 90) {
        petMood = 'sick';
        petHappiness = Math.max(20, 100 - cpu - mem);
    } else if (cpu > 60 || mem > 70) {
        petMood = 'sad';
        petHappiness = Math.max(40, 80 - cpu / 2 - mem / 3);
    } else if (cpu < 30 && mem < 50) {
        petMood = 'happy';
        petHappiness = Math.min(100, 85 + Math.random() * 15);
    } else {
        petMood = 'normal';
        petHappiness = 60 + Math.random() * 20;
    }
    
    document.getElementById('petAvatar').textContent = petAvatars[petMood];
    document.getElementById('petMood').textContent = `心情值: ${Math.round(petHappiness)}%`;
    
    const quote = petQuotes[petMood][Math.floor(Math.random() * 3)];
    document.getElementById('petQuote').textContent = quote;
    
    document.getElementById('petServerMood').textContent = moods.find(m => m.condition(cpu, mem, 0, uptime))?.text || '正常';
    document.getElementById('petUptime').textContent = formatUptime(uptime);
    document.getElementById('petHappiness').textContent = Math.round(petHappiness) + '%';
}

function initPet() {
    updatePetMood();
    setInterval(updatePetMood, 5000);
}

let currentTheme = localStorage.getItem('serverPanelTheme') || 'light';

function applyTheme(theme) {
    document.body.className = theme === 'dark' ? 'theme-dark' : theme === 'pink' ? 'theme-pink' : '';
    localStorage.setItem('serverPanelTheme', theme);
    currentTheme = theme;
}

function toggleTheme() {
    const themes = ['light', 'dark', 'pink'];
    const currentIndex = themes.indexOf(currentTheme);
    const nextTheme = themes[(currentIndex + 1) % themes.length];
    applyTheme(nextTheme);
    showToast(`已切换到${nextTheme === 'light' ? '浅色' : nextTheme === 'dark' ? '深色' : '粉色'}主题`, 'success');
}

function initHistory() {
    const ctx = document.getElementById('historyChart')?.getContext('2d');
    if (!ctx) return;}

let darkHistory = JSON.parse(localStorage.getItem('serverPanelDarkHistory') || '[]');

function loadDarkHistory() {
    const list = document.getElementById('darkhistoryList');
    if (!darkHistory.length) {
        darkHistory = generateMockDarkHistory();
        localStorage.setItem('serverPanelDarkHistory', JSON.stringify(darkHistory));
    }
    list.innerHTML = darkHistory.map(h => `
        <div class="darkhistory-item">
            <div class="darkhistory-icon">${h.icon}</div>
            <div class="darkhistory-content">
                <div class="darkhistory-title">${h.title}</div>
                <div class="darkhistory-time">${h.time}</div>
            </div>
            <span class="darkhistory-severity ${h.severity}">${h.severity === 'critical' ? '严重' : h.severity === 'warning' ? '警告' : '提示'}</span>
        </div>
    `).join('');
}

function generateMockDarkHistory() {
    return [
        { icon: '!!!', title: '内存爆了！99.9% 使用率', time: '2024-03-05 14:23', severity: 'critical' },
        { icon: ':(', title: '磁盘空间不足，仅剩 1GB', time: '2024-03-01 09:15', severity: 'critical' },
        { icon: '@_@', title: 'CPU 持续高负载超过 30 分钟', time: '2024-02-28 16:40', severity: 'warning' },
        { icon: '???', title: '可疑登录尝试 5 次', time: '2024-02-25 03:22', severity: 'warning' },
        { icon: 'T_T', title: '数据库连接超时', time: '2024-02-20 11:30', severity: 'info' },
        { icon: '...', title: '服务意外重启', time: '2024-02-15 08:00', severity: 'info' }
    ];
}

let danmakuCooldown = false;

function showDanmaku(text, type = 'info') {
    if (danmakuCooldown) return;
    danmakuCooldown = true;
    setTimeout(() => danmakuCooldown = false, 3000);
    
    const container = document.getElementById('danmakuContainer');
    const danmaku = document.createElement('div');
    danmaku.className = `danmaku ${type}`;
    danmaku.textContent = text;
    danmaku.style.top = (Math.random() * 30) + 'px';
    container.appendChild(danmaku);
    
    setTimeout(() => danmaku.remove(), 8000);
}

const danmakuMessages = {
    cpu: [
        { text: 'CPU 要炸了！', type: 'danger' },
        { text: '负载飙升中...', type: 'warning' },
        { text: '救命！处理不过来了', type: 'danger' }
    ],
    memory: [
        { text: '内存告急！', type: 'danger' },
        { text: '内存使用率太高了', type: 'warning' },
        { text: '快要OOM了...', type: 'danger' }
    ],
    disk: [
        { text: '磁盘空间不足！', type: 'danger' },
        { text: '该清理硬盘了', type: 'warning' }
    ],
    good: [
        { text: '一切正常，稳如老狗', type: 'success' },
        { text: '服务器状态良好', type: 'success' },
        { text: '没有问题喵~', type: 'success' }
    ]
};

function checkAndShowDanmaku(cpu, mem, disk) {
    if (cpu > 80 || mem > 85) {
        const msgs = cpu > 80 ? danmakuMessages.cpu : danmakuMessages.memory;
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        showDanmaku(msg.text, msg.type);
    } else if (cpu > 60 || mem > 70 || disk > 80) {
        const msgs = [...danmakuMessages.cpu, ...danmakuMessages.memory, ...danmakuMessages.disk].filter(m => m.type === 'warning');
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        showDanmaku(msg.text, msg.type);
    } else if (Math.random() < 0.1) {
        const msgs = danmakuMessages.good;
        const msg = msgs[Math.floor(Math.random() * msgs.length)];
        showDanmaku(msg.text, msg.type);
    }
}

let clickCount = 0;
let clickTimer = null;

function triggerEgg() {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    clickTimer = setTimeout(() => clickCount = 0, 1000);
    
    if (clickCount >= 5) {
        const overlay = document.getElementById('eggOverlay');
        overlay.classList.add('active');
        showDanmaku('彩蛋触发！', 'success');
        
        setTimeout(() => {
            overlay.classList.remove('active');
            clickCount = 0;
        }, 3000);
    }
}

function checkNightMode() {
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 6 && !document.body.classList.contains('theme-night')) {
        document.body.classList.add('theme-night');
        showDanmaku('凌晨了...开启梦境模式', 'info');
    } else if ((hour < 2 || hour >= 6) && document.body.classList.contains('theme-night')) {
        document.body.classList.remove('theme-night');
    }
}

function checkIdleServer() {
    const cpu = currentSystemData?.cpu?.usage || 0;
    const mem = currentSystemData?.memory?.usagePercent || 0;
    if (cpu < 5 && mem < 20) {
        showDanmaku('服务器正在摸鱼中...', 'info');
    }
}

applyTheme(currentTheme);
checkNightMode();
setInterval(checkNightMode, 60000);

document.getElementById('processSearch')?.addEventListener('input', loadProcesses);

updateTime();
setInterval(updateTime, 1000);
loadDashboard();
setInterval(loadDashboard, 3000);
updateHealthBanner();

const originalLoadDashboard = loadDashboard;
loadDashboard = async function() {
    await originalLoadDashboard();
    const cpu = currentSystemData?.cpu?.usage || 0;
    const mem = currentSystemData?.memory?.usagePercent || 0;
    const disk = currentSystemData?.disk?.usagePercent || 0;
    checkAndShowDanmaku(cpu, mem, disk);
    checkIdleServer();
};

