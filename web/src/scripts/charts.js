let echartsModule = null;

async function getECharts() {
  if (!echartsModule) {
    echartsModule = await import('echarts');
  }
  return echartsModule;
}

let scatterChart = null;
let mapChart = null;
let geoJsonData = null;
let provinsiData = [];
let summaryData = null;
let currentMapMode = 'kemiskinan'; // 'kemiskinan' | 'rls' | 'cluster'

export async function initCharts(provData, sumData) {
  provinsiData = provData;
  summaryData = sumData;

  // 1. Render Scatter Plot secepatnya begitu ECharts selesai dimuat
  getECharts().then(async () => {
    await renderScatterPlot();
  });

  // 2. Unduh GeoJSON di background untuk peta wilayah
  try {
    const [ec, resp] = await Promise.all([
      getECharts(),
      fetch('./data/indonesia-prov.geojson')
    ]);
    geoJsonData = await resp.json();
    ec.registerMap('indonesia', geoJsonData);
    await renderMapChart(currentMapMode);
  } catch (err) {
    console.error('Gagal memuat GeoJSON atau ECharts:', err);
  }

  // Window Resize Listener with passive flag
  window.addEventListener('resize', () => {
    if (scatterChart) scatterChart.resize();
    if (mapChart) mapChart.resize();
  }, { passive: true });
}

/**
 * 1. Scatter Plot Hubungan RLS vs Kemiskinan
 */
async function renderScatterPlot() {
  const container = document.getElementById('scatterChartContainer');
  if (!container) return;

  const ec = await getECharts();
  scatterChart = ec.init(container);

  // Ambil titik data riil rata-rata per provinsi
  const scatterPoints = provinsiData.map(p => [
    p.mean_rls,
    p.mean_kemiskinan,
    p.nama,
    p.cluster_name,
    p.prediksi,
    p.residual
  ]);

  // Garis Regresi: y = 31.9615 - 2.4734 * x
  const xMin = 5.5;
  const xMax = 12.0;
  const intercept = summaryData.model_terpilih.intercept;
  const coef = summaryData.model_terpilih.koefisien_rls;
  
  const linePoints = [
    [xMin, intercept + coef * xMin],
    [xMax, intercept + coef * xMax]
  ];

  const option = {
    title: {
      text: 'Sebaran RLS vs Persentase Kemiskinan (Rata-rata 2015–2023)',
      subtext: 'Model OLS: Kemiskinan = 31.96 - 2.47 × RLS (R² = 17.6%, r = -0.42)',
      left: 'center',
      textStyle: {
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 14,
        fontWeight: 'bold',
        color: '#0B1B33'
      },
      subtextStyle: {
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 12,
        color: '#475872'
      }
    },
    grid: {
      left: '12%',
      right: '6%',
      top: '18%',
      bottom: '16%',
      containLabel: true
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#FFFFFF',
      borderColor: '#E2ECF8',
      borderWidth: 1,
      padding: [12, 16],
      textStyle: {
        color: '#0B1B33',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 13
      },
      extraCssText: 'box-shadow: 0 10px 30px rgba(11, 27, 51, 0.12); border-radius: 12px;',
      formatter: function (params) {
        if (params.seriesType === 'scatter') {
          const [rls, pov, name, cluster, pred, res] = params.data;
          return `
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px; color: #2F80ED;">${name}</div>
            <div style="font-size: 12px; color: #53647D; margin-bottom: 8px;">${cluster}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px;">
              <span>RLS Observasi:</span>
              <strong style="font-family: monospace;">${rls.toFixed(2)} tahun</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px;">
              <span>Kemiskinan Riil:</span>
              <strong style="font-family: monospace;">${pov.toFixed(2)}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 4px;">
              <span>Estimasi Model OLS:</span>
              <strong style="font-family: monospace;">${pred.toFixed(2)}%</strong>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; border-top: 1px dashed #E2ECF8; padding-top: 4px; margin-top: 4px;">
              <span>Residual (Galat):</span>
              <strong style="color: ${res > 0 ? '#E5484D' : '#2DA771'}; font-family: monospace;">${res > 0 ? '+' : ''}${res.toFixed(2)}%</strong>
            </div>
          `;
        }
        return `Garis Tren OLS: y = 31.96 - 2.47x`;
      }
    },
    xAxis: {
      type: 'value',
      name: 'Rata-Rata Lama Sekolah (Tahun)',
      nameLocation: 'middle',
      nameGap: 30,
      min: 5.5,
      max: 12.0,
      splitLine: { lineStyle: { color: '#EBF3FE' } },
      axisLine: { lineStyle: { color: '#C5DCF8' } },
      axisLabel: {
        color: '#53647D',
        formatter: '{value} th'
      }
    },
    yAxis: {
      type: 'value',
      name: 'Penduduk Miskin (%)',
      nameLocation: 'middle',
      nameGap: 36,
      min: 0,
      max: 30,
      splitLine: { lineStyle: { color: '#EBF3FE' } },
      axisLine: { lineStyle: { color: '#C5DCF8' } },
      axisLabel: {
        color: '#53647D',
        formatter: '{value}%'
      }
    },
    series: [
      {
        name: 'Provinsi',
        type: 'scatter',
        data: scatterPoints,
        symbolSize: 14,
        itemStyle: {
          color: function (params) {
            const pov = params.data[1];
            if (pov > 16.0) return '#E5484D'; // Tinggi (Papua, NTT, dll.)
            if (pov > 9.0) return '#F2A93B';  // Sedang
            return '#2DA771';                 // Rendah (Bali, DKI, dll.)
          },
          borderColor: '#FFFFFF',
          borderWidth: 2,
          shadowBlur: 6,
          shadowColor: 'rgba(0,0,0,0.1)'
        }
      },
      {
        name: 'Garis Regresi OLS',
        type: 'line',
        data: linePoints,
        showSymbol: false,
        lineStyle: {
          color: '#2F80ED',
          width: 2.5,
          type: 'solid'
        }
      }
    ]
  };

  scatterChart.setOption(option);
}

/**
 * 2. Peta Choropleth Interaktif Indonesia
 */
export async function setMapMode(mode) {
  currentMapMode = mode;
  await renderMapChart(mode);
}

async function renderMapChart(mode) {
  const container = document.getElementById('mapChartContainer');
  if (!container || !geoJsonData) return;

  const ec = await getECharts();
  if (!mapChart) {
    mapChart = ec.init(container);
    mapChart.on('click', function (params) {
      if (params.data && params.data.rawData) {
        window.dispatchEvent(new CustomEvent('province-selected', { detail: params.data.rawData }));
      }
    });
  }

  // Siapkan data pemetaan
  let mapData = [];
  let visualMapConfig = {};

  if (mode === 'kemiskinan') {
    mapData = provinsiData.map(p => ({
      name: p.nama,
      value: p.latest_kemiskinan,
      rawData: p
    }));

    visualMapConfig = {
      min: 3.0,
      max: 27.0,
      text: ['Tinggi (>20%)', 'Rendah (<6%)'],
      realtime: true,
      calculable: true,
      inRange: {
        color: ['#2DA771', '#F2A93B', '#E5484D'] // Colorblind friendly sequential
      },
      textStyle: { color: '#53647D', fontFamily: 'Plus Jakarta Sans', fontSize: 11 },
      bottom: 20,
      left: 20
    };
  } else if (mode === 'rls') {
    mapData = provinsiData.map(p => ({
      name: p.nama,
      value: p.latest_rls,
      rawData: p
    }));

    visualMapConfig = {
      min: 6.0,
      max: 11.5,
      text: ['RLS Tinggi', 'RLS Rendah'],
      realtime: true,
      calculable: true,
      inRange: {
        color: ['#E5484D', '#F2A93B', '#2DA771'] // Terbalik: RLS tinggi hijau
      },
      textStyle: { color: '#53647D', fontFamily: 'Plus Jakarta Sans', fontSize: 11 },
      bottom: 20,
      left: 20
    };
  } else if (mode === 'cluster') {
    mapData = provinsiData.map(p => ({
      name: p.nama,
      value: p.cluster_id,
      rawData: p
    }));

    visualMapConfig = {
      type: 'piecewise',
      pieces: [
        { value: 0, label: 'Klaster Maju (RLS Tinggi, Kemiskinan Terkendali)', color: '#2DA771' },
        { value: 1, label: 'Klaster Menengah (RLS Sedang, Kemiskinan Moderat)', color: '#F2A93B' },
        { value: 2, label: 'Klaster Prioritas (RLS Rendah, Kemiskinan Tinggi)', color: '#E5484D' }
      ],
      textStyle: { color: '#53647D', fontFamily: 'Plus Jakarta Sans', fontSize: 11 },
      bottom: 20,
      left: 20
    };
  }

  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: '#FFFFFF',
      borderColor: '#E2ECF8',
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: '#0B1B33', fontFamily: 'Plus Jakarta Sans', fontSize: 12 },
      extraCssText: 'box-shadow: 0 10px 30px rgba(11, 27, 51, 0.12); border-radius: 12px;',
      formatter: function (params) {
        if (!params.data || !params.data.rawData) return params.name;
        const p = params.data.rawData;
        return `
          <div style="font-weight: 800; font-size: 14px; color: #2F80ED; margin-bottom: 4px;">${p.nama}</div>
          <div>RLS: <strong>${p.latest_rls} tahun</strong></div>
          <div>Kemiskinan: <strong>${p.latest_kemiskinan}%</strong></div>
          <div>Klaster: <span style="font-size: 11px; color: #53647D;">${p.cluster_name}</span></div>
          <div style="font-size: 10px; color: #8A9BB3; margin-top: 6px;">👉 Klik untuk rincian panel</div>
        `;
      }
    },
    visualMap: visualMapConfig,
    geo: {
      map: 'indonesia',
      roam: true,
      zoom: 1.22,
      center: [118.0, -2.5],
      label: {
        show: false
      },
      itemStyle: {
        borderColor: '#FFFFFF',
        borderWidth: 1,
        areaColor: '#EBF3FE'
      },
      emphasis: {
        itemStyle: {
          areaColor: '#FFE082',
          borderColor: '#2F80ED',
          borderWidth: 1.5
        },
        label: { show: true, color: '#0B1B33', fontWeight: 'bold' }
      }
    },
    series: [
      {
        type: 'map',
        geoIndex: 0,
        data: mapData
      }
    ]
  };

  mapChart.setOption(option);
}
