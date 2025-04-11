const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// === TRYB 1: ANALIZA PRODUKTU ===
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
    const title = $('#productTitle').text().trim();

    let price = $('#priceblock_ourprice').text().trim()
              || $('#priceblock_dealprice').text().trim()
              || $('[data-asin-price]').first().text().trim()
              || $('.a-price .a-offscreen').first().text().trim();

    let bsr = null;
    const rankText = $('body').text();
    const match = rankText.match(/#([\d,]+)\s+in\s+Books/i);
    if (match) {
      bsr = match[1].replace(/,/g, '');
    }

    let image = $('#imgBlkFront').attr('src') 
              || $('#landingImage').attr('src')
              || $('img#ebooksImgBlkFront').attr('src')
              || $('img.a-dynamic-image').attr('src');

    let rating = $('i.a-icon-star span.a-icon-alt').first().text().trim();
    if (rating) {
      rating = rating.match(/[\d.]+/)?.[0] || null;
    }

    let reviewsCount = $('#acrCustomerReviewText').text().trim();
    if (reviewsCount) {
      const match = reviewsCount.match(/([\d,.]+)/);
      reviewsCount = match ? match[1].replace(/[,.]/g, '') : null;
    }

    let author = $('a.contributorNameID').first().text().trim()
              || $('a.author > span.a-declarative').first().text().trim()
              || $('.author a').first().text().trim();

    let pubDate = null;
    const dateMatch = response.data.match(/Publication date<\/span>\s*<\/span>\s*<span[^>]*>([^<]+)<\/span>/i);
    if (dateMatch) {
      pubDate = dateMatch[1].trim();
    }

    let pages = null;
    const pagesMatch = response.data.match(/Print length<\/span>\s*<\/span>\s*<span[^>]*>(\d+)[^<]*<\/span>/i);
    if (pagesMatch) {
      pages = pagesMatch[1];
    }

    res.json({
      title: title || null,
      price: price || null,
      bsr: bsr || null,
      image: image || null,
      rating: rating || null,
      reviewsCount: reviewsCount || null,
      author: author || null,
      publicationDate: pubDate || null,
      pages: pages || null
    });

  } catch (err) {
    res.status(500).json({ error: 'Błąd podczas scrapowania produktu Amazon.', details: err.message });
  }
});

// === TRYB 2: ANALIZA NISZY ===
app.get('/search-analyze', async (req, res) => {
  const { url } = req.query;
  if (!url || (!url.includes('/s?') && !url.includes('/s='))) {
    return res.status(400).json({ error: 'Podaj poprawny link do wyników wyszukiwania Amazon.' });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const $ = cheerio.load(response.data);
    const products = [];

    $('div.s-main-slot > div[data-asin]').each((i, el) => {
      if (products.length >= 20) return;

      const asin = $(el).attr('data-asin');
      if (!asin || asin.trim() === '') return;

      const title = $(el).find('h2 a span').text().trim();
      const price = $(el).find('.a-price .a-offscreen').first().text().trim();
      const reviews = $(el).find('.a-size-small .a-size-base').last().text().trim();
      const bsrMatch = $(el).html().match(/#([\d,]+)\s+in\s+Books/i);
      const bsr = bsrMatch ? bsrMatch[1].replace(/,/g, '') : '100000';

      if (title && price) {
        products.push({
          title,
          price,
          reviews: reviews.replace(/[^\d]/g, '') || '0',
          bsr: bsr
        });
      }
    });

    if (products.length === 0) {
      return res.status(404).json({ error: 'Nie znaleziono produktów na stronie.' });
    }

    const total = products.length;
    const avgPrice = (
      products.reduce((sum, p) => sum + parseFloat(p.price.replace(/[^0-9.]/g, '')) || 0, 0) / total
    ).toFixed(2);

    const avgBSR = Math.round(
      products.reduce((sum, p) => sum + parseInt(p.bsr) || 100000, 0) / total
    );

    const avgReviews = Math.round(
      products.reduce((sum, p) => sum + parseInt(p.reviews) || 0, 0) / total
    );

    const competition = avgReviews > 500 ? 'Wysoka' : avgReviews > 200 ? 'Średnia' : 'Niska';
    const potential = avgBSR < 20000 && avgReviews < 300 ? 'Wysoki' : avgBSR < 50000 ? 'Średni' : 'Niski';

    res.json({
      total,
      avgPrice,
      avgBSR,
      avgReviews,
      competition,
      potential,
      books: products
    });

  } catch (err) {
    res.status(500).json({ error: 'Błąd podczas analizy wyników wyszukiwania Amazon.', details: err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Scraper działa na porcie ${port}`);
});
