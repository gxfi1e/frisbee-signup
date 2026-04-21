// ================= CONFIG =================
// ===== Column index (0-based) =====
const COL = {
  ts: 0,         // A Timestamp
  name: 1,       // B Name
  gender: 2,     // C Gender
  throwing: 3,   // D Throwing
  catch: 4,      // E Catch
  fitness: 5,    // F Fitness
  experience: 6, // G Experience
  pd: 7,         // H PracticeDuration
  pref: 8,       // I Preference
  regId: 9,      // J RegID
  status: 10,    // K Status
  score: 11      // L Score
};

const SHEET_ID = "15izivlv7i8XM8yW46qO1nyda-qD8VRpT1UxOiymiFsI";
const MAX_PLAYERS = 30;
const TEAMS_MIN_FOR_FOUR = 24;
const MONTE_CARLO_ROUNDS = 1200;

const MAIN_INPUT_COLS = 11;  // A:K
const MAIN_TOTAL_COLS = 12;  // A:L
const PROFILE_SHEET_NAME = "Profiles";
const PROFILE_TOTAL_COLS = 15;
const GOOGLE_WEB_CLIENT_ID = "1069850564998-vkodia6uabn5p3sv863sk59732vo4qc7.apps.googleusercontent.com";
const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token=";

const PROFILE_COL = {
  email: 0,
  name: 1,
  gender: 2,
  throwing: 3,
  catch: 4,
  fitness: 5,
  experience: 6,
  practice: 7,
  preference: 8,
  updatedAt: 9,
  lastVerifiedAt: 10,
  status: 11,
  googleSub: 12,
  googleEmail: 13,
  lastGoogleLoginAt: 14
};

const SCORE_FORMULA = `=ARRAYFORMULA(
  IF(B2:B="","",
    ROUND(
      0.3*N(D2:D) +
      0.25*N(E2:E) +
      0.2*N(F2:F) +
      0.15*N(G2:G) +
      0.1*IF(H2:H="< 3 months",1,
        IF(H2:H="3–12 months",2,
        IF(H2:H="1–3 years",3.1,
        IF(H2:H="3–5 years",4.1,
        IF(H2:H="> 5 years",4.6,
        IF(H2:H="> 3 years",4.3,0)))))),
      3
    )
  )
)`;


// ================= BASIC =================
function sheet_(){
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  ensureMainSheetSchema_(sh);
  return sh;
}

function ensureMainSheetSchema_(sh){
  if (sh.getMaxColumns() < MAIN_TOTAL_COLS) {
    sh.insertColumnsAfter(sh.getMaxColumns(), MAIN_TOTAL_COLS - sh.getMaxColumns());
  }

  const headerCell = sh.getRange(1, COL.score + 1);
  if (!String(headerCell.getValue() || "").trim()) {
    headerCell.setValue("Score");
  }

  const formulaCell = sh.getRange(2, COL.score + 1);
  if (!formulaCell.getFormula()) {
    formulaCell.setFormula(SCORE_FORMULA);
  }
}

function ensureHeaderRow_(sh, headers){
  const width = headers.length;
  if (sh.getMaxColumns() < width) {
    sh.insertColumnsAfter(sh.getMaxColumns(), width - sh.getMaxColumns());
  }

  const existing = sh.getRange(1, 1, 1, width).getValues()[0];
  const same = headers.every((header, i) => String(existing[i] || "").trim() === header);
  if (!same) {
    sh.getRange(1, 1, 1, width).setValues([headers]);
  }
}

function profilesSheet_(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(PROFILE_SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(PROFILE_SHEET_NAME);
  }

  ensureHeaderRow_(sh, [
    "Email",
    "Name",
    "Gender",
    "Throwing",
    "Catch",
    "Fitness",
    "Experience",
    "PracticeDuration",
    "Preference",
    "UpdatedAt",
    "LastVerifiedAt",
    "Status",
    "GoogleSub",
    "GoogleEmail",
    "LastGoogleLoginAt"
  ]);
  return sh;
}

function installScoreFormula_(){
  const sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  ensureMainSheetSchema_(sh);

  sh.getRange(1, COL.score + 1).setValue("Score");

  const maxRows = sh.getMaxRows();
  if (maxRows >= 2) {
    sh.getRange(2, COL.score + 1, maxRows - 1, 1).clearContent();
  }

  sh.getRange(2, COL.score + 1).setFormula(SCORE_FORMULA);
  Logger.log("Installed ARRAYFORMULA in L2.");
}

function resetScoreFormula_(){
  installScoreFormula_();
}

function json_(o){
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeNum_(v){
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function normalizeEmail_(email){
  return String(email || "").trim().toLowerCase();
}

function isValidEmail_(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail_(email));
}

function getSheetDataRows_(sh){
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
}

// Find the next real data row based only on A:K (ignore score column L completely)
function getNextDataRow_(sh) {
  const maxRows = sh.getMaxRows();
  if (maxRows < 2) return 2;

  const vals = sh.getRange(2, 1, maxRows - 1, MAIN_INPUT_COLS).getValues();

  for (let i = vals.length - 1; i >= 0; i--) {
    const row = vals[i];
    const hasData = row.some(v => String(v || "").trim() !== "");
    if (hasData) return i + 3; // sheet row number of next empty row
  }
  return 2;
}

function getMainLastDataRow_(sh){
  return getNextDataRow_(sh) - 1;
}

function getMainInputRows_(sh){
  const lastDataRow = getMainLastDataRow_(sh);
  if (lastDataRow < 2) return [];
  return sh.getRange(2, 1, lastDataRow - 1, MAIN_INPUT_COLS).getValues();
}

function getAllRows_(){
  const sh = sheet_();
  const lastDataRow = getMainLastDataRow_(sh);
  if (lastDataRow < 2) return [];
  return sh.getRange(2, 1, lastDataRow - 1, MAIN_TOTAL_COLS).getValues();
}

function activeRows_(rows){
  return rows.filter(r => String(r[COL.status] || "").trim() === "Active");
}

function activeCount_(){
  return activeRows_(getAllRows_()).length;
}

function findActiveRowByName_(rows, name){
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const rName = String(r[COL.name] || "").trim();
    const rStat = String(r[COL.status] || "").trim();
    if (rName === name && rStat === "Active") {
      return { index: i, row: r };
    }
  }
  return null;
}

// ================= WEEK KEY / CUTOFF =================
function getRelevantFridayDate_(refDate){
  const now = refDate ? new Date(refDate) : new Date();
  const day = now.getDay(); // 0=Sun ... 5=Fri ... 6=Sat
  const backToFriday = (day + 2) % 7;

  const friday = new Date(now);
  friday.setDate(now.getDate() - backToFriday);
  friday.setHours(0, 0, 0, 0);
  return friday;
}

function getWeekKey_(){
  return Utilities.formatDate(
    getRelevantFridayDate_(new Date()),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

function isAfterCutoff_(){
  const now = new Date();
  const cutoff = new Date(getRelevantFridayDate_(now));
  cutoff.setHours(15, 0, 0, 0);
  return now.getTime() >= cutoff.getTime();
}

function getCutoffTime_() {
  const now = new Date();
  const cutoff = new Date(now);

  const day = cutoff.getDay();
  const diffToFriday = (5 - day + 7) % 7;

  cutoff.setDate(cutoff.getDate() + diffToFriday);
  cutoff.setHours(15, 0, 0, 0);

  return cutoff;
}

function getRegistrationStatus_(){
  const cutoff = getCutoffTime_();
  const now = new Date();
  const count = activeCount_();
  const isFull = count >= MAX_PLAYERS;
  const open = now.getTime() < cutoff.getTime() && !isFull;

  return {
    now,
    cutoff,
    count,
    isFull,
    open
  };
}

// ================= PROFILE CLOUD LAYER =================
function findProfileRowIndexByEmail_(email){
  const sh = profilesSheet_();
  const rows = getSheetDataRows_(sh);
  const normalized = normalizeEmail_(email);

  for (let i = rows.length - 1; i >= 0; i--) {
    if (normalizeEmail_(rows[i][PROFILE_COL.email]) === normalized) {
      return i + 2;
    }
  }
  return 0;
}

function findProfileRowIndexByGoogleSub_(googleSub){
  const sh = profilesSheet_();
  const rows = getSheetDataRows_(sh);
  const normalizedSub = String(googleSub || "").trim();

  if (!normalizedSub) return 0;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][PROFILE_COL.googleSub] || "").trim() === normalizedSub) {
      return i + 2;
    }
  }
  return 0;
}

function profileRecordFromRow_(row){
  if (!row) return null;
  return {
    email: normalizeEmail_(row[PROFILE_COL.email]),
    name: String(row[PROFILE_COL.name] || "").trim(),
    gender: String(row[PROFILE_COL.gender] || "").trim(),
    throwing: String(row[PROFILE_COL.throwing] || "").trim(),
    catch: String(row[PROFILE_COL.catch] || "").trim(),
    fitness: String(row[PROFILE_COL.fitness] || "").trim(),
    experience: String(row[PROFILE_COL.experience] || "").trim(),
    practice: String(row[PROFILE_COL.practice] || "").trim(),
    preference: String(row[PROFILE_COL.preference] || "").trim(),
    updatedAt: row[PROFILE_COL.updatedAt] || "",
    lastVerifiedAt: row[PROFILE_COL.lastVerifiedAt] || "",
    status: String(row[PROFILE_COL.status] || "").trim(),
    googleSub: String(row[PROFILE_COL.googleSub] || "").trim(),
    googleEmail: normalizeEmail_(row[PROFILE_COL.googleEmail]),
    lastGoogleLoginAt: row[PROFILE_COL.lastGoogleLoginAt] || ""
  };
}

function readProfileByEmail_(email){
  const sh = profilesSheet_();
  const rowIndex = findProfileRowIndexByEmail_(email);
  if (!rowIndex) return null;

  const row = sh.getRange(rowIndex, 1, 1, PROFILE_TOTAL_COLS).getValues()[0];
  const profile = profileRecordFromRow_(row);
  profile.rowIndex = rowIndex;
  return profile;
}

function readProfileByGoogleSub_(googleSub){
  const sh = profilesSheet_();
  const rowIndex = findProfileRowIndexByGoogleSub_(googleSub);
  if (!rowIndex) return null;

  const row = sh.getRange(rowIndex, 1, 1, PROFILE_TOTAL_COLS).getValues()[0];
  const profile = profileRecordFromRow_(row);
  profile.rowIndex = rowIndex;
  return profile;
}

function findProfileRowIndexByIdentity_(identity, emailFallback){
  const idxBySub = findProfileRowIndexByGoogleSub_(identity && identity.sub);
  if (idxBySub) return idxBySub;

  const candidates = [
    normalizeEmail_(emailFallback),
    normalizeEmail_(identity && identity.email)
  ].filter(Boolean);

  for (let i = 0; i < candidates.length; i++) {
    const idxByEmail = findProfileRowIndexByEmail_(candidates[i]);
    if (idxByEmail) return idxByEmail;
  }

  return 0;
}

function buildProfileRowValues_(profile, existingRow, identity){
  return [[
    normalizeEmail_(profile.email) || normalizeEmail_(existingRow && existingRow[PROFILE_COL.email]) || normalizeEmail_(identity && identity.email),
    String(profile.name || (existingRow && existingRow[PROFILE_COL.name]) || "").trim(),
    String(profile.gender || (existingRow && existingRow[PROFILE_COL.gender]) || "").trim(),
    String(profile.throwing || (existingRow && existingRow[PROFILE_COL.throwing]) || "").trim(),
    String(profile.catch || (existingRow && existingRow[PROFILE_COL.catch]) || "").trim(),
    String(profile.fitness || (existingRow && existingRow[PROFILE_COL.fitness]) || "").trim(),
    String(profile.experience || (existingRow && existingRow[PROFILE_COL.experience]) || "").trim(),
    String(profile.practice || (existingRow && existingRow[PROFILE_COL.practice]) || "").trim(),
    String(profile.preference || (existingRow && existingRow[PROFILE_COL.preference]) || "").trim(),
    new Date(),
    existingRow ? existingRow[PROFILE_COL.lastVerifiedAt] || "" : "",
    "Active",
    String(identity && identity.sub || "").trim(),
    normalizeEmail_(identity && identity.email),
    new Date()
  ]];
}

function upsertProfileByGoogleIdentity_(profile, identity){
  const sh = profilesSheet_();
  const rowIndex = findProfileRowIndexByIdentity_(identity, profile.email);
  const existingRow = rowIndex
    ? sh.getRange(rowIndex, 1, 1, PROFILE_TOTAL_COLS).getValues()[0]
    : null;
  const rowValues = buildProfileRowValues_(profile, existingRow, identity);

  if (rowIndex) {
    sh.getRange(rowIndex, 1, 1, PROFILE_TOTAL_COLS).setValues(rowValues);
  } else {
    sh.appendRow(rowValues[0]);
  }

  return readProfileByGoogleSub_(identity.sub) || readProfileByEmail_(profile.email || identity.email);
}

function publicProfilePayload_(profile){
  if (!profile) return null;
  return {
    email: profile.email,
    name: profile.name,
    gender: profile.gender,
    throwing: profile.throwing,
    catch: profile.catch,
    fitness: profile.fitness,
    experience: profile.experience,
    practice: profile.practice,
    preference: profile.preference,
    googleEmail: profile.googleEmail || ""
  };
}

function getGoogleTokenCacheKey_(idToken){
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(idToken || ""));
  return "gid:" + Utilities.base64EncodeWebSafe(digest).slice(0, 80);
}

function verifyGoogleIdToken_(idToken){
  const token = String(idToken || "").trim();
  if (!token) {
    throw new Error("Google sign-in token is required.");
  }

  const cache = CacheService.getScriptCache();
  const cacheKey = getGoogleTokenCacheKey_(token);
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const res = UrlFetchApp.fetch(GOOGLE_TOKENINFO_URL + encodeURIComponent(token), {
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    throw new Error("Google sign-in token is invalid or expired.");
  }

  const data = JSON.parse(res.getContentText() || "{}");
  const aud = String(data.aud || "").trim();
  const iss = String(data.iss || "").trim();
  const sub = String(data.sub || "").trim();
  const email = normalizeEmail_(data.email);
  const emailVerified = String(data.email_verified || "").toLowerCase() === "true";
  const expMs = Number(data.exp || 0) * 1000;

  if (!sub) {
    throw new Error("Google sign-in token is missing the user id.");
  }
  if (aud !== GOOGLE_WEB_CLIENT_ID) {
    throw new Error("Google sign-in token does not match this app.");
  }
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") {
    throw new Error("Google sign-in issuer is invalid.");
  }
  if (!email || !emailVerified) {
    throw new Error("Google account email must be verified.");
  }
  if (!expMs || Date.now() >= expMs) {
    throw new Error("Google sign-in token has expired.");
  }

  const identity = {
    sub,
    email,
    name: String(data.name || "").trim()
  };

  const ttlSec = Math.max(30, Math.min(300, Math.floor((expMs - Date.now()) / 1000)));
  cache.put(cacheKey, JSON.stringify(identity), ttlSec);
  return identity;
}

function loadGoogleProfileAction_(data){
  let identity = null;

  try {
    identity = verifyGoogleIdToken_(data.idToken);
  } catch (err) {
    return {
      ok:false,
      error:String(err && err.message || err),
      code:"invalid_google_token"
    };
  }

  let profile = readProfileByGoogleSub_(identity.sub);
  if (!profile) {
    const fallbackRowIndex = findProfileRowIndexByEmail_(identity.email);
    if (fallbackRowIndex) {
      const sh = profilesSheet_();
      sh.getRange(fallbackRowIndex, PROFILE_COL.googleSub + 1, 1, 3).setValues([[
        identity.sub,
        identity.email,
        new Date()
      ]]);
      profile = readProfileByGoogleSub_(identity.sub);
    }
  } else if (profile.rowIndex) {
    const sh = profilesSheet_();
    sh.getRange(profile.rowIndex, PROFILE_COL.googleSub + 1, 1, 3).setValues([[
      identity.sub,
      identity.email,
      new Date()
    ]]);
    profile = readProfileByGoogleSub_(identity.sub);
  }

  return {
    ok:true,
    google: {
      sub: identity.sub,
      email: identity.email,
      name: identity.name
    },
    profile: publicProfilePayload_(profile)
  };
}

function saveGoogleProfileAction_(data){
  let identity = null;

  try {
    identity = verifyGoogleIdToken_(data.idToken);
  } catch (err) {
    return {
      ok:false,
      error:String(err && err.message || err),
      code:"invalid_google_token"
    };
  }

  const profile = {
    email: normalizeEmail_(data.email) || identity.email,
    name: data.name,
    gender: data.gender,
    throwing: data.throwing,
    catch: data.catch,
    fitness: data.fitness,
    experience: data.experience,
    practice: data.practice,
    preference: data.preference
  };

  if (
    !profile.email ||
    !profile.name ||
    !profile.gender ||
    !profile.throwing ||
    !profile.catch ||
    !profile.fitness ||
    !profile.experience ||
    !profile.practice ||
    !profile.preference
  ) {
    return { ok:false, error:"Complete profile fields required for cloud save" };
  }

  const saved = upsertProfileByGoogleIdentity_(profile, identity);
  return {
    ok:true,
    saved:true,
    google: {
      sub: identity.sub,
      email: identity.email,
      name: identity.name
    },
    profile: publicProfilePayload_(saved)
  };
}

function parsePostData_(e){
  const raw = e && e.postData ? String(e.postData.contents || "").trim() : "";
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (_err) {
    }
  }

  const params = (e && e.parameter) ? e.parameter : {};
  const obj = {};
  Object.keys(params).forEach(key => {
    obj[key] = params[key];
  });
  return obj;
}

// ================= API =================
function doGet(e){
  const action = String(e?.parameter?.action || "status");

  if (action === "players") return players_();
  if (action === "teams") return getTeamsWithAuto_();
  if (action === "analytics") return analytics_();
  if (action !== "status") return json_({ ok:false, error:"unknown action: " + action });

  const st = getRegistrationStatus_();

  return json_({
    ok: true,
    count: st.count,
    max: MAX_PLAYERS,
    open: st.open,
    isFull: st.isFull,
    cutoffIso: st.cutoff.toISOString()
  });
}



// ================= REGID =================
function generateRegId_() {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  const datePart = `${yyyy}${mm}${dd}`;

  const rand = Math.random()
    .toString(36)
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 8)
    .toUpperCase();

  return "FRI-" + datePart + "-" + rand;
}

// ================= POST =================
function doPost(e){
  const out = (obj) => ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

  let lock = null;

  try{
    const data = parsePostData_(e);
    const action = String(data.action || "register");
    
    if (action === "loadGoogleProfile") {
      return out(loadGoogleProfileAction_(data));
    }

    if (action === "saveGoogleProfile") {
      return out(saveGoogleProfileAction_(data));
    }

    lock = LockService.getScriptLock();
    lock.waitLock(10000);
    
    // ============ CANCEL ============
    if (action === "cancel") {
      const sh = sheet_();
      const rows = getMainInputRows_(sh);
      const name = (data.name || "").toString().trim();
      const regId = (data.regId || "").toString().trim();
    
      if (!name || !regId) {
        return out({ ok:false, error:"name and regId required" });
      }
    
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        const rName  = (r[COL.name] || "").toString().trim();
        const rRegId = (r[COL.regId] || "").toString().trim();
        const rStat  = (r[COL.status] || "").toString().trim();
    
        if (rName === name && rRegId === regId && rStat === "Active") {
          sh.getRange(i + 2, COL.status + 1).setValue("Cancelled");
          return out({ ok:true, cancelled:true });
        }
      }
    
      return out({ ok:false, error:"Active record not found (name/regId mismatch or already cancelled)" });
    }
    
    // ============ REGISTER ============
    if (action === "register") {
      const sh = sheet_();
      const name = (data.name || "").toString().trim();
      const gender = (data.gender || "").toString().trim();
      const throwing = (data.throwing || "").toString().trim();
      const catchV = (data.catch || "").toString().trim();
      const fitness = (data.fitness || "").toString().trim();
      const experience = (data.experience || "").toString().trim();
      const pd = (data.practice || "").toString().trim();
      const pref = (data.preference || "").toString().trim();
    
      if (!name || !gender || !throwing || !catchV || !fitness || !experience || !pref || !pd) {
        return out({ ok:false, error:"missing required fields" });
      }
    
      const regStatus = getRegistrationStatus_();
      if (!regStatus.open) {
        return out({
          ok:false,
          error: regStatus.isFull ? "Registration is full." : "Registration is closed."
        });
      }
    
      const rows = getMainInputRows_(sh);
      const existing = findActiveRowByName_(rows, name);
      if (existing) {
        return out({
          ok:false,
          error:"This name is already registered. Please use your full name to avoid repeat registration with other people."
        });
      }
    
      // Re-check capacity immediately before append while still holding the lock
      const freshCount = activeCount_();
      if (freshCount >= MAX_PLAYERS) {
        return out({ ok:false, error:"Registration is full." });
      }
    
      const regId = generateRegId_();
      const nextRow = getNextDataRow_(sh);
    
      sh.getRange(nextRow, 1, 1, MAIN_INPUT_COLS).setValues([[
        new Date(),
        name,
        gender,
        throwing,
        catchV,
        fitness,
        experience,
        pd,
        pref,
        regId,
        "Active"
      ]]);
    
      return out({ ok:true, updated:false, regId });
    }
    
    return out({ ok:false, error:"unknown action: " + action });

  } catch(err) {
    return out({ ok:false, error:String(err) });
  } finally {
    try {
      lock.releaseLock();
    } catch (_err) {
    }
  }
}

// ================= PLAYERS =================
function players_(){
  const rows = activeRows_(getAllRows_());

  const players = rows.map(r => ({
    name: r[COL.name],
    gender: r[COL.gender],
    preference: r[COL.pref]
  }));

  const stats = {
    male: players.filter(p => p.gender === "Male").length,
    female: players.filter(p => p.gender === "Female").length,
    handler: players.filter(p => p.preference === "Handler").length,
    cutter: players.filter(p => p.preference === "Cutter").length
  };

  return json_({
    ok:true,
    count: players.length,
    stats,
    players
  });
}

function buildPublicTeams_(teams){
  return (teams || []).map(t => ({
    name: String(t?.name || "").trim(),
    players: (t?.players || []).map(p => ({
      name: String(p?.name || "").trim()
    }))
  }));
}

function buildPublicTeamsText_(teams){
  if (!teams || !teams.length) return "No players.";
  return teams.map(t => {
    const lines = [t.name].concat((t.players || []).map(p => "- " + p.name));
    return lines.join("\n");
  }).join("\n\n");
}

function makePublicTeamsPayload_(full){
  const publicTeams = buildPublicTeams_(full?.teams || []);
  return {
    nTeams: Number(full?.nTeams) || publicTeams.length,
    nPlayers: Number(full?.nPlayers) ||
      publicTeams.reduce((sum, t) => sum + (t.players || []).length, 0),
    teams: publicTeams,
    teamsText: buildPublicTeamsText_(publicTeams)
  };
}

// ================= TEAM AUTO =================
function getTeamsWithAuto_(){
  if (!isAfterCutoff_()) {
    return json_({ ok:false, error:"Not generated yet" });
  }
  ensureTeamsGenerated_();
  return getTeams_();
}

// ================= ENSURE GENERATED =================
function ensureTeamsGenerated_(){

  const key = getWeekKey_();
  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sh = ss.getSheetByName("Teams");
    
    if (!sh) {
      sh = ss.insertSheet("Teams");
      sh.appendRow(["WeekKey", "GeneratedAt", "TeamsJSON", "TeamsText"]);
    }
    
    const lastRow = sh.getLastRow();
    
    if (lastRow > 1) {
      const vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();
      for (let i = vals.length - 1; i >= 0; i--) {
        const existingKey = Utilities.formatDate(
          new Date(vals[i][0]),
          Session.getScriptTimeZone(),
          "yyyy-MM-dd"
        );
        if (existingKey === key) return;
      }
    }
    
    const result = generateTeams_();
    
    sh.appendRow([
      key,
      new Date(),
      JSON.stringify(result),
      result.teamsText
    ]);

  } finally {
    lock.releaseLock();
  }
}

// ================= READ TEAMS =================
function getTeams_(){

  const key = getWeekKey_();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName("Teams");

  if (!sh || sh.getLastRow() < 2) {
    return json_({ ok:false, error:"Not generated yet" });
  }

  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues(); // only A:C needed

  for (let i = vals.length - 1; i >= 0; i--) {
    const existingKey = Utilities.formatDate(
      new Date(vals[i][0]),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

    if (existingKey === key) {
      try {
        const full = JSON.parse(String(vals[i][2] || "{}"));
    
        return json_({
          ok:true,
          ...makePublicTeamsPayload_(full)
        });
      } catch (err) {
        return json_({ ok:false, error:"Teams cache is corrupted" });
      }
    }

  }

  return json_({ ok:false, error:"Not generated yet" });
}

// ================= TEAM GENERATOR =================
function generateTeams_(){

  const rows = activeRows_(getAllRows_());
  if (rows.length === 0) {
    return { nTeams:0, nPlayers:0, teams:[], teamsText:"No players." };
  }

  const players = rows.map((r, idx) => {
    const throwing = safeNum_(r[COL.throwing]);
    const catchV = safeNum_(r[COL.catch]);
    const fitness = safeNum_(r[COL.fitness]);
    const experience = safeNum_(r[COL.experience]);
    const preference = (r[COL.pref] || "").toString().trim();

    return {
      uid: String(r[COL.regId] || (String(r[COL.name] || "") + "_" + idx)),
      name: r[COL.name],
      gender: (r[COL.gender] || "").toString().trim(),
      preference,
      throwing,
      catch: catchV,
      fitness,
      experience,
      score: safeNum_(r[COL.score]),
    
      athlete: fitness >= 4,
      lowFitness: fitness <= 2,
    
      // New internal balancing indices
      offenseValue: 0.45 * throwing + 0.30 * catchV + 0.15 * experience + 0.10 * fitness,
      defenseValue: 0.55 * fitness + 0.25 * experience + 0.20 * catchV,
    
      // New handler-quality flag
      reliableHandler: preference === "Handler" && throwing >= 4
    };

  });

  const nPlayers = players.length;
  const nTeams = nPlayers >= TEAMS_MIN_FOR_FOUR ? 4 : 2;

  const sortedAll = [...players].sort((a, b) => b.score - a.score);
  const eliteCutAll = Math.ceil(nPlayers * 0.25);
  const ELITE = sortedAll.slice(0, eliteCutAll);

  function variance(arr){
    if (!arr.length) return 0;
    const max = Math.max(...arr);
    const min = Math.min(...arr);
    return (max - min) ** 2;
  }

  function randInt(n){
    return Math.floor(Math.random() * n);
  }

  function jitterSorted(arr, temperature){
    const a = [...arr];
    const swaps = Math.max(0, Math.floor(temperature * a.length));
    for (let s = 0; s < swaps; s++) {
      const i = randInt(a.length);
      const j = Math.min(a.length - 1, Math.max(0, i + (randInt(5) - 2)));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function splitByPercentile(group){
    const arr = [...group].sort((a, b) => b.score - a.score);
    const n = arr.length;
    if (n === 0) return { ELITE:[], STRONG:[], MID:[], NEWBIE:[] };

    const eliteCut = Math.ceil(n * 0.25);
    const strongCut = Math.ceil(n * 0.50);
    const midCut = Math.ceil(n * 0.75);
    
    return {
      ELITE: arr.slice(0, eliteCut),
      STRONG: arr.slice(eliteCut, strongCut),
      MID: arr.slice(strongCut, midCut),
      NEWBIE: arr.slice(midCut)
    };

  }

  function snakeDraftPreferFemale(group, teams){
    let direction = 1;
    let index = 0;

    group.forEach(p => {
      let target = index;
    
      if (p.gender === "Female") {
        const femaleCounts = teams.map(t => t.filter(x => x.gender === "Female").length);
        const minF = Math.min(...femaleCounts);
        const candidates = [];
        for (let k = 0; k < teams.length; k++) {
          if (femaleCounts[k] === minF) candidates.push(k);
        }
        target = candidates.reduce((best, k) => {
          return Math.abs(k - target) < Math.abs(best - target) ? k : best;
        }, candidates[0]);
      }
    
      teams[target].push(p);
    
      if (direction === 1) {
        if (index === nTeams - 1) direction = -1;
        else index++;
      } else {
        if (index === 0) direction = 1;
        else index--;
      }
    });

  }

  function draftRolePool_(pool, teams, { usePercentile = true, temperature = 0.6 } = {}){
    if (pool.length === 0) return;

    const sorted = [...pool].sort((a, b) => b.score - a.score);
    const small = pool.length < 10;
    
    if (!usePercentile || small) {
      const arr = temperature > 0 ? jitterSorted(sorted, temperature * 0.35) : sorted;
      snakeDraftPreferFemale(arr, teams);
      return;
    }
    
    const G = splitByPercentile(sorted);
    
    snakeDraftPreferFemale(jitterSorted(G.ELITE,  temperature * 0.90), teams);
    snakeDraftPreferFemale(jitterSorted(G.STRONG, temperature * 0.80), teams);
    snakeDraftPreferFemale(jitterSorted(G.MID,    temperature * 0.70), teams);
    snakeDraftPreferFemale(jitterSorted(G.NEWBIE, temperature * 0.60), teams);

  }

  function avgScoreOfRole(team, role){
    const arr = team.filter(p => (role === "Handler" ? p.preference === "Handler" : p.preference !== "Handler"));
    if (arr.length === 0) return 0;
    return arr.reduce((s, p) => s + p.score, 0) / arr.length;
  }

  function avgFitness(team){
    if (team.length === 0) return 0;
    return team.reduce((s, p) => s + p.fitness, 0) / team.length;
  }

  function athleteCount(team){
    return team.filter(p => p.athlete).length;
  }

  function lowFitnessCount(team){
    return team.filter(p => p.lowFitness).length;
  }

  function topKFitnessSum(team, k){
    const arr = team.map(p => p.fitness).sort((a, b) => b - a);
    return arr.slice(0, k).reduce((s, x) => s + x, 0);
  }

  function topKScoreSum(team, k){
    const arr = team.map(p => p.score).sort((a, b) => b - a);
    return arr.slice(0, k).reduce((s, x) => s + x, 0);
  }

  function avgRoleFitness(team, role){
    const arr = team.filter(p => (role === "Handler" ? p.preference === "Handler" : p.preference !== "Handler"));
    if (arr.length === 0) return 0;
    return arr.reduce((s, p) => s + p.fitness, 0) / arr.length;
  }

  function avgAttr(team, attr){
    if (team.length === 0) return 0;
    return team.reduce((s, p) => s + safeNum_(p[attr]), 0) / team.length;
  }

  function avgRoleAttr(team, role, attr){
    const arr = team.filter(p => (role === "Handler" ? p.preference === "Handler" : p.preference !== "Handler"));
    if (arr.length === 0) return 0;
    return arr.reduce((s, p) => s + safeNum_(p[attr]), 0) / arr.length;
  }

  function reliableHandlerCount(team){
    return team.filter(p => p.reliableHandler).length;
  }

  function femaleAchievablePenalty(femaleCounts){
    const totalFemale = femaleCounts.reduce((a, b) => a + b, 0);
    const low = Math.floor(totalFemale / nTeams);
    const high = Math.ceil(totalFemale / nTeams);
    const highTeams = totalFemale - low * nTeams;

    let p = 0;
    
    for (const c of femaleCounts) {
      if (c < low) p += (low - c) * 6;
      else if (c > high) p += (c - high) * 6;
    }
    
    const actualHighTeams = femaleCounts.filter(c => c === high).length;
    p += Math.abs(actualHighTeams - highTeams) * 2;
    
    return p;

  }

  // =============================
  // New: First-pass seeding
  // =============================
  function takeUnassigned(sortedList, assigned, limit){
    const out = [];
    for (const p of sortedList) {
      if (assigned.has(p.uid)) continue;
      out.push(p);
      assigned.add(p.uid);
      if (out.length >= limit) break;
    }
    return out;
  }

  function buildInitialTeams_(temperature){
    const teams = Array.from({ length:nTeams }, () => []);
    const assigned = new Set();

    // 1) top scorers: one per team if possible
    const topScoreSeeds = takeUnassigned(
      [...players].sort((a, b) => b.score - a.score),
      assigned,
      Math.min(nTeams, players.length)
    );
    snakeDraftPreferFemale(jitterSorted(topScoreSeeds, temperature * 0.25), teams);
    
    // 2) athletes: one per team if possible
    const athleteSeeds = takeUnassigned(
      [...players]
        .filter(p => p.athlete)
        .sort((a, b) => (b.fitness - a.fitness) || (b.score - a.score)),
      assigned,
      Math.min(nTeams, players.filter(p => p.athlete).length)
    );
    snakeDraftPreferFemale(jitterSorted(athleteSeeds, temperature * 0.20), teams);
    
    // 3) reliable handlers: one per team if possible
    const reliableHandlerSeeds = takeUnassigned(
      [...players]
        .filter(p => p.reliableHandler)
        .sort((a, b) => (b.throwing - a.throwing) || (b.score - a.score)),
      assigned,
      Math.min(nTeams, players.filter(p => p.reliableHandler).length)
    );
    snakeDraftPreferFemale(jitterSorted(reliableHandlerSeeds, temperature * 0.20), teams);
    
    const remainingPlayers = players.filter(p => !assigned.has(p.uid));
    
    const HANDLERS = remainingPlayers.filter(p => p.preference === "Handler");
    const CUTTERS  = remainingPlayers.filter(p => p.preference !== "Handler");
    
    draftRolePool_(HANDLERS, teams, { usePercentile:false, temperature });
    draftRolePool_(CUTTERS, teams, { usePercentile:true, temperature });
    
    return teams;

  }

  function evaluatePenalty(teams){
    const teamSizes = teams.map(t => t.length);
    if (Math.max(...teamSizes) - Math.min(...teamSizes) > 1) {
      return Infinity;
    }

    const totalHandlers = players.filter(p => p.preference === "Handler").length;
    const totalCutters = players.filter(p => p.preference !== "Handler").length;
    const totalAthletes = players.filter(p => p.athlete).length;
    const totalReliableHandlers = players.filter(p => p.reliableHandler).length;
    
    const scoreAvgs = teams.map(t => t.reduce((s, p) => s + p.score, 0) / t.length);
    const femaleCounts = teams.map(t => t.filter(p => p.gender === "Female").length);
    const handlerCounts = teams.map(t => t.filter(p => p.preference === "Handler").length);
    const cutterCounts = teams.map(t => t.filter(p => p.preference !== "Handler").length);
    const handlerAvgs = teams.map(t => avgScoreOfRole(t, "Handler"));
    const cutterAvgs = teams.map(t => avgScoreOfRole(t, "Cutter"));
    const eliteCounts = teams.map(t => t.filter(p => ELITE.includes(p)).length);
    
    // Existing fitness metrics
    const fitnessAvgs = teams.map(t => avgFitness(t));
    const athleteCounts = teams.map(t => athleteCount(t));
    const top2Fitness = teams.map(t => topKFitnessSum(t, 2));
    const lowFitnessCounts = teams.map(t => lowFitnessCount(t));
    const cutterFitnessAvgs = teams.map(t => avgRoleFitness(t, "Cutter"));
    
    // New: top-end score concentration
    const top2Score = teams.map(t => topKScoreSum(t, 2));
    
    // New: handler quality
    const reliableHandlerCounts = teams.map(t => reliableHandlerCount(t));
    const handlerThrowingAvgs = teams.map(t => avgRoleAttr(t, "Handler", "throwing"));
    
    // New: offense / defense balance
    const offenseAvgs = teams.map(t => avgAttr(t, "offenseValue"));
    const defenseAvgs = teams.map(t => avgAttr(t, "defenseValue"));
    
    let hardPenalty = 0;
    let fragilePenalty = 0;
    
    if (ELITE.length >= nTeams) {
      eliteCounts.forEach(c => {
        if (c === 0) hardPenalty += 1000;
      });
    }
    
    if (totalHandlers >= nTeams) {
      handlerCounts.forEach(c => {
        if (c === 0) hardPenalty += 1000;
      });
    }
    
    if (totalAthletes >= nTeams) {
      athleteCounts.forEach(c => {
        if (c === 0) hardPenalty += 1000;
      });
    }
    
    // New: each team should get 1 reliable handler if possible
    if (totalReliableHandlers >= nTeams) {
      reliableHandlerCounts.forEach(c => {
        if (c === 0) hardPenalty += 900;
      });
    }
    
    // New: fragile-structure penalty
    if (totalAthletes >= 2 * nTeams) {
      athleteCounts.forEach(c => {
        if (c < 2) fragilePenalty += (2 - c) * 18;
      });
    }
    
    if (totalHandlers >= 2 * nTeams) {
      handlerCounts.forEach(c => {
        if (c < 2) fragilePenalty += (2 - c) * 12;
      });
    }
    
    if (totalReliableHandlers >= 2 * nTeams) {
      reliableHandlerCounts.forEach(c => {
        if (c < 2) fragilePenalty += (2 - c) * 15;
      });
    }
    
    const femaleP = femaleAchievablePenalty(femaleCounts);
    
    const W = {
      scoreAvgVar: 10,
      female: 25,
      handlerCountVar: 6,
      cutterCountVar: 4,
      handlerAvgVar: 10,
      cutterAvgVar: 8,
      sizeVar: 20,
    
      // Existing fitness terms
      fitnessAvgVar: 16,
      athleteCountVar: 18,
      top2FitnessVar: 16,
      lowFitnessVar: 12,
      cutterFitnessVar: 10,
    
      // New five upgrades
      top2ScoreVar: 14,
      reliableHandlerCountVar: 12,
      handlerThrowVar: 10,
      offenseAvgVar: 10,
      defenseAvgVar: 12
    };
    
    const cutterFitnessPenalty = (totalCutters >= nTeams)
      ? variance(cutterFitnessAvgs) * W.cutterFitnessVar
      : 0;
    
    const handlerThrowPenalty = (totalHandlers >= nTeams)
      ? variance(handlerThrowingAvgs) * W.handlerThrowVar
      : 0;
    
    const reliableHandlerPenalty = (totalReliableHandlers > 0)
      ? variance(reliableHandlerCounts) * W.reliableHandlerCountVar
      : 0;
    
    return hardPenalty +
      fragilePenalty +
    
      variance(scoreAvgs)           * W.scoreAvgVar +
      variance(top2Score)           * W.top2ScoreVar +
      femaleP                       * W.female +
      variance(handlerCounts)       * W.handlerCountVar +
      variance(cutterCounts)        * W.cutterCountVar +
      variance(handlerAvgs)         * W.handlerAvgVar +
      variance(cutterAvgs)          * W.cutterAvgVar +
      variance(teamSizes)           * W.sizeVar +
    
      variance(fitnessAvgs)         * W.fitnessAvgVar +
      variance(athleteCounts)       * W.athleteCountVar +
      variance(top2Fitness)         * W.top2FitnessVar +
      variance(lowFitnessCounts)    * W.lowFitnessVar +
      cutterFitnessPenalty +
    
      reliableHandlerPenalty +
      handlerThrowPenalty +
      variance(offenseAvgs)         * W.offenseAvgVar +
      variance(defenseAvgs)         * W.defenseAvgVar;

  }

  let bestTeams = null;
  let bestPenalty = Infinity;

  for (let round = 0; round < MONTE_CARLO_ROUNDS; round++) {
    const t = Math.max(0.10, 1.0 - round / Math.max(1, MONTE_CARLO_ROUNDS - 1));
    const teams = buildInitialTeams_(t);

    const penalty = evaluatePenalty(teams);
    
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestTeams = teams.map(t2 => [...t2]);
    }

  }

  if (!bestTeams) {
    bestTeams = Array.from({ length:nTeams }, () => []);
    sortedAll.forEach((p, i) => {
      bestTeams[i % nTeams].push(p);
    });
  }

  function deepCopyTeams(ts){
    return ts.map(t => [...t]);
  }

  function swapInPlace(teams, i, ai, j, bj){
    const tmp = teamsi;
    teamsi = teamsj;
    teamsj = tmp;
  }

  function getIndicesByRole(team, role){
    const idx = [];
    for (let k = 0; k < team.length; k++) {
      const isH = team[k].preference === "Handler";
      if (role === "Handler" ? isH : !isH) idx.push(k);
    }
    return idx;
  }

  function sampledImprove({ iterations = 220, samplesPerIter = 1800, allowCrossRoleEvery = 14 } = {}){
    let curTeams = deepCopyTeams(bestTeams);
    let curPenalty = bestPenalty;
    let T0 = 1.0;

    for (let iter = 0; iter < iterations; iter++) {
      let improved = false;
      const T = Math.max(0.02, T0 * (1.0 - iter / iterations));
    
      for (let s = 0; s < samplesPerIter; s++) {
        const i = randInt(nTeams);
        let j = randInt(nTeams);
        if (j === i) j = (j + 1) % nTeams;
    
        const allowCross = (iter % allowCrossRoleEvery === 0);
        const roleMode = allowCross ? (Math.random() < 0.90 ? "same" : "cross") : "same";
    
        let aiList, bjList;
    
        if (roleMode === "same") {
          const role = (Math.random() < 0.5) ? "Handler" : "Cutter";
          aiList = getIndicesByRole(curTeams[i], role);
          bjList = getIndicesByRole(curTeams[j], role);
          if (aiList.length === 0 || bjList.length === 0) continue;
        } else {
          aiList = [...Array(curTeams[i].length).keys()];
          bjList = [...Array(curTeams[j].length).keys()];
          if (aiList.length === 0 || bjList.length === 0) continue;
        }
    
        const ai = aiList[randInt(aiList.length)];
        const bj = bjList[randInt(bjList.length)];
    
        const trial = deepCopyTeams(curTeams);
        swapInPlace(trial, i, ai, j, bj);
    
        const p = evaluatePenalty(trial);
        const delta = p - curPenalty;
    
        if (delta <= 0 || Math.random() < Math.exp(-delta / Math.max(1e-6, T * 50))) {
          curTeams = trial;
          curPenalty = p;
    
          if (curPenalty < bestPenalty) {
            bestPenalty = curPenalty;
            bestTeams = deepCopyTeams(curTeams);
          }
    
          if (delta < 0) improved = true;
        }
      }
    
      if (!improved && T <= 0.03) break;
    }

  }

  sampledImprove({
    iterations: 240,
    samplesPerIter: 1600,
    allowCrossRoleEvery: 16
  });

  const resultTeams = bestTeams.map((team, i) => ({
    name:"Team " + (i + 1),
    avgScore:(team.reduce((s, p) => s + p.score, 0) / team.length).toFixed(2),
    avgFitness:(team.reduce((s, p) => s + p.fitness, 0) / team.length).toFixed(2),
    athleteCount: team.filter(p => p.athlete).length,
    lowFitnessCount: team.filter(p => p.lowFitness).length,
    cutterAvgFitness: avgRoleFitness(team, "Cutter").toFixed(2),

    // new diagnostics
    top2Score: topKScoreSum(team, 2),
    top2Fitness: topKFitnessSum(team, 2),
    reliableHandlerCount: reliableHandlerCount(team),
    handlerAvgThrowing: avgRoleAttr(team, "Handler", "throwing").toFixed(2),
    avgOffense: avgAttr(team, "offenseValue").toFixed(2),
    avgDefense: avgAttr(team, "defenseValue").toFixed(2),
    
    players:team

  }));

  const publicTeams = buildPublicTeams_(resultTeams);
  const publicTeamsText = buildPublicTeamsText_(publicTeams);

  const adminTeamsText = resultTeams.map(t =>
    t.name +
    " (AvgScore: " + t.avgScore +
    ", Top2Score: " + Number(t.top2Score).toFixed(2) +
    ", AvgFitness: " + t.avgFitness +
    ", Athletes: " + t.athleteCount +
    ", LowFit: " + t.lowFitnessCount +
    ", RH: " + t.reliableHandlerCount +
    ")\n" +
    t.players.map(p => "- " + p.name).join("\n")
  ).join("\n\n");

  return {
    nTeams,
    nPlayers,
    teams: resultTeams,        // internal full data, cached in sheet only
    teamsText: publicTeamsText, // public text for browser
    adminTeamsText             // optional internal use
  };
}

// ================= ARCHIVE =================
function archiveAndResetWeek(force = false){

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const main = sheet_();

  if (!main) {
    Logger.log("Main sheet not found");
    return;
  }

  const weekKey = getWeekKey_();
  const props = PropertiesService.getScriptProperties();
  const lastArchived = props.getProperty("lastArchivedWeek");

  if (!force) {
    if (!isAfterCutoff_()) {
      Logger.log("Not after cutoff");
      return;
    }
    if (lastArchived === weekKey) {
      Logger.log("Already archived this week");
      return;
    }
  }

  let archive = ss.getSheetByName("Archive");

  if (!archive) {
    archive = ss.insertSheet("Archive");
    archive.appendRow([
      "WeekKey",
      "Timestamp",
      "Name",
      "Gender",
      "Throwing",
      "Catch",
      "Fitness",
      "Experience",
      "PracticeDuration",
      "Preference",
      "RegID",
      "Status",
      "Score"
    ]);
  }

  const lastDataRow = getMainLastDataRow_(main);
  if (lastDataRow < 2) {
    Logger.log("No data in main sheet");
    return;
  }

  const data = main.getRange(2, 1, lastDataRow - 1, MAIN_TOTAL_COLS).getValues();
  const activeOnly = data.filter(r => String(r[COL.status] || "").trim() === "Active");

  if (activeOnly.length === 0) {
    Logger.log("No active rows found");
    return;
  }

  if (force && archive.getLastRow() > 1) {
    const archiveLastRow = archive.getLastRow();
    const archiveData = archive.getRange(2, 1, archiveLastRow - 1, 1).getValues();

    for (let i = archiveData.length - 1; i >= 0; i--) {
      if (wkText_(archiveData[i][0]) === weekKey) {
        archive.deleteRow(i + 2);
      }
    }

  }

  const rowsToWrite = activeOnly.map(r => [weekKey, ...r]);

  archive.getRange(
    archive.getLastRow() + 1,
    1,
    rowsToWrite.length,
    rowsToWrite[0].length
  ).setValues(rowsToWrite);

  // Clear only A:K. Keep L2 formula untouched.
  main.getRange(2, 1, lastDataRow - 1, MAIN_INPUT_COLS).clearContent();

  props.setProperty("lastArchivedWeek", weekKey);

  Logger.log("Archived week: " + weekKey);
}

// ================= ARCHIVE HELPERS =================
function wkText_(wk) {
  if (wk instanceof Date) {
    return Utilities.formatDate(wk, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const s = String(wk || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return s;
}

function findHeaderIndex_(headers, candidates){
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

function getArchiveInfo_(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const archive = ss.getSheetByName("Archive");
  if (!archive || archive.getLastRow() < 2) return null;

  const lastCol = archive.getLastColumn();
  const headers = archive.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = archive.getRange(2, 1, archive.getLastRow() - 1, lastCol).getValues();

  const idxWeek = findHeaderIndex_(headers, ["WeekKey", "ArchieveTime", "ArchiveTime"]);
  if (idxWeek < 0) return null;

  const byWeek = {};
  data.forEach(r => {
    const key = wkText_(r[idxWeek]);
    if (!key) return;
    if (!byWeek[key]) byWeek[key] = [];
    byWeek[key].push(r);
  });

  const weeks = Object.keys(byWeek).sort();

  return {
    archive,
    headers,
    data,
    idxWeek,
    byWeek,
    weeks
  };
}

function avg_(a){
  return a.reduce((x, y) => x + y, 0) / a.length;
}

function std(a){
  if (!a.length) return 0;
  const m = avg(a);
  return Math.sqrt(avg_(a.map(x => (x - m) ** 2)));
}

function percentileSorted_(a, p){
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(a.length * p)))];
}

function computeArchiveStats_(rows, idxGender, idxScore){
  const scores = [];
  const male = [];
  const female = [];

  rows.forEach(r => {
    const s = Number(r[idxScore]);
    if (isNaN(s)) return;

    scores.push(s);
    
    const g = String(r[idxGender] || "").trim();
    if (g === "Male") male.push(s);
    if (g === "Female") female.push(s);

  });

  if (!scores.length) return null;

  scores.sort((a, b) => a - b);

  const levels = { Beginner:0, Intermediate:0, Advanced:0, Elite:0 };
  scores.forEach(s => {
    if (s < 1.91) levels.Beginner++;
    else if (s < 2.91) levels.Intermediate++;
    else if (s < 3.81) levels.Advanced++;
    else levels.Elite++;
  });

  const bins = { "1.0-1.9":0, "2.0-2.9":0, "3.0-3.9":0, "4.0-5.0":0 };
  scores.forEach(s => {
    if (s < 2) bins["1.0-1.9"]++;
    else if (s < 3) bins["2.0-2.9"]++;
    else if (s < 4) bins["3.0-3.9"]++;
    else bins["4.0-5.0"]++;
  });

  const A = avg(scores);
  const S = std(scores);

  return {
    scores,
    male,
    female,
    levels,
    bins,
    n: scores.length,
    avg: Number(A.toFixed(2)),
    std: Number(S.toFixed(2)),
    balance: Number((S / A).toFixed(2)),
    min: Number(scores[0].toFixed(2)),
    p25: Number(percentileSorted(scores, 0.25).toFixed(2)),
    median: Number(percentileSorted(scores, 0.50).toFixed(2)),
    p75: Number(percentileSorted(scores, 0.75).toFixed(2)),
    max: Number(scores[scores.length - 1].toFixed(2)),
    eliteFrac: Number((levels.Elite / scores.length).toFixed(4)),
    maleAvg: male.length ? Number(avg(male).toFixed(2)) : null,
    femaleAvg: female.length ? Number(avg_(female).toFixed(2)) : null
  };
}

// ================= SEASON SUMMARY =================
function rebuildSeasonSummary(){

  const archiveInfo = getArchiveInfo_();
  if (!archiveInfo || !archiveInfo.weeks.length) {
    Logger.log("No archive data found");
    return;
  }

  const { headers, byWeek, weeks } = archiveInfo;
  const idxGender = findHeaderIndex_(headers, ["Gender"]);
  if (idxGender < 0) {
    Logger.log("Gender header not found");
    return;
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let summary = ss.getSheetByName("Summary");

  if (!summary) {
    summary = ss.insertSheet("Summary");
  }

  summary.clear();
  summary.appendRow(["Week", "Male", "Female", "Total", "Female%"]);

  weeks.forEach(week => {
    const rows = byWeek[week];
    const males = rows.filter(r => String(r[idxGender] || "").trim() === "Male").length;
    const females = rows.filter(r => String(r[idxGender] || "").trim() === "Female").length;
    const total = males + females;
    const femalePercent = total ? (females / total) : 0;

    summary.appendRow([week, males, females, total, femalePercent]);

  });

  const lastSummaryRow = summary.getLastRow();
  if (lastSummaryRow > 1) {
    summary.getRange(2, 5, lastSummaryRow - 1, 1).setNumberFormat("0.0%");
  }

  Logger.log("Season summary rebuilt");
}

// ================= FEMALE TREND CHART =================
function buildGenderChart(){

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const summary = ss.getSheetByName("Summary");

  if (!summary || summary.getLastRow() < 2) {
    Logger.log("No summary data for chart");
    return;
  }

  const charts = summary.getCharts();
  charts.forEach(c => summary.removeChart(c));

  const chart = summary.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(summary.getRange("A1:A" + summary.getLastRow()))
    .addRange(summary.getRange("E1:E" + summary.getLastRow()))
    .setPosition(1, 7, 0, 0)
    .setOption("title", "Female Participation Trend")
    .setOption("hAxis", { title:"Week" })
    .setOption("vAxis", {
      title:"Female %",
      viewWindow:{ min:0, max:1 },
      format:"0.0%"
    })
    .build();

  summary.insertChart(chart);

  Logger.log("Gender chart rebuilt");
}

// ================= ATTENDANCE RANKING =================
function buildAttendanceRanking(){

  const archiveInfo = getArchiveInfo_();
  if (!archiveInfo || !archiveInfo.data.length) {
    Logger.log("No archive data for ranking");
    return;
  }

  const { headers, data } = archiveInfo;
  const idxName = findHeaderIndex_(headers, ["Name"]);
  if (idxName < 0) {
    Logger.log("Name header not found");
    return;
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let ranking = ss.getSheetByName("Ranking");

  if (!ranking) {
    ranking = ss.insertSheet("Ranking");
  }

  ranking.clear();
  ranking.appendRow(["Name", "Appearances"]);

  const countMap = {};

  data.forEach(r => {
    const name = String(r[idxName] || "").trim();
    if (!name) return;
    countMap[name] = (countMap[name] || 0) + 1;
  });

  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]);
  if (sorted.length) {
    ranking.getRange(2, 1, sorted.length, 2).setValues(sorted);
  }

  Logger.log("Attendance ranking rebuilt");
}

// ================= MASTER FUNCTION =================
function rebuildAllSeasonAnalytics(){
  rebuildSeasonSummary();
  buildGenderChart();
  buildAttendanceRanking();
}

function testTeams(){
  ensureTeamsGenerated_();
}

// ================= READABLE TEAM TABLE =================
function writeTeamReadableTable(){

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName("Teams");

  if (!sh) {
    Logger.log("Teams sheet not found.");
    return;
  }

  Logger.log("Spreadsheet=" + ss.getName() + " | " + ss.getUrl());
  Logger.log("Teams lastRow=" + sh.getLastRow() + ", lastCol=" + sh.getLastColumn());

  const scanR = Math.min(60, sh.getMaxRows());
  const scanC = Math.min(12, sh.getMaxColumns());
  const disp = sh.getRange(1, 1, scanR, scanC).getDisplayValues();

  const hits = [];
  for (let r = 0; r < scanR; r++) {
    for (let c = 0; c < scanC; c++) {
      const v = (dispr || "").toString().trim();
      if (v !== "") {
        hits.push({ r:r + 1, c:c + 1, a1:sh.getRange(r + 1, c + 1).getA1Notation(), val:v.slice(0, 120) });
        if (hits.length >= 40) break;
      }
    }
    if (hits.length >= 40) break;
  }
  Logger.log("Non-empty cells (first 40): " + JSON.stringify(hits));

  const key = getWeekKey_();
  Logger.log("writeTeamReadableTable() weekKey=" + key);

  function toYMD_(v){
    try{
      const tz = Session.getScriptTimeZone();
      if (v instanceof Date && !isNaN(v.getTime())) {
        return Utilities.formatDate(v, tz, "yyyy-MM-dd");
      }
      const s = (v || "").toString().trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = new Date(s);
      if (!isNaN(d.getTime())) return Utilities.formatDate(d, tz, "yyyy-MM-dd");
      return null;
    } catch(e) {
      return null;
    }
  }

  let jsonData = null;
  let pickedRow = null;

  if (sh.getLastRow() >= 2) {
    const data = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      const existingKey = toYMD_(data[i][0]);
      if (existingKey && existingKey === key) {
        try {
          jsonData = JSON.parse((data[i][2] || "").toString());
          pickedRow = i + 2;
          Logger.log("Matched weekKey at row " + pickedRow);
          break;
        } catch(e) {
          Logger.log("JSON parse error (matched weekKey) row " + (i + 2) + ": " + e);
          jsonData = null;
        }
      }
    }
    
    if (!jsonData) {
      for (let i = data.length - 1; i >= 0; i--) {
        const cell = (data[i][2] || "").toString().trim();
        if (!cell) continue;
        try {
          const parsed = JSON.parse(cell);
          if (parsed && parsed.teams && parsed.teams.length) {
            jsonData = parsed;
            pickedRow = i + 2;
            Logger.log("Fallback to latest valid JSON row " + pickedRow + " (date=" + toYMD_(data[i][0]) + ")");
            break;
          }
        } catch(e) {}
      }
    }

  } else {
    Logger.log("Teams lastRow<2, so A2:C cache does not exist.");
  }

  if (!jsonData) {
    const c1 = (sh.getRange(1, 3).getDisplayValue() || "").toString().trim();
    if (c1) {
      try {
        const parsed = JSON.parse(c1);
        if (parsed && parsed.teams && parsed.teams.length) {
          jsonData = parsed;
          pickedRow = 1;
          Logger.log("Recovered JSON from C1.");
        }
      } catch(e) {
        Logger.log("C1 is not JSON.");
      }
    }
  }

  if (!jsonData) {
    const colC = sh.getRange(1, 3, scanR, 1).getDisplayValues().map(r => (r[0] || "").toString().trim());
    for (let r = 0; r < colC.length; r++) {
      const s = colC[r];
      if (!s) continue;
      if (!(s.startsWith("{") && s.includes('"teams"'))) continue;
      try {
        const parsed = JSON.parse(s);
        if (parsed && parsed.teams && parsed.teams.length) {
          jsonData = parsed;
          pickedRow = r + 1;
          Logger.log("Recovered JSON from C" + (r + 1));
          break;
        }
      } catch(e) {}
    }
  }

  if (!jsonData) {
    Logger.log("No valid teams JSON found anywhere (A2:C / C1 / C:scan).");
    Logger.log("=> Fix: make sure the code that GENERATES teams also WRITES JSON into Teams!A:C.");
    return;
  }

  const lastCol = sh.getLastColumn();
  if (lastCol > 4) {
    sh.getRange(1, 5, sh.getMaxRows(), lastCol - 4).clearContent();
  }

  let rowPointer = 1;
  const colPointer = 5; // E

  (jsonData.teams || []).forEach(team => {
    const players = (team.players || []).map(p => ({
      ...p,
      score: safeNum_(p.score),
      fitness: safeNum_(p.fitness)
    }));

    sh.getRange(rowPointer, colPointer)
      .setValue(
        (team.name || "Team") + " " +
        "(AvgScore: " + safeNum_(team.avgScore).toFixed(2) +
        ", Top2Score: " + safeNum_(team.top2Score).toFixed(2) +
        ", AvgFitness: " + safeNum_(team.avgFitness).toFixed(2) +
        ", Athletes: " + safeNum_(team.athleteCount) +
        ", RH: " + safeNum_(team.reliableHandlerCount) +
        ", Off: " + safeNum_(team.avgOffense).toFixed(2) +
        ", Def: " + safeNum_(team.avgDefense).toFixed(2) + ")"
      )
      .setFontWeight("bold");
    rowPointer++;
    
    sh.getRange(rowPointer, colPointer, 1, 3)
      .setValues([["Name", "Score", "Fitness"]])
      .setFontWeight("bold");
    rowPointer++;
    
    const outRows = players.map(p => [
      p.name || "",
      safeNum_(p.score).toFixed(2),
      safeNum_(p.fitness).toFixed(0)
    ]);
    
    if (outRows.length) {
      sh.getRange(rowPointer, colPointer, outRows.length, 3).setValues(outRows);
      rowPointer += outRows.length;
    }
    
    rowPointer += 2;

  });

  sh.autoResizeColumns(5, 3);
  Logger.log("Readable team table generated. JSON source row = " + pickedRow);
}

function debugProps(){
  const props = PropertiesService.getScriptProperties();
  Logger.log(props.getProperties());
}

function autoArchive(){
  archiveAndResetWeek(false);
}

function manualArchive(){
  archiveAndResetWeek(true);
}

// ================= SCORE ANALYTICS =================
function buildScoreAnalyticsV3() {
  const archiveInfo = getArchiveInfo_();
  if (!archiveInfo || !archiveInfo.weeks.length) {
    Logger.log("No archive data");
    return;
  }

  const { headers, byWeek, weeks } = archiveInfo;
  const idxGender = findHeaderIndex_(headers, ["Gender"]);
  const idxScore = findHeaderIndex_(headers, ["Score"]);

  if (idxGender < 0 || idxScore < 0) {
    Logger.log("Missing required columns: Gender / Score");
    return;
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName("Analytics");
  if (!sh) {
    sh = ss.insertSheet("Analytics");
  } else {
    sh.clear();
  }

  let latestWeek = "";
  let latest = null;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const wk = weeks[i];
    const st = computeArchiveStats_(byWeek[wk], idxGender, idxScore);
    if (st) {
      latestWeek = wk;
      latest = st;
      break;
    }
  }

  if (!latest) {
    Logger.log("No score data in archive weeks");
    return;
  }

  sh.getCharts().forEach(c => sh.removeChart(c));

  let row = 1;

  sh.getRange(row++, 1, 1, 2)
    .setValues([["Score Statistics (Latest Week: " + latestWeek + ")", ""]])
    .setFontWeight("bold");

  sh.getRange(row++, 1, 1, 2).setValues([["Players", latest.n]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Average", latest.avg]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Std Dev", latest.std]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Balance Index", latest.balance]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Min", latest.min]]);
  sh.getRange(row++, 1, 1, 2).setValues([["P25", latest.p25]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Median", latest.median]]);
  sh.getRange(row++, 1, 1, 2).setValues([["P75", latest.p75]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Max", latest.max]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Elite %", latest.eliteFrac]]).setNumberFormat("0.0%");

  row++;

  const genderStart = row;

  sh.getRange(row++, 1, 1, 2)
    .setValues([["Gender Average", ""]])
    .setFontWeight("bold");

  sh.getRange(row++, 1, 1, 2).setValues([["Male", latest.maleAvg != null ? latest.maleAvg : "-"]]);
  sh.getRange(row++, 1, 1, 2).setValues([["Female", latest.femaleAvg != null ? latest.femaleAvg : "-"]]);

  row++;

  const levelStart = row;

  sh.getRange(row++, 1, 1, 2)
    .setValues([["Skill Levels", ""]])
    .setFontWeight("bold");

  Object.entries(latest.levels).forEach(([k, v]) => {
    sh.getRange(row++, 1, 1, 2).setValues([[k, v]]);
  });

  row++;

  const histStart = row;

  sh.getRange(row++, 1, 1, 2)
    .setValues([["Score Histogram", ""]])
    .setFontWeight("bold");

  Object.entries(latest.bins).forEach(([k, v]) => {
    sh.getRange(row++, 1, 1, 2).setValues([[k, v]]);
  });

  sh.autoResizeColumns(1, 2);

  const histChart = sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(histStart + 1, 1, 4, 2))
    .setPosition(1, 4, 0, 0)
    .setOption("title", "Score Distribution (Latest Week)")
    .setOption("legend", { position:"none" })
    .setOption("vAxis", { viewWindow:{ min:0 } })
    .build();
  sh.insertChart(histChart);

  const pieChart = sh.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange(levelStart + 1, 1, 4, 2))
    .setPosition(18, 4, 0, 0)
    .setOption("title", "Skill Level Distribution (Latest Week)")
    .build();
  sh.insertChart(pieChart);

  const genderChart = sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(genderStart + 1, 1, 2, 2))
    .setPosition(35, 4, 0, 0)
    .setOption("title", "Male vs Female Avg (Latest Week)")
    .setOption("legend", { position:"none" })
    .setOption("vAxis", { viewWindow:{ min:0, max:5 } })
    .build();
  sh.insertChart(genderChart);

  const percentileChart = sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange(3, 1, 7, 2))
    .setPosition(52, 4, 0, 0)
    .setOption("title", "Score Percentiles (Latest Week)")
    .build();
  sh.insertChart(percentileChart);

  const trendCol = 4;
  const trendRowStart = 1;

  sh.getRange(trendRowStart, trendCol, 1, 5)
    .setValues([["Week", "Players", "Avg", "Std", "Elite%"]])
    .setFontWeight("bold");

  const trend = weeks.map(wk => {
    const st = computeArchiveStats_(byWeek[wk], idxGender, idxScore);
    if (!st) return null;
    return [wk, st.n, st.avg, st.std, st.eliteFrac];
  }).filter(Boolean);

  if (trend.length) {
    sh.getRange(trendRowStart + 1, trendCol, trend.length, 5).setValues(trend);
    sh.getRange(trendRowStart, trendCol, trend.length + 1, 1).setNumberFormat("@");
    sh.getRange(trendRowStart + 1, trendCol + 4, trend.length, 1).setNumberFormat("0.0%");
    sh.autoResizeColumns(trendCol, 5);
  }

  const chartCol = trendCol + 6;
  sh.getRange(trendRowStart, chartCol, 1, 3)
    .setValues([["Week", "Avg", "Std"]])
    .setFontWeight("bold");

  sh.getRange(trendRowStart + 1, chartCol, trend.length, 3)
    .setValues(trend.map(r => [r[0], r[2], r[3]]));

  sh.getRange(trendRowStart, chartCol, trend.length + 1, 1).setNumberFormat("@");

  const trendChart1 = sh.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sh.getRange(trendRowStart, chartCol, trend.length + 1, 3))
    .setPosition(1, 9, 0, 0)
    .setOption("title", "Weekly Avg & Std Trend")
    .setOption("legend", { position:"right" })
    .setOption("pointSize", 6)
    .setOption("lineWidth", 2)
    .setOption("hAxis", { slantedText:true, slantedTextAngle:25 })
    .setOption("vAxis", { viewWindow:{ min:0, max:5 } })
    .setOption("series", {
      0: { labelInLegend:"Avg" },
      1: { labelInLegend:"Std" }
    })
    .build();

  sh.insertChart(trendChart1);

  const chartCol2 = chartCol + 4;
  sh.getRange(trendRowStart, chartCol2, 1, 2)
    .setValues([["Week", "Elite%"]])
    .setFontWeight("bold");

  sh.getRange(trendRowStart + 1, chartCol2, trend.length, 2)
    .setValues(trend.map(r => [r[0], r[4]]));

  sh.getRange(trendRowStart, chartCol2, trend.length + 1, 1).setNumberFormat("@");
  sh.getRange(trendRowStart + 1, chartCol2 + 1, trend.length, 1).setNumberFormat("0.0%");

  const trendChart2 = sh.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sh.getRange(trendRowStart, chartCol2, trend.length + 1, 2))
    .setPosition(18, 9, 0, 0)
    .setOption("title", "Weekly Elite% Trend")
    .setOption("legend", { position:"right" })
    .setOption("pointSize", 6)
    .setOption("lineWidth", 2)
    .setOption("hAxis", { slantedText:true, slantedTextAngle:25 })
    .setOption("vAxis", { viewWindow:{ min:0, max:1 } })
    .setOption("series", {
      0: { labelInLegend:"Elite%" }
    })
    .build();

  sh.insertChart(trendChart2);

  Logger.log("Analytics V3 complete (latest week + weekly trend)");
}

// ================= TEAMS CLEAR HELPERS =================
function weekKeyText_(v){
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const s = String(v || "").trim();
  if (!s) return "";
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return s;
}

function clearTeamsReadableArea_(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName("Teams");
  if (!sh) return;

  const lastCol = sh.getLastColumn();
  if (lastCol <= 4) return;

  sh.getRange(1, 5, sh.getMaxRows(), lastCol - 4).clearContent();
}

function clearTeamsCacheThisWeek(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName("Teams");
  if (!sh || sh.getLastRow() < 2) return;

  const key = getWeekKey_();
  const lastRow = sh.getLastRow();
  const vals = sh.getRange(2, 1, lastRow - 1, 1).getValues();

  for (let i = vals.length - 1; i >= 0; i--) {
    const existingKey = weekKeyText_(valsi);
    if (existingKey === key) {
      sh.deleteRow(i + 2);
      Logger.log("Deleted Teams cache row for weekKey=" + key);
      break;
    }
  }
}

function clearTeamsCacheAll(){
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sh = ss.getSheetByName("Teams");
  if (!sh) return;

  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return;

  sh.deleteRows(2, lastRow - 1);
  Logger.log("Deleted ALL Teams cache rows.");
}

function clearTeamsThisWeek_All(){
  clearTeamsCacheThisWeek();
  clearTeamsReadableArea_();
  Logger.log("Cleared Teams for this week (cache + readable area).");
}

function clearTeamsAll_All(){
  clearTeamsCacheAll();
  clearTeamsReadableArea_();
  Logger.log("Cleared Teams for ALL weeks (cache + readable area).");
}

// ================= API ANALYTICS =================
function analytics_(){
  const archiveInfo = getArchiveInfo_();
  if (!archiveInfo || !archiveInfo.weeks.length) {
    return json_({ ok:false, error:"No archive data" });
  }

  const { headers, byWeek, weeks } = archiveInfo;
  const idxGender = findHeaderIndex_(headers, ["Gender"]);
  const idxScore = findHeaderIndex_(headers, ["Score"]);

  if (idxGender < 0 || idxScore < 0) {
    return json_({ ok:false, error:"Missing Gender/Score" });
  }

  let latestWeek = "";
  let latestStats = null;
  for (let i = weeks.length - 1; i >= 0; i--) {
    const wk = weeks[i];
    const st = computeArchiveStats_(byWeek[wk], idxGender, idxScore);
    if (st) {
      latestWeek = wk;
      latestStats = st;
      break;
    }
  }

  if (!latestStats) {
    return json_({ ok:false, error:"No scores in archive weeks" });
  }

  const trend = weeks.map(wk => {
    const st = computeArchiveStats_(byWeek[wk], idxGender, idxScore);
    if (!st) return null;
    return {
      week: wk,
      players: st.n,
      avg: st.avg,
      std: st.std,
      eliteFrac: st.eliteFrac
    };
  }).filter(Boolean);

  return json_({
    ok:true,
    latestWeek,
    latest: {
      n: latestStats.n,
      avg: latestStats.avg,
      std: latestStats.std,
      balance: latestStats.balance,
      min: latestStats.min,
      p25: latestStats.p25,
      median: latestStats.median,
      p75: latestStats.p75,
      max: latestStats.max,
      eliteFrac: latestStats.eliteFrac,
      maleAvg: latestStats.maleAvg,
      femaleAvg: latestStats.femaleAvg,
      levels: latestStats.levels,
      bins: latestStats.bins
    },
    trend
  });
}

