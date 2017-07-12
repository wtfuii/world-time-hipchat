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
          headers: { 'Authorization': 'JWT ' + token },
          dataType: 'json',
          success: function (res) {
            jq_timezoneselect.val(res).trigger('change')
          },
          error: function (res) {
            jq_timezoneselect.val([]).trigger('change')
          }
        });
    }

    jq_timezoneselect.on('change', function () {
      HipChat.auth.withToken(function (err, token) {
        if (!err) {
          $.ajax(
            {
              type: 'POST',
              url: '/selectedtzs',
              headers: { 'Authorization': 'JWT ' + token },
              dataType: 'json',
              data: { tzs: jq_timezoneselect.val() },
              
            }).done((succ) => {
AJS.messages.success({
   title: 'This is a title in a default message.',
   body: '<p> And this is just content in a Default message.</p>'
});
            }).fail((error) => {console.log(error)})
        }
      })
    });
  });
});