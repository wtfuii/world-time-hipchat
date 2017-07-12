var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');
var moment = require('moment');

// This is the heart of your HipChat Connect add-on. For more information,
// take a look at https://developer.atlassian.com/hipchat/tutorials/getting-started-with-atlassian-connect-express-node-js
module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);

  // simple healthcheck
  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  // Root route. This route will serve the `addon.json` unless a homepage URL is
  // specified in `addon.json`.
  app.get('/',
    function (req, res) {
      // Use content-type negotiation to choose the best way to respond
      res.format({
        // If the request content-type is text-html, it will decide which to serve up
        'text/html': function () {
          var homepage = url.parse(addon.descriptor.links.homepage);
          if (homepage.hostname === req.hostname && homepage.path === req.path) {
            res.render('homepage', addon.descriptor);
          } else {
            res.redirect(addon.descriptor.links.homepage);
          }
        },
        // This logic is here to make sure that the `addon.json` is always
        // served up when requested by the host
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
    );

  // This is an example route that's used by the default for the configuration page
  // https://developer.atlassian.com/hipchat/guide/configuration-page
  app.get('/config',
    // Authenticates the request using the JWT token in the request
    addon.authenticate(),
    function (req, res) {
      // The `addon.authenticate()` middleware populates the following:
      // * req.clientInfo: useful information about the add-on client such as the
      //   clientKey, oauth info, and HipChat account info
      // * req.context: contains the context data accompanying the request like
      //   the roomId
      res.render('config', {context: req.context, timezones: moment.tz.names()});
    }
    );

  // Sample endpoint to send a card notification back into the chat room
  // See https://developer.atlassian.com/hipchat/guide/sending-messages
  app.post('/send_notification',
    addon.authenticate(),
    function (req, res) {
      var card = {
        "style": "link",
        "url": "https://www.hipchat.com",
        "id": uuid.v4(),
        "title": req.body.messageTitle,
        "description": "Great teams use HipChat: Group and private chat, file sharing, and integrations",
        "icon": {
          "url": "https://hipchat-public-m5.atlassian.com/assets/img/hipchat/bookmark-icons/favicon-192x192.png"
        }
      };
      var msg = '<b>' + card.title + '</b>: ' + card.description;
      var opts = { 'options': { 'color': 'yellow' } };
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, msg, opts, card);
      res.json({ status: "ok" });
    }
    );

    app.get('/selectedtzs',
    addon.authenticate(),
    function (req, res) {
      addon.settings.get('world-time-converter', req.clientInfo.clientKey).then((tzs) => {
        res.json(tzs)
      })
    })

    app.post('/selectedtzs',
    addon.authenticate(),
    function (req, res) {
      let timezones = req.body['tzs[]'];
      if (!(timezones instanceof Array)) {
        timezones = [timezones]
      }
      addon.settings.set('world-time-converter', JSON.stringify(timezones), req.clientInfo.clientKey).then(() => {
        res.json({status: "ok"})
      })
    })

  // This is an example route to handle an incoming webhook
  // https://developer.atlassian.com/hipchat/guide/webhooks
  app.post('/webhook',
    addon.authenticate(),
    function (req, res) {
      const results = req.body.item.message.message.match(/([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]/g);
      if (!results || !results.length) {
        return res.sendStatus(200);
      }
      const promises = []
      results.map((result, index) => {
        //const tzs = moment.tz.names();
        let resultString = ''
        const splittedResult = result.split(':')
        const now = moment.tz(moment(), req.context.user_tz).hour(splittedResult[0]).minute(splittedResult[1]);
        const nowOffset = moment.tz.zone(req.context.user_tz).offset(now)
        addon.settings.get('world-time-converter', req.clientInfo.clientKey).then((selectedTzs) => {
          if (!selectedTzs) {
            return
          }
          selectedTzs.map((tz, tzIndex) => {
            if (tz === req.context.user_tz) {
              return
            }
            const offset = moment.tz.zone(tz).offset(now)
            let differenceString = createDifferenceString(now, nowOffset - offset)
            resultString += `${tz}: ${differenceString}<br>`
          })
          promises.push(hipchat.sendMessage(req.clientInfo, req.identity.roomId, resultString))
        })
      })
        Promise.all(promises).then(()=> {
          res.sendStatus(200);
        })
    }
    );

    function createDifferenceString(now, offset) {
      let result = ''
      const timeZoned = moment(now).add(offset, 'm')
      if (now.isBefore(timeZoned, "d")) {
        result += '(+1) '
      }
      if (now.isAfter(timeZoned, 'd')) {
        result += '(-1) '
      }

      result += timeZoned.format('HH:mm')
      const offsetInHours = offset / 60
      if (offsetInHours >= 0) {
        result += ` (+${offsetInHours} h)`
      } else {
        result += ` (${offsetInHours} h)`
      }
      return result;
    }
  // Notify the room that the add-on was installed. To learn more about
  // Connect's install flow, check out:
  // https://developer.atlassian.com/hipchat/guide/installation-flow
  addon.on('installed', function (clientKey, clientInfo, req) {
    hipchat.sendMessage(clientInfo, req.body.roomId, 'The ' + addon.descriptor.name + ' add-on has been installed in this room');
  });

  // Clean up clients when uninstalled
  addon.on('uninstalled', function (id) {
    addon.settings.client.keys(id + ':*', function (err, rep) {
      rep.forEach(function (k) {
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });

};
