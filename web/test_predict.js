/**
 * Skrip Uji Kesetaraan Output Prediksi Model Python vs JavaScript (model.js)
 * 5 Sampel RLS Pengujian: [6.0, 7.5, 8.544, 9.5, 11.0]
 */

const { predict } = require('./src/model.js');

// Nilai eksak yang dihasilkan oleh model Python (LinearRegression di Scikit-Learn)
// Persamaan: y = 31.961485263944304 + rls * -2.4734132466208907
const testCases = [
  { rls: 6.000, python_pred: 17.1210057842189585 },
  { rls: 7.500, python_pred: 13.4108859142876256 },
  { rls: 8.544, python_pred: 10.8286424848154148 },
  { rls: 9.500, python_pred: 8.4640594210458424 },
  { rls: 11.000, python_pred: 4.7539395511145059 }
];

console.log("==========================================================================================");
console.log("UJI KESETARAAN PREDIKSI: PYTHON (Scikit-Learn) VS JAVASCRIPT (model.js via m2cgen)");
console.log("==========================================================================================");
console.log("No | Input RLS (thn) | Python Prediksi (%) | JS Prediksi (%) | Selisih Absolut | Status");
console.log("---+-----------------+---------------------+-----------------+-----------------+----------");

let allPassed = true;

testCases.forEach((tc, idx) => {
  const js_pred = predict(tc.rls);
  const diff = Math.abs(tc.python_pred - js_pred);
  const isMatch = diff < 1e-9;
  
  if (!isMatch) allPassed = false;
  
  console.log(
    `${(idx + 1).toString().padEnd(2)} | ` +
    `${tc.rls.toFixed(3).padEnd(15)} | ` +
    `${tc.python_pred.toFixed(8).padEnd(19)} | ` +
    `${js_pred.toFixed(8).padEnd(15)} | ` +
    `${diff.toExponential(4).padEnd(15)} | ` +
    `${isMatch ? "SESUAI (PASS)" : "GAGAL (FAIL)"}`
  );
});

console.log("==========================================================================================");
if (allPassed) {
  console.log("KESIMPULAN: Seluruh 5 sampel uji terbukti 100% IDENTIK antara Python dan JavaScript!");
} else {
  console.error("KESIMPULAN: Terdapat perbedaan output antara Python dan JavaScript.");
  process.exit(1);
}
