const chaiHttp = require('chai-http');
const chai = require('chai');
const assert = chai.assert;
const server = require('../server');

chai.use(chaiHttp);

suite('Functional Tests', function() {
  this.timeout(5000);
  let likesVar = 0
  let likesVar2 = 0

  //test #1
  test('Viewing one stock: GET request to /api/stock-prices/', (done) => {
    chai
        .request(server)
        .get('/api/stock-prices?stock=GOOG')
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.body.stockData.stock, 'GOOG');
          assert.equal(typeof res.body.stockData.price, "number");
          assert.equal(typeof res.body.stockData.likes, "number");
          done()
        })
  })

  //test #2
  test('Viewing one stock and liking it: GET request to /api/stock-prices/', (done) => {
    chai
        .request(server)
        .get('/api/stock-prices?stock=GOOG&like=true')
        .set('x-forwarded-for', '136.144.17.247')
        .end((err, res) => {
          likesVar = res.body.stockData.likes
          assert.equal(res.status, 200);
          assert.equal(res.body.stockData.stock, 'GOOG');
          assert.equal(typeof res.body.stockData.price, "number");
          assert.equal(res.body.stockData.likes, likesVar);
          done()
        })
  })

  //test #3
  test('Viewing the same stock and liking it again: GET request to /api/stock-prices/', (done) => {
    chai
        .request(server)
        .get('/api/stock-prices?stock=GOOG&like=true')
        .set('x-forwarded-for', '136.144.17.247')
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.body.stockData.stock, 'GOOG');
          assert.equal(typeof res.body.stockData.price, "number");
          assert.equal(res.body.stockData.likes, likesVar);
          done()
        })
  })

  //test #4
  test('Viewing two stocks: GET request to /api/stock-prices/', (done) => {
    chai
        .request(server)
        .get('/api/stock-prices?stock=GOOG&stock=MSFT')
        .set('x-forwarded-for', '136.144.17.247')
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.body.stockData[0].stock, 'GOOG');
          assert.equal(typeof res.body.stockData[0]['price'], "number");
          assert.equal(typeof res.body.stockData[0]['rel_likes'], "number");
          assert.equal(res.body.stockData[1].stock, 'MSFT');
          assert.equal(typeof res.body.stockData[1]['price'], "number");
          assert.equal(typeof res.body.stockData[1]['rel_likes'], "number");
          done()
        })
  })

  //test #5
  test('Viewing two stocks and liking them: GET request to /api/stock-prices/', (done) => {
    chai
        .request(server)
        .get('/api/stock-prices?stock=GOOG&stock=MSFT&like=true')
        .set('x-forwarded-for', '136.144.17.247')
        .end((err, res) => {
          assert.equal(res.status, 200);
          assert.equal(res.body.stockData[0].stock, 'GOOG');
          assert.equal(typeof res.body.stockData[0]['price'], "number");
          assert.equal(typeof res.body.stockData[0]['rel_likes'], "number");
          assert.equal(res.body.stockData[1].stock, 'MSFT');
          assert.equal(typeof res.body.stockData[1]['price'], "number");
          assert.equal(typeof res.body.stockData[1]['rel_likes'], "number");
          done()
        })
  })

});
