const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
app.use(express.json());

// -------------------------------------------------------------
// KONFIGURASI RATE LIMIT: MAX 3 KALI PER HARI (24 JAM) PER IP
// -------------------------------------------------------------
const apiLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Batas penggunaan harian tercapai. Kamu hanya bisa mencoba 3 kali per hari.'
  },
  standardHeaders: true, 
  legacyHeaders: false,
});

const API_URL = 'https://anita-studio.netlify.app/.netlify/functions/amprem';

async function postToApi(action, data) {
  const response = await axios.post(
    API_URL,
    { action, ...data },
    { headers: { 'Content-Type': 'application/json' } }
  );
  return response.data;
}

// Route untuk menampilkan index.html langsung dari folder utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint API dengan Limiter
app.post('/api/send-link', apiLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email tidak boleh kosong.' });

    const result = await postToApi('send-magiclink', { email });
    res.json(result);
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.response?.data?.message || err.message || 'Terjadi kesalahan pada server.' 
    });
  }
});

app.post('/api/process-premium', apiLimiter, async (req, res) => {
  try {
    const { email, rawLink } = req.body;
    if (!email || !rawLink) return res.status(400).json({ success: false, message: 'Email dan Link wajib diisi.' });

    const verifyRes = await postToApi('verify-account', { email, rawLink });
    if (!verifyRes.success) throw new Error(verifyRes.message || 'Verifikasi gagal');

    const idToken = verifyRes.idToken || verifyRes.profile?.idToken;
    if (!idToken) throw new Error('idToken tidak ditemukan dalam respons verifikasi');

    const premRes = await postToApi('apply-premium', { email, idToken });
    res.json(premRes);

  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: err.response?.data?.message || err.message || 'Terjadi kesalahan saat memproses.' 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
