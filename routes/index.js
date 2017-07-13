var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');
var moment = require('moment');

// take a look at https://developer.atlassian.com/hipchat/tutorials/getting-started-with-atlassian-connect-express-node-js
module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);

  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  app.get('/',
    function (req, res) {
      res.format({
        'text/html': function () {
          var homepage = url.parse(addon.descriptor.links.homepage);
          if (homepage.hostname === req.hostname && homepage.path === req.path) {
            res.render('homepage', addon.descriptor);
          } else {
            res.redirect(addon.descriptor.links.homepage);
          }
        },
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
  );


  app.get('/config',
    addon.authenticate(),
    function (req, res) {
      res.render('config', { context: req.context, timezones: moment.tz.names() });
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
        res.json({ status: "ok" })
      })
    })


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
          if (typeof selectedTzs === 'string') {
            selectedTzs = JSON.parse(selectedTzs)
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
      Promise.all(promises).then(() => {
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
