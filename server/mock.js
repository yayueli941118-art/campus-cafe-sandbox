/**
 * Mock 数据生成器 - 断网/演示模式保底
 * 按预设曲线自动生成全班数据，教师端无需学生端即可演示
 */

const TEAM_NAMES = [
  '赤焰少年队', '瑞幸突击队', '星巴克战队', '飞虎队', '海底捞小队',
  '元气森林组', '蜜雪冰城连', '库迪咖啡团', '麦咖啡特攻', '必胜客精英',
  '喜茶先锋', '奈雪梦之队', '茶颜悦色军', '古茗骑士', '霸王茶姬团'
];

const STATUS_POOL = [
  { msg: '架构存活，效率提升15%', rate: 85, passed: true },
  { msg: '成功建立私域护城河，绝境翻盘', rate: 92, passed: true },
  { msg: '矩阵重组完美，存活率95%', rate: 95, passed: true },
  { msg: '管理幅度超载，系统瘫痪', rate: 35, passed: false },
  { msg: '未建立私域护城河，宣告破产', rate: 15, passed: false },
  { msg: '架构存活，效率提升8%', rate: 72, passed: true },
  { msg: '管理幅度击穿，已被判定瘫痪', rate: 28, passed: false },
  { msg: '敏捷矩阵成型，效率提升22%', rate: 88, passed: true },
];

let mockIndex = 0;
let mockInterval = null;

function generateMockTeam(index) {
  const name = TEAM_NAMES[index % TEAM_NAMES.length];
  const status = STATUS_POOL[index % STATUS_POOL.length];
  return {
    team_id: `mock-${index}`,
    team_name: name,
    leader: `队长${index + 1}`,
    survival_rate: status.rate,
    radar_scores: {
      '决策效率': Math.round(40 + Math.random() * 55),
      '沟通成本': Math.round(10 + Math.random() * 70),
      '执行偏差': Math.round(10 + Math.random() * 60),
      '管理幅度': Math.round(30 + Math.random() * 65),
      '响应速度': Math.round(20 + Math.random() * 70),
      '冗余程度': Math.round(30 + Math.random() * 60)
    },
    crisis_passed: status.passed,
    message: status.msg
  };
}

function startMock(io) {
  if (mockInterval) return;
  mockIndex = 0;

  // 先清空旧数据
  io.emit('MOCK_RESET');

  mockInterval = setInterval(() => {
    if (mockIndex >= 12) {
      // 循环重置
      mockIndex = 0;
      io.emit('MOCK_RESET');
      return;
    }

    const team = generateMockTeam(mockIndex);

    io.emit('TEAM_SUBMITTED', { team_id: team.team_id, team_name: team.team_name });
    
    setTimeout(() => {
      io.emit('VERDICT_READY', team);
      io.emit('BATTLE_LOG', { team_name: team.team_name, status: team.survival_rate >= 60 ? 'survive' : 'bankrupt', message: team.message });
      io.emit('RADAR_UPDATE', { avg_radar_scores: team.radar_scores });
    }, 500);

    mockIndex++;
  }, 3000);
}

function stopMock() {
  if (mockInterval) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
}

function isMockRunning() {
  return mockInterval !== null;
}

module.exports = { startMock, stopMock, isMockRunning };
