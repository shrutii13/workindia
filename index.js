var express = require('express');
var md5 = require('md5')
const bcrypt = require('bcrypt')
var app = express();
var connection = require('./database');
const {
    v4: uuidv4
  } = require('uuid')   // USE IT FOR UNIQUE B0OOK ID 

const jwt = require('jsonwebtoken');
const secretKey = 'your-secret-key'; 

const bodyParser = require("body-parser");
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/',function(req,res){
    res.send("GETTING");
})


app.post('/api/signup/',async(req,res)=>{
    console.log(req.body);
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;
    const saltRounds=10;
    const encryptpassword =  await bcrypt.hash(password,saltRounds);
    const role = "user";

    const token = jwt.sign({ username: username }, secretKey, { expiresIn: '1h' });

    connection.query(`INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)`,
    [username,email,encryptpassword,role],
    (err,result) => {
        if(err){
            throw err;
            console.log(err);
        }else{
            const userId = connection.query("SELECT userid FROM users WHERE email=?",[username]);
            console.log("userid ", userid);
            console.log(result);
            res.send({
                "status" : "Account successfully created",
                "status_code" : 200,
                "user_id" : userid,
                access_token: token
            })
        }
    })
});

app.listen(3000,function(){
    console.log("App listing on post 3000");
    connection.connect(function(err){
        if(err){
            console.log(err);
        }
        console.log("database connected");
    })
});


app.post("/api/login", async (req, res) => {
    // console.log("body" , req.body);
    
    const username = req.body.username;
    const password = req.body.password;
    connection.query(`SELECT password FROM users WHERE username=?`, [username], async (err, result) => {
      console.log(result);
      if (err) {
        res.send({
          "code": 400,
          "failed": "error occurred",
          "error": err
        })
      } else {
        console.log(result[0]);
        res.send("logined");
        if (result) {
          const comparison = await bcrypt.compareSync(password, result[0].password)
          if (comparison) {
            // results.password = undefined;
            const jsontoken=sign({result:result[0]},"key",
                {
                    expiresIn:"1h"
                }
                )
    
            // const jsontoken = sign({ result: results }, "qwe1234", {
            //   expiresIn: "1h"
            // });
            res.send({
                "status": "Login successful",
                "status_code": 200,
                "user_id": "12345",
                "access_token": jsontoken
            })
          } else {
            res.send({
                "status": "Incorrect username/password provided. Please retry",
                "status_code": 401
            })
            // console.log("Declined");
          }
        }
      }
    })
  })

// ADDING NEW BOOK 

app.post('/api/books/create', async(req,res)=>{
    const { title, author, isbn } = req.body;
    const book_id = uuidv4();
    // Save the book details in the database
    connection.query(
    `INSERT INTO books(book_id, title, author, isbn) VALUES (?,?,?,?)`,
    [book_id, title, author, isbn],
    async(err, result) => {
        if (err) {
        console.log(err);
        } else {
        res.send({
            message: "Book added successfully",
            book_id: book_id
        });
        }
    }
    );
})


// SEARCH BOOKS BY TITLE
app.get('/api/books?title={search_query}', (req, res) => {
    const { title } = req.query;
  
    // Query the database to search for books by title
    connection.query(
      'SELECT * FROM books WHERE title LIKE ?',
      [`%${title}%`],
      (err, result) => {
        if (err) {
          console.log(err);
        } else {
          const books = result.map(book => {
            return {
              book_id: book.book_id,
              title: book.title,
              author: book.author,
              isbn: book.isbn
            };
          });
  
          res.send({
            results: books
          });
        }
      }
    );
  });
  

// Getting book availability
app.get('/api/books/{book_id}/availability', (req, res) => {
    const { book_id } = req.params;
  
    connection.query(
      'SELECT * FROM books WHERE book_id = ?',
      [book_id],
      (err, result) => {
        if (err) {
          console.log(err);
        } else {
          if (result.length === 0) {
            // Book not found
            res.status(404).send("Book not found");
          } else {
            const book = result[0];
            const response = {
              book_id: book.book_id,
              title: book.title,
              author: book.author,
              available: book.available
            };
  
            if (!book.available) {
              // Book is already booked, include next_available_at in the response
              response.next_available_at = book.next_available_at;
            }
  
            res.send(response);
          }
        }
      }
    );
  });
  


  app.post('/api/books/borrow', (req, res) => {
    const token = req.headers.authorization; // Get the token from the request headers

    // Verify and decode the token
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        console.log(err);
        res.status(401).send("Unauthorized");
      } else {
        const { book_id, user_id, issue_time, return_time } = req.body;
  
        // Check the availability of the book
        connection.query(
          'SELECT available FROM books WHERE book_id = ?',
          [book_id],
          (err, result) => {
            if (err) {
              console.log(err);
              res.status(500).send("Internal Server Error");
            } else {
              if (result.length === 0) {
                // Book not found
                res.status(404).send("Book not found");
              } else {
                const book = result[0];
                if (book.available) {
                  // Book is available, book it for the user
                  connection.query(
                    'INSERT INTO bookings (book_id, user_id, issue_time, return_time) VALUES (?, ?, ?, ?)',
                    [book_id, user_id, issue_time, return_time],
                    (err, result) => {
                      if (err) {
                        console.log(err);
                        res.status(500).send("Internal Server Error");
                      } else {
                        res.send({
                          status: "Book booked successfully",
                          status_code: 200,
                          booking_id: result.insertId
                        });
                      }
                    }
                  );
                } else {
                  // Book is already booked
                  res.send({
                    status: "Book is not available at this moment",
                    status_code: 400
                  });
                }
              }
            }
          }
        );
      }
 
  });
  })
  


