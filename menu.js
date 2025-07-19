// menu.js
const db = require('./db');

const getMenuText = () => {
  return `🤖 *MENU BOT ARIA*
━━━━━━━━━━━━━━━━━━━━
1. 📋 *Follow Up Fatigue Hari Ini*
   /fatiguetoday

2. 🕓 *Riwayat Follow Up Fatigue*
   /fatiguebydate [tanggal]  
   contoh: /fatiguebydate 20250716

3. 🔍 *Riwayat Fatigue Berdasarkan NRP*
   /riwayatfatigue [NRP]  
   contoh: /riwayatfatigue 33220070

4. 📊 *Jumlah CNM Semua Operator*
   /jumlahcnm

5. 🔎 *Jumlah CNM Berdasarkan NRP*
   /jumlahcnm [NRP]  
   contoh: /jumlahcnm 33220011

6. 🔎 *Jumlah CNM Berdasarkan Nama*
   /cnmby [NRP]  
   contoh: /cnmby Akmal

7. 📊 *Grafik CNM*
   /grafikcnm (CNM YTD)
   /grafikcnm YYYYMMDD (Pilih tanggal awal)
   contoh: /grafikcnm 20250701
━━━━━━━━━━━━━━━━━━━━
Ketik salah satu perintah di atas untuk melihat data.
`;
};

const getReportWO = () => {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `📊 *REPORT WO ARIA*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Tanggal: ${currentDate}
🔧 Status:
✅ WO-001: Maintenance Pump A - COMPLETED
🔄 WO-002: Conveyor Belt - IN PROGRESS
⏳ WO-003: Panel Check - PENDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
};

const getFatigueToday = async () => {
  const today = new Date().toISOString().split('T')[0]; // format YYYY-MM-DD
  return await getFatigueByDate(today);
};

const getFatigueByDate = async (date) => {
  try {
    const pool = await db.poolPromise;
    const result = await pool.request()
      .query(`SELECT * FROM vw_t_followup_ftw_detail WHERE CAST(created_date AS DATE) = '${date}' ORDER BY created_date DESC`);

    const rows = result.recordset;

    if (rows.length === 0) {
      return `📅 *${date}*\nTidak ditemukan data fatigue untuk tanggal ini.`;
    }

    const dataText = rows.map((row, i) => {
      return `*${i + 1}. ${row.nama_operator}*
• WO: ${row.wo_number}
• NRP: ${row.nrp_operator}
• Followup: ${row.total_cnm_YTD}
• Alasan: ${row.alasan_tidur_kurang || '-'}
• Catatan: ${row.catatan?.substring(0, 180)}...`;
    }).join('\n\n');

    return `💤 *FATIGUE REPORT – ${date}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dataText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Source: vw_t_followup_ftw_detail`;

  } catch (err) {
    console.error('❌ DB Error (FatigueByDate):', err.message);
    return '❌ Gagal mengambil data dari database.';
  }
};

const getFatigueHistoryByNRP = async (nrp) => {
  try {
    const pool = await db.poolPromise;
    const result = await pool.request()
      .query(`SELECT * FROM vw_t_followup_ftw_detail WHERE nrp_operator = '${nrp}' ORDER BY created_date DESC`);

    const rows = result.recordset;

    if (rows.length === 0) {
      return `❌ Tidak ditemukan data fatigue untuk NRP ${nrp}.`;
    }

    const dataText = rows.map((row, i) => {
      return `*${i + 1}. ${row.nama_operator}*
📅 ${row.created_date.toISOString().split('T')[0]}
• WO: ${row.wo_number}
• Followup: ${row.cara_follow_up}
• Alasan: ${row.alasan_tidur_kurang || '-'}
• Catatan: ${row.catatan || '-'}
• Hasil Pemeriksaan: ${row.hasil_pe || '-'}`;
    }).join('\n\n');

    return `📜 *RIWAYAT FATIGUE – ${nrp}*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${dataText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 Source: vw_t_followup_ftw_detail`;

  } catch (err) {
    console.error('❌ DB Error (HistoryByNRP):', err.message);
    return '❌ Gagal mengambil data dari database.';
  }
};

const getJumlahCNM = async () => {
  try {
    const pool = await db.poolPromise;
    const result = await pool.request()
      .query(`SELECT nrp_operator, nama_operator, total_cnm_YTD FROM vw_t_followup_count ORDER BY total_cnm_YTD DESC`);

    const rows = result.recordset;

    if (rows.length === 0) {
      return '❌ Tidak ada data CNM ditemukan.';
    }

    const dataText = rows.map((row, i) => {
      return `${i + 1}. *${row.nama_operator}* (${row.nrp_operator}) – *${row.total_cnm_YTD}x*`;
    }).join('\n');

    return `📊 *DAFTAR JUMLAH CNM YTD*\n━━━━━━━━━━━━━━━━━━━━\n${dataText}\n━━━━━━━━━━━━━━━━━━━━\n📅 Source: vw_t_followup_count`;

  } catch (err) {
    console.error('❌ DB Error (JumlahCNM):', err.message);
    return '❌ Gagal mengambil data dari database.';
  }
};

const getJumlahCNMByNRP = async (nrp) => {
  try {
    const pool = await db.poolPromise;
    const result = await pool.request()
      .input('nrp', db.sql.VarChar, nrp)
      .query(`
        SELECT nrp_operator, nama_operator, total_cnm_YTD
        FROM vw_t_followup_count
        WHERE nrp_operator = @nrp
      `);

    if (result.recordset.length === 0) {
      return `❌ Data CNM tidak ditemukan untuk NRP *${nrp}*.`;
    }

    const { nama_operator, total_cnm_YTD } = result.recordset[0];

    return `📌 *DATA CNM OPERATOR*\n━━━━━━━━━━━━━━━━━━━━\n👤 *${nama_operator}*\n🆔 NRP: ${nrp}\n📊 CNM YTD: *${total_cnm_YTD}x*`;
  } catch (err) {
    console.error('❌ DB Error (JumlahCNMByNRP):', err.message);
    return '❌ Terjadi kesalahan saat mengambil data.';
  }
};

const getCNMByNama = async (nama) => {
  try {
    const pool = await db.poolPromise;
    const result = await pool.request()
      .input('nama', db.sql.VarChar, `%${nama}%`)
      .query(`
        SELECT TOP 10 nrp_operator, nama_operator, total_cnm_YTD
        FROM vw_t_followup_count
        WHERE nama_operator LIKE @nama
        ORDER BY total_cnm_YTD DESC
      `);

    const rows = result.recordset;

    if (rows.length === 0) {
      return `🔍 Tidak ditemukan operator dengan nama mengandung *${nama}*.`;
    }

    let message = `📋 *Hasil CNM untuk "${nama}"*\n\n`;
    for (const row of rows) {
      message += `👷 *${row.nama_operator}*\n🆔 NRP: ${row.nrp_operator}\n📊 CNM YTD: *${row.total_cnm_YTD}*\n\n`;
    }

    return message;
  } catch (err) {
    console.error('Error getCNMByNama:', err);
    return '⚠️ Terjadi kesalahan saat mengambil data CNM.';
  }
};



module.exports = {
  getMenuText,
  getReportWO,
  getFatigueToday,
  getFatigueByDate,
  getFatigueHistoryByNRP,
  getJumlahCNM,
  getJumlahCNMByNRP,
  getCNMByNama // ← ini ditambahkan
};
