var winston = require("winston");

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({ filename: 'traces.log', level: 'info', json:true })
  ]
});

exports.logger = logger;
