/**
 * Important notes about index.js:
 * 
 * DON'T use the following as variable names:
 * users, subscriptions & other import file names;
 * 
 * 
 * FIRESTORE COLLECTION NAMES: users, subscriptions, reviews, usersubscriptions.
 * 
 */


/**
 * ALL FIREBASE IMPORTS AND CONFIGURATIONS
 */
const firebase = require('firebase');
const analytics = require('@firebase/analytics');
const admin = require('firebase-admin');
// cloud storage firebase
const {Storage} = require('@google-cloud/storage');
const storage = new Storage({
  projectId: 'subcrates',
  keyFilename: 'subcrates-firebase-adminsdk-a4mf1-10268ea17c.json'
});


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

// Initialize bucket for firebase storage. USE UPLOAD AND DOWNLOADS USING THIS VARIABLE - [bucket]
 const bucket = storage.bucket('gs://subcrates.appspot.com');

// Initialize firebase service account
const serviceAccount = require('./subcrates-firebase-adminsdk-a4mf1-10268ea17c.json');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://subcrates.firebaseio.com'
});

const db = admin.firestore();
// db.enablePersistence();
const users = db.collection('users');
const subscriptions = db.collection('subscriptions');
const usersubscriptions = db.collection('usersubscriptions');
const reviews = db.collection('reviews');


firebase.database.enableLogging(true);




/* ALL OTHER IMPORTS */
const express = require('express');
const cookieParser = require('cookie-parser');  // read and write cookies
const bodyParser = require('body-parser');      // to parse post request body as json
const stripe = require('stripe')('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');
require('datejs');                // use date functions
// Mixpanel imports
const Mixpanel = require('mixpanel');
const mixpanel = Mixpanel.init("1eafdc052a8f32cbaf49341a883b96e6");



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
      res.render('errorPage', { message: "Error: Please log in first.", displaySubscription: false });
  }
}


// Check if user is still subscribed 
function isSubscribed(req, res, next) {

  users.doc(firebase.auth().currentUser.email).get()
    .then(user => {
      var nowInSeconds = Math.trunc(new Date().getTime() / 1000);  

      if(user.data().status == true || nowInSeconds < user.data().expiresAt) {
        next();
      } else {
        res.render('errorPage', { message: 'Your subscription has expired.', displaySubscription: true }); 
      }
    })
}



// -------------------- MIDDLEWARE SECTION ENDS ----------------------------------------
// --------------------------------------------------------------------------------



// Listen on PORT for connection
  app.listen(PORT, () => {
    console.log('Server is running fine!!');
  });


  // ROOT GET ROUTE - Landing page
  app.get('/', (req, res) => {
    res.render('landing');
  });



  // BUSINESS SIGN UP GET ROUTE - Business Landing page
  // app.get('/business', (req, res) => {
  //   res.render('business_signup');
  // });


  /// ROOT POST ROUTE - Landing Page For Signup && Login
  app.post('/', (req, res) => {
    // Sign up variables
    var signupEmail = req.body.signupEmail;
    var signupPassword = req.body.signupPassword;

    // cut off any whitespaces from sign up credentials
    if(signupEmail != null) {
      signupEmail = signupEmail.toString().trim();
    }
    if(signupPassword != null) {
      signupPassword = signupPassword.toString().trim();
    }



    // Log in variables
    var loginEmail = req.body.loginEmail;
    var loginPassword = req.body.loginPassword; 


    // cut off any whitespaces from login credentials
    if(loginEmail != null) {
      loginEmail = loginEmail.toString().trim();
    }
    if(loginPassword != null) {
      loginPassword = loginPassword.toString().trim();
    }

 
    /**
     * SIGN UP BLOCK ON LANDING PAGE
    **/
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
              
                // Current date
                var date = new Date().toLocaleDateString();
                var nowInSeconds = Math.trunc(new Date().getTime() / 1000);
                // 14 day free trial
                var expiresAtSeconds = nowInSeconds + (86400 * 14);

                // Then update firebase document with the new subsciption that's been added 
                // and also update user with their free trial data

                try {
                  users.doc(firebase.auth().currentUser.email).update({
                    // set status to false for free trial until paid subscription is bought.
                    status: false, 
                    expiresAt: expiresAtSeconds,
                    lastLogin: date,
                    usersubscriptions: admin.firestore.FieldValue.arrayUnion('subcrates')
                  }).then(result => {
                    usersubscriptions.add({
                      subID: 'subcrates',
                      subName: 'Subcrates',
                      logoLink: 'https://firebasestorage.googleapis.com/v0/b/subcrates.appspot.com/o/subscriptionImages%2FSubcrates.png?alt=media&token=d66e4710-7b46-4991-a6d8-55d1a7eebd74',
                      lastPaidDate: nowInSeconds,
                      nextPayDate: expiresAtSeconds,
                      userEmail: firebase.auth().currentUser.email
                    });

                    // Mixpanel user register on signup
                    // mixpanel.identify('test2@gmail.com');
                    mixpanel.people.set(
                      signupEmail,
                      {
                      $email: signupEmail,
                      plan: 'Free'
                    });

                    // THEN RENDER HOMEPAGE
                    res.redirect('/homepage'); 
                  })
                  .catch(e => {
                    console.log('signup user update error.');
                    res.render('errorPage', { message: e.message, displaySubscription: false  })  
                  });
                } 
                catch(e) {
                  console.log('signup add/update error.');
                  res.render('errorPage', { message: e.message, displaySubscription: false  })
                }

              })
              .catch(err3 => {
                console.log('signup err3');
                res.render('errorPage', { message: err3.message, displaySubscription: false  })
              })
          })
          .catch(err2 => {
            console.log('signup err2');
            res.render('errorPage', { message: err2.message, displaySubscription: false  })
          })
      })
      .catch((err1) => {
        console.log('signup err1');
        res.render('errorPage', { message: err1.message, displaySubscription: false  })
      });
    } else {
    /**
     * LOG IN BLOCK ON LANDING PAGE
     */
    // When email and password are entered and checked by firebase then log in user to [homepage]
    try {
      firebase.auth().signInWithEmailAndPassword(loginEmail, loginPassword)
      .then(result => {
        // Current date
        var date = new Date().toLocaleDateString();

        /// update last login date for user

        // THEN RENDER HOMEPAGE
        res.redirect('/homepage'); 
        
      })
    }
    catch(e) {
      console.log(e.toString());

        if (loginEmail == "") {
          console.log('login err1');
          res.render('errorPage', { message: "The email is blank!" });
        } else {
          console.log('login err2');
          res.render('errorPage', { message: err1.message, displaySubscription: false });
        }
      }
    }
   
  }); // END FOR POST ROUTE ('/') 





  // GET ROUTE - Homepage
  // [isAuthenticated],
  app.get('/homepage', [isAuthenticated], (req, res) => {

    // Arrays to store categories, unique categories and subscription data
    var allCategories = [];
    var uniqueCategories = [
      'Design', 'Entertainment', 'Health & Wellness', 'Home', 'Pets', 'Sports', 'Kids', 'Literature',
      'Personal Care', 'Finance', 'Software', 'Gaming', 'Productivity', 'Cloud Service', 'Wireless & Internet', 
      'Food & Drink', 'Fashion', 'Delivery', 'Utility', 'Novelty', 'Ride sharing'
    ];
    var allSubscriptions = []; // Stores 7 subscriptions from each category
    var limitedSubscriptions = []; // Stores ALL subscriptions from each category

    var loginEmail = firebase.auth().currentUser.email;

    // Get all subscriptions and store them in array and filter out unique categories
    subscriptions.get()
      .then(subscriptionSnap => {

        subscriptionSnap.forEach(singleSubscription => {
          // //push all subscription into array
          limitedSubscriptions.push(singleSubscription);
          // push all categories into array
          allCategories.push(singleSubscription.data().category);
        });
         
        // Filter all categories to get unique categories and put in array
        // uniqueCategories = Array.from(new Set(allCategories));
        // Remove custom items from homepage display
        // uniqueCategories = uniqueCategories.filter(item => item !== 'Custom');




    // USE THIS PLACE BELOW TO SORT THE [limitedSubscriptions] array by position when you needed.
    // Filer and give preference to the subscriptions that have paid.
    // NOTE: Make sure the position of the paid subscriptions are changed as 1, 2, 3, ...
    // Default value for all subscriptions that [HAVE NOT] paid are 999.
    limitedSubscriptions.sort((a, b) => (a.data().position > b.data().position) ? 1 : -1);



    // Only store 6 subscriptions for each category (at most) for homepage to
    // This saves user data and speed up loading.
    for (let c = 0; c < uniqueCategories.length; c++) {
      let counter = 0;
      for (let i = 0; i < limitedSubscriptions.length; i++) {
        if (counter < 6 &&
            uniqueCategories[c] ==
            limitedSubscriptions[i].data().category) {
              allSubscriptions.push(limitedSubscriptions[i]);
          counter++;
        }
      }
    }

        // THEN RENDER HOMEPAGE
        res.render('homepage', {allSubscriptions, uniqueCategories, name: loginEmail});
      })
      .catch((e) => {
        console.log('SUBSCRIPTION DATABASE COULD NOT BE ACCESSED.');
        console.log(e);
        res.render('errorPage', {message: e.message, displaySubscription: false })
      });  

  });




  // GET ROUTE - Subscription Category
  // [isAuthenticated]
  // Use the category to find all the subscriptions from that category and display them 
  app.get('/category/:id', [isAuthenticated], (req, res) => {

    var categorySelected = req.params.id;
    var allSubscriptions = []; // Holds all the subscriptions information to send to frontend


    subscriptions.where('category', '==', categorySelected).get()
      .then(subscriptionsSnap => {
        subscriptionsSnap.forEach(singleSubscription => {
          //push all subscription into array
          allSubscriptions.push(singleSubscription);
        });

        // THEN RENDER HOMEPAGE
        res.render('singlecategory', {allSubscriptions, categorySelected});

      }).catch(err1 => {
        console.log('subscriptions from category not found for category page.');
        res.render('errorPage', {message: err1.message, displaySubscription: false })
      });

  });



  

  // GET ROUTE FOR SUBSCRIPTIONS [FORMAT /subscription/id] where [id] -> the id/name of the subscription being displayed
  app.get('/subscription/:id', [isAuthenticated], (req, res) => {

    // Get the subscription id which is the document id from the query
    var docID = req.params.id;
    var reviewsList = [];
    var hasPosted = false;
    var myReview = '';
    var myRating;
    var myUsername = '';

    // Update homeclick counter for the subscription and navigate to subscription detail page
    subscriptions.doc(docID).update({
      homepageViewMore: admin.firestore.FieldValue.increment(1)
    }).then( result => {
      subscriptions.doc(docID).get()
      .then( subscription => {
        // Then get all the reviews of this subscription
        reviews.where('subID', '==', docID).get()
          .then(reviews => {
            reviews.forEach((f) => {
              reviewsList.push(f);
              // console.log(f.data().userid);
              // console.log(firebase.auth().currentUser.email);
              if(f.data().userid == firebase.auth().currentUser.email) {
                hasPosted = true;
                myReview = f.data().review;
                myRating = f.data().ratingGiven;
                myUsername = f.data().username;
              }
            });
            res.render('subscriptions', {subscription, reviewsList, hasPosted, myReview, myRating, myUsername});
          })
          .catch(err2 => {
            res.render('errorPage', { message: err2, displaySubscription: false });
          });
      })
      .catch(err1 => {
        res.render('errorPage', { message: err1, displaySubscription: false });
      });
    })
    .catch(err2 => {
      res.render('errorPage', { message: err2, displaySubscription: false });
    }) 
  });


  app.post('/subscription/:id', [isAuthenticated], (req, res) => {

    // Get the subscription name which is the document id from the query
    var docID = req.params.id;
    var subscription;
    var reviewsList = [];

    // Get the review innformation from the GET page
    // Subscriptions to retrieve and store: name, plan, price, last bill date, frequency of renewal, 
    // notify me (in days), notes, logo.
    var nowInSeconds = Math.trunc(new Date().getTime() / 1000); 
    var username = req.body.username;
    var chooseRating = parseInt(req.body.givenStarRating);
    var reviewGiven = req.body.reviewGiven;
    var subName = req.body.subName;

    /// Review map data
    var data = {
      datePosted: nowInSeconds,
      ratingGiven: chooseRating,
      review: reviewGiven,
      subID: docID,
      subName: subName,
      userid: firebase.auth().currentUser.email,
      username: username
    };

    // User's subscription status & previous rating of the user's review
    var previousRating;
  
    users.doc(firebase.auth().currentUser.email).get()
    .then(user => {
      userSubscription = user.data().status;

        // check if review exists => 1. if not add it; 2. if yes update it
        reviews.doc(docID+firebase.auth().currentUser.email).get()
        .then(review => {
          if(review.exists) {

            // GET previous rating and update it with the new rating
            previousRating = review.data().ratingGiven;
            
            reviews.doc(docID+firebase.auth().currentUser.email).update(data)
            .then(result1 => {

              // Then update the subscription's ratings and rating count
              subscriptions.doc(docID).get()
                .then(subscription => {

                  // Calculate upadated rating
                  var rating;
                  var ratingCount;

                    rating = parseFloat(subscription.data().rating).toFixed(1);
                    ratingCount = parseInt(subscription.data().ratingCount);
                  

                  console.log('--- Before rating change in db ---');
                  console.log(rating);
                  console.log(ratingCount);
                  console.log(previousRating);
                  console.log(chooseRating);
                  console.log('--- After rating change in db ---');
                  
                  
                  var newRating = parseFloat(((rating * ratingCount) - previousRating + chooseRating) / ratingCount).toFixed(2);
                  var newRatingCount = ratingCount;

                  console.log(newRating);
                  console.log(newRatingCount);

                  console.log('--- Rating change code block end ---');

                  /// Increase the new star count and decrease the previous star count
                  var subData = {
                    rating: newRating,
                    ratingCount: newRatingCount,
                    fiveStarCount: (chooseRating == 5 && previousRating != 5)
                        ? subscription.data().fiveStarCount + 1
                        : (previousRating == 5 && chooseRating != 5)
                            ? subscription.data().fiveStarCount - 1
                            : subscription.data().fiveStarCount,
                    fourStarCount: (chooseRating == 4 && previousRating != 4)
                        ? subscription.data().fourStarCount + 1
                        : (previousRating == 4 && chooseRating != 4)
                            ? subscription.data().fourStarCount - 1
                            : subscription.data().fourStarCount,
                    threeStarCount: (chooseRating == 3 && previousRating != 3)
                        ? subscription.data().threeStarCount + 1
                        : (previousRating == 3 && chooseRating != 3)
                            ? subscription.data().threeStarCount - 1
                            : subscription.data().threeStarCount,
                    twoStarCount: (chooseRating == 2 && previousRating != 2)
                        ? subscription.data().twoStarCount + 1
                        : (previousRating == 2 && chooseRating != 2)
                            ? subscription.data().twoStarCount - 1
                            : subscription.data().twoStarCount,
                    oneStarCount: (chooseRating == 1 && previousRating != 1)
                        ? subscription.data().oneStarCount + 1
                        : (previousRating == 1 && chooseRating != 1)
                            ? subscription.data().oneStarCount - 1
                            : subscription.data().oneStarCount,
                  };

                // Then update the subscription
                subscriptions.doc(docID).update(subData)
                  .then(result => {
                    res.redirect('/subscription/' + docID);
                    return;
                  })

                })
            }) 
            .catch(err1 => {
              res.render('errorPage', { message: err1, displaySubscription: false });
            })
          } else {

            /// Otherwise create the new review with the document id being
            /// the [subscriptionId + userid]

            reviews.doc(docID+firebase.auth().currentUser.email).set(data)
            .then(result => {

              subscriptions.doc(docID).get()
                .then(subscription => {


                  // Calculate the new rating
                  var rating = parseFloat(subscription.data().rating).toFixed(1);
                  var ratingCount = parseInt(subscription.data().ratingCount);
                  
                  var newRating = parseFloat(((rating * ratingCount) + chooseRating) / (ratingCount + 1)).toFixed(2);
                  var newRatingCount = ratingCount + 1;

                  /// Increase the new star count and rating count
                  var subData = {
                    rating: newRating,
                    ratingCount: newRatingCount,
                    fiveStarCount: (chooseRating == 5 && previousRating != 5)
                        ? subscription.data().fiveStarCount + 1
                        : (previousRating == 5 && chooseRating != 5)
                            ? subscription.data().fiveStarCount - 1
                            : subscription.data().fiveStarCount,
                    fourStarCount: (chooseRating == 4 && previousRating != 4)
                        ? subscription.data().fourStarCount + 1
                        : (previousRating == 4 && chooseRating != 4)
                            ? subscription.data().fourStarCount - 1
                            : subscription.data().fourStarCount,
                    threeStarCount: (chooseRating == 3 && previousRating != 3)
                        ? subscription.data().threeStarCount + 1
                        : (previousRating == 3 && chooseRating != 3)
                            ? subscription.data().threeStarCount - 1
                            : subscription.data().threeStarCount,
                    twoStarCount: (chooseRating == 2 && previousRating != 2)
                        ? subscription.data().twoStarCount + 1
                        : (previousRating == 2 && chooseRating != 2)
                            ? subscription.data().twoStarCount - 1
                            : subscription.data().twoStarCount,
                    oneStarCount: (chooseRating == 1 && previousRating != 1)
                        ? subscription.data().oneStarCount + 1
                        : (previousRating == 1 && chooseRating != 1)
                            ? subscription.data().oneStarCount - 1
                            : subscription.data().oneStarCount,
                  };

                  // Update the subscription with new rating
                  subscriptions.doc(docID).update(subData);
                })
            })
            .then(result3 => {
              res.redirect('/subscription/' + docID);
              return;
            })
            .catch(err1 => {
              res.render('errorPage', { message: err1, displaySubscription: false });
            })
          }
        })
    })

  });



  // GET ROUTE FOR ADDING A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id/name of the subscription being displayed/added]
  app.get('/addsubscription/:id', [isAuthenticated], (req, res) => {

    // Get the subscription name which is the document id from the query
    var docID = req.params.id;

    // Update addFromSubDescPage counter for the subscription and navigate to add subscription page
    subscriptions.doc(docID).update({
      addFromSubDescPage: admin.firestore.FieldValue.increment(1)
    }).then(result => {
      subscriptions.doc(docID).get()
      .then( subscription => {
        res.render('subscriptionform', {subscription});
      })
      .catch(err1 => {
        res.render('errorPage', { message: err1, displaySubscription: false });
      });
    })
    .catch(err2 => {
      res.render('errorPage', { message: err2, displaySubscription: false });
    });
    
  });



  // POST ROUTE FOR ADDING A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id/name of the subscription being displayed/added]
  app.post('/addsubscription/:id', [isAuthenticated], (req, res) => {

    // Get the subscription id which is the document id from the query
    var docID = req.params.id;
    
    // Get the subscription innformation from the GET page
    // Subscriptions to retrieve and store: name, plan, price, last bill date, frequency of renewal, 
    // notify me (in days), notes, logo.
    var subName = req.body.name; 

    // plan name
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

    // price value
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


    // subscription frequency
    var subscriptionFrequency;
    if(req.body.subscriptionFrequency == 'unselected') {
      subscriptionFrequency = '';
    } else {
      subscriptionFrequency = req.body.subscriptionFrequency;
    }


    // subscription Notification
    var subscriptionNotification;
    if(req.body.subscriptionNotification == 'unselected') {
      subscriptionNotification = 7;
    } else {
      subscriptionNotification = Number(req.body.subscriptionNotification);
    }


    // last paid date
    var lastPaidlDate = new Date(req.body.lastBillDate);
    var lastPaidDateSeconds = Math.trunc(lastPaidlDate / 1000);


    // next bill date
    var nextBillInSeconds;
    // 0 = January. So, months range from 0 - 11.
    /// Add 28 if month = [1], add 30 if month = [3, 5, 8, 10] & add 31 if month = [0, 2, 4, 6, 7, 9, 11].

    /// Get current month so we can adjust next pay date based on the month of lastPaidDate
    var month;
    month = lastPaidlDate.getMonth();


    if(subscriptionFrequency == 'Weekly') {
      nextBillInSeconds = lastPaidDateSeconds + (86400 * 7);
    } else if(subscriptionFrequency == 'Monthly') {
      if(month === 3 || month === 5 || month === 8 || month === 10) {
        nextBillInSeconds = (lastPaidDateSeconds + (86400 * 30));
      } else if(month === 0 || month === 2 || month === 4 || month === 6 || month === 7 || month === 9 ||  month === 11) {
        nextBillInSeconds = (lastPaidDateSeconds + (86400 * 31));
      } else if(month === 1) {
        nextBillInSeconds = (lastPaidDateSeconds + (86400 * 28));
      }
    } else if(subscriptionFrequency == 'Yearly') {
      nextBillInSeconds = lastPaidDateSeconds + (86400 * 365);
    }


    // notify At
    if(subscriptionNotification => 0 && subscriptionNotification < 7) {
      var notifyAtInSeconds = nextBillInSeconds - (86400 * subscriptionNotification);
    }

    // notes
    var subscriptionNotes = req.body.subscriptionNotes;


    // logo
    var logoLink = req.body.logo;


    // First check if the subscription is already added and update it if it is
    users.doc(firebase.auth().currentUser.email).get()
      .then(user => {
        // Get the list of current subscriptions
        let subList = user.data().usersubscriptions;

        // Check if any subscriptions match with the newly added one.
        // If yes, then update the subscription.
        if(subList.includes(docID)) {
          usersubscriptions.where('userEmail', '==', firebase.auth().currentUser.email)
              .where('subID', '==', docID).get()
              .then(querySnapshot => {
                querySnapshot.forEach(doc => {

                  doc.ref.update({
                    'lastPaidDate': lastPaidDateSeconds,
                    'nextPayDate': nextBillInSeconds == null ? '' : nextBillInSeconds,
                    'notifyAt': notifyAtInSeconds == null ? '' : notifyAtInSeconds,
                    'planName': plan,
                    'price': price,
                    'subName': subName,
                    'subscriptionFrequency': subscriptionFrequency,
                    'subscriptionNotification': subscriptionNotification,
                    'subscriptionNotes': subscriptionNotes,
                  })
                  .then(result => {
                    res.redirect('/mycrate');
                  })
                  .catch(e1 => {
                    console.log('user subscription update failed.');
                    res.render('errorPage', { message: e1, displaySubscription: false });                
                  });
                })
              })
        } else {
          // Otherwise add the subscription to user's list and the
          // [user subscriptions] collection

          users.doc(firebase.auth().currentUser.email).update({
            usersubscriptions: admin.firestore.FieldValue.arrayUnion(docID)            
          }).then(result => {
            usersubscriptions.add({
              lastPaidDate: lastPaidDateSeconds,
              nextPayDate: nextBillInSeconds,
              notifyAt: notifyAtInSeconds,
              logoLink: logoLink,
              planName: plan,
              price: price,
              subID: docID,
              subName: subName,
              subscriptionFrequency: subscriptionFrequency,
              subscriptionNotification: subscriptionNotification,
              subscriptionNotes: subscriptionNotes,
              userEmail: firebase.auth().currentUser.email
            }).catch(e3 => {
              
              console.log('user subscription add failed');
              res.render('errorPage', { message: e2, displaySubscription: false });
            });

            // store the new data to user's profile and then redirect to mycrates
            res.redirect('/mycrate');
          })
          .catch(e2 => {
            console.log('user subscription add failed');
            res.redirect('/deletesubscription/'+docID);
          })
        }

      })
      .catch(err1 => {
      res.render('errorPage', { message: err1, displaySubscription: false });
      })

  }); // END POST ROUTE FOR ADDING A SUBSCRIPTION




  // GET ROUTE FOR EDITINNG A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id/name of the subscription being displayed/added]
  app.get('/editsubscription/:id', [isAuthenticated], (req, res) => {

    // Get the subscription name which is the document id from the query
    var docID = req.params.id;
    var n = 'Custom subscription';


    // add data to subscription
    let data = {
      subscriptionName: n,
      category: "Custom",
      image: 'https://firebasestorage.googleapis.com/v0/b/subcrates.appspot.com/o/subscriptionImages%2FcustomImage.jpg?alt=media&token=2d597f3b-e044-45b4-98e3-aa39de2d7ad5',
      homepageViewMore: 0,
      addFromSubDescPage: 0,
    }

     subscriptions.doc(docID).set(data)
      .then(sub => {
        var q = '/addSubscription/' + docID;
        res.redirect(q);
        return;
      })
      .catch(err1 => {
        res.render('errorPage', { message: err1, displaySubscription: false });
      });

  });
 


  // GET ROUTE FOR DELETING A SUBSCRIPTION [FORMAT /addsubscription/:id -> the id(name) of the subscription being displayed/added]
  app.get('/deletesubscription/:id', [isAuthenticated], (req, res) => {

    // Get the id of the subscription from the param id
    var subID = req.params.id;

    if(subID == 'subcrates') {
      res.render('errorPage', { message: 'Error: This subscription can only be edited.', displaySubscription: false });
      return;
    } else {
      // First check if the subscription is already added and delete it if it is
    users.doc(firebase.auth().currentUser.email).get()
      .then(user => {
        // Get the list of current subscriptions
        let subList = user.data().usersubscriptions;
        // Check if any subscriptions match with the newly added one
        for(let i = 0; i < subList.length; i++) {
          if(subID === subList[i]) {
            // Delete the subscription from user's array list 
            users.doc(firebase.auth().currentUser.email).update({
              usersubscriptions: admin.firestore.FieldValue.arrayRemove(subID)
            }).then(result => {
              // Delete the subscription from [user subscription] collection
              // for this user
              usersubscriptions.where('userEmail', '==', firebase.auth().currentUser.email)
              .where('subID', '==', subID).get()
              .then(querySnapshot => {
                querySnapshot.forEach(doc => {
                  doc.ref.delete();
                });

                // Load mycrates page again
                res.redirect('/mycrate');
                return;
              })
              .catch(er3 => {
                console.log(err1);
                res.render('errorPage', { message: err1, displaySubscription: false });
              });

            })
            .catch(err1 => {
              console.log(err1);
              res.render('errorPage', { message: err1, displaySubscription: false });
            });
          }
        }
      });
    }

  });


  

  // GET ROUTE FOR MY CRATE PAGE
  app.get('/mycrate', [isAuthenticated], (req, res) => {
    var dateList = [];
    var weeklyCost = 0.00;
    var monthlyCost = 0.00;
    var yearlyCost = 0.00;


    // use user email to get all the subscriptions and display them
    users.doc(firebase.auth().currentUser.email).get()
      .then(user => {
        let subList = []; // user subscription list 
        let subscriptionsList = []; // subscription list with all the data in it


          // Get firebase date in seconds and set up bill date display and calculate weekly, monthly & yearly expenses
          usersubscriptions.where('userEmail', '==', firebase.auth().currentUser.email)
            .get()
            .then(subs => {
              subs.forEach((sub) => {
                // add subscription to subList
                subList.push(sub);

                // FOR WEEKLY COST
                if(sub.data().subscriptionFrequency == 'Weekly') {
                  var nextbill = new Date(sub.data().nextPayDate * 1000).toISOString();
                  nextbill = Date.parse(nextbill).toString("M/d/yyyy");
                  dateList.push(nextbill);

                  if(sub.data().price != '') {
                    weeklyCost += sub.data().price;
                    monthlyCost += (sub.data().price * 4);
                    yearlyCost += (sub.data().price * 52);
                  }
                // FOR MONTHLY COST
                } else if(sub.data().subscriptionFrequency == 'Monthly') {
                  var nextbill = new Date(sub.data().nextPayDate * 1000).toISOString();
                  nextbill = Date.parse(nextbill).toString("M/d/yyyy");
                  dateList.push(nextbill);

                  if(sub.data().price != '') {
                    weeklyCost += (sub.data().price / 4);
                    monthlyCost += sub.data().price;
                    yearlyCost += (sub.data().price * 12);
                  }
                // FOR YEARLY COST
                } else if (sub.data().subscriptionFrequency == 'Yearly') {
                  var nextbill = new Date(sub.data().nextPayDate * 1000).toISOString();
                  nextbill = Date.parse(nextbill).toString("M/d/yyyy");
                  dateList.push(nextbill);

                  if(sub.data().price != '') {
                    weeklyCost += (sub.data().price / 52);
                    monthlyCost += (sub.data().price / 12);
                    yearlyCost += sub.data().price;
                  }
                } else {
                  var text = 'Date or frequency missing';
                  dateList.push(text); 
                }

                
                subscriptions.doc(sub.data().subID).get()
                  .then(subscription => {
                    // add subscription from subscriptions db to subscriptionsList
                    subscriptionsList.push(subscription);
                  })
                  .catch(e6 => {
                    console.log(e6);
                    res.render('errorPage', { message: e6, displaySubscription: false });    
                  })
   
              })
              res.render('mycrates', {subList, subscriptionsList, dateList, weeklyCost, monthlyCost, yearlyCost});
            })
            .catch(e4 => {
              console.log(e4);
              res.render('errorPage', { message: e4, displaySubscription: false });    
            })
      })
      .catch(e5 => {
        console.log(e5);
        res.render('errorPage', { message: e5, displaySubscription: false });   
      })

  });




  // HEADLINES PAGE GET ROUTE
  app.get('/headlines', (req, res) => {
    res.render('headlines');
  });



  // GIFTS PAGE GET ROUTE
  // This route filters all the subscriptions that can be gifted based on [canGift] variable in the
  // database and sends it to the [gift.ejs] page
  app.get('/gifts', [isAuthenticated], (req, res) => {
    var allSubscriptions = []; // holds all the subscriptions that can be gifted

    subscriptions.where('canGift', '==', true).get()
      .then(subscriptionsSnap => {
        subscriptionsSnap.forEach(singleSubscription => {
          //push all subscriptions that can be gifted into array
          allSubscriptions.push(singleSubscription);
          console.log(singleSubscription.data().subscriptionName);
        });

        // THEN RENDER GIFT PAGE
        res.render('gifts', {allSubscriptions});

      }).catch(err1 => {
        console.log(err1);
        res.render('errorPage', { message: err1, displaySubscription: false });
      });
  });

 

  // GIFT FORM PAGE GET ROUTE
  app.get('/giftform', (req, res) => {
    res.render('giftform');
  });




  // GET ROUTE FOR SETTINGS PAGE
  app.get('/settings', isAuthenticated, (req, res) => {
    // Get the status of the user to display the subscription OR cancel subscription
    // button.
    users.doc(firebase.auth().currentUser.email).get()
      .then(user => {
        var userStatus = user.data().status;
        res.render('settings', {userStatus: userStatus, userEmail: firebase.auth().currentUser.email});
      })
      .catch(err1 => {
        console.log(err1);
        res.render('errorPage', { message: err1, displaySubscription: false });        
      });
  });




  // GET ROUTE FOR BUSINESS DASHBOARD PAGE
  // app.get('/businessdash', (req, res) => {
  //   res.render('business_dashboard');
  // });





  // POST ROUTE - SEARCH - Use the name from the search query to find the item and display it in 
  // subscription details page.
  // If name is not in the subscription list in db then return 'Subscription Not found. Use Custom sub
  // to create your own subscription.'
  app.post('/search', [isAuthenticated], (req, res) => {

    // Get the name of the subscription from the search body 
    var name = req.body.searchBar;

    // Get all subscriptions and then find the one whose [subscriptionName] matches [name] and redirect
    // to [subscriptionDetails] page.
    subscriptions.get()
      .then(subscriptionSnap => {
        subscriptionSnap.forEach(singleSubscription => {
          if(singleSubscription.data().subscriptionName == name) {
            res.redirect('/subscription/' + singleSubscription.id);
            return;
          }
        });
        res.render('errorPage', 
        { message: 'No such subscription found in our database. Please use custom subscription to add it. If you would like us to add this subscription let us know by contacting us.', displaySubscription: false })
      })
  });



  // POST ROUTE TO CHARGE SUBSCRIPTION FEE
  app.post('/subscribe', isAuthenticated, (req,res) => {

    // Create a customer for the user and then assign automatic subscription
    stripe.customers.create({
      email: req.body.stripeEmail,
      source: req.body.stripeToken
    },function(err, customer) {

      if(err) {
        res.render('errorPage', { message: err, displaySubscription: false });
      } else {
        const { id } = customer;

        stripe.subscriptions.create({
          customer: id,
          items: [
            {
              plan: 'price_1HEQZSDb5Y9ujDqzYReaXCVm',
              
            },
          ],
        }, function(err, subscription) {

          console.log(subscription);
          // Update user's status and subscription expiry time (in seconds) when user
          // subscribes to Subcrates. 
          users.doc(firebase.auth().currentUser.email).update({
            status: true,
            expiresAt: subscription.current_period_end,
            subscriptionID: subscription.id
          });

          if(err) {
            res.render('errorPage', { message: err, displaySubscription: false });            
          } else {
            res.render('Settings/settings', {userStatus: true, userEmail: firebase.auth().currentUser.email});
          }
        });
      }
    });
  });


// CANCEL SUBSCRIPTION POST ROUTE
app.post('/cancelsubscription', isAuthenticated, (req, res) => {

  users.doc(firebase.auth().currentUser.email).get()
    .then(user => {
      stripe.subscriptions.del(
        user.data().subscriptionID,
        // 'sss',
        function(err, confirmation) {
    
          console.log(confirmation);
    
          // Update user's status to false 
          users.doc(firebase.auth().currentUser.email).update({
            status: false,
            subscriptionID: ''
          });
          
    
          if(err) {
            res.render('errorPage', { message: err, displaySubscription: false });            
          } else {
            // After cancelling subscription go to settings screen
            res.render('Settings/settings', {userStatus: false, userEmail: firebase.auth().currentUser.email});
          }
        }
      );
    });
});


// RESET PASSWORD PAGE GET ROUTE
app.get('/resetpassword', (req, res) => {
  res.render('reset_password');
});




// RESET PASSWORD PAGE POST ROUTE
app.post('/resetpassword', (req, res) => {
  const email = req.body.email
  const auth = firebase.auth()

  if (email != "") {
      auth.sendPasswordResetEmail(email.toString())
          .then(result => {
              res.render('reset_sent');
          }).catch(err1 => {
            res.render('errorPage', {message: err1, displaySubscription: false })
          });
  } else {
      res.render('errorPage', { message: "Enter a valid email", displaySubscription: false });
  }
});



  // GET ROUTE FOR TERMS OF USE
  app.get('/tos', (req, res) => {
    res.render('Policies/termsOfUse');
  });


  // GET ROUTE FOR PRIVACCY
  app.get('/privacy', (req, res) => {
    res.render('Policies/privacy');
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
        res.render('errorPage', {message: err, displaySubscription: false })
    })
  });


