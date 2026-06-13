/**
 * 数据持久化模块 - 纯 JSON 文件存储（零原生依赖）
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_PATH, 'db.json');

let data = { teams: [] };
let initialized = false;

function init() {
  if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try { data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); } catch (e) { data = { teams: [] }; }
  }
  if (!data.teams) data.teams = [];
  initialized = true;
  return { teams: data.teams };
}

function save() {
  if (!fs.existsSync(DATA_PATH)) fs.mkdirSync(DATA_PATH, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function createTeam(id, teamName, leader) {
  data.teams.push({
    id, team_name: teamName, leader,
    architecture: null, verdict: null, survival_rate: null,
    radar_scores: null, crisis_passed: 0, message: null,
    structure_type: null, failure_reasons: null, teaching_points: null,
    submitted_at: null, created_at: new Date().toISOString()
  });
  save();
}

function getTeam(id) {
  return data.teams.find(t => t.id === id) || null;
}

function getAllTeams() {
  return [...data.teams].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
}

function getSubmittedTeams() {
  return data.teams.filter(t => t.submitted_at).sort((a, b) => (b.submitted_at || '').localeCompare(a.submitted_at || ''));
}

function submitTeam(id, architecture, verdict, survivalRate, radarScores, crisisPassed, message, structureType, failureReasons, teachingPoints) {
  const t = data.teams.find(t => t.id === id);
  if (!t) return;
  t.architecture = JSON.stringify(architecture);
  t.verdict = verdict;
  t.survival_rate = survivalRate;
  t.radar_scores = JSON.stringify(radarScores);
  t.crisis_passed = crisisPassed ? 1 : 0;
  t.message = message;
  t.structure_type = structureType || null;
  t.failure_reasons = JSON.stringify(failureReasons || []);
  t.teaching_points = JSON.stringify(teachingPoints || []);
  t.submitted_at = new Date().toISOString();
  save();
}

function getAvgRadarScores() {
  const submitted = data.teams.filter(t => t.radar_scores);
  if (submitted.length === 0) return null;
  const totals = {};
  let count = 0;
  for (const t of submitted) {
    try {
      const scores = typeof t.radar_scores === 'string' ? JSON.parse(t.radar_scores) : t.radar_scores;
      for (const [key, val] of Object.entries(scores)) {
        totals[key] = (totals[key] || 0) + val;
      }
      count++;
    } catch (e) {}
  }
  if (count === 0) return null;
  const avg = {};
  for (const [key, total] of Object.entries(totals)) {
    avg[key] = Math.round(total / count);
  }
  return avg;
}

function resetAll() {
  data.teams = [];
  save();
}

module.exports = { init, createTeam, getTeam, getAllTeams, getSubmittedTeams, submitTeam, getAvgRadarScores, resetAll };
