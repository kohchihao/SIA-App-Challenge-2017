var QRCode = require("qr-image");
var fs = require("fs");
var nodeMailer = require('nodemailer');
var handlebars = require('handlebars');
var path = require('path');
var express = require('express');
var app = express(); 
var request = require('request');

// Below 3 modules are for firebase
var admin = require("firebase-admin");
const storage = require('@google-cloud/storage');
var serviceAccount = require("./serviceAccountKey.json");

var http = require('http');
var formidable = require("formidable");
var util = require('util');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "<your databaseURL>",
    authDomain: "<your databaseURL>",
    projectId: "<projectId>",
    storageBucket: "<storage bucket url>",
    messagingSenderId: "<your messengingSenderId>"
});

const keyFilename = './serviceAccountKey.json';
const projectId = "<projectId>";
const bucketName = '<storage bucket url>'

var gcs = storage({
    projectId,
    keyFilename
});

const bucket = gcs.bucket(bucketName);

function createPublicFileURL(storageName) {
    return `http://storage.googleapis.com/${bucketName}/${encodeURIComponent(storageName)}`;
}

function writeId(userId, qr_code) {
   admin.database().ref('users').push({
        name: userId,
        qrCode: qr_code
    });
}

const fetch = (qrCode, callback) =>{
  var ref = admin.database().ref("users");
  ref.orderByChild('qrCode').equalTo(qrCode).once("value", function(snapshot) {
    var data = snapshot.val();
      callback(data)
  })
}

var api_url = "https://apidev.singaporeair.com/appchallenge/pnr/get";

var headers = {
    'Content-Type': 'application/json',
    'x-api-key': 'du1yO8KLZm9PfFeg6OHQW8CFcpK1RMym3JXp78Uk',
    "cache-control" : "no-cache"
};

var api_body = {  
   clientUUID:"BAZINGAA",
   request:{  
      pnr:"RVA7GY"
   }
}

var datetime = new Date();
var month
switch(datetime.getMonth()) {
    case 1: 
        month = "January"
        break;
    case 2: 
        month = "Febuary"
        break;
    case 3: 
        month = "March"
        break;
    case 4: 
        month = "April"
        break;
    case 5: 
        month = "May"
        break;
    case 6: 
        month = "June"
        break;
    case 7: 
        month = "July"
        break;
    case 8: 
        month = "August"
        break;
    case 9: 
        month = "September"
        break;
    case 10: 
        month = "October"
        break;
    case 11: 
        month = "November"
        break;
    case 12: 
        month = "December"
        break;
}
var today = datetime.getDate() + " " + month + " " + datetime.getFullYear(); 

function doWork() {
    request.post({
        url: api_url,
        headers : headers,
        body: JSON.stringify(api_body)

    }, function (e, r, body) {
        // your callback body
        var json = JSON.parse(body)
        var customerId = json.responseBody.passengers[0].ticketNumber
        var customerName = json.responseBody.passengers[0].firstName + " " + json.responseBody.passengers[0].lastName
        var title = json.responseBody.passengers[0].title

        var readHTMLFile = function(path, callback) {
            fs.readFile(path, {encoding: 'utf-8'}, function (err, html) {
                if (err) {
                    throw err;
                    callback(err);
                }
                else {
                    callback(null, html);
                }
            });
        };


        var transporter = nodeMailer.createTransport('smtps://abcdeft@gmail.com:mypasswordis@smtp.gmail.com');

        // Generate QR Code based on customerId
        var qr_png = QRCode.image(customerId, { type: 'png' });
        var qr_link = qr_png.pipe(fs.createWriteStream('qrcodes/' + customerId + '.png'));   

        const filePath = "qrcodes/" + customerId + ".png";
        const uploadTo = customerId + ".png";

        // Read the eamil template
        readHTMLFile('email.html', function(err, html) {
            var template = handlebars.compile(html);
            var replacements = {
                 username: customerName,
                 qr_code: createPublicFileURL(uploadTo),
                 title: title,
                 date: today
            };
            var htmlToSend = template(replacements);
            const mailOptions = {
              from: '123455@gmail.com', // sender address
              to: '123455@gmail.com', // list of receivers
              subject: 'Order Confirmation', // Subject line
              html: htmlToSend,// plain text body
              attachments: [
                {   // file on disk as an attachment
                    filename: 'singapore_map.pdf',
                    path: 'singapore_map.pdf' // stream this file
                },
              ]
            };
            console.log("working")
            fetch(customerId,function(data) {
                console.log(data)
                if(data) {
                    console.log(data);
                }else {
                    writeId(customerName, customerId) ;               
                }
                
            });

            // Upload file to firebase
            bucket.upload(filePath, {
                destination: uploadTo,
                public: true
            },function(err, file) {
                if(err)
                {
                    console.log(err);
                    return;
                }
                console.log(createPublicFileURL(uploadTo));

            });

            // Send mail
            transporter.sendMail(mailOptions, function (err, info) {
               if(err) {
                    console.log("Error");
                    console.log(err)
                }
               else
                 console.log(info);
            });
        });
        
    });
}

var server = http.createServer(function (req, res) {
    if (req.method.toLowerCase() == 'get') {
        console.log("doWork");
        displayForm(res);
    } else if (req.method.toLowerCase() == 'post') {
        console.log("post");
        processFormFieldsIndividual(req, res);
    }
});

function displayForm(res) {
    fs.readFile('index.html', function (err, data) {
        res.writeHead(200, {
            'Content-Type': 'text/html',
                'Content-Length': data.length
        });
        res.write(data);
        res.end();
    });
}

function processFormFieldsIndividual(req, res) {
    //Store the data from the fields in your data store.
    //The data store could be a file or database or any other store based
    //on your application.
   var fields = [];
    var form = new formidable.IncomingForm();
    // form.on('field', function (field, value) {
    //     console.log(field);
    //     console.log(value);
    //     fields[field] = value;
    // });

    form.on('end', function () {
        // res.writeHead(200, {
        //     'content-type': 'text/plain'
        // });
        // res.write('received the data:\n\n');
        // res.end(util.inspect({
        //     fields: fields
        // }));
        doWork();
    });
    form.parse(req);
    res.writeHead(200,
      {Location: 'http://www.google.com'}
    );
    res.end();
}

server.listen(process.env.PORT || 5000);
console.log("server listening on 5000");