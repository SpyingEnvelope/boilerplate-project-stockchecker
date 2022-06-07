'use strict';
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const mySecretURI = process.env['MONGO_URI'];
const bcrypt = require('bcrypt');

// Connect to Database
mongoose.connect(mySecretURI, {useNewUrlParser: true, useUnifiedTopology: true})

//Create IP Schema
const ipSchema = new Schema({
  'ip-address': {
    type: String,
    required: true
  },
  'symbol': {
    type: String,
    required: true
  }
})

// Create Like Schema
const likeSchema = new Schema({
  'symbol': {
    type: String,
    required: true
  },
  'likes': {
    type: Number,
    required: true
  }
})

const ipUser = mongoose.model('ip', ipSchema);
const likes = mongoose.model('Like', likeSchema);

module.exports = function (app) {

  app.route('/api/stock-prices')
    .get(async function (req, res){
      const saltRounds = 12;

      // If the user did not like the symbol, this line of code executes
      if (req.query.like == 'false' | !req.query.like) {
        let symbolLikes = 0;

        // Check database for likes relating to the symbol, but first check to see if req.query.stock is an array or string
        if (typeof req.query.stock == 'object') {
          console.log(req.query.stock)

          // Send fetch request for both symbols
          let response1 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[0]}/quote`)
                            .then(response => response.json())
                            .catch(e => console.log(e))

          let response2 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[1]}/quote`)
                            .then(response => response.json())
                            .catch(e => console.log(e))

          console.log('First response : ' + response1.latestPrice)
          console.log('Second response : ' + response2.latestPrice)

          // Search for both symbols in the likes database
          likes.find({'symbol': req.query.stock}, (err, docs) => {
            if (err) {
              console.log(err)
              res.json({'Error': err})
            } else {
              // if none of the symbols were find, save both symbols to the database with a likes value of 0
              if (!docs[0]) {
                const newSymbol1 = new likes({
                  'symbol': req.query.stock[0],
                  'likes': 0
                }).save((err, data1) => {
                  if (err) {
                    console.log(err)
                    res.json({'error': err})
                  } else {
                    console.log('Symbol 1 saved')
                    const newSymbol2 = new likes({
                      'symbol': req.query.stock[1],
                      'likes': 0
                    }).save((err, data2) => {
                      if (err) {
                        console.log(err)
                        res.json({'error': err})
                      } else {
                        console.log('Symbol 2 saved')
                        // Once both symbols are saved, respond with json
                        res.json({
                          "stockData": [
                            {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": 0},
                            {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": 0},
                          ]
                        })
                      }
                    })
                  }
                })
                // If only one result was found, execute this code block
                } else if (!docs[1]) {
                  let relLikes1 = docs[0].likes
                  let relLikes2 = 0 - docs[0].likes

                  //If docs[0] symbol is the same as in response1, run this block
                  if (docs[0].symbol == response1.symbol) {
                    res.json({
                      "stockData": [
                        {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": relLikes1},
                        {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": relLikes2}
                      ]
                    })
                  // if docs[0] symbol is the same as response2 symbol
                  } else if (docs[0].symbol == response2.symbol) {
                    res.json({
                      "stockData": [
                        {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": relLikes2},
                        {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": relLikes1}
                      ]
                    })

                  // if docs[0] does not equal to any response.symbol, just return rellikes
                  } else {
                    res.json({
                      "stockData": [
                        {"rel_likes": relLikes1},
                        {"rel_likes": relLikes2}
                      ]
                    })
                  }
              // If mongoose.find found two matches, execute this line of code
              } else {
                let relLikes1 = docs[0].likes - docs[1].likes
                let relLikes2 = docs[1].likes - docs[0].likes

                // Since mongoose finds things in alphabetical order, I use this else if to see where to position the relLikes variables
                if (docs[0].symbol == req.query.stock[0]) {
                  res.json({
                    "stockData": [
                      {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": relLikes1},
                      {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": relLikes2}
                    ]
                  })
                  
                } else {
                  res.json({
                    "stockData": [
                      {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": relLikes2},
                      {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": relLikes1}
                    ]
                  })
                }
              }
            }
          })

        //Execute this line of code if the get req.query.stock only has one symbol
        } else {

        // Send fetch request to the API
        let response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock}/quote`)
                            .then(response => response.json())
                            .catch(e => console.log(e))
          likes.find({'symbol': req.query.stock}, (err, docs) => {
          if (err) {
            console.log(err)
          } else {
            // Send back response data based on the scenario
            if (!docs[0]) {
              res.json({
                "stockData": {
                "stock": response.symbol,
                "price": response.latestPrice,
                "likes": symbolLikes
              }
            })
            } else {
              symbolLikes = docs[0]['likes']
              res.json({
                "stockData": {
                "stock": response.symbol,
                "price": response.latestPrice,
                "likes": symbolLikes
                }
              })
            }
          }
          })          
        }
      }

      else if (req.query.like == 'true') {
        // Encrypt the ip
        console.log(req.headers)
        let encryptedIP = req.headers['x-forwarded-for'];
        encryptedIP = encryptedIP.replace(/.$/, "0")

        //If req.query.stock has more than one symbol, execute this
        if (typeof req.query.stock == 'object'){
          const query1 = await ipUser.find({'ip-address': encryptedIP, 'symbol': req.query.stock[0]}).catch(e => res.json({'error': e}))
          const query2 = await ipUser.find({'ip-address': encryptedIP, 'symbol': req.query.stock[1]}).catch(e => res.json({'error': e}))

          // If query1 and query2 both found results, run this block of code
          if (query1[0] && query2[0]) {
            // Retrieve likes from likes database for both symbols
            const symbol1 = await likes.findOne({'symbol': req.query.stock[0]}).catch(e => res.json({'error': e}))
            const symbol2 = await likes.findOne({'symbol': req.query.stock[1]}).catch(e => res.json({'error': e}))

            // Retrieve responses for both symbols from api
            let response1 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[0]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            let response2 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[1]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            // Respond with JSON and relevant data
            res.json({
              "stockData": [
                {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": symbol1['likes'] - symbol2['likes']},
                {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": symbol2['likes'] - symbol1['likes']}
              ]
            })

          // if query1 found results but query2 did not
          } else if (query1[0] && !query2[0]) {

            // get symbol1 from query1
            const symbol1 = await likes.findOne({'symbol': req.query.stock[0]}).catch(e => res.json({'error': e}))

            // fetch responses from api
            let response1 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[0]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            let response2 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[1]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            // register the new symbol and ip in the ip database
            const newSymbol = await new ipUser({
              'ip-address': encryptedIP,
              'symbol': req.query.stock[1]
            }).save().catch(e => {
              console.log(e)
              res.json({'error': e})
            })

            //see if the symbol from req.query.stock[1] (which is query2) exists in the likes database
            let likesAmount = await likes.findOne({'symbol': req.query.stock[1]}).catch(e => console.log(e))
            console.log('I am after likes amount')
            console.log(likesAmount)

            // if it exists in the likes database, update the likes value and return the json response
            if (likesAmount != null) {
              await likes.findOneAndUpdate({'symbol': req.query.stock[1]}, {'likes': likesAmount['likes'] + 1})
              const symbol2 = await likes.findOne({'symbol': req.query.stock[1]})

              res.json({
                "stockData": [
                  {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": symbol1['likes'] - symbol2['likes']},
                  {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": symbol2['likes'] - symbol1['likes']}
                ]
              })
            // if it does not exist in the likes database, add it to the likes database with a likes value of 1 then return json response
            } else {
              const newLike = await new likes({
                'symbol': req.query.stock[1],
                'likes': 1
              }).save().catch(e => console.log(e))

              const symbol2 = await likes.findOne({'symbol': req.query.stock[1]}).catch(e => console.log(e))

              res.json({
                "stockData": [
                  {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": symbol1['likes'] - symbol2['likes']},
                  {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": symbol2['likes'] - symbol1['likes']}
                ]
              })
            }

          // if query1 did not find results but query2 did
          } else if (!query1[0] && query2[0]) {

            // find symbol2 from query2 in the likes database
            const symbol2 = await likes.findOne({'symbol': req.query.stock[1]}).catch(e => res.json({'error': e}))

            // fetch response from api
            let response1 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[0]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            let response2 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[1]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            // register query1 symbol and ip address with the ip database
            const newSymbol = await new ipUser({
              'ip-address': encryptedIP,
              'symbol': req.query.stock[0]
            }).save().catch(e => {
              console.log(e)
              res.json({'error': e})
            })

            // check if query1 symbol exists in the likes database
            let likesAmount = await likes.findOne({'symbol': req.query.stock[0]}).catch(e => console.log(e))
            console.log('I am after likes amount in !query1[0]')
            console.log(likesAmount)

            // if it does, update the value in the likes database and return the response
            if (likesAmount != null) {
              await likes.findOneAndUpdate({'symbol': req.query.stock[0]}, {'likes': likesAmount['likes'] + 1})
              const symbol1 = await likes.findOne({'symbol': req.query.stock[0]})

              res.json({
                "stockData": [
                  {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": symbol1['likes'] - symbol2['likes']},
                  {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": symbol2['likes'] - symbol1['likes']}
                ]
              })

            //if it does not exist in the likes database, add it to the likes database with a likes value of 1, then return JSON response
            } else {
              const newLike = await new likes({
                'symbol': req.query.stock[0],
                'likes': 1
              }).save().catch(e => console.log(e))

              const symbol1 = await likes.findOne({'symbol': req.query.stock[0]}).catch(e => console.log(e))

              res.json({
                "stockData": [
                  {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": symbol1['likes'] - symbol2['likes']},
                  {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": symbol2['likes'] - symbol1['likes']}
                ]
              })
            }
          // If neither query1 nor query2 found anything in the ip database
          } else {

            // fetch responses from the API
            let response1 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[0]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            let response2 = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock[1]}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))

            // register the new IP and symbols in the ip database
            const newIp1 = await new ipUser({
              'ip-address': encryptedIP,
              'symbol': req.query.stock[0]
            }).save().catch(e => console.log(e))

            const newIp2 = await new ipUser({
              'ip-address': encryptedIP,
              'symbol': req.query.stock[1]
            }).save().catch(e => console.log(e))

            // fetch symbol 1 and symbol 2 from the likes database
            let likesAmount1 = await likes.findOne({'symbol': req.query.stock[0]})
            let likesAmount2 = await likes.findOne({'symbol': req.query.stock[1]})

            // if symbol1 does not exist, add it to the likes database with a value of one and set likeAmount1 to the number of likes
            if (likesAmount1 == null) {
              const newLikes = await new likes({
                'symbol': req.query.stock[0],
                'likes': 1
              }).save().catch(e => console.log(e))

              likesAmount1 = await likes.findOne({'symbol': req.query.stock[0]})
                                        .then(response => response['likes'])
                                        .catch(e => console.log(e))

            // if symbol1 exists in the likes database, update the likes amount and then put the new likes value in the likesAmount1 variable
            } else {;
              await likes.findOneAndUpdate({'symbol': req.query.stock[0]}, {'likes': likesAmount1['likes'] + 1}).catch(e => console.log(e))
              likesAmount1 = await likes.findOne({'symbol': req.query.stock[0]})
                                        .then(response => response['likes'])
                                        .catch(e => console.log(e))
              
            }

             // if symbol2 does not exist, add it to the likes database with a value of one and set likeAmount2 to the number of likes
            if (likesAmount2 == null) {
              const newLikes2 = await new likes({
                'symbol': req.query.stock[1],
                'likes': 1
              }).save().catch(e => console.log(e))

              likesAmount2 = await likes.findOne({'symbol': req.query.stock[1]})
                                        .then(response => response['likes'])
                                        .catch(e => console.log(e))

              // if symbol2 exists in the likes database, update the likes amount and then put the new likes value in the likesAmount2 variable
            } else {
              await likes.findOneAndUpdate({'symbol': req.query.stock[1]}, {'likes': likesAmount2['likes'] + 1}).catch(e => console.log(e))
              likesAmount2 = await likes.findOne({'symbol': req.query.stock[1]})
                                        .then(response => response['likes'])
                                        .catch(e => console.log(e))
            }

            // send the json response
            res.json({
              "stockData": [
                {"stock": response1.symbol, "price": response1.latestPrice, "rel_likes": likesAmount1 - likesAmount2},
                {"stock": response2.symbol, "price": response2.latestPrice, "rel_likes": likesAmount2 - likesAmount1}
              ]
            })
          }

        // if req.query.stock has one symbol, execute this
        } else {
          // Send fetch request to api
          let response = await fetch(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${req.query.stock}/quote`)
                      .then(response => response.json())
                      .catch(e => console.log(e))
        
        // check to see if the IP exists in the ip database with the same symbol
        ipUser.find({'ip-address': encryptedIP, 'symbol': req.query.stock}, (err, ip) => {
          if (err) {
            console.log(err)
            res.json({'error': err})
          } else {
            console.log(ip)
            // if ip does not exist in database, add it to database
            if (!ip[0]) {
              let newIp = new ipUser({
                'ip-address': encryptedIP,
                'symbol': req.query.stock
              }).save((err, data) => {
                if (err) {
                  console.log(err)
                  res.json({'error': err})
                } else {
                  console.log('New IP saved')

                  //After saving the new ip, look for the symbol in the likes database
                  likes.find({'symbol': req.query.stock}, (err, docs) => {
                    if (err) {
                      console.log(err)
                      res.json({'error': err})
                    } else {
                      console.log(docs)
                      //if the symbol does not exist in the likes database, add it with a likes value of 1
                      if (!docs[0]) {
                        const newSymbol = new likes({
                          'symbol': req.query.stock,
                          'likes': 1
                        }).save((err, data) => {
                          if (err) {
                            console.log(err)
                            res.send(err)
                          } else {
                            console.log('New symbol saved')
                            // After new symbol is saved, respond with json
                            res.json({
                              "stockData": {
                                "stock": response.symbol,
                                "price": response.latestPrice,
                                "likes": data['likes']
                              }
                            })
                            }
                          })
                        } else {
                        // If symbol exists in the likes database and ip is not found in the ip database, add a like to it and respond with updated like amount
                          console.log('I am in else ' + docs)
                          likes.updateOne({'symbol': req.query.stock}, {'likes': docs[0]['likes'] + 1}, (err, updatedDocs) => {
                            if (err) {
                              console.log(err)
                              res.json({'error': err})
                            } else {
                              console.log('updated docs : ' + JSON.stringify(updatedDocs))
                              res.json({
                                "stockData": {
                                  "stock": response.symbol,
                                  "price": response.latestPrice,
                                  "likes": docs[0]['likes'] + 1
                                }
                              })
                            }
                          })
                        }
                      }
                    })
                  }
                })
              // if IP exists in the ip database, it moves to this line of code
              } else {
              // Find the symbol in the likes database
                likes.find({'symbol': req.query.stock}, (err, docs) => {
                  if (err) {
                    console.log(err)
                    res.json({'error': err})
                  } else {
                    // If symbol does not exist, create it in the database with a likes value of 0
                    if (!docs[0]) {
                        const newSymbol = new likes({
                          'symbol': req.query.stock,
                          'likes': 0
                        }).save((err, data) => {
                          if (err) {
                            console.log(err)
                            res.send(err)
                          } else {
                            // respond with new symbol after it is saved
                            console.log('New symbol saved')
                            res.json({
                              "stockData": {
                                "stock": response.symbol,
                                "price": response.latestPrice,
                                "likes": data['likes']
                              }
                            })
                            }
                          })
                    } else {
                      // If symbol is found in the likes database, respond with the data retrieved
                      console.log(docs[0])
                      res.json({
                        "stockData": {
                          "stock": response.symbol,
                          "price": response.latestPrice,
                          "likes": docs[0]['likes']
                        }
                      })
                    }
                  }
                })
              }
            }
          })
        }
        }
      console.log(req.query)
      console.log(req.headers['x-forwarded-for'])
      })
    };
    
