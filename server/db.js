/**
 * SQLite 数据库模块 - 团队状态持久化
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'sandbox.db');

let db;

function init() {
  const fs = require('fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      team_name TEXT NOT NULL,
      leader TEXT NOT NULL,
      architecture TEXT,
      verdict TEXT,
      survival_rate INTEGER,
      radar_scores TEXT,
      crisis_passed INTEGER DEFAULT 0,
      message TEXT,
      submitted_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  return db;
}

function createTeam(id, teamName, leader) {
  const stmt = db.prepare('INSERT INTO teams (id, team_name, leader) VALUES (?, ?, ?)');
  stmt.run(id, teamName, leader);
}

function getTeam(id) {
  return db.prepare('SELECT * FROM teams WHERE id = ?').get(id);
}

function getAllTeams() {
  return db.prepare('SELECT * FROM teams ORDER BY created_at DESC').all();
}

function getSubmittedTeams() {
  return db.prepare("SELECT * FROM teams WHERE submitted_at IS NOT NULL ORDER BY submitted_at DESC").all();
}

function submitTeam(id, architecture, verdict, survivalRate, radarScores, crisisPassed, message) {
  const stmt = db.prepare(`
    UPDATE teams SET 
      architecture = ?, verdict = ?, survival_rate = ?, radar_scores = ?, 
      crisis_passed = ?, message = ?, submitted_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(JSON.stringify(architecture), verdict, survivalRate, JSON.stringify(radarScores), crisisPassed ? 1 : 0, message, id);
}

function getAvgRadarScores() {
  const rows = db.prepare("SELECT radar_scores FROM teams WHERE radar_scores IS NOT NULL").all();
  if (rows.length === 0) return null;

  const totals = {};
  let count = 0;
  for (const row of rows) {
    try {
      const scores = JSON.parse(row.radar_scores);
      for (const [key, val] of Object.entries(scores)) {
        totals[key] = (totals[key] || 0) + val;
      }
      count++;
    } catch (e) { /* skip */ }
  }
  if (count === 0) return null;
  const avg = {};
  for (const [key, total] of Object.entries(totals)) {
    avg[key] = Math.round(total / count);
  }
  return avg;
}

function resetAll() {
  db.exec("DELETE FROM teams");
}

module.exports = { init, createTeam, getTeam, getAllTeams, getSubmittedTeams, submitTeam, getAvgRadarScores, resetAll };
