const STORAGE_KEY = 'ai-fluency-check-session-v1';
const ANALYTICS_KEY = 'ai-fluency-check-events-v1';

const state = {
  data: null,
  dataReady: false,
  mode: 'quick',
  questions: [],
  answers: {},
  currentIndex: 0,
  expandedDimensions: new Set(),
};

const screens = {
  landing: document.getElementById('landing'),
  quiz: document.getElementById('quiz'),
  results: document.getElementById('results'),
  error: document.getElementById('error'),
};

function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.classList.toggle('hidden', key !== name);
  }
}

// Anonymous, local-only analytics. Events go to console plus a capped localStorage
// ring buffer. Replace the body of this function (and remove the localStorage
// fallback) when wiring a real backend (Plausible / umami / Cloudflare Worker).
function track(event, payload = {}) {
  const entry = { event, payload, ts: new Date().toISOString() };
  console.log('[track]', entry);
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const buf = raw ? JSON.parse(raw) : [];
    buf.push(entry);
    while (buf.length > 200) buf.shift();
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(buf));
  } catch (e) {
    // localStorage may be unavailable (private mode, quota); console alone is enough
  }
}

function saveSession() {
  if (!state.dataReady) return;
  try {
    const snapshot = {
      mode: state.mode,
      questionIds: state.questions.map(q => q.id),
      answers: state.answers,
      currentIndex: state.currentIndex,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    // ignore
  }
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // ignore
  }
}

async function loadData() {
  const res = await fetch('questions.json');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  state.data = await res.json();
  state.dataReady = true;
  const startBtn = document.getElementById('start-btn');
  startBtn.disabled = false;
  startBtn.textContent = 'Start';
}

function selectQuestions(mode) {
  if (mode === 'quick') {
    return state.data.questions.filter(q => q.core);
  }
  return state.data.questions.slice();
}

function startQuiz() {
  if (!state.dataReady) return;
  const checked = document.querySelector('input[name="mode"]:checked');
  state.mode = checked ? checked.value : 'quick';
  state.questions = selectQuestions(state.mode);
  state.answers = {};
  state.currentIndex = 0;
  state.expandedDimensions = new Set();
  track('assessment_started', { mode: state.mode, questionCount: state.questions.length });
  saveSession();
  renderQuestion();
  showScreen('quiz');
  focusQuestion();
}

function focusQuestion() {
  // Move focus to the first interactive element in the question for keyboard / screen-reader users
  setTimeout(() => {
    const firstInput = document.querySelector('#question-container input, #question-container textarea');
    if (firstInput) firstInput.focus();
  }, 0);
}

function resumeSession(snapshot) {
  if (!state.dataReady) return false;
  const idById = new Map(state.data.questions.map(q => [q.id, q]));
  const resumed = snapshot.questionIds.map(id => idById.get(id)).filter(Boolean);
  if (resumed.length !== snapshot.questionIds.length) {
    // bank changed since session was saved; can't safely resume
    return false;
  }
  state.mode = snapshot.mode;
  state.questions = resumed;
  state.answers = snapshot.answers || {};
  state.currentIndex = Math.min(snapshot.currentIndex || 0, resumed.length - 1);
  state.expandedDimensions = new Set();
  track('assessment_resumed', { mode: state.mode, currentIndex: state.currentIndex });
  renderQuestion();
  showScreen('quiz');
  focusQuestion();
  return true;
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  const dim = state.data.dimensions[q.dimension];

  document.getElementById('progress').textContent =
    `Question ${state.currentIndex + 1} of ${state.questions.length}`;
  document.getElementById('dim-tag').textContent =
    `${q.dimension} · ${dim.name} · ${q.difficulty}`;

  const container = document.getElementById('question-container');
  container.innerHTML = '';

  const text = document.createElement('div');
  text.className = 'question-text';
  text.textContent = q.text;
  container.appendChild(text);

  const existing = state.answers[q.id];

  if (q.type === 'mc') {
    const wrap = document.createElement('div');
    wrap.className = 'options';
    q.options.forEach((opt, i) => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'answer';
      input.value = String(i);
      if (existing && existing.value === i) {
        input.checked = true;
        label.classList.add('selected');
      }
      input.addEventListener('change', () => {
        wrap.querySelectorAll('label').forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');
        state.answers[q.id] = {
          value: i,
          score: i === q.correct ? 2 : 0,
        };
        document.getElementById('next-btn').disabled = false;
        saveSession();
      });
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + opt));
      wrap.appendChild(label);
    });
    container.appendChild(wrap);
  } else {
    // free text
    const ta = document.createElement('textarea');
    ta.className = 'free-input';
    ta.placeholder = 'Type your answer here...';
    ta.value = existing ? existing.value : '';

    const liveScore = document.createElement('span');
    liveScore.className = 'live-score';
    liveScore.textContent = existing ? `keyword-match estimate: ${existing.score} / 2` : '';

    const updateScore = () => {
      const score = scoreFreeText(ta.value, q.keyword_groups);
      state.answers[q.id] = { value: ta.value, score };
      liveScore.textContent = ta.value.trim().length === 0 ? '' : `keyword-match estimate: ${score} / 2`;
      document.getElementById('next-btn').disabled = ta.value.trim().length === 0;
      saveSession();
    };
    ta.addEventListener('input', updateScore);

    container.appendChild(ta);

    if (q.scoring_rubric) {
      const rubric = document.createElement('div');
      rubric.className = 'scoring-rubric';
      const title = document.createElement('strong');
      title.textContent = 'Scoring rubric:';
      rubric.appendChild(title);
      rubric.appendChild(liveScore);
      rubric.appendChild(document.createElement('br'));
      rubric.appendChild(document.createTextNode(q.scoring_rubric));
      container.appendChild(rubric);
    }
  }

  document.getElementById('back-btn').classList.toggle('hidden', state.currentIndex === 0);
  const pct = ((state.currentIndex + 1) / state.questions.length) * 100;
  const progressBar = document.getElementById('progress-bar');
  if (progressBar) progressBar.style.width = `${pct}%`;
  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = !state.answers[q.id] ||
    (q.type === 'free' && (!state.answers[q.id].value || state.answers[q.id].value.trim().length === 0));
  nextBtn.textContent = state.currentIndex === state.questions.length - 1 ? 'See results' : 'Next';
}

function scoreFreeText(text, groups) {
  if (!groups || groups.length === 0) return 0;
  if (!text || text.trim().length === 0) return 0;
  const lower = text.toLowerCase();
  let hits = 0;
  for (const group of groups) {
    if (group.some(kw => lower.includes(kw.toLowerCase()))) {
      hits++;
    }
  }
  if (hits === groups.length) return 2;
  if (hits >= 1) return 1;
  return 0;
}

function next() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    saveSession();
    renderQuestion();
    focusQuestion();
  } else {
    track('assessment_completed', { mode: state.mode, questionCount: state.questions.length });
    clearSession();
    renderResults();
    showScreen('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function back() {
  if (state.currentIndex > 0) {
    state.currentIndex--;
    saveSession();
    renderQuestion();
    focusQuestion();
  }
}

function dimensionLevel(score, questionCount) {
  if (questionCount === 1) {
    return score === 0 ? 'Unfamiliar' : 'Aware';
  }
  if (questionCount === 2) {
    if (score === 0) return 'Unfamiliar';
    if (score <= 2) return 'Aware';
    if (score === 3) return 'Working';
    return 'Strong';
  }
  if (questionCount === 3) {
    if (score === 0) return 'Unfamiliar';
    if (score <= 3) return 'Aware';
    if (score <= 5) return 'Working';
    return 'Strong';
  }
  // unexpected count, fall back
  const ratio = score / (questionCount * 2);
  if (ratio === 0) return 'Unfamiliar';
  if (ratio < 0.5) return 'Aware';
  if (ratio < 0.85) return 'Working';
  return 'Strong';
}

const ORDER = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'A1', 'A2', 'A3', 'A4', 'A5'];

function renderResults() {
  const dimScores = {};
  for (const dimId of Object.keys(state.data.dimensions)) {
    dimScores[dimId] = { score: 0, count: 0, max: 0, questions: [] };
  }
  for (const q of state.questions) {
    const ans = state.answers[q.id];
    dimScores[q.dimension].score += ans ? ans.score : 0;
    dimScores[q.dimension].count += 1;
    dimScores[q.dimension].max += 2;
    dimScores[q.dimension].questions.push({ q, ans });
  }

  // Quick-mode note: only visible when state.mode === 'quick'
  const noteEl = document.getElementById('quick-mode-note');
  if (noteEl) noteEl.classList.toggle('hidden', state.mode !== 'quick');

  // Summary pills
  const summary = document.getElementById('summary');
  summary.innerHTML = '';
  const counts = { None: 0, Aware: 0, Working: 0, Strong: 0 };
  for (const dimId of ORDER) {
    const ds = dimScores[dimId];
    if (ds.count === 0) continue;
    counts[dimensionLevel(ds.score, ds.count)]++;
  }
  for (const [level, count] of Object.entries(counts)) {
    if (count === 0) continue;
    const pill = document.createElement('span');
    pill.className = `summary-pill level-${level}`;
    pill.textContent = `${count} × ${level}`;
    summary.appendChild(pill);
  }

  // Dynamic funnel CTA
  renderFunnelCTA(dimScores);

  // Per-dimension cards
  const grid = document.getElementById('results-grid');
  grid.innerHTML = '';
  for (const dimId of ORDER) {
    const dim = state.data.dimensions[dimId];
    const ds = dimScores[dimId];
    if (ds.count === 0) continue;
    const level = dimensionLevel(ds.score, ds.count);

    const card = document.createElement('div');
    card.className = 'dim-result';

    const header = document.createElement('div');
    header.className = 'dim-result-header';

    const left = document.createElement('span');
    const tier = document.createElement('span');
    tier.className = 'dim-tier-tag';
    tier.textContent = dim.tier;
    const name = document.createElement('span');
    name.className = 'dim-name';
    name.textContent = `${dimId} · ${dim.name}`;
    left.appendChild(tier);
    left.appendChild(name);

    const levelBadge = document.createElement('span');
    levelBadge.className = `dim-level level-${level}`;
    levelBadge.textContent = level;

    header.appendChild(left);
    header.appendChild(levelBadge);
    card.appendChild(header);

    const anchor = document.createElement('div');
    anchor.className = 'dim-anchor';
    anchor.innerHTML = `<em>Strong looks like:</em> ${dim.anchor}`;
    card.appendChild(anchor);

    const detail = document.createElement('div');
    detail.className = 'dim-score-detail';
    detail.textContent = `${ds.score} / ${ds.max} across ${ds.count} question${ds.count === 1 ? '' : 's'}`;
    card.appendChild(detail);

    // Syllabus toggle + panel (only if the dimension has a syllabus authored
    // and the user isn't already at Strong)
    if (dim.syllabus && level !== 'Strong') {
      const syllBtn = document.createElement('button');
      syllBtn.className = 'syllabus-toggle';
      syllBtn.type = 'button';
      syllBtn.setAttribute('aria-expanded', 'false');
      syllBtn.textContent = 'Show suggested next steps';

      const syllPanel = document.createElement('div');
      syllPanel.className = 'syllabus-panel hidden';
      renderSyllabus(syllPanel, dim.syllabus);

      syllBtn.addEventListener('click', () => {
        const open = !syllPanel.classList.contains('hidden');
        syllPanel.classList.toggle('hidden');
        syllBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
        syllBtn.textContent = open ? 'Show suggested next steps' : 'Hide next steps';
        if (!open) {
          track('syllabus_opened', { dimension: dimId, level });
        }
      });

      card.appendChild(syllBtn);
      card.appendChild(syllPanel);
    }

    // Drill-down toggle and panel
    const drillBtn = document.createElement('button');
    drillBtn.className = 'drill-toggle';
    drillBtn.type = 'button';
    drillBtn.setAttribute('aria-expanded', 'false');
    drillBtn.textContent = 'Show details';

    const panel = document.createElement('div');
    panel.className = 'drill-panel hidden';
    renderDrilldown(panel, ds.questions);

    drillBtn.addEventListener('click', () => {
      const open = !panel.classList.contains('hidden');
      panel.classList.toggle('hidden');
      drillBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      drillBtn.textContent = open ? 'Show details' : 'Hide details';
      if (!open) {
        track('drilldown_opened', { dimension: dimId });
        state.expandedDimensions.add(dimId);
      } else {
        state.expandedDimensions.delete(dimId);
      }
    });

    card.appendChild(drillBtn);
    card.appendChild(panel);

    grid.appendChild(card);
  }
}

function renderDrilldown(panel, questions) {
  panel.innerHTML = '';
  for (const { q, ans } of questions) {
    const block = document.createElement('div');
    block.className = 'drill-question';

    const stem = document.createElement('div');
    stem.className = 'drill-stem';
    stem.innerHTML = `<strong>${q.id}</strong>: ${escapeHtml(q.text)}`;
    block.appendChild(stem);

    const score = ans ? ans.score : 0;
    const scoreLine = document.createElement('div');
    scoreLine.className = 'drill-score';
    scoreLine.textContent = `Your score: ${score} / 2`;
    block.appendChild(scoreLine);

    if (q.type === 'mc') {
      const userIdx = ans ? ans.value : null;
      const userText = userIdx != null ? q.options[userIdx] : '(no answer)';
      const correctText = q.options[q.correct];

      const userLine = document.createElement('div');
      userLine.className = score === 2 ? 'drill-correct' : 'drill-incorrect';
      userLine.innerHTML = `<em>You picked:</em> ${escapeHtml(userText)}`;
      block.appendChild(userLine);

      if (score !== 2) {
        const correctLine = document.createElement('div');
        correctLine.className = 'drill-correct';
        correctLine.innerHTML = `<em>Correct answer:</em> ${escapeHtml(correctText)}`;
        block.appendChild(correctLine);
      }
    } else {
      const userLine = document.createElement('div');
      userLine.className = 'drill-user-text';
      userLine.innerHTML = `<em>Your answer:</em> ${escapeHtml(ans ? ans.value : '(no answer)')}`;
      block.appendChild(userLine);

      if (q.scoring_rubric) {
        const rubric = document.createElement('div');
        rubric.className = 'drill-rubric';
        rubric.innerHTML = `<em>Scoring rubric:</em> ${escapeHtml(q.scoring_rubric)}`;
        block.appendChild(rubric);
      }
    }

    panel.appendChild(block);
  }
}

function renderSyllabus(panel, syllabus) {
  panel.innerHTML = '';

  const sections = [
    { key: 'read', label: 'Read' },
    { key: 'try', label: 'Try' },
    { key: 'tool', label: 'Tool' },
    { key: 'next_phase', label: 'Next phase' },
  ];

  for (const { key, label } of sections) {
    const section = syllabus[key];
    if (!section) continue;
    const block = document.createElement('div');
    block.className = `syllabus-section syllabus-${key}`;

    const heading = document.createElement('h3');
    heading.className = 'syllabus-heading';
    heading.textContent = label;
    block.appendChild(heading);

    if (section.title) {
      const title = document.createElement('div');
      title.className = 'syllabus-title';
      if (section.url) {
        const a = document.createElement('a');
        a.href = section.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = section.title;
        title.appendChild(a);
      } else {
        title.textContent = section.title;
      }
      block.appendChild(title);
    }

    if (section.duration_minutes) {
      const dur = document.createElement('div');
      dur.className = 'syllabus-duration';
      dur.textContent = `~${section.duration_minutes} minutes`;
      block.appendChild(dur);
    }

    if (Array.isArray(section.steps) && section.steps.length) {
      const ol = document.createElement('ol');
      ol.className = 'syllabus-steps';
      for (const step of section.steps) {
        const li = document.createElement('li');
        li.innerHTML = formatRichText(step);
        ol.appendChild(li);
      }
      block.appendChild(ol);
    }

    if (section.summary) {
      const p = document.createElement('p');
      p.className = 'syllabus-summary';
      p.innerHTML = formatRichText(section.summary);
      block.appendChild(p);
    }

    if (section.outcome) {
      const out = document.createElement('p');
      out.className = 'syllabus-outcome';
      out.innerHTML = `<em>You should leave with:</em> ${formatRichText(section.outcome)}`;
      block.appendChild(out);
    }

    if (section.power_user_followup) {
      const fu = document.createElement('p');
      fu.className = 'syllabus-followup';
      fu.innerHTML = `<em>Power-user follow-up:</em> ${formatRichText(section.power_user_followup)}`;
      block.appendChild(fu);
    }

    panel.appendChild(block);
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Renders trusted-but-text content (syllabus body strings from questions.json) with:
//   - HTML entities escaped first, so any unexpected markup stays inert
//   - http(s) URLs auto-linked to open in a new tab
//   - inline `backtick` spans wrapped in <code>
// Order matters: escapeHtml first, then operate only on the escaped string. The regex
// is anchored on https?:// so javascript:, data:, vbscript:, file: cannot match.
function formatRichText(s) {
  if (s == null) return '';
  let out = escapeHtml(s);
  out = out.replace(/https?:\/\/[^\s<>"]+/g, (url) => {
    let trailing = '';
    while (url.length > 0 && /[,.;:!?]/.test(url[url.length - 1])) {
      trailing = url[url.length - 1] + trailing;
      url = url.slice(0, -1);
    }
    return `<a href="${url}" target="_blank" rel="noopener">${url}</a>${trailing}`;
  });
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function renderFunnelCTA(dimScores) {
  const ctaContainer = document.getElementById('funnel-cta');
  if (!ctaContainer) return;
  const advancedDims = ['A1', 'A2', 'A3', 'A4', 'A5'];
  const lowAdvancedCount = advancedDims.filter(id => {
    const ds = dimScores[id];
    if (!ds || ds.count === 0) return false;
    const level = dimensionLevel(ds.score, ds.count);
    return level === 'Unfamiliar' || level === 'Aware';
  }).length;

  ctaContainer.innerHTML = '';
  if (state.mode === 'deep' && lowAdvancedCount >= 3) {
    ctaContainer.className = 'funnel-cta funnel-cta-strong';
    const heading = document.createElement('strong');
    heading.textContent = 'Your team likely has org-level gaps too.';
    ctaContainer.appendChild(heading);
    const body = document.createElement('p');
    body.innerHTML = `You scored Aware or below on ${lowAdvancedCount} of 5 advanced dimensions (LLMOps, Agent design, Cloud-native deployment, Safety, Evaluation). Teams with this profile typically benefit from a 30-minute org-readiness conversation. <a href="https://impacteng.com.au" target="_blank" rel="noopener">See impacteng.com.au</a> for the org-level self-assessment and audit options.`;
    ctaContainer.appendChild(body);
    track('funnel_cta_shown', { variant: 'strong', lowAdvancedCount });
  } else {
    ctaContainer.className = 'funnel-cta funnel-cta-soft';
    const body = document.createElement('p');
    body.innerHTML = `If your team's <em>organisational</em> AI readiness needs the same kind of check, the org-level self-assessment lives on <a href="https://impacteng.com.au" target="_blank" rel="noopener">impacteng.com.au</a>.`;
    ctaContainer.appendChild(body);
    track('funnel_cta_shown', { variant: 'soft', lowAdvancedCount });
  }
}

function restart() {
  track('assessment_restarted', {});
  clearSession();
  state.answers = {};
  state.currentIndex = 0;
  state.expandedDimensions = new Set();
  showScreen('landing');
  window.scrollTo({ top: 0 });
  document.getElementById('start-btn').focus();
}

function maybeOfferResume() {
  const snapshot = loadSession();
  if (!snapshot) return;
  const banner = document.getElementById('resume-banner');
  if (!banner) return;
  const savedAt = snapshot.savedAt ? new Date(snapshot.savedAt) : null;
  const when = savedAt ? savedAt.toLocaleString() : 'a previous session';
  const progress = `${(snapshot.currentIndex || 0) + 1} of ${snapshot.questionIds.length}`;
  banner.querySelector('.resume-detail').textContent =
    `Saved ${when}. You were on question ${progress} (${snapshot.mode} mode).`;
  banner.classList.remove('hidden');

  const resumeBtn = banner.querySelector('.resume-yes');
  const discardBtn = banner.querySelector('.resume-no');
  resumeBtn.onclick = () => {
    const ok = resumeSession(snapshot);
    if (!ok) {
      // bank changed, can't safely resume
      clearSession();
      banner.classList.add('hidden');
      alert('Saved session is from an older question bank and cannot be safely resumed. It has been cleared.');
    } else {
      banner.classList.add('hidden');
    }
  };
  discardBtn.onclick = () => {
    clearSession();
    banner.classList.add('hidden');
    track('saved_session_discarded', {});
  };
}

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('next-btn').addEventListener('click', next);
document.getElementById('back-btn').addEventListener('click', back);
document.getElementById('restart-btn').addEventListener('click', restart);
const runDeepLink = document.getElementById('run-deep-link');
if (runDeepLink) {
  runDeepLink.addEventListener('click', (e) => {
    e.preventDefault();
    restart();
    const deepRadio = document.querySelector('input[name="mode"][value="deep"]');
    if (deepRadio) deepRadio.checked = true;
  });
}

// Disable Start until questions are loaded
const startBtn = document.getElementById('start-btn');
startBtn.disabled = true;
startBtn.textContent = 'Loading...';

track('page_loaded', {});

loadData()
  .then(() => {
    maybeOfferResume();
  })
  .catch(err => {
    document.getElementById('error-detail').textContent = `Detail: ${err.message}`;
    showScreen('error');
    console.error('Failed to load questions.json:', err);
  });
