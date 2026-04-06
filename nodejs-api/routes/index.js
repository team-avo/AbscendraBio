var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// Register locations route
router.use('/locations', require('./locations'));
router.use('/content', require('./content'));
router.use('/public-content', require('./public-content'));
// Inquiries
router.use('/inquiries', require('./inquiries'));

module.exports = router;
