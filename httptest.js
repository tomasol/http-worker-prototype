var http = require("https");

let options = {protocol: 'https:', host: 'httpbin.org', path: '/post', method: 'POST'}

var req = http.request(options, function(res) {
    console.log('STATUS: ' + res.statusCode);
    console.log('HEADERS: ' + JSON.stringify(res.headers));
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
    });
});

req.on("error", console.log)

req.write('123 aaaaa', 'ascii', err =>
{console.log('nastala chyba ', err)});
req.end();