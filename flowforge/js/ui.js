// ===== UI CONTROLLER =====
// Screen transitions, modal management, HUD updates, tutorial tips.

class UIController {
  constructor() {
    // Screen references
    this.screens = {
      title:       document.getElementById('screen-title'),
      levelselect: document.getElementById('screen-levelselect'),
      mission:     document.getElementById('screen-mission'),
      game:        document.getElementById('screen-game'),
    };

    // Modal/overlay references
    this.resultsModal = document.getElementById('modal-results');
    this.hintBubble   = document.getElementById('hint-bubble');

    // HUD elements
    this.hudDelivered   = document.getElementById('hud-delivered');
    this.hudBlocked     = document.getElementById('hud-blocked');
    this.hudThroughput  = document.getElementById('hud-throughput');
    this.hudTick        = document.getElementById('hud-tick');
    this.hudTitle       = document.getElementById('hud-title');
    this.hudLevel       = document.getElementById('hud-level');
    this.runBtn         = document.getElementById('btn-run');
    this.pauseBtn       = document.getElementById('btn-pause');
    this.resetBtn       = document.getElementById('btn-reset');
    this.hintBtn        = document.getElementById('btn-hint');

    // Info panel
    this.goalProgress   = document.getElementById('goal-progress');
    this.spikeIndicator = document.getElementById('spike-indicator');

    // Tutorial tips container
    this.tipsContainer  = document.getElementById('tutorial-tips');

    this._hintIdx = 0;
    this._currentLevel = null;
    this._tutorialStep = 0;
  }

  showScreen(name) {
    for (const [k, el] of Object.entries(this.screens)) {
      el.classList.toggle('active', k === name);
    }
  }

  // ===== LEVEL SELECT =====
  renderLevelSelect() {
    const cards = document.querySelectorAll('.level-card');
    cards.forEach((card, i) => {
      const levelId = i + 1;
      const unlocked = isLevelUnlocked(levelId);
      const stars = getBestScore(levelId);
      card.classList.toggle('locked', !unlocked);

      const starEls = card.querySelectorAll('.star');
      starEls.forEach((s, si) => {
        s.classList.toggle('earned', si < stars);
      });
    });
  }

  // ===== MISSION BRIEF =====
  showMission(level) {
    this._currentLevel = level;
    document.getElementById('mission-level-num').textContent = `Level ${level.id}`;
    document.getElementById('mission-title').textContent = level.title;
    document.getElementById('mission-subtitle').textContent = level.subtitle;
    document.getElementById('mission-brief-text').textContent = level.brief;

    const goalsEl = document.getElementById('mission-goals-list');
    goalsEl.innerHTML = level.goals.map(g =>
      `<div class="goal-item"><span class="goal-icon">${g.icon}</span><span>${g.label}</span></div>`
    ).join('');

    this.showScreen('mission');
  }

  // ===== HUD =====
  setupHUD(level) {
    this._currentLevel = level;
    this.hudLevel.textContent = `Level ${level.id}`;
    this.hudTitle.textContent = level.title;
    this._hintIdx = 0;
    this.updateHUD({ delivered: 0, blocked: 0, totalSpawned: 0, ticks: 0 }, 0);

    // Goal progress bars
    this._renderGoalBars(level, { delivered: 0, blocked: 0, brokenFragile: 0 });
  }

  updateHUD(metrics, tick) {
    const pct = metrics.totalSpawned > 0
      ? Math.round((metrics.delivered / metrics.totalSpawned) * 100)
      : 0;
    const throughput = tick > 0
      ? (metrics.delivered / tick * 10).toFixed(1)
      : '0.0';

    this.hudDelivered.textContent = `${metrics.delivered}`;
    this.hudDelivered.className = 'hud-metric-value' + (pct >= 90 ? ' good' : pct < 50 ? ' bad' : '');

    this.hudBlocked.textContent = `${metrics.blocked}`;
    this.hudBlocked.className = 'hud-metric-value' + (metrics.blocked > 0 ? ' bad' : ' good');

    this.hudThroughput.textContent = throughput;
    this.hudTick.textContent = `Tick ${tick}`;

    // Spike warning
    if (this.spikeIndicator) {
      this.spikeIndicator.style.display = metrics.spikeActive ? 'flex' : 'none';
    }

    // Update goal progress bars
    if (this._currentLevel) {
      this._renderGoalBars(this._currentLevel, metrics);
    }
  }

  _renderGoalBars(level, metrics) {
    if (!this.goalProgress) return;
    const pct = metrics.totalSpawned > 0
      ? Math.round((metrics.delivered / metrics.totalSpawned) * 100) : 0;
    const blockedMax = level.id === 2 ? 4 : level.id === 4 ? 6 : 0;

    let html = '';
    if (level.id === 1) {
      html += this._progressBar('Delivered', pct, 100, '%', pct >= 100 ? 'good' : '');
      html += this._progressBar('Blocked', metrics.blocked, 5, '', metrics.blocked === 0 ? 'good' : 'bad');
    } else if (level.id === 2) {
      html += this._progressBar('Delivered', pct, 85, '% target', pct >= 85 ? 'good' : '');
      html += this._progressBar('Blocked', metrics.blocked, blockedMax + 2, '', metrics.blocked < 4 ? 'good' : 'bad');
    } else if (level.id === 3) {
      html += this._progressBar('Delivered', pct, 80, '% target', pct >= 80 ? 'good' : '');
      html += this._progressBar('Broken Fragile', metrics.brokenFragile, 5, '', metrics.brokenFragile === 0 ? 'good' : 'bad');
    } else if (level.id === 4) {
      html += this._progressBar('Delivered', pct, 75, '% target', pct >= 75 ? 'good' : '');
      html += this._progressBar('Blocked', metrics.blocked, 12, '', metrics.blocked <= 6 ? 'good' : 'bad');
    }
    this.goalProgress.innerHTML = html;
  }

  _progressBar(label, val, max, unit, cls) {
    const ratio = Math.min(val / (max || 1), 1);
    const fillClass = cls || (ratio >= 0.8 ? 'good' : ratio > 0.4 ? 'warn' : 'bad');
    return `
      <div class="goal-row">
        <div class="goal-row-label">${label}: <strong>${val}${unit ? ' ' + unit : ''}</strong></div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill ${fillClass}" style="width:${Math.round(ratio*100)}%"></div>
        </div>
      </div>`;
  }

  setRunning(running) {
    this.runBtn.disabled = running;
    this.pauseBtn.disabled = !running;
  }

  // ===== RESULTS MODAL =====
  showResults(level, summary, report) {
    const modal = this.resultsModal;

    modal.querySelector('#results-level').textContent = `Level ${level.id}: ${level.title}`;
    modal.querySelector('#results-subtitle').textContent =
      summary.stars === 3 ? '🏆 Perfect Run!' :
      summary.stars === 2 ? '✅ Mission Complete' :
      summary.stars === 1 ? '⚠️ Partial Success' : '❌ Try Again';

    // Stars
    const starEls = modal.querySelectorAll('.star-big');
    starEls.forEach((s, i) => {
      s.classList.remove('earned', 'pop');
      s.classList.toggle('earned', i < summary.stars);
    });
    // Animate stars with delay
    setTimeout(() => {
      starEls.forEach((s, i) => {
        if (i < summary.stars) {
          setTimeout(() => s.classList.add('pop'), i * 180);
        }
      });
    }, 100);

    // Metrics
    modal.querySelector('#results-delivered').textContent = `${summary.delivered}/${summary.totalSpawned}`;
    modal.querySelector('#results-delivery-pct').textContent = `${summary.deliveryPct}%`;
    modal.querySelector('#results-blocked').textContent = summary.blocked;
    modal.querySelector('#results-ticks').textContent = summary.ticks;
    modal.querySelector('#results-throughput').textContent = summary.throughput;

    const broken = modal.querySelector('#results-broken-row');
    if (broken) {
      broken.style.display = level.id === 3 ? '' : 'none';
      if (level.id === 3) {
        modal.querySelector('#results-broken').textContent = summary.brokenFragile;
      }
    }

    // Coach report
    modal.querySelector('#coach-report-text').textContent = report;

    // Next level button
    const nextBtn = modal.querySelector('#btn-next-level');
    if (nextBtn) {
      const nextId = level.id + 1;
      const hasNext = nextId <= LEVELS.length;
      nextBtn.style.display = hasNext ? '' : 'none';
      if (hasNext) nextBtn.textContent = `Next Level →`;
    }

    modal.classList.add('active');
    modal.querySelector('.modal').classList.add('slide-up');
  }

  hideResults() {
    this.resultsModal.classList.remove('active');
  }

  // ===== HINT BUBBLE =====
  showHint(level) {
    const text = generateHint(level, this._hintIdx);
    this._hintIdx++;
    const bubble = this.hintBubble;
    bubble.querySelector('#hint-text').textContent = text;
    bubble.classList.add('active');
  }

  hideHint() {
    this.hintBubble.classList.remove('active');
  }

  // ===== TUTORIAL TIPS =====
  showTutorialTip(text, position) {
    if (!this.tipsContainer) return;
    this.clearTutorialTips();
    const tip = document.createElement('div');
    tip.className = `tutorial-tip tip-${position.side || 'bottom'}`;
    tip.style.left = (position.x || 220) + 'px';
    tip.style.top = (position.y || 80) + 'px';
    tip.textContent = text;
    this.tipsContainer.appendChild(tip);
  }

  clearTutorialTips() {
    if (this.tipsContainer) this.tipsContainer.innerHTML = '';
  }

  // Toolbar highlight for tutorial
  highlightTool(toolId) {
    document.querySelectorAll('.component-btn').forEach(b => {
      b.style.boxShadow = b.dataset.tool === toolId
        ? '0 0 0 2px var(--accent), 0 0 16px rgba(74,158,255,0.4)'
        : '';
    });
  }

  clearToolHighlight() {
    document.querySelectorAll('.component-btn').forEach(b => { b.style.boxShadow = ''; });
  }
}
