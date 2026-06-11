/**
 * 判定引擎 - 所有业务规则硬编码实现
 * 开发者无需理解管理学理论，严格按此文件实现即可
 */

const VERDICT = { SURVIVE: 'survive', BANKRUPT: 'bankrupt' };

/**
 * 主判定入口
 * @param {Object} architecture - 完整架构JSON:{ nodes, edges }
 * @returns {Object} { verdict, survival_rate, radar_scores, crisis_passed, message }
 */
function judge(architecture) {
  const { nodes, edges } = architecture;
  
  // 1. 计算每个节点的管理幅度
  const spans = calcSpans(nodes, edges);
  
  // 2. 检查管理幅度击穿
  const breakdown = checkSpanBreakdown(spans);
  if (breakdown.hit) {
    return {
      verdict: VERDICT.BANKRUPT,
      survival_rate: 40,
      radar_scores: {
        '决策效率': 40,
        '沟通成本': 95,
        '执行偏差': 90,
        '管理幅度': 10,
        '响应速度': 10,
        '冗余程度': 50
      },
      crisis_passed: false,
      message: '管理幅度击穿，系统瘫痪！单个节点直连超过8人。'
    };
  }

  // 3. 常规架构评估
  const groups = nodes.filter(n => n.type === 'group');
  const shopManager = nodes.find(n => n.type === 'manager');
  const shopSpan = spans[shopManager.id] || 0;
  
  let baselineSurvival = 60;
  let radar = { '决策效率': 50, '沟通成本': 60, '执行偏差': 50, '管理幅度': 60, '响应速度': 50, '冗余程度': 50 };

  if (groups.length >= 3 && shopSpan <= 3) {
    baselineSurvival = 85;
    radar = { '决策效率': 85, '沟通成本': 20, '执行偏差': 15, '管理幅度': 90, '响应速度': 90, '冗余程度': 70 };
  }

  // 4. 危机压力测试
  const crisisGroup = groups.find(g => {
    const name = (g.label || '').toLowerCase();
    return name.includes('私域');
  });
  
  const crisisMembers = crisisGroup 
    ? nodes.filter(n => n.type === 'staff' && n.group_id === crisisGroup.id).length 
    : 0;

  let finalSurvival, crisisPassed, message;

  if (crisisGroup && crisisMembers >= 2) {
    finalSurvival = Math.min(baselineSurvival + 10, 100);
    crisisPassed = true;
    message = `架构存活，成功建立私域护城河！效率提升${finalSurvival - (baselineSurvival === 85 ? 85 : 60)}%`;
  } else {
    finalSurvival = Math.max(baselineSurvival - 50, 0);
    crisisPassed = false;
    message = crisisGroup 
      ? '私域运营组人数不足（需≥2人），已被平台抽成击穿，宣告破产！'
      : '未建立私域护城河，已被平台抽成击穿，宣告破产！';
  }

  return {
    verdict: finalSurvival >= 60 ? VERDICT.SURVIVE : VERDICT.BANKRUPT,
    survival_rate: finalSurvival,
    radar_scores: radar,
    crisis_passed: crisisPassed,
    message
  };
}

/**
 * 计算每个节点的直接子节点数量（管理幅度）
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
 * 检查是否存在管理幅度击穿（任意节点span > 8）
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
