//whatsapp.js
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mqtt = require('mqtt');
const mqtt_conf = require('./mqtt_config');
const db = require('./db');
const menu = require('./menu'); // << import command menu bot
const { MessageMedia } = require('whatsapp-web.js');
const { generateCNMChartBase64 } = require('./grafik');

/* ========== 1. WHATSAPP CLIENT ========== */
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'session' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ],
  },
});

let waReady = false;
const pendingQueue = [];
const processedMessages = new Set();
const MESSAGE_CACHE_TTL = 60000;

/* ========== 2. MQTT CONFIG ========== */
const MQTT_ADDR = 'mqtt://10.2.195.30/';
const MQTT_TOPIC_SEND = 'svc_wa_send';
const MQTT_TOPIC_RECEIVE = 'svc_wa_receive';

const mqtt_client = mqtt.connect(MQTT_ADDR, mqtt_conf);

mqtt_client.on('connect', () => {
  mqtt_client.subscribe(MQTT_TOPIC_SEND, err => {
    if (err) return console.error('❌ MQTT Subscribe Error:', err);
    console.log('✅ Subscribed to MQTT Topic:', MQTT_TOPIC_SEND);
  });
});

/* ========== 3. HELPER FUNCTIONS ========== */
const replaceAll = (txt, search, replace) => txt.split(search).join(replace);

const publishMqtt = (no_hp, text, sendTo = 'contact') => {
  const payload = JSON.stringify({ no_hp, msg: text, send_to: sendTo });
  mqtt_client.publish(MQTT_TOPIC_RECEIVE, payload, { qos: 0 }, err => {
    if (err) console.error('❌ MQTT Publish Error:', err);
  });
};

const sendSafe = async (id, message, opts = {}) => {
  if (!waReady) {
    console.log(`[DEBUG] WA not ready, queueing: ${id}`);
    return pendingQueue.push({ id, message, opts });
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    await client.sendMessage(id, message, opts);
    console.log(`✅ Sent to ${id}`);
  } catch (err) {
    if (!err.message.includes('serialize')) {
      try {
        const chat = await client.getChatById(id);
        await chat.sendMessage(message);
        console.log(`✅ Sent (alternative) to ${id}`);
      } catch (altErr) {
        console.error('❌ sendMessage failed:', altErr.message);
      }
    } else {
      console.warn(`⚠️ Serialize error (ignored): ${id}`);
    }
  }
};

/* ========== 4. MQTT HANDLER ========== */
mqtt_client.on('message', async (_topic, raw) => {
  let data;
  try { data = JSON.parse(raw.toString()); } catch { return; }

  if (!data.no_hp || !data.msg) return;

  const text = replaceAll(data.msg, '^', '\n');

  if (data.send_to === 'group') {
    const groupId = `${data.no_hp}@g.us`;
    const mentions = (Array.isArray(data.tag_no) ? data.tag_no : [])
                     .map(n => `${n}@c.us`);
    await sendSafe(groupId, text, { mentions });
  } else {
    let number = data.no_hp.replace(/[^0-9]/g, '');
    if (number.startsWith('0')) number = '62' + number.slice(1);
    const contactId = `${number}@c.us`;
    await sendSafe(contactId, text);
  }
});

/* ========== 5. WHATSAPP EVENTS ========== */
client
  .on('qr', qr => {
    console.log('📱 Scan QR code to login:');
    qrcode.generate(qr, { small: true });
  })
  .on('ready', () => {
    waReady = true;
    console.log('✅ WhatsApp client ready');
    pendingQueue.splice(0).forEach(({ id, message, opts }) => sendSafe(id, message, opts));
  })
  .on('auth_failure', err => {
    console.error('❌ Auth failed:', err);
  })
  .on('disconnected', reason => {
    console.error('❌ Disconnected:', reason);
    process.exit(1);
  })
  .on('message', async msg => {

    const messageId = `${msg.from}_${msg.timestamp}_${msg.body}`;
    if (processedMessages.has(messageId)) return;
    processedMessages.add(messageId);
    setTimeout(() => processedMessages.delete(messageId), MESSAGE_CACHE_TTL);

    if (msg.fromMe) return;

    const text = msg.body.trim();
    const lower = text.toLowerCase();
    const sender = msg.from.replace(/@(c|g)\.us$/, '');
    const isDm = msg.from.endsWith('@c.us');

    console.log(`[WA] Msg from ${sender}: ${text}`);


    // === COMMAND HANDLERS ===
if (lower.startsWith('/grafikcnm')) {
  const parts = lower.split(' ');

  let startDate = null;
  if (parts.length === 2) {
    const rawDate = parts[1];
    // Validasi: harus 8 digit angka
    if (/^\d{8}$/.test(rawDate)) {
      // Format ulang jadi YYYY-MM-DD
      startDate = `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`;
    } else {
      return await sendSafe(msg.from, '❌ Format tanggal salah.\nContoh: `/grafikcnm 20250701`');
    }
  }

  const base64 = await generateCNMChartBase64(startDate);
  if (!base64) return await sendSafe(msg.from, '❌ Gagal membuat grafik.');

  const media = new MessageMedia('image/png', base64, 'grafikcnm.png');
  return await client.sendMessage(msg.from, media);
}



	if (lower.startsWith('/cnmby')) {
  const parts = msg.body.split(' '); // Gunakan .body agar tidak lowercase
  if (parts.length < 2) {
    return await sendSafe(msg.from, '❌ Format salah.\nGunakan: `/cnmby Nama Operator`\nContoh: `/cnmby Ahmad Salim`');
  }

  const nama = parts.slice(1).join(' ');
  const res = await menu.getCNMByNama(nama);
  return await sendSafe(msg.from, res);
}

	if (lower.startsWith('/jumlahcnm')) {
  const parts = lower.split(' ');
  if (parts.length === 2) {
    const nrp = parts[1];
    const res = await menu.getJumlahCNMByNRP(nrp);
    return await sendSafe(msg.from, res);
  } else {
    const res = await menu.getJumlahCNM(); // default tanpa NRP
    return await sendSafe(msg.from, res);
  }
}

if (lower.startsWith('/riwayatfatigue')) {
  const parts = lower.split(' ');
  if (parts.length !== 2 || !/^[a-zA-Z0-9]+$/.test(parts[1])) {
    return await sendSafe(msg.from, '❌ Format salah.\nGunakan: `/riwayatfatigue 33220070`');
  }

  if (lower === '/jumlahcnm') {
  const res = await menu.getJumlahCNM();
  return await sendSafe(msg.from, res);
}

  const nrp = parts[1];
  const res = await menu.getFatigueHistoryByNRP(nrp);
  return await sendSafe(msg.from, res);
}
    if (lower === '/menu') {
      const res = menu.getMenuText();
      return await sendSafe(msg.from, res);
    }

    if (lower === '/report') {
      const res = menu.getReportWO();
      return await sendSafe(msg.from, res);
    }

    if (lower === '/fatiguetoday') {
      const res = await menu.getFatigueToday();
      return await sendSafe(msg.from, res);
    }

if (lower.startsWith('/fatiguebydate')) {
  const parts = lower.split(' ');
  if (parts.length !== 2 || !/^\d{8}$/.test(parts[1])) {
    return await sendSafe(msg.from, '❌ Format salah.\nGunakan: `/fatiguebydate YYYYMMDD`\nContoh: `/fatiguebydate 20250716`');
  }

  // Format ulang menjadi YYYY-MM-DD
  const raw = parts[1];
  const formattedDate = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;

  const res = await menu.getFatigueByDate(formattedDate);
  return await sendSafe(msg.from, res);
}


    if (lower === 'aria') {
      await sendSafe(msg.from, 'test');
      publishMqtt(sender, 'test', isDm ? 'contact' : 'group');
      return;
    }

    if (isDm) {
      await sendSafe(msg.from, msg.body);
      publishMqtt(sender, msg.body, 'contact');
    }
  });

  
/* ========== 6. CACHE CLEANER ========== */
setInterval(() => {
  const size = processedMessages.size;
  processedMessages.clear();
  console.log(`🧹 Cache cleared: ${size} entries`);
}, MESSAGE_CACHE_TTL);

/* ========== 7. START WA CLIENT ========== */
client.initialize();
