const http = require('http');

test('GET /health returns 200', (done) => {
  http.get('http://localhost:3000/health', res => {
    expect(res.statusCode).toBe(200);
    done();
  }).on('error', done);
});
