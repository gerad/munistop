MuniStop = (function() {
  // store class - data store (cookie based)
  var store = (function() {
    var cookies = 10;
    var expire = 90; // 90

    var cookie = function(c_name, value, expiredays) {
      c_name = '' + c_name;
      if(value !== undefined) { // set the cookie
        var exdate = new Date();
        exdate.setDate(exdate.getDate() + expiredays);
        document.cookie = c_name + "=" + escape(value) +
          ((expiredays !== undefined) ? "" : ";expires="+exdate.toGMTString());
      } else { // get the cookie
        if (document.cookie.length <= 0) return null;

        c_start = document.cookie.indexOf(c_name + "=");
        if(c_start == -1) return null;
        c_start = c_start + c_name.length + 1; 

        c_end = document.cookie.indexOf(";",c_start);
        if(c_end == -1) c_end = document.cookie.length;

        return unescape(document.cookie.substring(c_start, c_end));
      }
    };

    var stringify = function(data) {
      return data.map(function(row) { 
        return row.join("\t"); 
      }).join("\n");
    };

    var unstringify = function(string) {
      var ret = [];
      string.split("\n").forEach(function(row) {
        if(row) ret.push(row.split("\t"));
      });
      return ret;
    };

    var save = function(data) {
      for(var i = cookies - 2; i >= 0; i--) {
        var c = cookie(i);
        if(c) cookie(i + 1, c, expire);
      }
      cookie(0, stringify(data), expire);
    };

    var load = function() {
      var ret = [], c;
      for(var i = 0; i < cookies; i++) {
        c = cookie(i);
        if(c) ret.push(unstringify(c));
      }
      return ret;
    };

    var reset = function() {
      for(var i = 0; i < cookies; i++)
        cookie(i, '', -1);
    }

    var store = function(data) {
      if(!data) return load();
      save(data);
    };
    store.reset = reset;

    return store;
  })();

  // get class - calls the api
  var get = (function() {
    var hierarchy = ['routes', 'directions', 'stops', 'times'];

    var getJSON = function(url, callback) {
      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if(xhr.readyState === 4) {// loaded
          if(xhr.status === 200) {
            var json = eval('('+xhr.responseText+')');
            callback(json);
          } else console.error(xhr.statusText);
        }
      };
      xhr.open('GET', url, true);
      xhr.send('');
    }

    var url = function(data) {
      var url = '';
      for(var i = 0; i <= data.length; i++) {
        if(i > 0) url += '/' + data[i - 1];
        url += '/' + hierarchy[i];
      }
      return url;
    };

    var get = function(data, callback) {
      getJSON(url(data), callback);
    };

    return get;
  })();

  // time class
  var time = (function() {

    var display = function(data) {
      var times = document.getElementById('times');
      var table = "<table><tr>" +
        "<td class='info'>" +
        "  <div class='stop'>" + data[2][1] + '</div>' +
        "  <div class='route'>" + data[0][1] + ' - ' + data[1][1] + '</div>' +
        "</td><td class='times'>" +
        "  <img class='loading' src='/i/ajax-loader.gif' alt='loading&hellip;' />" +
        "  <div class='current' style='display:none'></div>" +
        "  <div class='next' style='display:none'></div>" +
        "</td>" +
        "</tr></table>";

      times.innerHTML = table + times.innerHTML;
      table = times.getElementsByTagName('table')[0];
      var loading = table.getElementsByClassName('loading')[0];
      var current = table.getElementsByClassName('current')[0];
      var next = table.getElementsByClassName('next')[0];
      var info = data.map(function(d) { return d[0]; });

      var updateDisplay = function() {
        loading.style.display = '';
        current.style.display = 'none';
        next.style.display = 'none';

        get(info, function(json) {
          if(json.length > 0) {
            current.innerHTML = json.shift();
          } else current.innerHTML = 'None';

          next.innerHTML = json.join(', ');

          loading.style.display = 'none';
          current.style.display = '';
          next.style.display = '';
        });
      };
      updateDisplay();
      setInterval(updateDisplay, 20000);
    };

    return function(data) {
      display(data);
    };
  })();

  // choice class
  var choice = (function() {
    var selects = document.getElementsByTagName('select');

    var data = function () {
      var data = [];
      for(var i = 0; i < selects.length; i++) {
        var sel = selects[i];
        if(sel.getAttribute('disabled')) break;

        var opt = sel.options[sel.selectedIndex];
        data.push([opt.value, opt.innerHTML])
      }
      return data;
    }

    var reset = function(select) {
      var opts = select.getElementsByTagName('option');
      for(var i = 1; i < opts.length; i++)
        select.removeChildNode(opts[i]);
      select.setAttribute("disabled", true);
    }

    var position = function(name) {
      for(var i = 0; i< selects.length; i++) {
        if(selects[i].getAttribute('name') === name)
          return i;
      }
    }

    var update = function(pos) {
      var select = selects[pos];

      for(var i = pos; i < selects.length; i++)
        reset(selects[i]);

      var chosen = data().map(function(d) { return d[0]; });
      get(chosen, function(json) {
        json.forEach(function(a) {
          select.innerHTML = select.innerHTML
            + '<option value="' + a[1] + '">' + a[0] + '</option>';
        });
        select.removeAttribute("disabled");
      });
    };

    var change = function(event) {
      var select = event.target;
      var name = select.getAttribute('name');
      var pos = position(name);
      var next = pos + 1;
      if(next === selects.length) {
        store(data());  // TODO tightly coupled
        time(data());
      }
      else update(next);
    };

    for(i = 0; i < selects.length; i++) {
      selects[i].addEventListener('change', change);
    }

    return function(name) {
      if(name !== undefined) {
        var pos = position(name);
        update(pos);
      }
      else return data();
    }
  })();

/*
  choice('routes');
  store().forEach(function(data) {
    time(data);
  });
*/
  return {
    store: store,
    get: get,
    choice: choice,
    time: time
  };

})();
