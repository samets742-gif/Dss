/**
 * UI-логика СППР «Ситуационное управление»
 * Использует SituationalEngine и KNOWLEDGE_BASE из подключённых скриптов.
 */

(function () {
  'use strict';

  // ── Инициализация движка ─────────────────────────────────────────────────
  const engine = new SituationalEngine(KNOWLEDGE_BASE);
  const attributes = engine.getAttributes();

  // Текущая ситуация — выбранные значения дескрипторов
  const currentSituation = {};

  // ── DOM helpers ──────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  };

  // ── Рендер формы дескрипторов ────────────────────────────────────────────
  function renderForm() {
    const container = $('attr-form');
    container.innerHTML = '';

    attributes.forEach(attr => {
      const card = el('div', 'attr-card');
      card.dataset.attr = attr.id;

      const header = el('div', 'attr-header');
      header.innerHTML = `
        <span class="attr-icon">${attr.icon}</span>
        <span class="attr-label">${attr.label}</span>
        <span class="attr-badge">✓</span>`;
      card.appendChild(header);

      const vals = el('div', 'attr-values');
      attr.values.forEach(v => {
        const btn = el('button', 'val-btn', v.label);
        btn.dataset.value = v.id;
        btn.addEventListener('click', () => selectValue(attr.id, v.id, btn, card));
        vals.appendChild(btn);
      });
      card.appendChild(vals);
      container.appendChild(card);
    });

    updateProgress();
  }

  // ── Выбор значения дескриптора ───────────────────────────────────────────
  function selectValue(attrId, valueId, clickedBtn, card) {
    // Сброс предыдущего выбора
    card.querySelectorAll('.val-btn').forEach(b => b.classList.remove('active'));

    if (currentSituation[attrId] === valueId) {
      // Повторный клик — снять выбор
      delete currentSituation[attrId];
      card.classList.remove('selected');
    } else {
      currentSituation[attrId] = valueId;
      clickedBtn.classList.add('active');
      card.classList.add('selected');
    }

    updateProgress();
    updateAnalyzeButton();
  }

  // ── Прогресс-бар заполнения ситуации ─────────────────────────────────────
  function updateProgress() {
    const total = attributes.length;
    const filled = Object.keys(currentSituation).length;
    const pct = Math.round((filled / total) * 100);

    $('progress-fill').style.width = pct + '%';
    $('progress-text').textContent = `${filled} из ${total}`;
  }

  function updateAnalyzeButton() {
    const btn = $('btn-analyze');
    const filled = Object.keys(currentSituation).length;
    btn.disabled = filled === 0;
    btn.textContent = filled === 0
      ? 'Выберите хотя бы один дескриптор'
      : filled < attributes.length
        ? `Анализировать ситуацию (${filled}/${attributes.length})`
        : 'Анализировать ситуацию';
  }

  // ── Анализ ───────────────────────────────────────────────────────────────
  function analyze() {
    const results = engine.analyze(currentSituation, 3, 0.25);
    renderResults(results);

    // Плавная прокрутка к результатам
    setTimeout(() => {
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  // ── Рендер результатов ───────────────────────────────────────────────────
  function renderResults(results) {
    const container = $('results');
    container.innerHTML = '';

    const title = el('div', 'section-title', 'Рекомендации системы');
    container.appendChild(title);

    if (results.length === 0) {
      const none = el('div', 'no-results');
      none.innerHTML = `
        <div class="icon">🔍</div>
        <p>Не удалось подобрать подходящую ситуацию.<br>Попробуйте уточнить значения дескрипторов.</p>`;
      container.appendChild(none);
      return;
    }

    results.forEach((res, idx) => {
      const card = buildResultCard(res, idx + 1);
      container.appendChild(card);
    });

    // Кнопка сброса
    const resetBtn = el('button', 'btn-reset', '← Новый анализ');
    resetBtn.addEventListener('click', reset);
    container.appendChild(resetBtn);
  }

  function buildResultCard(res, rank) {
    const { rule, score, confidence } = res;
    const pct = Math.round(score * 100);

    const priorityLabels = { ok: 'Норма', warning: 'Внимание', critical: 'Критично' };
    const priorityLabel = priorityLabels[rule.priority] || rule.priority;

    const card = el('div', 'result-card');

    // Top row
    const top = el('div', 'result-top');
    top.innerHTML = `
      <div class="result-rank">${rank}</div>
      <div class="result-info">
        <div class="result-name">${rule.name}</div>
        <div class="result-decision">${rule.decision}</div>
      </div>`;
    card.appendChild(top);

    // Meta row
    const meta = el('div', 'result-meta');
    meta.innerHTML = `
      <span class="confidence-pill" style="color:${confidence.color}; border-color:${confidence.color}20; background:${confidence.color}15">
        <span style="width:6px;height:6px;border-radius:50%;background:${confidence.color};display:inline-block"></span>
        ${confidence.label} уверенность ${pct}%
      </span>
      <span class="priority-pill priority-${rule.priority}">${priorityLabel}</span>`;
    // Score bar
    const barWrap = el('div', 'score-bar-wrap');
    barWrap.innerHTML = `<div class="score-bar"><div class="score-fill" style="width:0%;background:${confidence.color}"></div></div>`;
    meta.appendChild(barWrap);
    card.appendChild(meta);
    // Animate bar
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const fill = barWrap.querySelector('.score-fill');
        if (fill) fill.style.width = pct + '%';
      });
    });

    // Rationale
    const rat = el('div', 'result-rationale', `💡 ${rule.rationale}`);
    card.appendChild(rat);

    // Actions accordion
    const toggleBtn = el('button', 'result-actions-toggle');
    toggleBtn.innerHTML = `<span>📋 Рекомендуемые действия (${rule.actions.length})</span><span class="arrow">▼</span>`;

    const actionsDiv = el('div', 'result-actions');
    const ol = el('ol', '', rule.actions.map(a => `<li>${a}</li>`).join(''));
    actionsDiv.appendChild(ol);

    toggleBtn.addEventListener('click', () => {
      const open = actionsDiv.classList.toggle('open');
      toggleBtn.classList.toggle('open', open);
    });

    // Раскрыть первый результат по умолчанию
    if (rank === 1) {
      actionsDiv.classList.add('open');
      toggleBtn.classList.add('open');
    }

    card.appendChild(toggleBtn);
    card.appendChild(actionsDiv);

    return card;
  }

  // ── Сброс ────────────────────────────────────────────────────────────────
  function reset() {
    Object.keys(currentSituation).forEach(k => delete currentSituation[k]);
    $('results').innerHTML = '';
    document.querySelectorAll('.val-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.attr-card').forEach(c => c.classList.remove('selected'));
    updateProgress();
    updateAnalyzeButton();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Регистрация Service Worker ───────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }

  // ── Инициализация ────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderForm();
    updateAnalyzeButton();

    $('btn-analyze').addEventListener('click', analyze);
  });

})();
