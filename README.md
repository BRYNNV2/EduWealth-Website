# Project 2 Data Sains: Machine Learning Pipeline
**Topik:** Analisis Hubungan Rata-Rata Lama Sekolah (RLS) terhadap Persentase Penduduk Miskin Antarprovinsi di Indonesia  
**Institusi:** Program Studi Teknik Informatika, Universitas Maritim Raja Ali Haji (UMRAH)

---

## 📁 Struktur Direktori Proyek

```text
Datasainsproject/
├── data/                                  # Dataset mentah sumber BPS
│   ├── Persentase Penduduk Miskin (P0) Menurut Provinsi dan Daerah (2007-2026) (3).xlsx
│   └── Rata-rata Lama Sekolah (RLS) menurut Jenis Kelamin SEMUA TAHUN (1).xlsx
├── notebooks/
│   └── project2_modeling.ipynb            # Jupyter Notebook utama (lengkap dengan narasi & visualisasi)
├── web/                                   # Artefak ekspor untuk antarmuka web (serverless)
│   ├── public/
│   │   └── data/
│   │       ├── provinsi.json              # Data 34 provinsi: capaian, cluster, prediksi, riwayat 2015-2023
│   │       ├── model_metrics.json         # Hasil evaluasi 5-Fold Cross Validation semua model
│   │       └── summary.json               # Ringkasan statistik nasional, korelasi, dan model terbaik
│   ├── src/
│   │   └── model.js                       # Model linear hasil konversi m2cgen (ekspor fungsi predict(rls))
│   └── test_predict.js                    # Skrip pengujian kesetaraan prediksi Python vs JavaScript
├── requirements.txt                       # Daftar dependensi Python
└── README.md                              # Dokumentasi petunjuk penggunaan
```

---

## 🚀 Panduan Menjalankan Ulang (Reproducibility)

### 1. Instalasi Dependensi Lingkungan Python
Pastikan Python versi 3.10 atau yang lebih baru telah terpasang:
```bash
pip install -r requirements.txt
```

### 2. Menjalankan Notebook Pemodelan
Anda dapat membuka dan mengeksekusi notebook secara interaktif:
```bash
jupyter notebook notebooks/project2_modeling.ipynb
```
Atau menjalankan seluruh pipeline secara otomatis dari terminal tanpa membuka peramban:
```bash
cd notebooks
jupyter nbconvert --to notebook --execute --inplace project2_modeling.ipynb
cd ..
```
*Catatan: Seluruh artefak di folder `web/public/data/` dan `web/src/model.js` akan diekspor dan diperbarui secara otomatis saat notebook dieksekusi sampai selesai.*

### 3. Menguji Kesetaraan Model JavaScript (`model.js`)
Uji fungsi `predict(rls)` yang diekspor untuk memastikan kesetaraan 100% dengan model Scikit-Learn Python:
```bash
cd web
node test_predict.js
cd ..
```

---

## 📊 Ringkasan Hasil Model & Evaluasi

### Tabel Komparasi Model (5-Fold Cross Validation)

| Algoritma / Model | Train $R^2$ | Test $R^2$ (Mean) | Test $R^2$ (Std) | MAE (Test) | RMSE (Test) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Polynomial Regression (Deg 3)** | 0.2819 | 0.2406 | 0.0946 | 3.8939 | 4.8061 |
| **Random Forest Regressor** | 0.3828 | 0.1810 | 0.1098 | 3.9918 | 4.9869 |
| **Support Vector Regressor (SVR)**| 0.2261 | 0.1670 | 0.1070 | 3.6986 | 5.0418 |
| **Linear Regression (Baseline OLS)**| **0.1766** | **0.1275** | **0.0870** | **4.0506** | **5.1741** |
| **XGBoost Regressor** | 0.4509 | 0.1150 | 0.1435 | 4.0683 | 5.1698 |
| **Gradient Boosting Regressor** | 0.4990 | 0.1035 | 0.1290 | 4.1336 | 5.2124 |
| **Polynomial Regression (Deg 2)** | 0.2176 | 0.0954 | 0.1288 | 4.1910 | 5.2477 |

### Model Terpilih: Linear Regression (Baseline OLS)
- **Persamaan Matematis:**  
  $$\text{Persentase Kemiskinan} = 31.9615 - 2.4734 \times \text{RLS}$$
- **Alasan Pemilihan:**
  1. **Bebas Overfitting Pohon:** Algoritma ensemble pohon (*Gradient Boosting/XGBoost*) menunjukkan gejala *overfitting* yang kuat (Train $R^2 \approx 0.50$ namun Test $R^2 \approx 0.10$; dan menghasilkan $R^2$ negatif pada pengujian antar-provinsi *GroupKFold*).
  2. **Konsistensi Monotonik:** Polinomial derajat 3 memiliki artefak ekor melengkung ke atas pada RLS tinggi (>10.5 tahun) yang bertentangan dengan kaidah sosio-ekonomi pembangunan.
  3. **Interpretabilitas Tinggi:** Setiap penambahan 1 tahun lama sekolah secara konsisten diasosiasikan dengan penurunan tingkat kemiskinan sebesar **2.47 poin persentase**, menjadikannya rujukan kebijakan publik yang jelas dan dapat dipertanggungjawabkan.

### Tipologi Klaster Provinsi (K-Means, $k = 3$)
- **Klaster Maju ($N = 17$):** RLS tinggi (rata-rata 9.25 tahun), kemiskinan terkendali (rata-rata 9.28%). Contoh: DKI Jakarta, DI Yogyakarta, Bali, Kepulauan Riau.
- **Klaster Menengah ($N = 12$):** RLS sedang (rata-rata 7.97 tahun), kemiskinan moderat (rata-rata 8.97%). Contoh: Jawa Barat, Jawa Tengah, Jawa Timur, Lampung.
- **Klaster Prioritas / Tertinggal ($N = 5$):** RLS rendah (rata-rata 7.51 tahun), kemiskinan tinggi (rata-rata 20.56%). Provinsi: Gorontalo, NTB, NTT, Papua, Papua Barat.
