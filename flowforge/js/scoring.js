// ===== SCORING MODULE =====
// Calculates star ratings and summary metrics after each run.

function calcStars(level, metrics) {
  const thresholds = level.starThresholds;
  // 3 stars = first threshold, 2 = second, 1 = third, 0 = none
  if (thresholds[0](metrics)) return 3;
  if (thresholds[1](metrics)) return 2;
  if (thresholds[2](metrics)) return 1;
  return 0;
}

function calcDeliveryPct(metrics) {
  if (!metrics.totalSpawned) return 0;
  return Math.round((metrics.delivered / metrics.totalSpawned) * 100);
}

function calcThroughput(metrics) {
  // packages per 10 ticks average
  if (!metrics.ticks) return 0;
  return (metrics.delivered / metrics.ticks * 10).toFixed(1);
}

function buildSummary(level, metrics) {
  return {
    stars: calcStars(level, metrics),
    deliveryPct: calcDeliveryPct(metrics),
    throughput: calcThroughput(metrics),
    delivered: metrics.delivered,
    blocked: metrics.blocked,
    brokenFragile: metrics.brokenFragile,
    ticks: metrics.ticks,
    totalSpawned: metrics.totalSpawned,
  };
}

// ===== BOB THE FOREMAN COACHING MODULE =====
function generateCoachReport(level, metrics, summary) {
  const pct = summary.deliveryPct;
  const blocked = summary.blocked;
  const broken = summary.brokenFragile;
  const stars = summary.stars;
  const concept = level.coachConcept;
  const ticks = summary.ticks;
  const delivered = summary.delivered;
  const total = summary.totalSpawned;

  // --- Level-specific, metrics-grounded reports ---

  if (level.id === 1) {
    if (stars === 3) {
      return `Every single package made it through — that's a perfect run! ` +
             `You nailed the basics of ${concept}: keep the flow direction consistent from input to output. ` +
             `For the next level, try adding a second output path — things get more interesting when volume picks up.`;
    }
    if (stars === 2) {
      return `All ${delivered} packages reached the output, but the run took ${ticks} ticks. ` +
             `For perfect flow, a shorter, more direct path reduces transit time. ` +
             `Try replacing any unnecessary turns with straight belts — each extra segment adds delay.`;
    }
    if (stars === 1) {
      return `${delivered} of ${total} packages arrived, but some got lost. ` +
             `That usually means there's a gap in the belt path — packages need a continuous route to the output. ` +
             `Check every cell between the spawner and the collector; even one missing belt will stop the flow.`;
    }
    return `Looks like the packages couldn't find their way. ` +
           `Make sure you've placed belts all the way from the 🏭 input to the 🎯 output without any gaps. ` +
           `Start simple: one straight horizontal line first, then add turns if needed.`;
  }

  if (level.id === 2) {
    if (stars === 3) {
      return `Flawless throughput — zero blocks, every package delivered! ` +
             `You've mastered the ${concept} concept: when one path can't keep up, split the load or add capacity. ` +
             `Next challenge: what happens when different *types* of packages need different handling?`;
    }
    if (blocked >= 6) {
      return `${blocked} packages got stuck, piling up before the middle section. ` +
             `That's a textbook ${concept} — your single path couldn't handle the volume arriving from the spawner. ` +
             `Add a Buffer (🗄️) before the pinch point, or build a parallel belt lane in rows 2–6 to share the load.`;
    }
    if (blocked > 0 && blocked < 6) {
      return `${blocked} packages were blocked — close to the goal! ` +
             `The ${concept} was almost resolved, but a small surge still caused backups. ` +
             `Add one more Buffer right before the congestion point, or widen the parallel section by one extra belt.`;
    }
    if (pct < 85) {
      return `Only ${pct}% of packages delivered — the target is 85%. ` +
             `The missing packages likely got blocked at the narrow section. ` +
             `Focus on expanding the mid-section: either a 2-cell wide parallel path or a buffer with capacity for 4+ packages.`;
    }
    return `Good progress — ${pct}% delivered. ` +
           `Throughput was ${summary.throughput} packages per 10 ticks. ` +
           `To hit 3 stars, keep the throughput steady by making sure the buffer empties before it fills completely.`;
  }

  if (level.id === 3) {
    if (stars === 3) {
      return `Zero broken fragile packages and full delivery — the sorter did its job perfectly! ` +
             `You've applied ${concept} beautifully: the right component on the right path for the right cargo type. ` +
             `Level 4 will push your system harder — think about what happens when *volume* spikes suddenly.`;
    }
    if (broken > 0) {
      return `${broken} fragile package${broken > 1 ? 's' : ''} broke on the fast belts in the lower lane. ` +
             `That's the core challenge of ${concept}: fragile items need a dedicated safe route. ` +
             `Place your Sorter (🔀) earlier in the path — it needs to intercept fragile packages *before* they reach row 5.`;
    }
    if (pct < 80) {
      return `Fragile packages were protected, but only ${pct}% of the total load was delivered. ` +
             `The safe upper route might be too slow or missing belt segments. ` +
             `Make sure the upper path has a clear continuous belt from the sorter's alt-exit all the way to the top collector.`;
    }
    return `The sorting is working — but throughput was ${summary.throughput} packages per 10 ticks. ` +
           `Fine-tune the two routes: the lower fast path and the upper safe path can both run simultaneously. ` +
           `Check that no belt is pointing the wrong way at the split point.`;
  }

  if (level.id === 4) {
    if (stars === 3) {
      return `System stayed functional through the entire spike — that's exceptional resilience! ` +
             `You nailed ${concept}: by building in spare capacity (buffers + parallel lanes), the surge at tick 40 had somewhere to go. ` +
             `You've completed all four levels — try optimizing for zero blocks or fastest delivery time!`;
    }
    if (metrics.blocked > 6) {
      return `${metrics.blocked} packages jammed during the spike at tick 40. ` +
             `Classic ${concept} failure: the extra volume had nowhere to go and caused a chain reaction. ` +
             `Add at least two Buffers (🗄️) in the middle section *before* the spike hits, and consider splitting into two parallel lanes.`;
    }
    if (pct < 75) {
      return `Only ${pct}% of packages delivered through the full spike window. ` +
             `The system was close to stable but collapsed when demand tripled. ` +
             `Focus on the section between ticks 40–80: that's where the surge hits. Add parallel routing there specifically.`;
    }
    return `You made it through, but there were ${metrics.blocked} blocked packages at peak load. ` +
           `The design held during normal flow but partially overwhelmed during the spike. ` +
           `For 3 stars, pre-stage 2 buffers before the midpoint and widen to 2 parallel lanes for the last 5 columns.`;
  }

  // Generic fallback
  return `You delivered ${delivered} of ${total} packages (${pct}%). ` +
         `The key concept here is ${concept}. ` +
         `Focus on making sure every package has a clear, unblocked path to the output.`;
}

function generateHint(level, hintIdx) {
  const hints = level.hints || [];
  if (!hints.length) return "Try connecting the input to the output with a continuous belt path.";
  return hints[hintIdx % hints.length];
}

// Persist best scores to localStorage
const STORAGE_KEY = 'flowforge_scores_v1';

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function saveScore(levelId, stars) {
  const scores = loadScores();
  if (!scores[levelId] || scores[levelId] < stars) {
    scores[levelId] = stars;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }
}

function getBestScore(levelId) {
  const scores = loadScores();
  return scores[levelId] || 0;
}

function unlockLevel(levelId) {
  const scores = loadScores();
  if (!scores[`unlock_${levelId}`]) {
    scores[`unlock_${levelId}`] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  }
}

function isLevelUnlocked(levelId) {
  if (levelId === 1) return true;
  const scores = loadScores();
  return !!scores[`unlock_${levelId}`];
}
