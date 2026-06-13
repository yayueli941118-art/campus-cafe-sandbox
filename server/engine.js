/**
 * 判定引擎 - 将组织结构类型知识点转化为沙盘反馈
 */

const VERDICT = { SURVIVE: 'survive', BANKRUPT: 'bankrupt' };

const RADAR_KEYS = {
  decision: '决策效率',
  communication: '沟通成本',
  deviation: '执行偏差',
  span: '管理幅度',
  response: '响应速度',
  redundancy: '冗余程度'
};

function makeRadar(decision, communication, deviation, span, response, redundancy) {
  return {
    [RADAR_KEYS.decision]: decision,
    [RADAR_KEYS.communication]: communication,
    [RADAR_KEYS.deviation]: deviation,
    [RADAR_KEYS.span]: span,
    [RADAR_KEYS.response]: response,
    [RADAR_KEYS.redundancy]: redundancy
  };
}

/**
 * 主判定入口
 * @param {Object} architecture - 完整架构JSON:{ nodes, edges, groups }
 * @returns {Object} { verdict, survival_rate, radar_scores, crisis_passed, message, structure_type, failure_reasons, teaching_points }
 */
function judge(architecture) {
  const nodes = Array.isArray(architecture.nodes) ? architecture.nodes : [];
  const edges = Array.isArray(architecture.edges) ? architecture.edges : [];
  const groups = collectGroups(architecture);
  const spans = calcSpans(nodes, edges);
  const manager = nodes.find(n => n.type === 'manager') || { id: 'shop_manager' };
  const shopSpan = spans[manager.id] || 0;
  const directStaff = nodes.filter(n => n.type === 'staff' && !n.group_id).length;
  const groupedStaff = nodes.filter(n => n.type === 'staff' && n.group_id).length;
  const structureType = classifyStructure({ groups, shopSpan, directStaff, groupedStaff });

  const breakdown = checkSpanBreakdown(spans);
  if (breakdown.hit) {
    return {
      verdict: VERDICT.BANKRUPT,
      survival_rate: 40,
      radar_scores: makeRadar(40, 95, 90, 10, 10, 50),
      crisis_passed: false,
      structure_type: '直线制过载',
      failure_reasons: [
        '管理幅度超过安全阈值，店长成为单点瓶颈',
        '信息与任务仍集中向上汇报，沟通中枢被击穿'
      ],
      teaching_points: [
        '对应课件：传统直线制在业务突增时容易失灵',
        '改进方向：按职能拆分小组，降低店长直管人数'
      ],
      message: '管理幅度击穿：单个节点直连超过8人，直线制在爆单场景下失灵。'
    };
  }

  let baselineSurvival = 60;
  let radar = makeRadar(55, 60, 50, 60, 55, 50);
  const failureReasons = [];
  const teachingPoints = [
    `当前结构更接近：${structureType}`,
    `店长管理幅度：${shopSpan}；已分组员工：${groupedStaff}/${nodes.filter(n => n.type === 'staff').length}`
  ];

  if (groups.length >= 3 && shopSpan <= 4 && directStaff <= 1) {
    baselineSurvival = 85;
    radar = makeRadar(85, 25, 20, 90, 88, 70);
    teachingPoints.push('对应课件：矩阵制/敏捷结构通过横向分工提升响应速度');
  } else if (groups.length >= 2 && shopSpan <= 6) {
    baselineSurvival = 72;
    radar = makeRadar(70, 45, 35, 72, 68, 58);
    teachingPoints.push('对应课件：从直线制向职能分工过渡，但矩阵协同还不充分');
    if (groups.length < 3) failureReasons.push('职能小组数量偏少，业务链条覆盖不完整');
    if (directStaff > 1) failureReasons.push('仍有员工直接汇报给店长，管理幅度尚未完全释放');
  } else {
    baselineSurvival = 55;
    radar = makeRadar(50, 70, 62, 45, 45, 45);
    failureReasons.push('组织拆分不足，仍保留明显直线制特征');
    failureReasons.push('横向协同节点不足，无法承接外卖、品控、客服等并行业务');
    teachingPoints.push('对应课件：只增加人手不能解决结构性拥堵');
  }

  const crisisGroup = groups.find((g, index) => isCrisisGroup(g, index, groups));
  const crisisMembers = crisisGroup
    ? nodes.filter(n => n.type === 'staff' && n.group_id === crisisGroup.id).length
    : 0;

  let finalSurvival;
  let crisisPassed;
  let message;

  if (crisisGroup && crisisMembers >= 2) {
    finalSurvival = Math.min(baselineSurvival + 10, 100);
    crisisPassed = true;
    teachingPoints.push('危机环节：临时跨职能小组体现矩阵制的弹性协同');
    message = `结构存活：${structureType}基本成型，并建立私域运营组承接平台抽成危机。`;
  } else {
    finalSurvival = Math.max(baselineSurvival - 35, 0);
    crisisPassed = false;
    if (crisisGroup) {
      failureReasons.push('私域运营组人数不足，危机任务缺少稳定执行单元');
      message = '危机未通过：已建立私域运营组，但人数不足，无法形成有效响应。';
    } else {
      failureReasons.push('未建立私域运营组，缺少面向外部变化的临时响应结构');
      message = '危机未通过：未建立私域运营组，组织无法应对平台抽成突发变化。';
    }
    teachingPoints.push('对应课件：矩阵/敏捷结构的价值在于快速重组资源应对变化');
  }

  return {
    verdict: finalSurvival >= 60 ? VERDICT.SURVIVE : VERDICT.BANKRUPT,
    survival_rate: finalSurvival,
    radar_scores: radar,
    crisis_passed: crisisPassed,
    structure_type: structureType,
    failure_reasons: failureReasons.length ? failureReasons : ['结构关键节点配置合理，未发现致命瓶颈'],
    teaching_points: teachingPoints,
    message
  };
}

function collectGroups(architecture) {
  const fromNodes = (architecture.nodes || []).filter(n => n.type === 'group');
  const fromGroups = (architecture.groups || []).map(g => ({ ...g, type: 'group' }));
  const byId = new Map();
  for (const g of [...fromNodes, ...fromGroups]) byId.set(g.id, g);
  return [...byId.values()];
}

function classifyStructure({ groups, shopSpan, directStaff, groupedStaff }) {
  if (groups.length === 0 || directStaff >= 8) return '直线制';
  if (groups.length >= 3 && shopSpan <= 4 && groupedStaff >= 8) return '矩阵制/敏捷结构';
  if (groups.length >= 2 && groupedStaff >= directStaff) return '职能制过渡结构';
  return '混合结构';
}

function isCrisisGroup(group, index, groups) {
  const label = group.label || '';
  if (/私域|流量|运营/.test(label)) return true;
  const defaultGroupIds = new Set(['g01', 'g02', 'g03']);
  return groups.length >= 4 && index === groups.length - 1 && !defaultGroupIds.has(group.id);
}

/**
 * 计算每个节点的直接子节点数量，即管理幅度。
 */
function calcSpans(nodes, edges) {
  const spans = {};
  for (const n of nodes) {
    spans[n.id] = 0;
  }
  for (const e of edges) {
    if (spans[e.from] !== undefined) {
      spans[e.from]++;
    }
  }
  return spans;
}

/**
 * 任意节点直连人数超过8，视为管理幅度击穿。
 */
function checkSpanBreakdown(spans) {
  for (const [nodeId, span] of Object.entries(spans)) {
    if (span > 8) {
      return { hit: true, nodeId, span };
    }
  }
  return { hit: false };
}

module.exports = { judge, VERDICT };
