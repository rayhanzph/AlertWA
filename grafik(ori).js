// grafik.js
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const db = require('./db');

const width = 800;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

const generateCNMChartBase64 = async () => {
  try {
    const pool = await db.poolPromise;
    const result = await pool.request()
      .query(`SELECT TOP 20 nama_operator, total_cnm_YTD FROM vw_t_followup_count ORDER BY total_cnm_YTD DESC`);

    const rows = result.recordset;
    const labels = rows.map(row => row.nama_operator);
    const data = rows.map(row => row.total_cnm_YTD);

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Jumlah CNM YTD',
          data,
          backgroundColor: 'rgba(75, 192, 192, 0.7)'
        }]
      },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: 'Top 10 Operator CNM (YTD)'
          },
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    };

    // Hasilkan base64 string
    const dataUrl = await chartJSNodeCanvas.renderToDataURL(config);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, ''); // buang prefix

    return base64;
  } catch (err) {
    console.error('❌ Error generateCNMChartBase64:', err);
    return null;
  }
};

module.exports = { generateCNMChartBase64 };
