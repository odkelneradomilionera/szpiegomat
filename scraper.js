const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes('amazon.')) {
    return res.status(400).json({ error: 'Niepoprawny link Amazon.' });
  }

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(response.data);
    const title = $('#productTitle').text().trim();
    const price = $('#priceblock_ourprice').text().trim() || $('#priceblock_dealprice').text().trim();
    const details = $('#productDetails_detailBullets_sections1').text();
    const bsrMatch = details.match(/#([\d,]+)\s+in\s+Books/i);
    const bsr = bsrMatch ? parseInt(bsrMatch[1].replace(/,/g, '')) : null;

    res.json({ title, price, bsr });
  } catch (err) {
    res.status(500).json({ error: 'Nie udało się pobrać danych.', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Scraper działa na porcie ${port}`);
});
