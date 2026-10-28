import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';

import { initIcons } from './icons.js';
import { initCharts, setMapMode } from './charts.js';
import { initSimulator } from './simulator.js';

let summaryData = null;
let provinsiData = [];
let modelMetrics = [];

async function loadData() {
  try {
    const [sumResp, provResp, metResp] = await Promise.all([
      fetch('./data/summary.json'),
      fetch('./data/provinsi.json'),
      fetch('./data/model_metrics.json')
    ]);

    summaryData = await sumResp.json();
    provinsiData = await provResp.json();
    modelMetrics = await metResp.json();

    // Inisialisasi komponen UI utama
    populateHeroStats(summaryData);
    populateModelComparison(modelMetrics, summaryData);
    populateProvinceDetail(provinsiData[0]); // default provinsi pertama (Aceh)
    
    // Inisialisasi simulator jika elemen slider tersedia di halaman
    if (document.getElementById('rlsSlider')) {
      initSimulator(provinsiData);
    }
    initMapControls();
    initFAQ();
    initMobileNav();
    initIcons();

    // Muat grafik saat pengguna menggulir mendekati seksi Temuan (IntersectionObserver)
    const chartTrigger = document.getElementById('temuan');
    let chartInitialized = false;
    const triggerInit = () => {
      if (!chartInitialized) {
        chartInitialized = true;
        initCharts(provinsiData, summaryData);
      }
    };

    if ('IntersectionObserver' in window && chartTrigger) {
      const observer = new IntersectionObserver((entries) => {
        if (entries.some(e => e.isIntersecting)) {
          triggerInit();
          observer.disconnect();
        }
      }, { rootMargin: '600px' });
      observer.observe(chartTrigger);
    }
    // Fallback: inisialisasi di background setelah interaksi awal stabil
    setTimeout(triggerInit, 1200);
  } catch (err) {
    console.error('Gagal memuat data aplikasi:', err);
  }
}

function populateHeroStats(summary) {
  const rElem = document.getElementById('heroStatCorrelation');
  const provElem = document.getElementById('heroStatProvinces');
  const r2Elem = document.getElementById('heroStatR2');

  if (rElem) rElem.textContent = summary.korelasi.pearson.koefisien.toFixed(2);
  if (provElem) provElem.textContent = summary.jumlah_provinsi.toString();
  if (r2Elem) r2Elem.textContent = `${(summary.model_terpilih.r2_score * 100).toFixed(1)}%`;
}

function populateModelComparison(metrics, summary) {
  const container = document.getElementById('modelsGridContainer');
  if (container) {
    // Tampilkan 4 kartu sorotan utama dari 16 percobaan (Peringkat 1 & 2 Maret, Peringkat 1 September, dan sampel Random Forest)
    const featuredIndices = [0, 1, 8, 2];
    const cardsData = featuredIndices.map(i => metrics[i]).filter(Boolean);

    container.innerHTML = cardsData.map((m, idx) => {
      const isBest = idx === 0;
      const isLinear = m.Model.includes('Linear');
      return `
        <div class="card model-card ${isBest ? 'featured' : ''}">
          ${isBest ? '<div class="model-badge-top">Terbaik (Percobaan #1)</div>' : ''}
          <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: ${m.Periode === 'Maret' ? '#1A6ED8' : '#B45309'}; margin-bottom: 4px;">
            Percobaan #${m.No} • Periode ${m.Periode}
          </div>
          <h3 class="model-name" style="margin-bottom: 4px;">${m.Model}</h3>
          <div style="font-size: 12px; color: #53647D; font-weight: 600; margin-bottom: 14px;">
            Fitur: <strong>${m.Fitur}</strong>
          </div>
          <ul class="model-metrics-list">
            <li class="metric-item">
              <span class="name">Test R²</span>
              <span class="value tabular-nums">${m['Test R²'].toFixed(4)}</span>
            </li>
            <li class="metric-item">
              <span class="name">Test MAE</span>
              <span class="value tabular-nums">${m.MAE.toFixed(4)}</span>
            </li>
            <li class="metric-item">
              <span class="name">Test RMSE</span>
              <span class="value tabular-nums">${m.RMSE.toFixed(4)}</span>
            </li>
            <li class="metric-item">
              <span class="name">Train R²</span>
              <span class="value tabular-nums">${m['Train R²'].toFixed(4)}</span>
            </li>
          </ul>
          <div style="font-size: 12px; color: ${isLinear ? '#0E52A0' : '#C5221F'}; font-weight: 600;">
            ${isLinear ? '✓ ' + m.Status : '⚠️ ' + m.Status}
          </div>
        </div>
      `;
    }).join('');
  }

  // Isi Tabel Lengkap 16 Kali Percobaan
  const tbody = document.getElementById('experimentsTableBody');
  const filterBtns = document.querySelectorAll('.exp-filter-btn');
  if (!tbody) return;

  function renderExperimentRows(filterPeriode) {
    const list = filterPeriode === 'all'
      ? metrics
      : metrics.filter(m => m.Periode === filterPeriode);

    tbody.innerHTML = list.map(m => {
      const isLinear = m.Model.includes('Linear');
      const isTopRow = m.No === 1 || m.No === 9;
      return `
        <tr style="${isTopRow ? 'background: #F2F7FF;' : ''}">
          <td class="tabular-nums" style="text-align: center; font-weight: 800; color: #0B1B33;">${m.No}</td>
          <td>
            <span class="badge ${m.Periode === 'Maret' ? 'green' : 'amber'}" style="font-size: 11px; padding: 3px 10px;">
              ${m.Periode}
            </span>
          </td>
          <td>
            <strong style="color: ${isLinear ? '#0E52A0' : '#3B4858'};">${m.Model}</strong>
          </td>
          <td><strong>${m.Fitur}</strong></td>
          <td class="tabular-nums" style="text-align: right; font-weight: 600;">${m['Train R²'].toFixed(4)}</td>
          <td class="tabular-nums" style="text-align: right; font-weight: 700; color: ${m['Test R²'] > -0.5 ? '#0E52A0' : '#C5221F'};">${m['Test R²'].toFixed(4)}</td>
          <td class="tabular-nums" style="text-align: right;">${m.MAE.toFixed(4)}</td>
          <td class="tabular-nums" style="text-align: right;">${m.MSE.toFixed(4)}</td>
          <td class="tabular-nums" style="text-align: right; font-weight: 600;">${m.RMSE.toFixed(4)}</td>
          <td>
            <span class="badge ${isTopRow ? 'green' : (isLinear ? 'amber' : 'red')}" style="font-size: 11px; padding: 2px 8px;">
              ${m.Status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderExperimentRows('all');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderExperimentRows(btn.dataset.periode);
    });
  });
}

function populateProvinceDetail(prov) {
  const title = document.getElementById('detailProvTitle');
  const rls = document.getElementById('detailProvRLS');
  const pov = document.getElementById('detailProvKemiskinan');
  const cluster = document.getElementById('detailProvCluster');
  const diff = document.getElementById('detailProvDiff');

  if (title) title.textContent = prov.nama;
  if (rls) rls.textContent = `${prov.latest_rls} th`;
  if (pov) pov.textContent = `${prov.latest_kemiskinan}%`;
  if (cluster) cluster.textContent = prov.cluster_name;
  
  // Hitung selisih dari rata-rata nasional (10.09% di 2023)
  const natAvg = 10.089;
  const selisih = prov.latest_kemiskinan - natAvg;
  if (diff) {
    diff.textContent = `${selisih > 0 ? '+' : ''}${selisih.toFixed(2)}% poin dari rata-rata nasional`;
    diff.style.color = selisih > 0 ? 'var(--color-danger-red)' : 'var(--color-success-green)';
  }
}

function initMapControls() {
  const buttons = document.querySelectorAll('.pill-btn[data-mode]');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.mode;
      setMapMode(mode);
    });
  });

  window.addEventListener('province-selected', (e) => {
    populateProvinceDetail(e.detail);
  });
}

function initFAQ() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      
      // Tutup semua
      items.forEach(i => {
        i.classList.remove('open');
        const a = i.querySelector('.faq-answer');
        if (a) a.style.maxHeight = null;
        i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      // Buka yang diklik
      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        question.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

function initMobileNav() {
  const toggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
}

// Jalankan aplikasi saat DOM siap
document.addEventListener('DOMContentLoaded', loadData);
