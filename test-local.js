// Local test script for Vercel serverless function
// This simulates the Vercel runtime environment locally

const handler = require('./api/news/index.js');

// Create mock request and response objects
const mockReq = {
  method: 'GET',
  url: '/api/news',
  headers: {}
};

const mockRes = {
  statusCode: 200,
  headers: {},
  body: null,
  setHeader: function(name, value) {
    this.headers[name] = value;
  },
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    this.body = data;
    console.log('\n✅ Response Status:', this.statusCode);
    console.log('✅ Response Headers:', JSON.stringify(this.headers, null, 2));
    console.log('✅ Response Body (first 500 chars):', JSON.stringify(data, null, 2).substring(0, 500));
    if (JSON.stringify(data).length > 500) {
      console.log('... (truncated)');
    }
    return this;
  }
};

console.log('🧪 Testing Vercel serverless function locally...\n');
console.log('📡 Making request to /api/news');
console.log('⏳ This may take 10-30 seconds to fetch RSS feeds...\n');

// Call the handler (it's async, so we need to handle it)
(async () => {
  try {
    await handler(mockReq, mockRes);
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
})();

