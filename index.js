/* ALL IMPORTS */
const firebase = require('firebase');

const express = require('express');



// Set up express and our local PORT
const app = express();
const PORT = process.env.PORT || 3000;

// Set up ejs 
app.set('view engine', 'ejs');
app.set('views', './view');

// Use public folder for all static content
app.use('/public', express.static(__dirname + '/public'));


// Your web app's Firebase configuration
var firebaseConfig = {
    apiKey: "AIzaSyD1Twa53BJzDCMmAS6RWNR-qWGSbDc1ljo",
    authDomain: "subcrates.firebaseapp.com",
    databaseURL: "https://subcrates.firebaseio.com",
    projectId: "subcrates",
    storageBucket: "subcrates.appspot.com",
    messagingSenderId: "729219392798",
    appId: "1:729219392798:web:594252fcf370102fae150f",
    measurementId: "G-W896J0PECP"
  };
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
//   firebase.analytics();



// Listen on PORT for connection
  app.listen(PORT, () => {
    console.log('Server is running fine!!');
  });


  // ROOT GET ROUTE - Landing page
  app.get('/', (req, res) => {
    res.render('LandingPageCollection/landingPage');
  });



  // GET ROUTE - Homepage
  app.get('/homepage', (req, res) => {
    res.render('Homepage');
  });


  
  // GET ROUTE FOR SUBSCRIPTIONS [FORMAT /subscription/id] where [id] -> the id of the subscription being displayed
  app.get('/subscription/:id', (req, res) => {
    res.render('subscriptionDetails');
  });
