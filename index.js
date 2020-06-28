/**
 * Important notes about index.js:
 * 
 * DON'T use the following as variable names:
 * users, subscriptions & other import file names;
 * 
 * 
 * FIRESTORE COLLECTION NAMES: users, subscriptions.
 * 
 */


/**
 * ALL FIREBASE IMPORTS AND CONFIGURATIONS
 */
const firebase = require('firebase');
const analytics = require('@firebase/analytics');
const admin = require('firebase-admin');


const serviceAccount = require('./subcrates-firebase-adminsdk-a4mf1-10268ea17c.json');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://subcrates.firebaseio.com'
});

const db = admin.firestore();
const users = db.collection('users');
const subscriptions = db.collection('subscriptions');



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
// firebase.analytics();



/* ALL OTHER IMPORTS */
const express = require('express');
const cookieParser = require('cookie-parser');  // read and write cookies
const bodyParser = require('body-parser');      // to parse post request body as json
require('datejs');                // use date functions




// Set up express and our local PORT
const PORT = process.env.PORT || 3000;
const app = express();


// Set up ejs 
app.set('view engine', 'ejs');
app.set('views', './view');

// Use public folder for all static content
app.use('/public', express.static(__dirname + '/public'));


// parse to json when we get data from post request
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());





// --------------------------------------------------------------------------------
// -------------------- MIDDLEWARES SECTION STARTS -------------------------------------

// Create authentication middleware
function isAuthenticated(req, res, next) {
    /**  
     * Check if user is logged in: if yes, attach them to the request object and call [next]
    *                                 if not, send them to the '/' page to signup/login with
    *                                    a message saying 'Error: Please log in first'
    */
    if (firebase.auth().currentUser) {
      // Force the browser to not cache restricted pages (eg. logging out and clicking back button won't work now as broswer re-renders)
      // res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
      next();
  } else {
    console.log('isAuthenticated has failed');
      res.render('errorPage', { message: "Error: Please log in first." });
  }
}



// -------------------- MIDDLEWARE SECTION ENDS ----------------------------------------
// --------------------------------------------------------------------------------



// Listen on PORT for connection
  app.listen(PORT, () => {
    console.log('Server is running fine!!');
  });


  // ROOT GET ROUTE - Landing page
  app.get('/', (req, res) => {
    res.render('LandingPageCollection/landingPage');
  });


  /// ROOT POST ROUTE - Landing Page For Signup && Login
  app.post('/', (req, res) => {
    // Sign up variables
    var signupEmail = req.body.signupEmail;
    var signupPassword = req.body.signupPassword;


    // Log in variables
    var loginEmail = req.body.loginEmail;
    var loginPassword = req.body.loginPassword;




    /**
     * SIGN UP BLOCK ON LANDING PAGE
     */
    // When email and password are entered and checked by firebase create new user
    if(req.body.hasOwnProperty('signupButton')) {
      firebase.auth().createUserWithEmailAndPassword(signupEmail, signupPassword)
      .then((result1) => {
        /// create new document for the new user
        users.doc(signupEmail).set({Email: signupEmail})
          .then(result2 => {
            /// signing in and redirecting to homepage with new account
            firebase.auth().signInWithEmailAndPassword(signupEmail, signupPassword)
              .then(result3 => {
                
                // THEN RENDER HOMEPAGE
                res.redirect('/homepage'); 

              })
              .catch(err3 => {
                console.log('signup err3');
                res.render('errorPage', { message: err3.message })
              })
          })
          .catch(err2 => {
            console.log('signup err2');
            res.render('errorpage', { message: err2.message })
          })
      })
      .catch((err1) => {
        console.log('signup err1');
        res.render('errorpage', { message: err1.message })
      });
    } else {
    /**
     * LOG IN BLOCK ON LANDING PAGE
     */
    // When email and password are entered and checked by firebase then log in user to [homepage]
    firebase.auth().signInWithEmailAndPassword(loginEmail, loginPassword)
      .then(result => {

        // THEN RENDER HOMEPAGE
        res.redirect('/homepage'); 

      })
      .catch(err1 => {
        if (loginEmail == "") {
          console.log('login err1');
          res.render('errorpage', { message: "The email is blank!" });
        } else {
          console.log('login err2');
          res.render('errorpage', { message: err1.message });
        }
      })
    }
   
  }); // END FOR POST ROUTE ('/') 





  // GET ROUTE - Homepage
  app.get('/homepage', isAuthenticated, (req, res) => {

    // Arrays to store categories, unique categories and subscription data
    var allCategories = [];
    var uniqueCategories = [];
    var allSubscriptions = [];

    var loginEmail = firebase.auth().currentUser.email;

    // Get all subscriptions and store them in array and filter out unique categories
    subscriptions.get()
      .then(subscriptionSnap => {
        subscriptionSnap.forEach(singleSubscription => {
          //push all subscription into array
          allSubscriptions.push(singleSubscription);
          // push all categories into array
          allCategories.push(singleSubscription.data().category);
        });

        // Filter all categories to get unique categories and put in array
        uniqueCategories = Array.from(new Set(allCategories));

        // THEN RENDER HOMEPAGE
        res.render('Homepage', {allSubscriptions, uniqueCategories, name: loginEmail});
      })
      .catch((e) => {
        console.log('SUBSCRIPTION DATABASE COULDN NOT BE ACCESSED.');
        console.log(e);
        res.render('errorPage', {message: e.message})
      });  

  });


  

  // GET ROUTE FOR SUBSCRIPTIONS [FORMAT /subscription/id] where [id] -> the id/name of the subscription being displayed
  app.get('/subscription/:id', isAuthenticated, (req, res) => {

    // Get the subscription name which is the document id from the query
    var docID = req.params.id;
    console.log(docID);

    subscriptions.doc(docID).get()
      .then( subscription => {
        res.render('subscriptionDetails', {subscription});
      })
      .catch(err1 => {
        res.render('errorpage', { message: err1});
      });

  });




  // GET ROUTE FOR ADDING A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id/name of the subscription being displayed/added]
  app.get('/addsubscription/:id', (req, res) => {

    // Get the subscription name which is the document id from the query
    var docID = req.params.id;

    subscriptions.doc(docID).get()
      .then( subscription => {
        res.render('addSubscription', {subscription});
      })
      .catch(err1 => {
        res.render('errorpage', { message: err1});
      });

  });



  // POST ROUTE FOR ADDING A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id/name of the subscription being displayed/added]
  app.post('/addsubscription/:id', isAuthenticated, (req, res) => {

    // Get the subscription name which is the document id from the query
    var docID = req.params.id;
    console.log(docID);

    
    // Get the subscription innformation from the GET page
    // Subscriptions to retrieve and store: name, plan, price, last bill date, frequency of renewal, 
    // notify me (in days), notes, logo.
    var subName = req.body.name;

    var plan;
    if(req.body.customPlan != '') {
      plan = req.body.customPlan;
    } else {
      if(req.body.subscriptionPlans == 'unselected'){
        plan = ''
      } else {
        plan = req.body.subscriptionPlans;
      }
    }

    var price;
    if(req.body.customPrice != '') {
      price = Number(req.body.customPrice);
    } else {
      if(req.body.subscriptionPrice == 'unselected'){
        price = 0.00;
      } else {
        price = Number(req.body.subscriptionPrice);
      }
    } 

    var lastPaidlDate = new Date(req.body.lastBillDate);

    var subscriptionFrequency;
    if(req.body.subscriptionFrequency == 'unselected') {
      subscriptionFrequency = '';
    } else {
      subscriptionFrequency = req.body.subscriptionFrequency;
    }


    var subscriptionNotification;
    if(req.body.subscriptionNotification == 'unselected') {
      subscriptionNotification = 7;
    } else {
      subscriptionNotification = Number(req.body.subscriptionNotification);
    }

    var subscriptionNotes = req.body.subscriptionNotes;



    // First check if the subscription is already added and delete it if it is
    users.doc(firebase.auth().currentUser.email).get()
      .then(user => {
        // Get the list of current subscriptions
        let subList = user.data().userSubscriptions;
        console.log(subList);
        // Check if any subscriptions match with the newly added one
        for(let i = 0; i < subList.length; i++) {
          console.log(subList[i]['subName']);
          if(subName === subList[i]['subName']) {
            // Delete that item and store the newly added item
            users.doc(firebase.auth().currentUser.email).update({
              userSubscriptions: user.data().userSubscriptions.filter(s => s.subName != subName)
            }).then(newly => {

              // Then update firebase document with the new subsciption that's been added 
              users.doc(firebase.auth().currentUser.email).update({
                "userSubscriptions": admin.firestore.FieldValue.arrayUnion({
                  "subName": subName,
                  "planName": plan,
                  "price": price,
                  "lastPaidDate": lastPaidlDate,
                  "subscriptionFrequency": subscriptionFrequency,
                  "subscriptionNotification": subscriptionNotification,
                  "subscriptionNotes": subscriptionNotes,
                })
              }).then(result => {
                // store the new data to user's profile and then redirect to mycrates
                res.redirect('/mycrate');
                return;
              })
              .catch(err3 => {
                res.render('errorpage', { message: err3});
              })
            })
            .catch(err2 => {
              console.error("Error removing document: ", err2);
            });
          } 
        }

        // Otherwise update firebase document with the new subsciption that's been added 
        users.doc(firebase.auth().currentUser.email).update({
          "userSubscriptions": admin.firestore.FieldValue.arrayUnion({
            "subName": subName,
            "planName": plan,
            "price": price,
            "lastPaidDate": lastPaidlDate,
            "subscriptionFrequency": subscriptionFrequency,
            "subscriptionNotification": subscriptionNotification,
            "subscriptionNotes": subscriptionNotes,
          })
        }).then(result => {
          // store the new data to user's profile and then redirect to mycrates
          res.redirect('/mycrate');
        })
        .catch(err3 => {
          res.render('errorpage', { message: err3});
        })
      })
      .catch(err1 => {
      res.render('errorpage', { message: err1});
      })

  }); // END POST ROUTE FOR ADDING A SUBSCRIPTION




  // GET ROUTE FOR EDITINNG A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id/name of the subscription being displayed/added]
  app.get('/editsubscription/:id', isAuthenticated, (req, res) => {

    // Get the subscription name which is the document id from the query
    var docID = req.params.id;

    subscriptions.doc(docID).get()
      .then( subscription => {
        res.render('editSubscription', {subscription});
      })
      .catch(err1 => {
        res.render('errorpage', { message: err1});
      });

  });



  // GET ROUTE FOR DELETING A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id(name) of the subscription being displayed/added]
  app.get('/deletesubscription/:id', isAuthenticated, (req, res) => {

    // Get the name of the subscription from the id
    var subName = req.params.id;
    console.log(subName);

    // First check if the subscription is already added and delete it if it is
    users.doc(firebase.auth().currentUser.email).get()
      .then(user => {
        // Get the list of current subscriptions
        let subList = user.data().userSubscriptions;
        console.log(subList);
        // Check if any subscriptions match with the newly added one
        for(let i = 0; i < subList.length; i++) {
          console.log(subList[i]['subName']);
          if(subName === subList[i]['subName']) {
            // Delete the subscription by filtering it out of the array
            users.doc(firebase.auth().currentUser.email).update({
              userSubscriptions: user.data().userSubscriptions.filter(s => s.subName != subName)
            }).then(result => {
              // Load mycrates page again
              res.redirect('/mycrate');
              return;
            })
            .catch(err1 => {
              console.log(err1);
              res.render('errorpage', { message: err1});
            })
          }
        }
      })

  });


  

  // GET ROUTE FOR MY CRATE PAGE
  app.get('/mycrate', isAuthenticated, (req, res) => {
    var dateList = [];
    var weeklyCost = 0.00;
    var monthlyCost = 0.00;
    var yearlyCost = 0.00;


    // use user email to get all the subscriptions and display them
    users.doc(firebase.auth().currentUser.email).get()
      .then(user => {
        let subList = user.data().userSubscriptions;

        subList.forEach((sub) => {
          console.log(sub['lastPaidDate']['_seconds']);
          console.log(Date.today());
          // FOR WEEKLY COST
          if(sub['subscriptionFrequency'] == 'weekly') {
            var nextbill = new Date((sub['lastPaidDate']['_seconds'] + 604800) * 1000).toISOString();
            nextbill = Date.parse(nextbill).toString("M/d/yyyy");
            dateList.push(nextbill);

            if(sub['price'] != '') {
              weeklyCost += sub['price'];
              monthlyCost += (sub['price'] * 4);
              yearlyCost += (sub['price'] * 48);
            }
          // FOR MONTHLY COST
          } else if(sub['subscriptionFrequency'] == 'monthly') {
            var nextbill = new Date((sub['lastPaidDate']['_seconds'] + 2592000) * 1000).toISOString();
            nextbill = Date.parse(nextbill).toString("M/d/yyyy");
            dateList.push(nextbill);

            if(sub['price'] != '') {
              weeklyCost += (sub['price'] / 4);
              monthlyCost += sub['price'];
              yearlyCost += (sub['price'] * 12);
            }
          // FOR YEARLY COST
          } else if (sub['subscriptionFrequency'] == 'yearly') {
            var nextbill = new Date((sub['lastPaidDate']['_seconds'] + (2592000 * 12)) * 1000).toISOString();
            nextbill = Date.parse(nextbill).toString("M/d/yyyy");
            dateList.push(nextbill);

            if(sub['price'] != '') {
              weeklyCost += (sub['price'] / 48);
              monthlyCost += (sub['price'] / 12);
              yearlyCost += sub['price'];
            }
          } else {
            var text = 'Date or frequency is missing';
            dateList.push(text);
          }
        });

        res.render('MyCrate/myCrate', {subList, dateList, weeklyCost, monthlyCost, yearlyCost});
      })

  });




  // GET ROUTE FOR SETTINGS PAGE
  app.get('/settings', isAuthenticated, (req, res) => {
    res.render('Settings/settings')
  });



  // GET ROUTE FOR LOGOUT - log out user when they click on [Option > Logout]
  app.get('/logout', (req, res) => {
    
    // Log out user using firebase logout
    firebase.auth().signOut()
    .then(result => {
        res.redirect('/');
    })
    .catch(err => {
        console.log('logout err')
        res.render('errorPage', {message: err})
    })
  });




// RESET PASSWORD PAGE GET ROUTE
app.get('/resetpassword', (req, res) => {
  res.render('resetPassword');
});




// RESET PASSWORD PAGE POST ROUTE
app.post('/resetpassword', (req, res) => {
  const email = req.body.email
  const auth = firebase.auth()

  if (email != "") {
      auth.sendPasswordResetEmail(email)
          .then(result => {
              res.redirect('/');
          })
  } else {
      res.render('errorpage', { message: "Enter a valid email" });
  }
});