import { initIcons } from './icons.js';
import { predict } from '../model.js';

let echartsModule = null;
async function getECharts() {
  if (!echartsModule) {
    echartsModule = await import('echarts');
  }
  return echartsModule;
}

let histogramChart = null;
let scatterActualMarChart = null;
let scatterResMarChart = null;
let scatterActualSepChart = null;
let scatterResSepChart = null;
let provincesList = [];
let summaryData = null;
let modelMetrics = [];
let datasetPanel = [];
let predictionsF2 = null;
let currentYearFilter = 'all';
let currentScatterProvFilter = 'all';

async function loadEksplorasiData() {
  try {
    const [sumResp, provResp, metResp, panelResp, predResp] = await Promise.all([
      fetch('./data/summary.json'),
      fetch('./data/provinsi.json'),
      fetch('./data/model_metrics.json'),
      fetch('./data/dataset_panel.json'),
      fetch('./data/predictions_f2.json')
    ]);

    summaryData = await sumResp.json();
    provincesList = await provResp.json();
    modelMetrics = await metResp.json();
    datasetPanel = await panelResp.json();
    predictionsF2 = await predResp.json();

    // 0. Isi Tabel 16 Kali Percobaan
    populateExperimentsTable(modelMetrics);

    // 0B. Inisialisasi 4 Scatter Plot Aktual vs Prediksi & Residual (Model F2)
    await initScatterResidualCharts(predictionsF2);

    // 1. Inisialisasi Grafik Histogram
    await initHistogramChart();

    // 2. Inisialisasi Kontrol Simulator
    initSimulatorControls();

    // 3. Isi Tabel Dataset Panel 272 Observasi (2015–2022)
    populateProvincesTable(datasetPanel);

    // 4. Inisialisasi Navigasi & Ikon
    initMobileNav();
    initIcons();

    // Resize listener
    window.addEventListener('resize', () => {
      if (histogramChart) histogramChart.resize();
      if (scatterActualMarChart) scatterActualMarChart.resize();
      if (scatterResMarChart) scatterResMarChart.resize();
      if (scatterActualSepChart) scatterActualSepChart.resize();
      if (scatterResSepChart) scatterResSepChart.resize();
    }, { passive: true });

  } catch (err) {
    console.error('Gagal memuat data eksplorasi:', err);
  }
}

function populateExperimentsTable(metrics) {
  const tbody = document.getElementById('experimentsTableBody');
  const filterBtns = document.querySelectorAll('.exp-filter-btn');
  if (!tbody || !Array.isArray(metrics)) return;

  function renderRows(filterPeriode) {
    const list = filterPeriode === 'all'
      ? metrics
      : metrics.filter(m => m.Periode === filterPeriode);

    tbody.innerHTML = list.map(m => {
      const isLinear = m.Model.includes('Linear');
      const isTopRow = m.No === 1 || m.No === 9;
      const targetCode = m.Periode === 'Maret' ? 'P0_Jumlah_Sem1_Maret' : 'P0_Jumlah_Sem2_September';
      return `
        <tr style="${isTopRow ? 'background: #F2F7FF;' : ''}">
          <td class="tabular-nums" style="text-align: center; font-weight: 800; color: #0B1B33;">${m.No}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span class="badge ${m.Periode === 'Maret' ? 'green' : 'amber'}" style="font-size: 11px; padding: 3px 10px;">
                ${m.Periode}
              </span>
              <code class="feat-var-code" style="font-size: 11px; padding: 2px 6px;">${targetCode}</code>
            </div>
          </td>
          <td>
            <strong style="color: ${isLinear ? '#0E52A0' : '#3B4858'};">${isLinear ? 'Linear Regression' : 'Random Forest Regression'}</strong>
          </td>
          <td>
            <span class="feat-code-badge ${m.Kode_Fitur === 'F2' ? 'best' : ''}" style="font-size: 11px; padding: 2px 7px; margin-right: 6px;">${m.Kode_Fitur || ''}</span>
            <strong>${m.Fitur}</strong>
          </td>
          <td class="tabular-nums" style="text-align: right; font-weight: 600;">${m.MAE.toFixed(4)}</td>
          <td class="tabular-nums" style="text-align: right; font-weight: 600;">${m.RMSE.toFixed(4)}</td>
          <td class="tabular-nums" style="text-align: right; font-weight: 700; color: ${m['Test R²'] > -0.5 ? '#0E52A0' : '#C5221F'};">${m['Test R²'].toFixed(4)}</td>
          <td>
            <span class="badge ${isTopRow ? 'green' : (isLinear ? 'amber' : 'red')}" style="font-size: 11px; padding: 2px 8px;">
              ${m.Status}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderRows('all');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderRows(btn.dataset.periode);
    });
  });
}

/**
 * =========================================================================
 * 0B. VISUALISASI SCATTER PLOT AKTUAL VS PREDIKSI & RESIDUAL (MODEL F2)
 * =========================================================================
 */
const PROV_COLORS = {
  'JAWA BARAT': '#2563EB',
  'KALIMANTAN UTARA': '#0D9488',
  'MALUKU': '#DC2626',
  'NUSA TENGGARA BARAT': '#16A34A',
  'PAPUA BARAT': '#9333EA',
  'SULAWESI BARAT': '#D97706',
  'SULAWESI SELATAN': '#0284C7'
};

async function initScatterResidualCharts(predData) {
  if (!predData || !Array.isArray(predData.testing_points)) return;

  const elActMar = document.getElementById('scatterActualPredMaret');
  const elResMar = document.getElementById('scatterResidualMaret');
  const elActSep = document.getElementById('scatterActualPredSept');
  const elResSep = document.getElementById('scatterResidualSept');

  if (!elActMar || !elResMar || !elActSep || !elResSep) return;

  const ec = await getECharts();
  scatterActualMarChart = ec.init(elActMar);
  scatterResMarChart = ec.init(elResMar);
  scatterActualSepChart = ec.init(elActSep);
  scatterResSepChart = ec.init(elResSep);

  const provBtns = document.querySelectorAll('.scatter-prov-btn');
  provBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      provBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentScatterProvFilter = btn.dataset.prov;
      renderAllScatterPlots(predData);
    });
  });

  renderAllScatterPlots(predData);
}

function renderAllScatterPlots(predData) {
  const points = predData.testing_points;
  const provinces = Object.keys(PROV_COLORS);

  function buildActualVsPredOption(periode) {
    const isMaret = periode === 'maret';
    const actKey = isMaret ? 'P0_Jumlah_Sem1_Maret' : 'P0_Jumlah_Sem2_September';
    const predKey = isMaret ? 'Prediksi_Maret' : 'Prediksi_September';
    const resKey = isMaret ? 'Residual_Maret' : 'Residual_September';
    const labelPeriode = isMaret ? 'Maret (Sem 1)' : 'September (Sem 2)';

    const seriesList = provinces.map(prov => {
      const isSelected = currentScatterProvFilter === 'all' || currentScatterProvFilter === prov;
      const provPoints = points.filter(p => p.Provinsi === prov);
      return {
        name: prov,
        type: 'scatter',
        symbolSize: isSelected ? 11 : 7,
        itemStyle: {
          color: PROV_COLORS[prov],
          opacity: isSelected ? 0.92 : 0.18,
          borderColor: '#FFFFFF',
          borderWidth: 1.5
        },
        data: provPoints.map(p => ({
          value: [p[actKey], p[predKey]],
          meta: p
        }))
      };
    });

    // Garis Ideal Y = Y_hat (dari nilai 4% s.d. 28%)
    seriesList.push({
      name: 'Garis Ideal (Y = Ŷ)',
      type: 'line',
      symbol: 'none',
      silent: true,
      lineStyle: {
        color: '#64748B',
        width: 2,
        type: 'dashed'
      },
      data: [[4, 4], [28, 28]]
    });

    return {
      animationDuration: 500,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        padding: [12, 14],
        textStyle: { color: '#0B1B33', fontFamily: 'Plus Jakarta Sans, sans-serif' },
        formatter: (params) => {
          if (!params.data || !params.data.meta) return '';
          const m = params.data.meta;
          const resVal = m[resKey];
          const resColor = Math.abs(resVal) < 2 ? '#0D652D' : (resVal > 0 ? '#C5221F' : '#0E52A0');
          return `
            <div style="font-weight: 800; font-size: 13px; color: ${PROV_COLORS[m.Provinsi]}; margin-bottom: 4px;">
              ${m.Provinsi} (${m.Tahun}) — ${labelPeriode}
            </div>
            <div style="font-size: 12px; line-height: 1.6;">
              RLS Perempuan (F2): <strong>${m.RLS_Perempuan.toFixed(2)} tahun</strong><br/>
              Nilai Aktual (Y): <strong>${m[actKey].toFixed(2)}%</strong><br/>
              Nilai Prediksi (Ŷ): <strong>${m[predKey].toFixed(4)}%</strong><br/>
              Residual (Y − Ŷ): <strong style="color: ${resColor};">${resVal > 0 ? '+' : ''}${resVal.toFixed(4)} poin</strong>
            </div>
          `;
        }
      },
      legend: {
        bottom: 0,
        type: 'scroll',
        icon: 'circle',
        itemWidth: 9,
        itemHeight: 9,
        textStyle: { fontSize: 10.5, color: '#3B4858' }
      },
      grid: {
        top: 24,
        right: 24,
        bottom: 68,
        left: 52
      },
      xAxis: {
        type: 'value',
        name: `Nilai Aktual Kemiskinan ${isMaret ? 'Maret' : 'September'} (%)`,
        nameLocation: 'middle',
        nameGap: 28,
        min: 4,
        max: 28,
        nameTextStyle: { color: '#475569', fontSize: 11.5, fontWeight: 700 },
        splitLine: { lineStyle: { type: 'dashed', color: '#EDF2F7' } },
        axisLabel: { color: '#3B4858', fontSize: 11, formatter: '{value}%' }
      },
      yAxis: {
        type: 'value',
        name: 'Nilai Prediksi Model (Ŷ %)',
        min: 4,
        max: 20,
        nameTextStyle: { color: '#475569', fontSize: 11.5, fontWeight: 700 },
        splitLine: { lineStyle: { type: 'dashed', color: '#EDF2F7' } },
        axisLabel: { color: '#3B4858', fontSize: 11, formatter: '{value}%' }
      },
      series: seriesList
    };
  }

  function buildResidualOption(periode) {
    const isMaret = periode === 'maret';
    const actKey = isMaret ? 'P0_Jumlah_Sem1_Maret' : 'P0_Jumlah_Sem2_September';
    const predKey = isMaret ? 'Prediksi_Maret' : 'Prediksi_September';
    const resKey = isMaret ? 'Residual_Maret' : 'Residual_September';
    const labelPeriode = isMaret ? 'Maret (Sem 1)' : 'September (Sem 2)';

    const seriesList = provinces.map(prov => {
      const isSelected = currentScatterProvFilter === 'all' || currentScatterProvFilter === prov;
      const provPoints = points.filter(p => p.Provinsi === prov);
      return {
        name: prov,
        type: 'scatter',
        symbolSize: isSelected ? 11 : 7,
        itemStyle: {
          color: PROV_COLORS[prov],
          opacity: isSelected ? 0.92 : 0.18,
          borderColor: '#FFFFFF',
          borderWidth: 1.5
        },
        data: provPoints.map(p => ({
          value: [p[predKey], p[resKey]],
          meta: p
        }))
      };
    });

    // Garis Referensi Residual = 0
    seriesList.push({
      name: 'Residual = 0 (Tanpa Galat)',
      type: 'line',
      symbol: 'none',
      silent: true,
      lineStyle: {
        color: '#E11D48',
        width: 2,
        type: 'dashed'
      },
      data: [[5, 0], [17, 0]]
    });

    return {
      animationDuration: 500,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        padding: [12, 14],
        textStyle: { color: '#0B1B33', fontFamily: 'Plus Jakarta Sans, sans-serif' },
        formatter: (params) => {
          if (!params.data || !params.data.meta) return '';
          const m = params.data.meta;
          const resVal = m[resKey];
          const resColor = Math.abs(resVal) < 2 ? '#0D652D' : (resVal > 0 ? '#C5221F' : '#0E52A0');
          return `
            <div style="font-weight: 800; font-size: 13px; color: ${PROV_COLORS[m.Provinsi]}; margin-bottom: 4px;">
              ${m.Provinsi} (${m.Tahun}) — Residual ${labelPeriode}
            </div>
            <div style="font-size: 12px; line-height: 1.6;">
              RLS Perempuan (F2): <strong>${m.RLS_Perempuan.toFixed(2)} tahun</strong><br/>
              Nilai Prediksi (Ŷ): <strong>${m[predKey].toFixed(4)}%</strong><br/>
              Nilai Aktual (Y): <strong>${m[actKey].toFixed(2)}%</strong><br/>
              Residual (Y − Ŷ): <strong style="color: ${resColor};">${resVal > 0 ? '+' : ''}${resVal.toFixed(4)} poin</strong>
            </div>
          `;
        }
      },
      legend: {
        bottom: 0,
        type: 'scroll',
        icon: 'circle',
        itemWidth: 9,
        itemHeight: 9,
        textStyle: { fontSize: 10.5, color: '#3B4858' }
      },
      grid: {
        top: 24,
        right: 24,
        bottom: 68,
        left: 52
      },
      xAxis: {
        type: 'value',
        name: `Nilai Prediksi Kemiskinan ${isMaret ? 'Maret' : 'September'} (Ŷ %)`,
        nameLocation: 'middle',
        nameGap: 28,
        min: 5,
        max: 17,
        nameTextStyle: { color: '#475569', fontSize: 11.5, fontWeight: 700 },
        splitLine: { lineStyle: { type: 'dashed', color: '#EDF2F7' } },
        axisLabel: { color: '#3B4858', fontSize: 11, formatter: '{value}%' }
      },
      yAxis: {
        type: 'value',
        name: 'Residual (Aktual − Prediksi)',
        min: -6,
        max: 16,
        nameTextStyle: { color: '#475569', fontSize: 11.5, fontWeight: 700 },
        splitLine: { lineStyle: { type: 'dashed', color: '#EDF2F7' } },
        axisLabel: { color: '#3B4858', fontSize: 11 }
      },
      series: seriesList
    };
  }

  scatterActualMarChart.setOption(buildActualVsPredOption('maret'), true);
  scatterResMarChart.setOption(buildResidualOption('maret'), true);
  scatterActualSepChart.setOption(buildActualVsPredOption('september'), true);
  scatterResSepChart.setOption(buildResidualOption('september'), true);
}

/**
 * =========================================================================
 * 1. HISTOGRAM DISTRIBUSI PERSENTASE PENDUDUK MISKIN SEMESTER 1
 * =========================================================================
 */
async function initHistogramChart() {
  const container = document.getElementById('histogramChartContainer');
  if (!container) return;

  const ec = await getECharts();
  histogramChart = ec.init(container);

  // Setup Tombol Filter Tahun
  const filterBtns = document.querySelectorAll('.hist-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentYearFilter = btn.dataset.year;
      updateHistogramData();
    });
  });

  updateHistogramData();
}

function updateHistogramData() {
  if (!histogramChart) return;

  // Kumpulkan records kemiskinan Semester 1 (2015–2022, N = 272 observasi)
  let records = [];
  if (currentYearFilter === 'all') {
    records = provincesList.flatMap(p => p.history.filter(h => h.tahun >= 2015 && h.tahun <= 2022).map(h => ({
      nama: p.nama,
      tahun: h.tahun,
      kemiskinan: h.kemiskinan
    })));
  } else {
    const yNum = parseInt(currentYearFilter);
    records = provincesList.map(p => {
      const h = p.history.find(item => item.tahun === yNum) || { kemiskinan: p.latest_kemiskinan };
      return {
        nama: p.nama,
        tahun: yNum,
        kemiskinan: h.kemiskinan
      };
    });
  }

  const values = records.map(r => r.kemiskinan).sort((a, b) => a - b);
  const n = values.length;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const meanVal = values.reduce((sum, v) => sum + v, 0) / n;
  
  // Median
  const mid = Math.floor(n / 2);
  const medianVal = n % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;

  // Skewness sampel (Fisher-Pearson)
  const stdVal = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - meanVal, 2), 0) / (n - 1));
  const skewness = (n / ((n - 1) * (n - 2))) * values.reduce((s, v) => s + Math.pow((v - meanVal) / stdVal, 3), 0);

  // Perbarui Kartu Ringkasan Metrik di Bawah Grafik
  const meanElem = document.getElementById('histStatMean');
  const medianElem = document.getElementById('histStatMedian');
  const skewElem = document.getElementById('histStatSkew');
  const rangeElem = document.getElementById('histStatRange');
  const obsElem = document.getElementById('histStatObs');

  if (meanElem) meanElem.textContent = `${meanVal.toFixed(2)}%`;
  if (medianElem) medianElem.textContent = `${medianVal.toFixed(2)}%`;
  if (skewElem) skewElem.textContent = `${skewness > 0 ? '+' : ''}${skewness.toFixed(2)} (Menceng Kanan)`;
  if (rangeElem) rangeElem.textContent = `${minVal.toFixed(2)}% s.d. ${maxVal.toFixed(2)}%`;
  if (obsElem) obsElem.textContent = `${n} observasi`;

  // Buat 10 bin seragam
  const binCount = 10;
  const binWidth = (maxVal - minVal) / binCount;
  const bins = [];

  for (let i = 0; i < binCount; i++) {
    const bStart = minVal + i * binWidth;
    const bEnd = i === binCount - 1 ? maxVal + 0.001 : minVal + (i + 1) * binWidth;
    const matched = records.filter(r => r.kemiskinan >= bStart && r.kemiskinan < bEnd);
    bins.push({
      rangeLabel: `${bStart.toFixed(1)}% – ${(minVal + (i + 1) * binWidth).toFixed(1)}%`,
      count: matched.length,
      percentage: ((matched.length / n) * 100).toFixed(1),
      provinces: matched.slice(0, 5).map(m => currentYearFilter === 'all' ? `${m.nama} (${m.tahun})` : m.nama),
      totalMatches: matched.length
    });
  }

  const option = {
    animationDuration: 800,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      borderColor: '#E2E8F0',
      borderWidth: 1,
      padding: [14, 16],
      textStyle: { color: '#0B1B33', fontFamily: 'Plus Jakarta Sans, sans-serif' },
      formatter: (params) => {
        const item = params[0];
        const b = bins[item.dataIndex];
        return `
          <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px; color: #1A6ED8;">
            Rentang Kemiskinan: ${b.rangeLabel}
          </div>
          <div style="font-size: 13px; margin-bottom: 8px;">
            Frekuensi: <strong>${b.count} observasi</strong> (${b.percentage}% dari total)
          </div>
          <div style="font-size: 11px; color: #6E7C87; border-top: 1px solid #E2E8F0; padding-top: 6px; line-height: 1.5;">
            <strong>Contoh Wilayah:</strong><br>${b.provinces.join(', ')}${b.totalMatches > 5 ? '... dan lainnya' : ''}
          </div>
        `;
      }
    },
    grid: {
      top: 40,
      right: 30,
      bottom: 50,
      left: 55,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: bins.map(b => b.rangeLabel),
      name: 'Persentase Penduduk Miskin (%)',
      nameLocation: 'middle',
      nameGap: 36,
      nameTextStyle: { color: '#6E7C87', fontSize: 12, fontWeight: 600 },
      axisLabel: {
        rotate: 30,
        fontSize: 11,
        color: '#3B4858'
      },
      axisLine: { lineStyle: { color: '#E2E8F0' } }
    },
    yAxis: {
      type: 'value',
      name: 'Jumlah Observasi',
      nameTextStyle: { color: '#6E7C87', fontSize: 12, fontWeight: 600 },
      splitLine: { lineStyle: { type: 'dashed', color: '#EDF2F7' } },
      axisLabel: { color: '#3B4858', fontSize: 11 }
    },
    series: [
      {
        name: 'Distribusi Frekuensi',
        type: 'bar',
        barWidth: '65%',
        data: bins.map((b, idx) => ({
          value: b.count,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: idx >= 7 ? '#E5484D' : (idx >= 4 ? '#2F80ED' : '#1A6ED8') },
                { offset: 1, color: idx >= 7 ? '#B91C1C' : (idx >= 4 ? '#1A6ED8' : '#0E52A0') }
              ]
            },
            borderRadius: [6, 6, 0, 0]
          }
        })),
        markLine: {
          symbol: 'none',
          label: {
            position: 'end',
            formatter: '{b}',
            fontSize: 11,
            fontWeight: 700
          },
          data: [
            {
              name: `Mean: ${meanVal.toFixed(1)}%`,
              xAxis: Math.min(Math.max(0, Math.floor(((meanVal - minVal) / (maxVal - minVal)) * binCount)), binCount - 1),
              lineStyle: { color: '#1A6ED8', width: 2, type: 'dashed' }
            },
            {
              name: `Median: ${medianVal.toFixed(1)}%`,
              xAxis: Math.min(Math.max(0, Math.floor(((medianVal - minVal) / (maxVal - minVal)) * binCount)), binCount - 1),
              lineStyle: { color: '#F2A93B', width: 2, type: 'dotted' }
            }
          ]
        }
      }
    ]
  };

  histogramChart.setOption(option, true);
}

/**
 * =========================================================================
 * 2. SIMULATOR CONTROLS & WHAT-IF LOGIC
 * =========================================================================
 */
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
      presetButtons.forEach(b => b.classList.remove('active'));
      updatePrediction(val);
    });

    // Inisialisasi awal pada rata-rata nasional (8.54 th)
    updatePrediction(parseFloat(slider.value));
  }

  function updatePrediction(rlsVal) {
    if (rlsDisplay) rlsDisplay.textContent = `${rlsVal.toFixed(1)} th`;
    
    // Model OLS via m2cgen
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

    // Interval Keyakinan 95%
    const marginError = 1.96 * 0.45;
    const lowerBound = Math.max(0, pred - marginError);
    const upperBound = pred + marginError;

    if (ciLowerElem) ciLowerElem.textContent = `${lowerBound.toFixed(2)}%`;
    if (ciUpperElem) ciUpperElem.textContent = `${upperBound.toFixed(2)}%`;

    // Peringatan Ekstrapolasi
    if (extrapWarning) {
      if (rlsVal < 5.9 || rlsVal > 11.5) {
        extrapWarning.style.display = 'block';
        extrapWarning.innerHTML = `⚠️ <strong>Peringatan Ekstrapolasi:</strong> Nilai RLS (${rlsVal.toFixed(1)} th) berada di luar rentang data empiris BPS (5.93 – 11.46 tahun). Estimasi di luar batas ini memiliki ketidakpastian statistik tinggi.`;
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
            (<span style="color: ${diff < 0 ? '#136B36' : '#C5221F'}; font-weight: 700;">${diff < 0 ? '' : '+'}${diff.toFixed(2)}% poin</span> dibanding kondisi baseline terbaru).
          </p>
          <div style="margin-top: 8px; font-size: 12px; color: #6E7C87;">
            <em>*Asumsi ceteris paribus: kondisi makroekonomi, subsidi sosial, dan inflasi daerah diasumsikan konstan.</em>
          </div>
        </div>
      `;
    }
  }

  updateWhatIf();
}

/**
 * =========================================================================
 * 3. TABEL DATASET PANEL 34 PROVINSI × 8 TAHUN (N = 272 OBSERVASI)
 * =========================================================================
 */
function populateProvincesTable(panelData) {
  const tbody = document.getElementById('provincesTableBody');
  const searchInput = document.getElementById('tableSearchInput');
  const yearBtns = document.querySelectorAll('.panel-year-btn');
  const rowCountElem = document.getElementById('datasetRowCount');
  if (!tbody || !Array.isArray(panelData)) return;

  let activeYear = 'all';
  let searchQuery = '';

  function filterAndRender() {
    const filtered = panelData.filter(row => {
      const matchYear = activeYear === 'all' || String(row.Tahun) === String(activeYear);
      const matchSearch = !searchQuery || row.Provinsi.toLowerCase().includes(searchQuery);
      return matchYear && matchSearch;
    });

    if (rowCountElem) {
      rowCountElem.textContent = String(filtered.length);
    }

    tbody.innerHTML = filtered.map((row, idx) => `
      <tr>
        <td class="tabular-nums" style="color: #6E7C87; font-size: 12px; text-align: center; font-weight: 700;">${idx + 1}</td>
        <td><strong>${row.Provinsi}</strong></td>
        <td class="tabular-nums" style="text-align: center;">
          <span class="badge green" style="font-size: 11px; padding: 2px 8px;">${row.Tahun}</span>
        </td>
        <td class="tabular-nums" style="text-align: right; font-weight: 600;">${row.P0_Jumlah_Sem1_Maret.toFixed(2)}</td>
        <td class="tabular-nums" style="text-align: right; font-weight: 600;">${row.P0_Jumlah_Sem2_September.toFixed(2)}</td>
        <td class="tabular-nums" style="text-align: right; color: #0E52A0; font-weight: 600;">${row.RLS_Laki_Laki.toFixed(2)}</td>
        <td class="tabular-nums" style="text-align: right; color: #136B36; font-weight: 700;">${row.RLS_Perempuan.toFixed(2)}</td>
        <td class="tabular-nums" style="text-align: right; font-weight: 700;">${Number(row.RLS_Rata_Rata.toFixed(4))}</td>
      </tr>
    `).join('');
  }

  filterAndRender();

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterAndRender();
    });
  }

  yearBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      yearBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeYear = btn.dataset.year;
      filterAndRender();
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadEksplorasiData);
} else {
  loadEksplorasiData();
}
