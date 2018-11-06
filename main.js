var express = require("express");
var logfmt = require("logfmt");
var request = require('request');
var app = express();

// App setup
app.use(logfmt.requestLogger());
app.use (function(req, res, next) {
    var data='';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { 
       data += chunk;
    });
    req.on('end', function() {
        req.body = data;
        next();
    });
});

// Setup the configurations
var configurations = [
  {
    requestUrl: '/mixpanel',
    postUrl: process.env.SLACK_WEBHOOK_URL,
    formatter: function(data) {
      var ret = [];
      try {
        // First we need to format the mixpanel data
        data = decodeURIComponent(data).substr(6).replace(/\+/g,' ');
        // Then we parse it
        data = JSON.parse(data);
        data.forEach(function(event) {
          var reason = event['$properties']['$Reason'];
          var type = event['$properties']['$Type'];
          var payload = {              
            attachments: [
              {
                fallback: reason + ": " + type,
                text: reason + ": " + type,
                color: "#d17c88"
              }
            ],
            icon_emoji: ":moneybag:",
            username: "Mixpanel"
          };
          ret.push(payload);
        });
      } catch(error) {
        console.error('Failed to process data');
        console.error(error);
      }
      return ret;
    }
  }
];

// Handle posted messages
app.post('/*', function(req, res) {
  var url = req.url;
  var body = req.body;
  var startedRequests = 0;
  var completedRequests = 0;
  
  var doPost = function(item, data) {
    request({url: item.postUrl,
             method: 'POST',
             json: true, 
             body: data},
             function(err,httpResponse,body){
               completedRequests++;               
                if (completedRequests == startedRequests) {
                  res.send('OK');
                }
              });
     startedRequests++;
  };
  
  configurations.filter(function(item) {
    return item.requestUrl === url.substr(0, item.requestUrl.length);
  })
  .forEach(function(item) {
    var bodyReformatted = item.formatter(body, url);
    console.log('Found formatter');
    if (bodyReformatted) {
       console.log('Reformatting done, will pass the data to the next hook');
       
       if (bodyReformatted instanceof Array) {
         bodyReformatted.forEach(function(postData){
           doPost(item, postData);
         });
       } else {
          doPost(item, bodyReformatted);
       }
    }
  });
  if (startedRequests == 0) {
    res.send('OK');
  }
});

// Start server
var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
