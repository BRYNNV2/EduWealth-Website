import { predict } from '../model.js';

let provincesList = [];

export function initSimulator(provData) {
  provincesList = provData;

  const slider = document.getElementById('rlsSlider');
  const rlsDisplay = document.getElementById('rlsValueDisplay');
  const predNumber = document.getElementById('predictionValue');
  const predBadge = document.getElementById('predictionBadge');
  const extrapWarning = document.getElementById('extrapolationWarning');

  // Populate Dropdown What-If
  const provSelect = document.getElementById('whatIfProvinceSelect');
  if (provSelect) {
    provSelect.innerHTML = provincesList.map(p => 
      `<option value="${p.nama}">${p.nama} (RLS: ${p.latest_rls} thn, Miskin: ${p.latest_kemiskinan}%)</option>`
    ).join('');

    provSelect.addEventListener('change', updateWhatIf);
  }

  const deltaSelect = document.getElementById('whatIfDeltaSelect');
  if (deltaSelect) {
    deltaSelect.addEventListener('change', updateWhatIf);
  }

  // Slider Event Listener
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      updatePrediction(val);
    });

    // Inisialisasi awal pada rata-rata nasional (8.5 tahun)
    updatePrediction(parseFloat(slider.value));
  }

  function updatePrediction(rlsVal) {
    if (rlsDisplay) rlsDisplay.textContent = `${rlsVal.toFixed(1)} th`;
    
    // Panggil model.js (hasil konversi m2cgen)
    const pred = predict(rlsVal);
    if (predNumber) predNumber.textContent = `${pred.toFixed(2)}%`;

    // Klasifikasi Badge
    if (predBadge) {
      predBadge.className = 'prediction-badge';
      if (pred < 8.0) {
        predBadge.classList.add('low');
        predBadge.textContent = 'Kategori: Rendah (< 8%)';
      } else if (pred <= 14.0) {
        predBadge.classList.add('mid');
        predBadge.textContent = 'Kategori: Moderat (8% – 14%)';
      } else {
        predBadge.classList.add('high');
        predBadge.textContent = 'Kategori: Tinggi (> 14%)';
      }
    }

    // Peringatan Ekstrapolasi
    if (extrapWarning) {
      if (rlsVal < 5.9 || rlsVal > 11.5) {
        extrapWarning.style.display = 'block';
        extrapWarning.innerHTML = `⚠️ <strong>Peringatan Ekstrapolasi:</strong> Nilai RLS (${rlsVal.toFixed(1)} th) berada di luar rentang data empiris latih (5.93 – 11.46 tahun). Estimasi di luar batas ini memiliki ketidakpastian statistik tinggi.`;
      } else {
        extrapWarning.style.display = 'none';
      }
    }
  }

  function updateWhatIf() {
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
        <div style="margin-top: 12px; font-size: 13px; line-height: 1.6; color: #0B1B33;">
          Jika RLS <strong>${p.nama}</strong> dinaikkan dari <strong>${currentRls} tahun</strong> menjadi <strong>${targetRls.toFixed(1)} tahun</strong> (+${delta} th), model memproyeksikan persentase kemiskinan berpotensi menjadi <strong>${newPred.toFixed(2)}%</strong> 
          (<span style="color: ${diff < 0 ? '#136B36' : '#C5221F'}; font-weight: bold;">${diff < 0 ? '' : '+'}${diff.toFixed(2)}% poin</span>).
        </div>
      `;
    }
  }

  // Initial call for what-if
  updateWhatIf();
}
