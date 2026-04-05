/* ============================================================
   EquiLearn — app.js
   Interactive Documentary: Inequality in French Engineering Schools
   ============================================================ */

'use strict';

// ─── Global color tokens ───────────────────────────────────────────────────
const C = {
  darkGreen:  '#1a4031',
  forest:     '#2d5a45',
  sage:       '#8ba888',
  lightSage:  '#c5d9c0',
  mint:       '#e8f0e6',
  cream:      '#f7faf6',
  gold:       '#c9a227',
  goldLight:  '#f5e6a3',
  gray300:    '#c4cec2',
  gray500:    '#7a8a77',
  gray700:    '#4a5a48',
  white:      '#ffffff',
  // theme accents
  girls:      '#c9a227',
  girlsLight: 'rgba(201,162,39,0.18)',
  boys:       '#2d5a45',
  boysLight:  'rgba(45,90,69,0.18)',
  scholar:    '#e07b39',
  scholarLight:'rgba(224,123,57,0.18)',
};

// ─── Utility ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = n => n >= 1000 ? (n / 1000).toFixed(0) + 'k' : n;
const pct = (a, b) => b ? ((a / b) * 100).toFixed(1) + '%' : '—';

// loadJSON: uses XMLHttpRequest so it works on file:// AND http://
// fetch() throws a CORS error on file:// protocol; XHR returns status 0 but still delivers content.
function loadJSON(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      } else {
        reject(new Error('HTTP ' + xhr.status + ' — ' + url));
      }
    };
    xhr.onerror = () => reject(new Error('Network error loading ' + url));
    xhr.send();
  });
}

// Normalize dept codes to match france.json format ("01"…"95", "2A", "2B")
// Boursiers data uses "1", "02A", "02B" etc. — GeoJSON uses "01", "2A", "2B"
function normalizeDeptCode(raw) {
  const s = String(raw || '').trim();
  if (/^0[0-9][A-Z]+$/.test(s)) return s.replace(/^0+/, ''); // "02A" → "2A"
  if (/^[0-9]$/.test(s)) return '0' + s;                      // "1"   → "01"
  return s;
}

// ─── 1. HERO PARTICLES ─────────────────────────────────────────────────────
function initParticles() {
  const container = $('hero-particles');
  if (!container) return;
  const count = 40;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      position:absolute;
      border-radius:50%;
      background:rgba(139,168,136,${(Math.random() * 0.3 + 0.1).toFixed(2)});
      width:${Math.random() * 6 + 3}px;
      height:${Math.random() * 6 + 3}px;
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      animation: particleFloat ${(Math.random() * 10 + 8).toFixed(1)}s ease-in-out infinite;
      animation-delay:-${(Math.random() * 10).toFixed(1)}s;
    `;
    container.appendChild(p);
  }
  // inject keyframes once
  if (!document.getElementById('particle-kf')) {
    const s = document.createElement('style');
    s.id = 'particle-kf';
    s.textContent = `
      @keyframes particleFloat {
        0%,100% { transform: translate(0,0) scale(1); opacity:0.4; }
        33%      { transform: translate(${12}px,${-18}px) scale(1.2); opacity:0.8; }
        66%      { transform: translate(${-8}px,${10}px) scale(0.8); opacity:0.5; }
      }
    `;
    document.head.appendChild(s);
  }
}

// ─── 2. SCROLL REVEAL ──────────────────────────────────────────────────────
function initScrollReveal() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  gsap.utils.toArray('.reveal-up').forEach(el => {
    gsap.fromTo(el,
      { opacity: 0, y: 48 },
      {
        opacity: 1, y: 0, duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        }
      }
    );
  });
}

// ─── 3. MEDUSA INTERACTIVE MAP ─────────────────────────────────────────────
function initMedusaMap() {
  const container = $('medusa-container');
  if (!container) return;

  const canvas = $('medusa-canvas');
  const ctx    = canvas ? canvas.getContext('2d') : null;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = container.offsetWidth;
    canvas.height = container.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Node anchor positions match the CSS (left: 15%, 45%, 75%; top: 50%)
  const nodesCss = [
    { x: 0.15, y: 0.50 },
    { x: 0.45, y: 0.50 },
    { x: 0.75, y: 0.50 },
  ];
  // Avatar starts left (~3%) and moves right; destination is right bar
  const origin = { x: 0.47, y: 0.82 }; // bottom-center
  const dest   = { x: 0.96, y: 0.50 }; // right side bar center

  let tick = 0;
  function drawLines() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;
    tick += 0.010;

    const ox = origin.x * W, oy = origin.y * H;
    const dx = dest.x   * W, dy = dest.y   * H;

    nodesCss.forEach((n, i) => {
      const nx = n.x * W, ny = n.y * H;

      // Origin → node
      const g1 = ctx.createLinearGradient(ox, oy, nx, ny);
      g1.addColorStop(0, 'rgba(26,64,49,0.06)');
      g1.addColorStop(1, 'rgba(139,168,136,0.40)');
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.quadraticCurveTo(
        (ox + nx) / 2 + Math.sin(tick + i * 2.1) * 30,
        (oy + ny) / 2 + Math.cos(tick + i * 1.7) * 18,
        nx, ny
      );
      ctx.strokeStyle = g1; ctx.lineWidth = 1.8;
      ctx.setLineDash([6, 5]); ctx.stroke();

      // Node → destination
      const g2 = ctx.createLinearGradient(nx, ny, dx, dy);
      g2.addColorStop(0, 'rgba(139,168,136,0.40)');
      g2.addColorStop(1, 'rgba(201,162,39,0.30)');
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(
        (nx + dx) / 2 + Math.sin(tick * 0.8 + i * 1.5) * 20,
        (ny + dy) / 2 + Math.cos(tick * 0.8 + i * 2.0) * 14,
        dx, dy
      );
      ctx.strokeStyle = g2; ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 7]); ctx.stroke();
    });

    ctx.setLineDash([]);
    requestAnimationFrame(drawLines);
  }
  drawLines();

  // Click: smooth scroll to section
  document.querySelectorAll('.medusa-node').forEach(node => {
    node.addEventListener('click', () => {
      const target = $(node.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      node.classList.add('node--active');
      setTimeout(() => node.classList.remove('node--active'), 700);
    });
  });
}

// ─── 4. CHART HELPERS ──────────────────────────────────────────────────────
const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        font: { family: "'Inter', sans-serif", size: 12 },
        color: C.gray700,
        padding: 16,
      }
    },
    tooltip: {
      backgroundColor: C.darkGreen,
      titleFont: { family: "'Inter', sans-serif", size: 12, weight: '600' },
      bodyFont:  { family: "'Inter', sans-serif", size: 12 },
      padding: 12,
      cornerRadius: 8,
      displayColors: true,
    }
  },
  scales: {
    x: {
      grid:  { color: 'rgba(26,64,49,0.06)' },
      ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: C.gray500 },
    },
    y: {
      grid:  { color: 'rgba(26,64,49,0.06)' },
      ticks: { font: { family: "'Inter', sans-serif", size: 11 }, color: C.gray500 },
    }
  }
};

// Merge deep-ish for chart configs
function mergeOpts(base, extra) {
  return JSON.parse(JSON.stringify({ ...base, ...extra,
    plugins: { ...base.plugins, ...(extra.plugins || {}) },
    scales:  { ...base.scales,  ...(extra.scales  || {}) },
  }));
}

// Animated counter
function animateCounter(el, target, suffix = '') {
  if (!el) return;
  let start = 0;
  const step = target / 60;
  const tick = () => {
    start += step;
    if (start >= target) { el.textContent = target.toLocaleString('fr-FR') + suffix; return; }
    el.textContent = Math.round(start).toLocaleString('fr-FR') + suffix;
    requestAnimationFrame(tick);
  };
  tick();
}

// ─── 5. GENDER SECTION ─────────────────────────────────────────────────────

// 5a. Regional gender bar chart — grouped Girls vs Boys
function buildRegionalGenderChart() {
  const canvas = $('chart-regional-gender');
  if (!canvas) return;
  const data = CHART_DATA.specializations.regional_breakdown;
  const year = CHART_DATA.specializations.year;

  const badge = $('spec-year-badge');
  if (badge) badge.textContent = year;

  const labels = data.map(d => d.region.length > 18 ? d.region.substring(0, 16) + '…' : d.region);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Girls',
          data: data.map(d => d.girls),
          backgroundColor: 'rgba(201,162,39,0.80)',
          borderColor: C.gold,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.85,
          categoryPercentage: 0.6,
        },
        {
          label: 'Boys',
          data: data.map(d => d.boys),
          backgroundColor: 'rgba(45,90,69,0.80)',
          borderColor: C.forest,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.85,
          categoryPercentage: 0.6,
        }
      ]
    },
    options: mergeOpts(chartDefaults, {
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, pointStyle: 'rectRounded', padding: 20 }
        },
        tooltip: {
          callbacks: {
            afterBody: (ctxArr) => {
              const d = data[ctxArr[0].dataIndex];
              return [`  → ${d.pct_girls.toFixed(1)}% girls  |  ${(100 - d.pct_girls).toFixed(1)}% boys`];
            }
          }
        }
      },
      scales: {
        y: {
          ticks: { callback: v => (v / 1000).toFixed(0) + 'k' },
          title: { display: true, text: 'Students enrolled', color: C.gray500, font: { size: 11 } }
        },
        x: { grid: { display: false } }
      }
    })
  });

  const minR = data.reduce((a, b) => a.pct_girls < b.pct_girls ? a : b);
  const maxR = data.reduce((a, b) => a.pct_girls > b.pct_girls ? a : b);
  const insight = $('insight-regional-gender');
  if (insight) insight.innerHTML = `
    Across all regions, boys outnumber girls in science specializations. The gap is starkest in 
    <strong>${minR.region}</strong> (only <strong>${minR.pct_girls}%</strong> girls) while overseas 
    territories like <strong>${maxR.region}</strong> show near-parity at <strong>${maxR.pct_girls}%</strong> — 
    yet these regions host the fewest CPGE programs, making the pipeline to engineering schools even narrower.
  `;
}

// 5b. Specialization breakdown — grouped Girls vs Boys
function buildSpecBreakdownChart() {
  const canvas = $('chart-spec-breakdown');
  if (!canvas) return;
  const raw = CHART_DATA.specializations.specialization_breakdown;
  // Sort by pct_girls ascending (most male-dominated first)
  const data = [...raw].sort((a, b) => a.pct_girls - b.pct_girls);

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.name),
      datasets: [
        {
          label: 'Girls',
          data: data.map(d => d.girls),
          backgroundColor: 'rgba(201,162,39,0.82)',
          borderColor: C.gold,
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.9,
          categoryPercentage: 0.65,
        },
        {
          label: 'Boys',
          data: data.map(d => d.boys),
          backgroundColor: 'rgba(45,90,69,0.80)',
          borderColor: C.forest,
          borderWidth: 1,
          borderRadius: 3,
          barPercentage: 0.9,
          categoryPercentage: 0.65,
        }
      ]
    },
    options: mergeOpts(chartDefaults, {
      indexAxis: 'y',
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { usePointStyle: true, pointStyle: 'rectRounded', padding: 20 }
        },
        tooltip: {
          callbacks: {
            afterBody: (ctxArr) => {
              const d = data[ctxArr[0].dataIndex];
              return [`  → ${d.pct_girls.toFixed(1)}% girls`];
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { callback: v => (v / 1000).toFixed(0) + 'k' },
          title: { display: true, text: 'Students enrolled', color: C.gray500, font: { size: 11 } }
        },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    })
  });

  const low  = data.filter(d => d.pct_girls < 20).map(d => d.name);
  const high = data.filter(d => d.pct_girls > 60).map(d => d.name);
  const insight = $('insight-spec-breakdown');
  if (insight) insight.innerHTML = `
    The engineering-track combinations — <strong>${low.join(', ')}</strong> — are the most male-dominated, 
    with fewer than <strong>20% girls</strong>. The side-by-side bars make the gap visceral: 
    boys towers are 5–8× taller than girls' in these key combinations. 
    Meanwhile, Biology-inclusive combos (${high[0] || 'Bio-Earth combos'}) attract a female majority 
    but are less likely to lead to top engineering schools — a structural self-selection trap.
  `;
}

// 5c. Parcoursup Funnel — Girls vs Overall
function buildFunnelGirls() {
  const funnel = CHART_DATA.parcoursup.funnel;
  const session = funnel.session;
  const badge = $('funnel-year-badge');
  if (badge) badge.textContent = `Session ${session}`;
  const sessionSpan = $('parcoursup-session-year');
  if (sessionSpan) sessionSpan.textContent = session;

  // Overall funnel
  const overallSteps = [
    { label: 'Candidates',   value: funnel.overall.total_candidates },
    { label: 'Ranked',       value: funnel.overall.candidates_ranked },
    { label: 'Offered',      value: funnel.overall.candidates_offered },
    { label: 'Admitted',     value: funnel.overall.candidates_admitted },
  ];

  // Girls funnel (we only have candidates + admitted)
  const girlsSteps = [
    { label: 'Candidates', value: funnel.girls.total_candidates },
    { label: 'Admitted',   value: funnel.girls.admitted },
  ];

  renderFunnelHTML('funnel-overall',  overallSteps, C.sage,    C.forest);
  renderFunnelHTML('funnel-girls',    girlsSteps,   C.gold,    C.darkGreen);

  const girlsPct = ((funnel.girls.admitted / funnel.overall.candidates_admitted) * 100).toFixed(1);
  const insight = $('insight-funnel-girls');
  if (insight) insight.innerHTML = `
    While girls represent <strong>${pct(funnel.girls.total_candidates, funnel.overall.total_candidates)}</strong> 
    of all CPGE candidates on Parcoursup (session ${session}), they account for only 
    <strong>${girlsPct}%</strong> of those ultimately admitted — a drop of 
    ${(funnel.girls.total_candidates/funnel.overall.total_candidates*100 - parseFloat(girlsPct)).toFixed(1)} percentage points. 
    The selective filter of scientific CPGEs disproportionately excludes women.
  `;
}

// 5d. Girls in CPGE Over Time (line chart)
function buildGirlsTimelineChart() {
  const canvas = $('chart-girls-timeline');
  if (!canvas) return;
  const data = CHART_DATA.cpge.scientific_timeline;

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map(d => d.year),
      datasets: [
        {
          label: 'Girls (Public)',
          data: data.map(d => d.girls_public),
          borderColor: C.gold,
          backgroundColor: 'rgba(201,162,39,0.12)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: C.gold,
          pointRadius: 4,
          pointHoverRadius: 7,
        },
        {
          label: 'Boys (Public)',
          data: data.map(d => d.boys_public),
          borderColor: C.forest,
          backgroundColor: 'rgba(45,90,69,0.10)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: C.forest,
          pointRadius: 4,
          pointHoverRadius: 7,
        }
      ]
    },
    options: mergeOpts(chartDefaults, {
      plugins: {
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('fr-FR')}` } }
      },
      scales: {
        y: { ticks: { callback: v => (v/1000).toFixed(0) + 'k' } }
      }
    })
  });

  const last = data[data.length - 1];
  const first = data[0];
  const ratioCur  = (last.total_girls / (last.total_girls + last.total_boys) * 100).toFixed(1);
  const ratioInit = (first.total_girls / (first.total_girls + first.total_boys) * 100).toFixed(1);
  const insight = $('insight-girls-timeline');
  if (insight) insight.innerHTML = `
    Over more than a decade, the female share in scientific CPGEs has barely moved: from 
    <strong>${ratioInit}%</strong> in ${first.year} to <strong>${ratioCur}%</strong> in ${last.year}. 
    Despite broader social progress on gender equality, scientific preparatory classes remain 
    a firmly male-dominated world, with the gap widening between girls enrolled in science tracks 
    at high school and those who persist into CPGE.
  `;
}

// ─── 6. ECONOMIC SECTION ───────────────────────────────────────────────────

// 6a. Scholarship by Department — D3 choropleth
async function buildBoursiersChoropleth() {
  const container = $('map-boursiers');
  if (!container) return;
  const badge = $('boursiers-year-badge');
  if (badge) badge.textContent = CHART_DATA.boursiers.year;

  const geo = FRANCE_GEOJSON;

  try {
    drawChoropleth(container, geo, CHART_DATA.boursiers.by_department,
      d => normalizeDeptCode(d.code), d => d.boursiers,
      'Scholarship students', d3.schemeGreens[7], 'boursiers');

    const sorted = [...CHART_DATA.boursiers.by_department].sort((a,b) => b.boursiers - a.boursiers);
    const top3 = sorted.slice(0,3).map(d => d.name).join(', ');
    const insight = $('insight-boursiers-dept');
    if (insight) insight.innerHTML = `
      Scholarship students are concentrated in major urban and overseas departments: 
      <strong>${top3}</strong> lead in absolute numbers. 
      Overseas territories show the highest proportion of students receiving maximum-level scholarships 
      (<em>dernier échelon</em>), reflecting severe economic precarity — yet these are the regions 
      with the fewest access points to scientific CPGE.
    `;
  } catch(e) {
    console.error('Choropleth drawing error (boursiers):', e);
    container.innerHTML = '<p class="map-error">Map rendering error — check browser console for details.</p>';
  }
}

// 6b. Public vs Private sector
function buildSectorChart() {
  const canvas = $('chart-sector');
  if (!canvas) return;
  const data = CHART_DATA.boursiers.by_sector;

  new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.sector),
      datasets: [{
        data: data.map(d => d.boursiers),
        backgroundColor: [C.sage, C.darkGreen],
        borderColor: [C.white, C.white],
        borderWidth: 3,
        hoverOffset: 12,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: "'Inter', sans-serif", size: 12 }, color: C.gray700, padding: 20 }
        },
        tooltip: {
          backgroundColor: C.darkGreen,
          bodyFont: { family: "'Inter', sans-serif" },
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed.toLocaleString('fr-FR')} scholarship students`
          }
        }
      }
    }
  });

  const pub  = data.find(d => d.sector === 'Public');
  const priv = data.find(d => d.sector === 'Privé');
  const total = pub.boursiers + priv.boursiers;
  const insight = $('insight-sector');
  if (insight) insight.innerHTML = `
    Public schools educate <strong>${pct(pub.boursiers, total)}</strong> of all scholarship students, 
    while the private sector — which hosts some of the most prestigious CPGE classes — accounts for 
    only <strong>${pct(priv.boursiers, total)}</strong> of scholarship recipients. 
    This structural gap means the students who need support most are systematically 
    underrepresented in the schools that lead to the top engineering schools.
  `;
}

// 6c. Parcoursup Funnel — Scholarship vs Overall
function buildFunnelScholarship() {
  const funnel = CHART_DATA.parcoursup.funnel;

  const overallSteps = [
    { label: 'Candidates',   value: funnel.overall.total_candidates },
    { label: 'Ranked',       value: funnel.overall.candidates_ranked },
    { label: 'Offered',      value: funnel.overall.candidates_offered },
    { label: 'Admitted',     value: funnel.overall.candidates_admitted },
  ];
  const scholarSteps = [
    { label: 'Candidates', value: funnel.scholarship.total_candidates },
    { label: 'Admitted',   value: funnel.scholarship.admitted },
  ];

  renderFunnelHTML('funnel-overall-2', overallSteps, C.sage, C.forest);
  renderFunnelHTML('funnel-scholarship', scholarSteps, C.scholar, C.darkGreen);

  const scholarPct = pct(funnel.scholarship.admitted, funnel.overall.candidates_admitted);
  const candidatePct = pct(funnel.scholarship.total_candidates, funnel.overall.total_candidates);
  const insight = $('insight-funnel-scholarship');
  if (insight) insight.innerHTML = `
    Scholarship students make up <strong>${candidatePct}</strong> of all Parcoursup CPGE candidates 
    but represent <strong>${scholarPct}</strong> of those admitted. 
    Remarkably, their admission rate (${funnel.scholarship.admission_rate}%) is slightly above the 
    overall rate (${funnel.overall_admission_rate}%) — suggesting that those who apply despite financial 
    barriers are highly motivated, yet the total numbers remain low, indicating a massive drop-out 
    of scholarship students before they even reach the application stage.
  `;
}

// 6d. Scatter: admission rate vs scholarship %
function buildScatterChart() {
  const canvas = $('chart-scatter');
  if (!canvas) return;
  const raw = CHART_DATA.parcoursup.scatter.filter(d => d.scholarship_pct > 0 && d.admission_rate > 0);

  // Same harmonious palette as the dot map
  const programColors = {
    MPSI:         '#1a5c4a',
    'MPSI/MP2I':  '#7b68c8',
    PCSI:         '#4a7fa5',
    BCPST:        '#6aaa8e',
    PTSI:         '#c9a227',
    TSI:          '#d4956a',
    ECG:          '#d46a6a',
    Lettres:      '#a56ad4',
    Other:        '#909090',
  };
  const getColor = prog => programColors[prog] || '#909090';

  // One dataset per program → Chart.js renders a proper legend entry per program
  const programs = [...new Set(raw.map(d => d.program))].sort();

  const datasets = programs.map(prog => {
    const pts = raw.filter(d => d.program === prog);
    const col = getColor(prog);
    return {
      label: prog,
      data: pts.map(d => ({ x: d.scholarship_pct, y: d.admission_rate, _d: d })),
      backgroundColor: col + 'aa',
      borderColor:     col,
      borderWidth: 1.5,
      pointRadius: 7,
      pointHoverRadius: 10,
    };
  });

  new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: mergeOpts(chartDefaults, {
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 16,
            font: { size: 11 },
          }
        },
        tooltip: {
          callbacks: {
            title: ctx => {
              const d = ctx[0].raw._d;
              return d ? d.institution : '';
            },
            label: ctx => {
              const d = ctx.raw._d;
              if (!d) return '';
              return [
                ` Program: ${d.program}`,
                ` Admission rate: ${d.admission_rate}%`,
                ` Scholarship students: ${d.scholarship_pct}%`,
                ` Dept: ${d.department}`,
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '% Scholarship students', font: { size: 12 }, color: C.gray700 },
          ticks: { callback: v => v + '%' },
        },
        y: {
          title: { display: true, text: 'Admission rate (%)', font: { size: 12 }, color: C.gray700 },
          ticks: { callback: v => v + '%' },
        }
      }
    })
  });

  const allX = raw.map(d => d.scholarship_pct);
  const allY = raw.map(d => d.admission_rate);
  const corr = pearsonCorrelation(allX, allY);
  const insight = $('insight-scatter');
  if (insight) insight.innerHTML = `
    The scatter plot reveals a weak but consistent pattern: CPGE programs with higher shares of 
    scholarship students tend to have higher admission rates — meaning <em>less</em> selectivity, 
    not more. The most prestigious, oversubscribed programs cluster in the bottom-left quadrant: 
    <strong>high selectivity, low scholarship representation</strong>. 
    Each color represents a program type — hover any dot for full institution details. 
    (r ≈ ${corr.toFixed(2)})
  `;
}

// ─── 7. TERRITORIAL SECTION ────────────────────────────────────────────────

// 7a. IPS Choropleth by Department
async function buildIPSChoropleth() {
  const container = $('map-ips');
  if (!container) return;
  const badge = $('ips-year-badge');
  if (badge) badge.textContent = CHART_DATA.ips.year;

  const geo = FRANCE_GEOJSON;

  try {
    drawChoropleth(container, geo, CHART_DATA.ips.by_department,
      d => normalizeDeptCode(d.code), d => d.avg_ips,
      'Average IPS', d3.schemeGreens[7], 'ips', true);

    const sorted = [...CHART_DATA.ips.by_department].sort((a,b) => a.avg_ips - b.avg_ips);
    const low3 = sorted.slice(0,3).map(d => d.name).join(', ');
    const high = sorted[sorted.length - 1];
    const insight = $('insight-ips');
    if (insight) insight.innerHTML = `
      The Social Position Index (IPS) reveals stark territorial inequality in France's high schools. 
      <strong>${low3}</strong> record the lowest IPS scores, reflecting the most economically 
      disadvantaged school populations. Meanwhile, <strong>${high.name}</strong> tops the ranking 
      at ${high.avg_ips} — with its elite lycées feeding directly 
      into the most competitive CPGE preparatory programs.
    `;
  } catch(e) {
    console.error('Choropleth drawing error (IPS):', e);
    container.innerHTML = '<p class="map-error">Map rendering error — check browser console for details.</p>';
  }
}

// 7b. CPGE Geographic Distribution (D3 dot map)
async function buildCPGEGeoMap() {
  const container = $('map-cpge');
  if (!container) return;

  const geo = FRANCE_GEOJSON;

  try {
    drawDotMap(container, geo, CHART_DATA.parcoursup.geo_cpge);

    const total = CHART_DATA.parcoursup.geo_cpge.length;
    const byProg = {};
    CHART_DATA.parcoursup.geo_cpge.forEach(d => {
      byProg[d.program] = (byProg[d.program] || 0) + 1;
    });
    const topProg = Object.entries(byProg).sort((a,b) => b[1]-a[1])[0];
    const insight = $('insight-cpge-geo');
    if (insight) insight.innerHTML = `
      Scientific CPGE programs (<strong>${total} programs mapped</strong>) are heavily concentrated 
      in Paris and a handful of regional metropolises. The most common type is <strong>${topProg[0]}</strong> 
      (${topProg[1]} programs). Students from rural departments or overseas territories face a 
      geographic lottery: the nearest CPGE may be hundreds of kilometers away, 
      making relocation — and its financial burden — a prerequisite for access.
    `;
  } catch(e) {
    console.error('Dot map drawing error (CPGE geo):', e);
    container.innerHTML = '<p class="map-error">Map rendering error — check browser console for details.</p>';
  }
}

// 7c. IPS by Region bar chart
function buildIPSRegionChart() {
  const canvas = $('chart-ips-bars');
  if (!canvas) return;
  const data = [...CHART_DATA.ips.by_region].sort((a, b) => a.avg_ips - b.avg_ips);

  const globalAvg = data.reduce((s, d) => s + d.avg_ips, 0) / data.length;

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.region.length > 22 ? d.region.substring(0,20) + '…' : d.region),
      datasets: [{
        label: 'Average IPS',
        data: data.map(d => d.avg_ips),
        backgroundColor: data.map(d => d.avg_ips < globalAvg
          ? 'rgba(224,123,57,0.75)' : 'rgba(45,90,69,0.75)'),
        borderColor: data.map(d => d.avg_ips < globalAvg ? C.scholar : C.forest),
        borderWidth: 1.5,
        borderRadius: 5,
        barPercentage: 0.7,
      }]
    },
    options: mergeOpts(chartDefaults, {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` IPS: ${ctx.parsed.x.toFixed(1)} (${ctx.parsed.x < globalAvg ? 'below' : 'above'} national avg)`,
            afterLabel: ctx => ` Based on ${data[ctx.dataIndex].count} high schools`,
          }
        }
      },
      scales: {
        x: {
          min: 60, ticks: { callback: v => v.toFixed(0) },
          title: { display: true, text: 'Social Position Index (IPS)', color: C.gray500, font: { size: 11 } }
        },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      }
    })
  });

  const low  = data[0];
  const high = data[data.length - 1];
  const insight = $('insight-ips-region');
  if (insight) insight.innerHTML = `
    The gap between <strong>${low.region}</strong> (IPS: ${low.avg_ips}) and 
    <strong>${high.region}</strong> (IPS: ${high.avg_ips}) is 
    <strong>${(high.avg_ips - low.avg_ips).toFixed(1)} points</strong> — 
    a chasm that directly correlates with CPGE access. Île-de-France's outsized IPS reflects 
    the concentration of affluent families in its high schools, which also happen to host the 
    country's most selective preparatory classes. Orange bars indicate regions where the average 
    IPS falls below the national mean (${globalAvg.toFixed(1)}).
  `;
}

// ─── 8. SHARED: FUNNEL HTML RENDERER ───────────────────────────────────────
function renderFunnelHTML(containerId, steps, fillColor, textColor) {
  const el = $(containerId);
  if (!el) return;
  const maxVal = steps[0].value;
  el.innerHTML = '';
  steps.forEach((step, i) => {
    const pctWidth = Math.max(((step.value / maxVal) * 100), 15).toFixed(1);
    const row = document.createElement('div');
    row.className = 'funnel-step';
    row.style.cssText = `
      display:flex; align-items:center; gap:12px; margin-bottom:8px; width:100%;
    `;
    const bar = document.createElement('div');
    bar.style.cssText = `
      height:38px; width:${pctWidth}%; background:${fillColor};
      border-radius:4px; display:flex; align-items:center; justify-content:flex-end;
      padding-right:10px; transition:width 1.2s cubic-bezier(0.16,1,0.3,1);
      opacity:${1 - i * 0.1};
    `;
    bar.innerHTML = `<span style="color:${textColor === C.darkGreen ? '#fff' : '#fff'};font-size:11px;font-weight:600;font-family:'Inter',sans-serif;white-space:nowrap">${step.value.toLocaleString('fr-FR')}</span>`;

    const label = document.createElement('div');
    label.style.cssText = `font-size:12px;color:${C.gray700};font-family:'Inter',sans-serif;min-width:80px;`;
    label.textContent = step.label;

    row.appendChild(bar);
    row.appendChild(label);
    el.appendChild(row);

    if (i < steps.length - 1) {
      const pctDrop = ((1 - steps[i+1].value / step.value) * 100).toFixed(0);
      const arrow = document.createElement('div');
      arrow.style.cssText = `text-align:center;font-size:10px;color:${C.scholar};font-family:'Inter',sans-serif;margin-bottom:2px;`;
      arrow.textContent = `▼ −${pctDrop}%`;
      el.appendChild(arrow);
    }
  });
  // Animate bars with a slight delay
  setTimeout(() => {
    el.querySelectorAll('div > div').forEach(bar => {
      bar.style.opacity = '1';
    });
  }, 200);
}

// ─── 9. D3 CHOROPLETH ──────────────────────────────────────────────────────

// Pure-JS color interpolator: no d3.scale dependency for colors
function interpolateGreen(t) {
  // from #e8f0e6 (light sage) → #1a4031 (dark green)
  const t2 = Math.max(0, Math.min(1, t));
  const r = Math.round(0xe8 + t2 * (0x1a - 0xe8));
  const g = Math.round(0xf0 + t2 * (0x40 - 0xf0));
  const b = Math.round(0xe6 + t2 * (0x31 - 0xe6));
  return `rgb(${r},${g},${b})`;
}

function drawChoropleth(container, geo, dataset, codeAccessor, valueAccessor, label, _palette, id, isIPS=false) {
  container.innerHTML = '';
  const W = container.offsetWidth  || 700;
  const H = container.offsetHeight || 460;

  // Build lookup: normalized code → value
  const lookup = {};
  dataset.forEach(d => {
    const code = codeAccessor(d);
    lookup[code] = valueAccessor(d);
  });

  const vals = dataset.map(valueAccessor).filter(v => v != null && !isNaN(v));
  const vMin = Math.min.apply(null, vals);
  const vMax = Math.max.apply(null, vals);
  const vRange = vMax - vMin || 1;

  const colorScale = v => interpolateGreen((v - vMin) / vRange);

  const svg = d3.select(container)
    .append('svg')
    .attr('width', W)
    .attr('height', H)
    .style('font-family', "'Inter', sans-serif");

  const projection = d3.geoConicConformal()
    .center([2.454071, 46.279229])
    .scale(W * 2.5)
    .translate([W * 0.44, H * 0.55]);

  const path = d3.geoPath().projection(projection);

  // Tooltip
  const tooltip = $('d3-tooltip');

  // Helper: resolve code from GeoJSON feature props → lookup value
  function resolveValue(props) {
    const code = props.code || props.CODE_DEPT || props.dep || props.insee || props.num_dep;
    if (!code) return { code: null, v: undefined };
    // Try exact, then numeric-string, then zero-padded
    let v = lookup[code];
    if (v == null) v = lookup[String(Number(code))];
    if (v == null) v = lookup['0' + code];
    return { code, v };
  }

  svg.selectAll('path')
    .data(geo.features)
    .join('path')
    .attr('d', path)
    .attr('fill', d => {
      const { v } = resolveValue(d.properties);
      return v != null ? colorScale(v) : '#e2e8e0';
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5)
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => {
      const { code, v } = resolveValue(d.properties);
      const name = d.properties.nom || d.properties.NOM_DEPT || d.properties.libelle || code || '?';
      if (tooltip) {
        tooltip.style.opacity = '1';
        tooltip.style.left = (event.pageX + 14) + 'px';
        tooltip.style.top  = (event.pageY - 28) + 'px';
        tooltip.innerHTML = `<strong>${name}</strong><br>${label}: ${
          v != null ? (isIPS ? v.toFixed(1) : v.toLocaleString('fr-FR')) : 'N/A'
        }`;
      }
    })
    .on('mouseleave', () => { if (tooltip) tooltip.style.opacity = '0'; });

  // Legend
  const legendW = 140, legendH = 10;
  const lx = W - legendW - 16, ly = H - 36;
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', `grad-${id}`);
  grad.append('stop').attr('offset', '0%').attr('stop-color', '#e8f0e6');
  grad.append('stop').attr('offset', '100%').attr('stop-color', '#1a4031');

  svg.append('rect').attr('x', lx).attr('y', ly)
     .attr('width', legendW).attr('height', legendH)
     .attr('rx', 3).attr('fill', `url(#grad-${id})`);

  const fmtLegend = v => isIPS ? Math.round(v).toString() : (v >= 1000 ? Math.round(v/1000)+'k' : Math.round(v).toString());
  svg.append('text').attr('x', lx).attr('y', ly - 4)
     .text(fmtLegend(vMin))
     .attr('font-size', 9).attr('fill', C.gray500);
  svg.append('text').attr('x', lx + legendW).attr('y', ly - 4)
     .text(fmtLegend(vMax))
     .attr('font-size', 9).attr('fill', C.gray500).attr('text-anchor', 'end');
}

// ─── 10. D3 DOT MAP for CPGE programs ──────────────────────────────────────
function drawDotMap(container, geo, geoData) {
  container.innerHTML = '';
  const W = container.offsetWidth  || 600;
  const H = container.offsetHeight || 420;

  // Harmonious palette — no aggressive red, spread across hue wheel
  const programColors = {
    MPSI:       '#1a5c4a',  // deep teal
    PCSI:       '#4a7fa5',  // slate blue
    BCPST:      '#6aaa8e',  // sage green
    PTSI:       '#c9a227',  // warm gold
    TSI:        '#d4956a',  // soft amber
    'MPSI/MP2I':'#7b68c8',  // muted violet (if present)
  };
  const getColor = prog => programColors[prog] || '#909090';

  // Ordered list so legend is deterministic
  const programOrder = ['MPSI', 'PCSI', 'BCPST', 'PTSI', 'TSI', 'MPSI/MP2I'];
  const presentPrograms = programOrder.filter(p => geoData.some(d => d.program === p));

  const projection = d3.geoConicConformal()
    .center([2.454071, 46.279229])
    .scale(W * 2.5)
    .translate([W * 0.44, H * 0.55]);

  const path = d3.geoPath().projection(projection);
  const tooltip = $('d3-tooltip');

  const svg = d3.select(container)
    .append('svg').attr('width', W).attr('height', H)
    .style('font-family', "'Inter', sans-serif");

  // Base map
  svg.selectAll('path')
    .data(geo.features)
    .join('path')
    .attr('d', path)
    .attr('fill', '#e8f0e6')
    .attr('stroke', '#fff')
    .attr('stroke-width', 0.5);

  // Draw dots — less frequent programs on top for visibility
  const sorted = [...geoData].sort((a, b) =>
    programOrder.indexOf(b.program) - programOrder.indexOf(a.program)
  );

  svg.selectAll('circle')
    .data(sorted)
    .join('circle')
    .attr('cx', d => projection([d.lon, d.lat])[0])
    .attr('cy', d => projection([d.lon, d.lat])[1])
    .attr('r',  d => Math.max(3, Math.sqrt(d.admitted || 30) * 0.75))
    .attr('fill',         d => getColor(d.program) + 'bb')
    .attr('stroke',       d => getColor(d.program))
    .attr('stroke-width', 0.8)
    .style('cursor', 'pointer')
    .on('mousemove', (event, d) => {
      if (tooltip) {
        tooltip.style.opacity = '1';
        tooltip.style.left = (event.pageX + 14) + 'px';
        tooltip.style.top  = (event.pageY - 28) + 'px';
        tooltip.innerHTML  = `<strong>${d.institution}</strong><br>${d.program} · ${d.commune}<br>Admitted: ${d.admitted}`;
      }
    })
    .on('mouseleave', () => { if (tooltip) tooltip.style.opacity = '0'; });

  // Legend — white pill background for readability
  const lx = 12, ly = H - presentPrograms.length * 22 - 16;
  svg.append('rect')
     .attr('x', lx - 6).attr('y', ly - 14)
     .attr('width', 120).attr('height', presentPrograms.length * 22 + 10)
     .attr('rx', 6).attr('fill', 'rgba(255,255,255,0.88)');

  presentPrograms.forEach((p, i) => {
    svg.append('circle')
       .attr('cx', lx + 6).attr('cy', ly + i * 22)
       .attr('r', 5).attr('fill', getColor(p)).attr('stroke', getColor(p)).attr('stroke-width', 1);
    svg.append('text')
       .attr('x', lx + 18).attr('y', ly + i * 22 + 4)
       .text(p).attr('font-size', 11).attr('fill', '#2d3a2e').attr('font-weight', '500');
  });
}

// ─── 11. PEARSON CORRELATION ───────────────────────────────────────────────
function pearsonCorrelation(x, y) {
  const n = x.length;
  const mx = x.reduce((a,b)=>a+b,0)/n;
  const my = y.reduce((a,b)=>a+b,0)/n;
  const num = x.reduce((s,xi,i) => s + (xi-mx)*(y[i]-my), 0);
  const den = Math.sqrt(x.reduce((s,xi)=>s+(xi-mx)**2,0) * y.reduce((s,yi)=>s+(yi-my)**2,0));
  return den ? num/den : 0;
}

// ─── 12. CONCLUSION COUNTERS ───────────────────────────────────────────────
function initConclusionStats() {
  const funnel = CHART_DATA.parcoursup.funnel;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter($('stat-candidates'), funnel.overall.total_candidates);
        animateCounter($('stat-admitted'),   funnel.overall.candidates_admitted);
        const girlsPct = +((funnel.girls.admitted / funnel.overall.candidates_admitted)*100).toFixed(1);
        animateCounter($('stat-girls-pct'), girlsPct, '%');
        observer.disconnect();
      }
    });
  }, { threshold: 0.4 });

  const conclusion = document.querySelector('.conclusion-section');
  if (conclusion) observer.observe(conclusion);
}

// ─── 13. CHART-ON-SCROLL (Intersection Observer) ───────────────────────────
function initChartOnScroll() {
  const chartBlocks = document.querySelectorAll('.chart-block');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  chartBlocks.forEach(block => {
    block.style.opacity = '0';
    block.style.transform = 'translateY(32px)';
    block.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    observer.observe(block);
  });
}

// ─── 14. BACK TO MAP SMOOTH ─────────────────────────────────────────────────
function initBackToMap() {
  document.querySelectorAll('.back-to-map').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const map = $('medusa-map');
      if (map) map.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

// ─── 15. NAV HIGHLIGHTING ──────────────────────────────────────────────────
function initSectionHighlight() {
  const sections = ['gender-section', 'economic-section', 'territorial-section'];
  const nodes    = ['node-gender',    'node-economic',    'node-territorial'];

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const idx = sections.indexOf(entry.target.id);
      if (idx < 0) return;
      const node = $(nodes[idx]);
      if (node) node.classList.toggle('node--highlight', entry.isIntersecting);
    });
  }, { threshold: 0.3 });

  sections.forEach(id => {
    const el = $(id);
    if (el) observer.observe(el);
  });
}

// ─── 16. BOOTSTRAP ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Immediate UI
  initParticles();
  initScrollReveal();
  initMedusaMap();
  initChartOnScroll();
  initBackToMap();
  initSectionHighlight();
  initConclusionStats();

  // Gender charts
  buildRegionalGenderChart();
  buildSpecBreakdownChart();
  buildFunnelGirls();
  buildGirlsTimelineChart();

  // Economic charts
  buildSectorChart();
  buildFunnelScholarship();
  buildScatterChart();

  // IPS region chart (no async needed)
  buildIPSRegionChart();

  // Async D3 maps (require france.json fetch)
  await Promise.allSettled([
    buildBoursiersChoropleth(),
    buildIPSChoropleth(),
    buildCPGEGeoMap(),
  ]);

  console.log('✅ EquiLearn app fully initialized');
});

/* ─── EXTRA: node--active & node--highlight styles injected at runtime ─── */
(function injectNodeStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .node--active  { animation: nodeFlash 0.6s ease; }
    .node--highlight .node-pulse { background: radial-gradient(circle, var(--gold) 0%, var(--forest-green) 60%, transparent 70%); }
    @keyframes nodeFlash { 0%,100%{transform:translate(-50%,-50%) scale(1)} 40%{transform:translate(-50%,-50%) scale(1.22)} }
    #node-gender:hover   { transform: translate(-50%,-50%) scale(1.1) !important; }
    #node-economic:hover { transform: translate(-50%,-50%) scale(1.1) !important; }
    #node-territorial:hover { transform: translate(-50%,-50%) scale(1.1) !important; }
    .map-error { padding: 2rem; color: var(--gray-500); text-align:center; font-size:0.85rem; }
  `;
  document.head.appendChild(s);
})();
