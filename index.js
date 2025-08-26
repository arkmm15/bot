const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@adiwajshing/baileys');
const P = require('pino');
const fs = require('fs');
const ytdl = require('ytdl-core');
const axios = require('axios');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['MetaBot', 'Chrome', '20.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') {
      console.log('✅ Bot tersambung ke WhatsApp');
    } else if (connection === 'close') {
      console.log('❌ Koneksi terputus, mencoba ulang...');
      startBot();
    }
  });

  // Handler pesan masuk
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      '';

    console.log('📩 Dari', sender, ':', text);

    // .allmenu
    if (text.startsWith('.allmenu')) {
      await sock.sendMessage(sender, {
        text: `📌 *All Menu*
1. .allmenu → lihat semua perintah
2. .brat [teks] → buat stiker teks
3. .confes [nomor]|[pesan] → confess anonim
4. .bug [jumlah] → prank teks glitch
5. .tiktok [url] → download video TikTok
6. .yt [url] → download video YouTube`
      });
    }

    // .brat
    else if (text.startsWith('.brat ')) {
      const teks = text.replace('.brat ', '');
      await sock.sendMessage(sender, {
        sticker: {
          url: `https://api.xteam.xyz/sticker?text=${encodeURIComponent(teks)}`
        }
      });
    }

    // .confes
    else if (text.startsWith('.confes ')) {
      const isi = text.replace('.confes ', '');
      const [nomor, pesan] = isi.split('|');
      if (!nomor || !pesan) {
        return sock.sendMessage(sender, {
          text: '❌ Format salah!\nContoh: .confes 6281234567890|Aku suka kamu ❤️'
        });
      }
      const jid = nomor.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
      await sock.sendMessage(jid, {
        text: `💌 *Pesan Rahasia*:\n\n${pesan}`
      });
      await sock.sendMessage(sender, { text: '✅ Confess berhasil dikirim!' });
    }

    // .bug
    else if (text.startsWith('.bug')) {
      let jumlah = parseInt(text.split(' ')[1]) || 5;
      let bugText = "𓆩𓆩𓆩  ＢＵＧ ＢＯＴ  𓆩𓆩𓆩";
      for (let i = 0; i < jumlah; i++) {
        await sock.sendMessage(sender, { text: bugText });
      }
    }

    // .tiktok
    else if (text.startsWith('.tiktok ')) {
      const url = text.split(' ')[1];
      if (!url) return sock.sendMessage(sender, { text: '❌ Masukkan link TikTok!' });

      try {
        const api = `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`;
        const res = await axios.get(api);
        const dl = res.data.video.noWatermark || res.data.video;
        await sock.sendMessage(sender, {
          video: { url: dl },
          caption: '✅ TikTok video berhasil diunduh!'
        });
      } catch (e) {
        sock.sendMessage(sender, { text: '❌ Gagal download TikTok!' });
      }
    }

    // .yt
    else if (text.startsWith('.yt ')) {
      const url = text.split(' ')[1];
      if (!url || !ytdl.validateURL(url)) {
        return sock.sendMessage(sender, { text: '❌ Masukkan link YouTube valid!' });
      }
      try {
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title;
        const stream = ytdl(url, { filter: 'audioandvideo', quality: 'lowest' });
        const path = `yt-${Date.now()}.mp4`;
        const writeStream = fs.createWriteStream(path);
        stream.pipe(writeStream);
        writeStream.on('finish', async () => {
          await sock.sendMessage(sender, {
            video: fs.readFileSync(path),
            caption: `🎬 ${title}`
          });
          fs.unlinkSync(path);
        });
      } catch (e) {
        sock.sendMessage(sender, { text: '❌ Gagal download YouTube!' });
      }
    }
  });
}

startBot().catch((err) => console.error('Bot error:', err));