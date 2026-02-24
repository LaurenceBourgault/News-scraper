const express = require('express');
const cron = require('node-cron');
const { fetchAllNews, getCacheInfo } = require('./lib/fetcher');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/api/news', async (req, res) => {
  try {
    const data = await fetchAllNews();
    res.json({
      lastUpdated: data.lastUpdated,
      stats: data.stats,
      categories: data.categories,
    });
  } catch (error) {
    console.error('Error serving /api/news:', error.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.post('/api/news/refresh', async (req, res) => {
  try {
    console.log('Manual refresh triggered');
    const data = await fetchAllNews({ force: true });
    res.json({
      message: 'Cache refreshed',
      lastUpdated: data.lastUpdated,
      stats: data.stats,
    });
  } catch (error) {
    console.error('Refresh error:', error.message);
    res.status(500).json({ error: 'Failed to refresh news' });
  }
});

app.get('/api/status', (req, res) => {
  const cache = getCacheInfo();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    cache,
  });
});

// Refresh every day at midnight
cron.schedule('0 0 * * *', async () => {
  console.log(`[${new Date().toISOString()}] Scheduled daily refresh starting...`);
  try {
    await fetchAllNews({ force: true });
    console.log(`[${new Date().toISOString()}] Scheduled refresh complete.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Scheduled refresh failed:`, err.message);
  }
});

app.listen(PORT, async () => {
  console.log(`News scraper running at http://localhost:${PORT}`);
  console.log('Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/news         - Get news`);
  console.log(`  POST http://localhost:${PORT}/api/news/refresh - Force refresh`);
  console.log(`  GET  http://localhost:${PORT}/api/status        - Cache & health info`);
  console.log('');
  console.log('Daily auto-refresh scheduled at midnight.');
  console.log('Warming cache on startup...');
  try {
    await fetchAllNews();
    console.log('Cache warm — ready to serve.');
  } catch (err) {
    console.error('Startup fetch failed:', err.message);
  }
});
