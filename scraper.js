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
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);

    // Tytuł
    const title = $('#productTitle').text().trim();

    // Cena
    let price = $('#priceblock_ourprice').text().trim()
              || $('#priceblock_dealprice').text().trim()
              || $('[data-asin-price]').first().text().trim()
              || $('.a-price .a-offscreen').first().text().trim();

    // BSR (ranking)
    let bsr = null;
    const rankText = $('#productDetails_detailBullets_sections1').text()
                   || $('#detailBulletsWrapper_feature_div').text()
                   || $('#SalesRank').text();
    const match = rankText.match(/#([\d,]+)\s+in\s+Books/i);
    if (match) {
      bsr = match[1].replace(/,/g, '');
    }

    // Okładka
    let image = $('#imgBlkFront').attr('src') 
              || $('#landingImage').attr('src')
              || $('img#ebooksImgBlkFront').attr('src')
              || $('img.a-dynamic-image').attr('src');

    // Średnia ocena (gwiazdki)
    let rating = $('span[data-asin-average-rating]').attr('data-asin-average-rating')
              || $('i.a-icon-star span.a-icon-alt').first().text().trim()
              || $('.reviewCountTextLinkedHistogram.noUnderline').attr('title');
    if (rating) {
      rating = rating.match(/[\d.]+/)?.[0] || null;
    }

    // Liczba recenzji
    let reviewsCount = $('#acrCustomerReviewText').text().trim();
    if (reviewsCount) {
      reviewsCount = reviewsCount.replace(/[^\d]/g, '');
    }

    res.json({
      title: title || null,
      price: price || null,
      bsr: bsr || null,
      image: image || null,
      rating: rating || null,
      reviewsCount: reviewsCount || null
    });

  } catch (err) {
    res.status(500).json({ error: 'Błąd podczas scrapowania strony Amazon.', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Scraper działa na porcie ${port}`);
});
