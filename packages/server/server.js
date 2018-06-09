const http = require('http')
const path = require('path')
const swaggerJSDoc = require('swagger-jsdoc')
const SwaggerParser = require('swagger-parser')

const logger = require('./main/logger').getLogger('SERVER')
const configuration = require('./main/configuration')

logger.info('STARTUP')

var svcsettings = configuration.settings

logger.info('Settings: \n' + JSON.stringify(svcsettings, null, 2));

// Express and middlewares
var express = require('express')
var expressBodyParser = require('body-parser')
//var expressLogger = require('morgan')
//var expressMethodOverride = require('method-override')
//var expressErrorHandler = require('errorhandler')

var packageInfo = require('../package.json')

// Express server configuration //

var app = module.exports = express()
var env = app.get('env')

// metadata about service
app.set('svcInfo', packageInfo)

// all environments
app.set('port', process.env.PORT || svcsettings.port || 3003)

app.use(express.static(path.join(__dirname, '..', 'dist')))

// TODO ??
//app.use(expressLogger('dev'))

app.use(expressBodyParser.urlencoded({limit: '10mb', extended: true}))
app.use(expressBodyParser.json({limit: '10mb'}))
//app.use(expressMethodOverride())

// development only
//if (env === 'development') {
//  app.use(expressErrorHandler())
//}

// TODO Check ?
// Set http caching headers, mark all response as expired one second ago.
app.use(function (req, res, next) {
  res.set('Cache-Control', 'private')
  res.set('Expires', new Date(Date.now() - 1000).toUTCString())
  next()
})

// API
var logviapi = require('./main/api')
app.use('/api/v1', logviapi)

app.get('/info', function (req, res) {
  res.json({name: app.get('svcInfo').name, version: app.get('svcInfo').version})
})

app.get('/settings', function (req, res) {
  res.json(svcsettings)
})

// SWAGGER-JSDOC Initialization //
var swOptions = {
  swaggerDefinition: {
    info: {
      description: 'logvi',
      version: '1.0.0',
      title: 'Logvi API',
      contact: {
        email: 'sv2@slana.tech'
      }
    },
    host: 'localhost',
    basePath: '/api/v1',
    schemes: ['http'],
    securityDefinitions: {}
  },
  apis: ['./main/api.js']  // Path to the API files with swagger docs in comments
}

// Initialize swagger-jsdoc -> returns validated swagger spec in json format
var swaggerSpec = swaggerJSDoc(swOptions)

app.get('/swagger.json', function (req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

var parser = new SwaggerParser()

parser.validate(swaggerSpec, function (err, api) {
  if (err) {
    console.log('Error validating swagger spec: ' + err)
    return
  }

  // Swagger spec successfully validated

  // Setup server
  var server = http.createServer(app)

  // Start server
  server.listen(app.get('port'), function () {
    logger.info('Express server listening on port ' + app.get('port'))
    logger.info('Service url: http://localhost:' + app.get('port'))
    logger.info('Service name: ' + app.get('svcInfo').name + ', version: ' + app.get('svcInfo').version)
  })
})

// EVENTS //////////////////////////////////////////////////////////////// //

process.on('SIGTERM', function () {
  logger.info('Service shutting down gracefully');
  process.exit()
})

if (process.platform === 'win32') {
  require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  }).on('SIGINT', function () {
    process.emit('SIGINT')
  })
}

process.on('SIGINT', function () {
  logger.info('Service down gracefully')
  process.exit()
})

process.on('uncaughtException', function (err) {
  logger.fatal('Uncaught Exception - Service is exiting')
  logger.fatal(err.stack)
  process.exit();
})
