const { fetchAllNews } = require('../../lib/fetcher');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

  try {
    const data = await fetchAllNews();
    res.status(200).json({
      lastUpdated: data.lastUpdated,
      stats: data.stats,
      categories: data.categories,
    });
  } catch (error) {
    console.error('Handler error:', error.message);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
};
