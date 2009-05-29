var MuniStop = (function() {
  // store class - data store (cookie based)
  var Store = (function() {
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
  var Get = (function() {
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
  var Time = (function(options) {
    var my = {
      times: options.times,
      data: options.data
    };

    my.info = my.data.map(function(row) { return row[0]; });
    my.id = my.info.join('-');
    my.html = ["<table id='" + my.id + "'><tr>" ,
        "<td class='info'>" ,
        "  <div class='stop'>" + my.data[2][1] + '</div>' ,
        "  <div class='route'>" + my.data[0][1] + ' - ' + my.data[1][1] + '</div>' ,
        "</td><td class='times'>" ,
        "  <div class='delete' style='display:none'>X</div>" ,
        "  <img class='loading' src='/i/ajax-loader.gif' alt='loading&hellip;' />" ,
        "  <div class='current' style='display:none'></div>" ,
        "  <div class='next' style='display:none'></div>" ,
        "</td>" ,
        "</tr></table>"].join("\n");

    my.elements = function(name) {
      var table = document.getElementById(my.id);
      var elements = {};

      var classNames = ['loading', 'current', 'next', 'delete'];
      classNames.forEach(function(className) {
        elements[className] = table.getElementsByClassName(className)[0];
      });

      return name ? elements[name] : elements;
    };

    my.hideElements = function() {
      var els = my.elements();
      for(var name in els)
        els[name].style.display = 'none';
    };

    my.showLoading = function() {
      my.hideElements();
      my.elements('loading').style.display = '';
    };

    my.showDelete = function() {
      my.hideElements();
      my.elements('delete').style.display = '';
    };

    my.showTimes = function(times) {
      with(my.elements()) {
        if(times.length > 0) {
          current.innerHTML = times.shift();
        } else current.innerHTML = 'None';

        next.innerHTML = times.join(', ');

        loading.style.display = 'none';
        current.style.display = '';
        next.style.display = '';
      }
    };

    my.update = function() {
      my.showLoading();
      Get(my.info, function(json) {
        my.showTimes(json);
      });
    };

    my.remove = function() {
      times.remove(my.id);
    };

    return {
      update: my.update,
      remove: my.remove,
      html: my.html,
      id: my.id
    };
  });

  // times class
  var Times = (function() {
    return function(options) {
      var my = {
        id: options.id,
        ids: {},
        times: []
      };
      my.el = document.getElementById(my.id);

      my.add = function(data) {
        var t = Time({ times: my, data: data });
        if(t.id in my.ids) return;
        my.ids[t.id] = my.times.length;
        my.times.push(t);
        my.el.innerHTML = t.html + my.el.innerHTML;
        return t;
      };

      my.remove = function(id) {
        var child = document.getElementById(id);
        my.el.removeChild(child);
      };

      my.update = function() {
        my.times.forEach(function(time) {
          time.update();
        });
      };

      for(var i = options.data.length - 1; i >= 0; --i )
        my.add(options.data[i]);
      my.update();

      return {
        add: function(data) {
          var t = my.add(data);
          t.update();
        },
        update: my.update
      };
    }
  })();

  // choice class
  var Choice = (function(options) {
    var my = {
      id: options.id,
      onChosen: options.onChosen
    };
    my.el = document.getElementById(my.id);
    if(!my.el) console.log(my.id);
    my.selects = my.el.getElementsByTagName('select');

    my.data = function() {
      var data = [];
      for(var i = 0; i < my.selects.length; i++) {
        var sel = my.selects[i];
        if(sel.getAttribute('disabled')) break;

        var opt = sel.options[sel.selectedIndex];
        data.push([opt.value, opt.innerHTML])
      }
      return data;
    };

    my.reset = function(select) {
      var opts = select.getElementsByTagName('option');
      while(opts.length > 1)
        select.removeChild(opts[1]);
      select.setAttribute("disabled", true);
    };

    my.position = function(name) {
      for(var i = 0; i< my.selects.length; i++) {
        if(my.selects[i].getAttribute('name') === name)
          return i;
      }
    };

    my.update = function(pos) {
      var select = my.selects[pos];

      for(var i = pos; i < my.selects.length; i++)
        my.reset(my.selects[i]);

      var chosen = my.data().map(function(d) { return d[0]; });
      Get(chosen, function(json) {
        json.forEach(function(a) {
          select.innerHTML = select.innerHTML
            + '<option value="' + a[1] + '">' + a[0] + '</option>';
        });
        select.removeAttribute("disabled");
      });
    };

    my.change = function(event) {
      var select = event.target;
      var name = select.getAttribute('name');
      var pos = my.position(name);
      var next = pos + 1;
      if(next === my.selects.length) {
        if('onChosen' in my) my.onChosen(my.data());
      }
      else my.update(next);
    };

    for(i = 0; i < my.selects.length; i++) {
      my.selects[i].addEventListener('change', my.change);
    }

    my.update(0);
  });

  var times;
  var initialize = function() {
    times = Times({id:'times', data: Store()});
    Choice({
      id:'choice',
      onChosen: function(data) {
        Store(data);
        times.add(data);
    }});
  };

  var update = function() { times.update(); };

  /* for html
  window.onload = function() {
    initialize();
    setInterval(update, 10000);
  }; */

  /* for unit tests */
  return {
    choice: Choice,
    get: Get,
    times: Times,
    store: Store,
    initialize: initialize,
    update: update
  };
})();
