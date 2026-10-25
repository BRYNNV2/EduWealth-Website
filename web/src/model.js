/**
 * Model Prediksi Persentase Penduduk Miskin Berdasarkan Rata-rata Lama Sekolah (RLS)
 * Dihasilkan secara otomatis menggunakan pustaka m2cgen dari model Scikit-Learn
 *
 * Persamaan Regresi: Kemiskinan = 31.961485 + (-2.473413) * RLS
 */

function score(input) {
    return 31.961485263944304 + input[0] * -2.4734132466208907;
}


/**
 * Memprediksi persentase penduduk miskin berdasarkan nilai RLS
 * @param {number} rls - Rata-rata Lama Sekolah (satuan tahun, contoh: 8.5)
 * @returns {number} Persentase penduduk miskin yang diprediksi (contoh: 10.93)
 */
export function predict(rls) {
    if (typeof rls !== 'number' || isNaN(rls)) {
        throw new TypeError('Parameter rls harus berupa angka numerik.');
    }
    return score([rls]);
}

// Kompatibilitas Node.js (CommonJS) untuk pengujian lingkungan server/testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { score, predict };
}
