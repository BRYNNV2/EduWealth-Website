import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components.css';

import { initIcons } from './icons.js';
import { predict } from '../model.js';

let provincesList = [];
let summaryData = null;

async function loadSimulatorData() {
  try {
    const [sumResp, provResp] = await Promise.all([
      fetch('./data/summary.json'),
      fetch('./data/provinsi.json')
    ]);

    summaryData = await sumResp.json();
    provincesList = await provResp.json();

    initSimulatorControls();
    populateProvincesTable();
    initMobileNav();
    initIcons();
  } catch (err) {
    console.error('Gagal memuat data simulator:', err);
  }
}

function initSimulatorControls() {
  const slider = document.getElementById('rlsSlider');
  const rlsDisplay = document.getElementById('rlsValueDisplay');
  const predNumber = document.getElementById('predictionValue');
  const predBadge = document.getElementById('predictionBadge');
  const ciLowerElem = document.getElementById('ciLower');
  const ciUpperElem = document.getElementById('ciUpper');
  const extrapWarning = document.getElementById('extrapolationWarning');

  // Populate Dropdown What-If
  const provSelect = document.getElementById('whatIfProvinceSelect');
  const deltaSelect = document.getElementById('whatIfDeltaSelect');

  if (provSelect) {
    provSelect.innerHTML = provincesList.map(p => 
      `<option value="${p.nama}">${p.nama} (RLS: ${p.latest_rls} thn, Miskin: ${p.latest_kemiskinan}%)</option>`
    ).join('');

    provSelect.addEventListener('change', updateWhatIf);
  }

  if (deltaSelect) {
    deltaSelect.addEventListener('change', updateWhatIf);
  }

  // Preset Buttons
  const presetButtons = document.querySelectorAll('.preset-btn');
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetVal = parseFloat(btn.dataset.rls);
      if (slider) {
        slider.value = targetVal;
        updatePrediction(targetVal);
      }
    });
  });

  // Slider Event Listener
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      // Hapus preset aktif jika digeser manual
      presetButtons.forEach(b => b.classList.remove('active'));
      updatePrediction(val);
    });

    // Inisialisasi awal pada rata-rata nasional (8.54 th)
    updatePrediction(parseFloat(slider.value));
  }

  function updatePrediction(rlsVal) {
    if (rlsDisplay) rlsDisplay.textContent = `${rlsVal.toFixed(1)} th`;
    
    // Panggil model.js (hasil konversi m2cgen)
    const pred = predict(rlsVal);
    if (predNumber) predNumber.textContent = `${pred.toFixed(2)}%`;

    // Klasifikasi Kategori Badge
    if (predBadge) {
      predBadge.className = 'prediction-badge';
      if (pred < 8.0) {
        predBadge.classList.add('low');
        predBadge.textContent = 'Kategori: Rendah (< 8.0%)';
      } else if (pred <= 14.0) {
        predBadge.classList.add('mid');
        predBadge.textContent = 'Kategori: Moderat (8.0% – 14.0%)';
      } else {
        predBadge.classList.add('high');
        predBadge.textContent = 'Kategori: Tinggi (> 14.0%)';
      }
    }

    // Interval Keyakinan 95% (Estimasi standar error regresi se = ~4.12, t*se/sqrt(N) margin)
    // Untuk prediksi individual titik baru, interval prediksi adalah ~ ± 1.96 * RMSE (RMSE test = 4.14%)
    const marginError = 1.96 * 0.45; // Interval kepercayaan rata-rata populasi (~0.88%)
    const lowerBound = Math.max(0, pred - marginError);
    const upperBound = pred + marginError;

    if (ciLowerElem) ciLowerElem.textContent = `${lowerBound.toFixed(2)}%`;
    if (ciUpperElem) ciUpperElem.textContent = `${upperBound.toFixed(2)}%`;

    // Peringatan Ekstrapolasi
    if (extrapWarning) {
      if (rlsVal < 5.9 || rlsVal > 11.5) {
        extrapWarning.style.display = 'block';
        extrapWarning.innerHTML = `⚠️ <strong>Peringatan Ekstrapolasi:</strong> Nilai RLS (${rlsVal.toFixed(1)} th) berada di luar rentang data empiris BPS (5.93 – 11.46 tahun). Model OLS bersifat linier tak terbatas, namun di luar batas empiris estimasi memiliki ketidakpastian statistik tinggi.`;
      } else {
        extrapWarning.style.display = 'none';
      }
    }
  }

  function updateWhatIf() {
    if (!provSelect || !deltaSelect) return;
    const pName = provSelect.value;
    const delta = parseFloat(deltaSelect.value);
    const p = provincesList.find(item => item.nama === pName);
    if (!p) return;

    const currentRls = p.latest_rls;
    const currentPov = p.latest_kemiskinan;
    const targetRls = currentRls + delta;
    
    // Prediksi baru
    const newPred = predict(targetRls);
    const diff = newPred - currentPov;

    const whatIfResult = document.getElementById('whatIfResultText');
    if (whatIfResult) {
      whatIfResult.innerHTML = `
        <div class="what-if-feedback-box">
          <div style="font-size: 14px; font-weight: 700; color: #0B1B33; margin-bottom: 6px;">
            Hasil Proyeksi Intervensi Wilayah:
          </div>
          <p style="font-size: 13px; line-height: 1.6; color: #3B4858; margin: 0;">
            Jika RLS <strong>${p.nama}</strong> berhasil ditingkatkan dari <strong>${currentRls} tahun</strong> menjadi <strong>${targetRls.toFixed(1)} tahun</strong> (+${delta} th), model mengestimasikan tingkat kemiskinan berpotensi bergeser ke <strong>${newPred.toFixed(2)}%</strong> 
            (<span style="color: ${diff < 0 ? '#136B36' : '#C5221F'}; font-weight: 700;">${diff < 0 ? '' : '+'}${diff.toFixed(2)}% poin</span> dibanding kondisi Maret 2023).
          </p>
          <div style="margin-top: 8px; font-size: 12px; color: #6E7C87;">
            <em>*Asumsi ceteris paribus: kondisi makroekonomi, subsidi sosial, dan inflasi daerah diasumsikan konstan.</em>
          </div>
        </div>
      `;
    }
  }

  // Jalankan kalkulasi awal What-If
  updateWhatIf();
}

function populateProvincesTable() {
  const tbody = document.getElementById('provincesTableBody');
  const searchInput = document.getElementById('tableSearchInput');
  if (!tbody) return;

  function renderRows(list) {
    tbody.innerHTML = list.map((p, idx) => {
      const predCurrent = predict(p.latest_rls);
      const targetRls = p.latest_rls + 1.0;
      const predPlusOne = predict(targetRls);
      const diffPoin = predPlusOne - p.latest_kemiskinan;

      return `
        <tr>
          <td style="color: #6E7C87; font-size: 12px; text-align: center;">${idx + 1}</td>
          <td>
            <strong>${p.nama}</strong>
            <div style="font-size: 11px; color: #6E7C87;">${p.cluster_name}</div>
          </td>
          <td class="tabular-nums" style="text-align: right;">${p.latest_rls} th</td>
          <td class="tabular-nums" style="text-align: right; font-weight: 600;">${p.latest_kemiskinan}%</td>
          <td class="tabular-nums" style="text-align: right; color: #0E52A0; font-weight: 600;">${targetRls.toFixed(1)} th</td>
          <td class="tabular-nums" style="text-align: right; color: #136B36; font-weight: 700;">${predPlusOne.toFixed(2)}%</td>
          <td class="tabular-nums" style="text-align: right;">
            <span class="badge ${diffPoin < 0 ? 'green' : 'amber'}" style="font-size: 11px; padding: 2px 8px;">
              ${diffPoin < 0 ? '' : '+'}${diffPoin.toFixed(2)}%
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderRows(provincesList);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = provincesList.filter(p => p.nama.toLowerCase().includes(q) || p.cluster_name.toLowerCase().includes(q));
      renderRows(filtered);
    });
  }
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

document.addEventListener('DOMContentLoaded', loadSimulatorData);
