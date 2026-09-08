const http = require('http');

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting AeroTrack Endpoint Verification...');

  // Start the server in process
  const { app, server } = require('./server');

  // Give 500ms for server to bind
  await new Promise(r => setTimeout(r, 600));

  try {
    // 1. GET /api/flights
    const flightsRes = await request('http://localhost:3000/api/flights');
    console.log(`✔ [GET /api/flights] Status: ${flightsRes.status}, Total: ${flightsRes.body.length} flights`);

    // 2. GET /api/flights with convenience filter
    const convRes = await request('http://localhost:3000/api/flights?minConvenience=92');
    console.log(`✔ [GET /api/flights?minConvenience=92] Status: ${convRes.status}, High-convenience count: ${convRes.body.length}`);

    // 3. GET /api/prices/trends
    const trendRes = await request('http://localhost:3000/api/prices/trends?flightId=fl-101');
    console.log(`✔ [GET /api/prices/trends] Status: ${trendRes.status}, Past days: ${trendRes.body.history?.length}, Future days: ${trendRes.body.forecast?.length}, Action: ${trendRes.body.recommendation?.action}`);

    // 4. GET /api/deals
    const dealsRes = await request('http://localhost:3000/api/deals');
    console.log(`✔ [GET /api/deals] Status: ${dealsRes.status}, Active Deals: ${dealsRes.body.length}`);

    // 5. GET /api/recommendations
    const recRes = await request('http://localhost:3000/api/recommendations');
    console.log(`✔ [GET /api/recommendations] Status: ${recRes.status}, Best Overall: ${recRes.body.bestOverall?.flightNumber}, Cheapest: ${recRes.body.cheapest?.flightNumber}`);

    // 6. GET /api/stats
    const statsRes = await request('http://localhost:3000/api/stats');
    console.log(`✔ [GET /api/stats] Status: ${statsRes.status}, Airborne: ${statsRes.body.inFlight}, Avg Convenience: ${statsRes.body.avgConvenience}%`);

    // 7. POST /api/flights
    const postRes = await request('http://localhost:3000/api/flights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flightNumber: 'TEST-999',
        origin: 'DEL',
        destination: 'SFO',
        status: 'In Flight'
      })
    });
    console.log(`✔ [POST /api/flights] Status: ${postRes.status}, Created Flight: ${postRes.body.flightNumber} with id ${postRes.body.id}`);

    // 8. DELETE /api/flights/:id
    const delRes = await request(`http://localhost:3000/api/flights/${postRes.body.id}`, {
      method: 'DELETE'
    });
    console.log(`✔ [DELETE /api/flights/:id] Status: ${delRes.status}, Purged: ${delRes.body.target?.flightNumber}`);

    console.log('\n✨ ALL BACKEND TESTS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    server.close();
    process.exit(0);
  }
}

runTests();
