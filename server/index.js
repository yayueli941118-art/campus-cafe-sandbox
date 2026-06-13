/**
 * 校园咖啡馆数智化敏捷架构沙盘系统 - 主服务器
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const engine = require('./engine');
const db = require('./db');
const mock = require('./mock');

const PORT = process.env.PORT || 3000;
const MOCK_MODE = process.argv.includes('--mock');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/healthz', (req, res) => {
  res.json({ ok: true, service: 'campus-cafe-sandbox' });
});

app.get('/', (req, res) => {
  res.redirect('/dashboard/');
});

// Global phase state
let currentPhase = 'building'; // building | crisis | verdict
// Joined team counter; submitted team details are stored in db.
let joinedTeams = 0;

// ==================== REST API ====================

// 初始化团队
app.post('/api/team/init', (req, res) => {
  const { team_name, leader } = req.body;
  if (!team_name || team_name.length > 12) return res.status(400).json({ error: '团队名称必填且不超过12字' });
  if (!leader) return res.status(400).json({ error: '队长姓名必填' });

  const teamId = uuidv4();
  db.createTeam(teamId, team_name, leader);
  joinedTeams++;

  // 构建初始架构：1店长 + 10员工，直线制
  const staffPool = [];
  const edges = [];
  for (let i = 1; i <= 10; i++) {
    const sid = `s${String(i).padStart(2, '0')}`;
    staffPool.push({ id: sid, label: `员工${String(i).padStart(2, '0')}`, type: 'staff' });
    edges.push({ from: 'shop_manager', to: sid });
  }

  res.json({
    team_id: teamId,
    initial_architecture: {
      nodes: [
        { id: 'shop_manager', label: '店长', type: 'manager', x: 150, y: 20, group_id: null },
        ...staffPool.map((s, i) => ({
          ...s,
          x: 30 + (i % 5) * 65,
          y: 280 + Math.floor(i / 5) * 70,
          group_id: null
        }))
      ],
      groups: [],
      edges
    },
    total_quota: 15
  });
});

// 提交架构推演
app.post('/api/team/submit', (req, res) => {
  const { team_id, architecture, crisis_duration_seconds } = req.body;
  if (!team_id || !architecture) return res.status(400).json({ error: '缺少必填参数' });

  // 校验编制上限
  const staffCount = architecture.nodes.filter(n => n.type === 'staff').length;
  if (staffCount > 15) return res.status(400).json({ error: '编制超载！最多15人' });

  // 运行判定引擎
  const result = engine.judge(architecture);

  // 持久化
  db.submitTeam(
    team_id,
    architecture,
    result.verdict,
    result.survival_rate,
    result.radar_scores,
    result.crisis_passed,
    result.message,
    result.structure_type,
    result.failure_reasons,
    result.teaching_points
  );

  // WebSocket 广播
  const team = db.getTeam(team_id);
  io.emit('TEAM_SUBMITTED', { team_id, team_name: team.team_name });
  io.emit('VERDICT_READY', {
    team_id, team_name: team.team_name,
    survival_rate: result.survival_rate,
    radar_scores: result.radar_scores,
    crisis_passed: result.crisis_passed,
    message: result.message,
    structure_type: result.structure_type,
    failure_reasons: result.failure_reasons,
    teaching_points: result.teaching_points
  });
  io.emit('BATTLE_LOG', {
    team_name: team.team_name,
    status: result.verdict,
    message: result.message
  });

  // 更新全班平均雷达
  const avgRadar = db.getAvgRadarScores();
  if (avgRadar) io.emit('RADAR_UPDATE', { avg_radar_scores: avgRadar });

  res.json({
    team_id, verdict: result.verdict, survival_rate: result.survival_rate,
    radar_scores: result.radar_scores, crisis_passed: result.crisis_passed, message: result.message,
    structure_type: result.structure_type, failure_reasons: result.failure_reasons, teaching_points: result.teaching_points
  });
});

// 大屏数据快照（WebSocket降级方案）
app.get('/api/dashboard/snapshot', (req, res) => {
  const teams = db.getSubmittedTeams();
  const avgRadar = db.getAvgRadarScores();
  res.json({
    teams: teams.map(t => ({
      team_id: t.id, team_name: t.team_name, leader: t.leader,
      verdict: t.verdict, survival_rate: t.survival_rate,
      architecture: t.architecture,
      radar_scores: t.radar_scores ? JSON.parse(t.radar_scores) : null,
      crisis_passed: !!t.crisis_passed, message: t.message,
      structure_type: t.structure_type || null,
      failure_reasons: t.failure_reasons ? JSON.parse(t.failure_reasons) : [],
      teaching_points: t.teaching_points ? JSON.parse(t.teaching_points) : [],
      submitted_at: t.submitted_at
    })),
    avg_radar_scores: avgRadar
  });
});

// 重置（教师端清空本轮数据）
app.post('/api/admin/reset', (req, res) => {
  db.resetAll();
  io.emit('RESET');
  res.json({ ok: true });
});

// 触发危机（HTTP端点，供大屏通过隧道调用）
let activeCrisis = null;
app.post('/api/admin/crisis', (req, res) => {
  activeCrisis = { crisis_type: 'platform_fee', triggered_at: Date.now() };
  currentPhase = 'crisis';
  io.emit('CRISIS_TRIGGER', { crisis_type: 'platform_fee', duration_seconds: 60 });
  res.json({ ok: true, message: '危机已触发' });
});

// 相位管理
app.get('/api/phase', (req, res) => {
  res.json({ phase: currentPhase });
});

app.post('/api/phase', (req, res) => {
  const { phase } = req.body;
  if (!['building', 'crisis', 'verdict'].includes(phase)) {
    return res.status(400).json({ error: '无效相位' });
  }
  currentPhase = phase;
  if (phase === 'crisis') {
    activeCrisis = { crisis_type: 'platform_fee', triggered_at: Date.now() };
    io.emit('CRISIS_TRIGGER', { crisis_type: 'platform_fee', duration_seconds: 60 });
  }
  io.emit('PHASE_CHANGE', { phase });
  res.json({ ok: true, phase });
});

// 班级摘要
app.get('/api/teams/summary', (req, res) => {
  const subs = db.getSubmittedTeams() || [];
  res.json({
    joined: Math.max(joinedTeams, subs.length),
    submitted: subs.length,
    survived: subs.filter(t => t.verdict === 'survive').length,
    bankrupt: subs.filter(t => t.verdict === 'bankrupt').length
  });
});

// 查询是否有机（学生端轮询）
app.get('/api/crisis/check', (req, res) => {
  if (activeCrisis) {
    res.json({ active: true, crisis_type: activeCrisis.crisis_type, duration_seconds: 60 });
    activeCrisis = null; // 一次性消费
  } else {
    res.json({ active: false });
  }
});

// ==================== WebSocket ====================

io.on('connection', (socket) => {
  console.log(`[WS] 客户端连接: ${socket.id}`);

  // 教师触发危机
  socket.on('CRISIS_TRIGGER', (data) => {
    io.emit('CRISIS_TRIGGER', { crisis_type: data?.crisis_type || 'platform_fee', duration_seconds: 60 });
  });

  // Mock 模式控制
  socket.on('MOCK_TOGGLE', () => {
    if (mock.isMockRunning()) {
      mock.stopMock();
      io.emit('MOCK_STOPPED');
      console.log('[MOCK] 已停止');
    } else {
      mock.startMock(io);
      io.emit('MOCK_STARTED');
      console.log('[MOCK] 已启动');
    }
  });

  // 大屏心跳
  socket.on('TEACHER_PING', () => {
    socket.emit('TEACHER_PONG', { time: Date.now() });
  });

  socket.on('disconnect', () => {
    console.log(`[WS] 客户端断开: ${socket.id}`);
  });
});

// ==================== 启动 ====================

db.init();
server.listen(PORT, () => {
  console.log(`🍵 校园咖啡馆沙盘系统已启动`);
  console.log(`   H5学生端: http://localhost:${PORT}/student`);
  console.log(`   Web大屏:  http://localhost:${PORT}/dashboard`);
  console.log(`   Mock模式: ${MOCK_MODE ? '已启用' : '关闭 (大屏可手动开启)'}`);
});

// 启动时若指定mock参数则自动开启
if (MOCK_MODE) {
  setTimeout(() => mock.startMock(io), 1000);
}
