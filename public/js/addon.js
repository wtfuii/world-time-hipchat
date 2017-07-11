/* add-on script */

$(document).ready(function () {
  var jq_timezoneselect = $('#timezone-select')
  jq_timezoneselect.auiSelect2()

  HipChat.auth.withToken(function (err, token) {
  if (!err) {
    $.ajax(
        {
          type: 'GET',
          url: '/selectedtzs',
          headers: {'Authorization': 'JWT ' + token},
          dataType: 'json',
          success: function (res) {
            jq_timezoneselect.val(res)
          },
          error: function (res) {
            jq_timezoneselect.val([])
          }
        });
  }

  jq_timezoneselect.on('change', function() {
  HipChat.auth.withToken(function (err, token) {
  if (!err) {
    $.ajax(
        {
          type: 'POST',
          url: '/selectedtzs',
          headers: {'Authorization': 'JWT ' + token},
          dataType: 'json',
          data: jq_timezoneselect.val(),
          success: function (res) {
            //
          },
          error: function (err) {
            alert(err)
          }
        });
  }
  })
});

});