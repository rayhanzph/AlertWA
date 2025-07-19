const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const db = require('./db');

const width = 1000;
const height = 600;
const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

// const generateCNMChartBase64 = async () => {
//   try {
//     const pool = await db.poolPromise;
//     const result = await pool.request()
//       .query(`SELECT TOP 30 nama_operator, total_cnm_YTD FROM vw_t_followup_count ORDER BY total_cnm_YTD DESC`);

//     const rows = result.recordset;

//     const labels = rows.map(row => row.nama_operator);
//     const data = rows.map(row => row.total_cnm_YTD);

//     const config = {
//       type: 'bar',
//       data: {
//         labels,
//         datasets: [{
//           label: 'Jumlah CNM YTD',
//           data,
//           backgroundColor: 'rgba(54, 162, 235, 0.8)'
//         }]
//       },
//       options: {
//         responsive: false,
//         layout: {
//           padding: {
//             top: 30,
//             bottom: 30,
//             left: 20,
//             right: 20
//           }
//         },
//         plugins: {
//           title: {
//             display: true,
//             text: 'Jumlah CNM Operator – Top 30 (YTD)',
//             font: {
//               size: 18
//             }
//           },
//           legend: {
//             display: false
//           },
//           tooltip: {
//             enabled: true
//           }
//         },
//         scales: {
//           x: {
//             ticks: {
//               maxRotation: 60,
//               minRotation: 45,
//               font: {
//                 size: 11
//               }
//             }
//           },
//           y: {
//             beginAtZero: true,
//             ticks: {
//               stepSize: 1,
//               font: {
//                 size: 12
//               }
//             }
//           }
//         }
//       }
//     };

//     const dataUrl = await chartJSNodeCanvas.renderToDataURL(config);
//     const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
//     return base64;
//   } catch (err) {
//     console.error('❌ Error generateCNMChartBase64:', err);
//     return null;
//   }
// };

// module.exports = { generateCNMChartBase64 };


const generateCNMChartBase64 = async (startDate = null) => {
  try {
    const pool = await db.poolPromise;
    let query = `
      SELECT TOP 30 nama_operator, COUNT(*) AS total_cnm
      FROM vw_t_followup_ftw_detail
    `;

    if (startDate) {
      query += ` WHERE CONVERT(date, created_date) >= @startDate`;
    }

    query += `
      GROUP BY nama_operator
      ORDER BY total_cnm DESC
    `;

    const request = pool.request();
    if (startDate) {
      request.input('startDate', startDate);
    }

    const result = await request.query(query);
    const rows = result.recordset;

    const labels = rows.map(row => row.nama_operator);
    const data = rows.map(row => row.total_cnm);

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: startDate
            ? `Jumlah Follow-up sejak ${startDate}`
            : 'Jumlah Follow-up (YTD)',
          data,
          backgroundColor: 'rgba(54, 162, 235, 0.8)'
        }]
      },
      options: {
        responsive: false,
        layout: { padding: { top: 30, bottom: 30, left: 20, right: 20 } },
        plugins: {
          title: {
            display: true,
            text: startDate
              ? `Top 30 Operator Follow-up sejak ${startDate}`
              : 'Top 30 Operator Follow-up (YTD)',
            font: { size: 18 }
          },
          legend: { display: false },
          tooltip: { enabled: true }
        },
        scales: {
          x: {
            ticks: { maxRotation: 60, minRotation: 45, font: { size: 11 } }
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, font: { size: 12 } }
          }
        }
      }
    };

    const dataUrl = await chartJSNodeCanvas.renderToDataURL(config);
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  } catch (err) {
    console.error('❌ Error generateCNMChartBase64:', err);
    return null;
  }
};


module.exports = { generateCNMChartBase64 };