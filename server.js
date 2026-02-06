const express = require('express');
const Parser = require('rss-parser');
const parser = new Parser();

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static('public'));

// News topics with Google News RSS feeds
const NEWS_SOURCES = {
  'Vertical Software & Private Equity': [
    'https://news.google.com/rss/search?q=vertical+software+private+equity&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=software+buyout+private+equity&hl=en-US&gl=US&ceid=US:en'
  ],
  'Layoffs & Hiring in Canada': [
    'https://news.google.com/rss/search?q=layoffs+canada&hl=en-CA&gl=CA&ceid=CA:en',
    'https://news.google.com/rss/search?q=hiring+trends+canada&hl=en-CA&gl=CA&ceid=CA:en'
  ],
  'CEO Talent Insights': [
    'https://news.google.com/rss/search?q=CEO+talent+leadership&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=executive+hiring+trends&hl=en-US&gl=US&ceid=US:en'
  ],
  'Talent Intelligence': [
    'https://news.google.com/rss/search?q=talent+intelligence+HR+analytics&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=workforce+analytics+talent&hl=en-US&gl=US&ceid=US:en'
  ],
  'LinkedIn Insights': [
    'https://news.google.com/rss/search?q=linkedin+data+insights&hl=en-US&gl=US&ceid=US:en',
    'https://news.google.com/rss/search?q=linkedin+hiring+trends&hl=en-US&gl=US&ceid=US:en'
  ],
  'Tech & AI Startups in Canada': [
    'https://news.google.com/rss/search?q=AI+startups+canada&hl=en-CA&gl=CA&ceid=CA:en',
    'https://news.google.com/rss/search?q=tech+startups+toronto+vancouver&hl=en-CA&gl=CA&ceid=CA:en'
  ]
};

// Fetch news for all categories
async function fetchAllNews() {
  const allNews = {};
  
  for (const [category, feeds] of Object.entries(NEWS_SOURCES)) {
    allNews[category] = [];
    
    for (const feedUrl of feeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const articles = feed.items.slice(0, 5).map(item => ({
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          source: item.source || 'Google News',
          description: item.contentSnippet || item.content || ''
        }));
        
        allNews[category].push(...articles);
      } catch (error) {
        console.error(`Error fetching ${category}:`, error.message);
      }
    }
    
   // Remove duplicates, filter last 30 days, and sort by date
   const thirtyDaysAgo = new Date();
   thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
   
   allNews[category] = Array.from(new Map(
     allNews[category].map(item => [item.link, item])
   ).values())
     .filter(item => new Date(item.pubDate) >= thirtyDaysAgo)
     .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
     .slice(0, 8);
     ;
  }
  
  return allNews;
}

// API endpoint
app.get('/api/news', async (req, res) => {
  try {
    const news = await fetchAllNews();
    res.json(news);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

app.listen(PORT, () => {
  console.log(`News scraper running at http://localhost:${PORT}`);
  console.log('Open your browser and go to that URL!');
});
