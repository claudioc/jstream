var jStream = (function(window) {

  "use strict";

  var sock;

  var queue = [];
  var groups = [];
  var setup;

  var states = {
    LOADING:   0,
    LOADED:    1,
    EXECUTING: 2,
    EXECUTED:  3,
    ERROR:    -1
  };

  function addListeners() {

    sock.onopen = function() {
      dequeue();
    };

    sock.onmessage = function(e) {

      var message, group, resource;

      try {
        resource = JSON.parse(e.data.trim());
      } catch(ex) {
        console.log("Cannot parse server response.");
        return;
      }

      group = groups[resource.gid];

      // Put "back" the resource in the right slot in the group
      for (var i=0, l = group.resources.length; i < l; i++) {
        if (group.resources[i].name == resource.name) {
          group.resources[i] = resource;
          break;
        }
      }

      if (resource.type == 'css') {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = resource.content;
        document.getElementsByTagName('head')[0].appendChild(style);
      }

      if (resource.type == 'js') {

        if (resource.state == states.ERROR) {
          runCbResource(resource.gid, resource.name, false);
        }

        executeNext(group.id);
      }
    };

  }

  function runCbResource(gid, name, outcome) {

    var group = groups[gid];

    if (typeof group.cbResource == "function") {
      group.cbResource.call(null, outcome, name);
    }

    runCbGroup(gid);
  }

  function runCbGroup(gid) {

    var group = groups[gid], n;

    for (var i=0, l = group.resources.length; i < l; i++) {
      if (group.resources[i].state != states.ERROR && 
          group.resources[i].state != states.EXECUTED) {
        // Found a resource which is not in error and not executed: the group is not "finished"
        return;
      }
    }

    group.cbGroup.call();
  }

  function execute(resource) {

    resource.state = states.EXECUTING;
    var el = document.createElement('script');
    el.appendChild(document.createTextNode(resource.content));
    el.appendChild(document.createTextNode("\n;jStream.executed(\"" + resource.name + "\", " + resource.gid + ");"));
    document.body.appendChild(el);
  }

  function dequeue() {
    queue.forEach(function(group) {
      require(group);
    });
  }

  function require(group) {
    group.resources.forEach(function(resource) {
      sock.send(JSON.stringify(resource));
    });
  }

  function executeNext(gid) {

    var group = groups[gid],
        resources = group.resources,
        resource = null;

    for (var i=0, l = resources.length; i < l; i++) {

      // If there is a running script in the group, exit
      if (resources[i].state == states.EXECUTING) {
        return;
      }

      // If we found a loading script before the first loaded one, exit (preserve order)
      if (!resource && resources[i].state == states.LOADING) {
        return;
      }

      // Try selecting the first ready resource
      if (!resource && resources[i].state == states.LOADED) {
        resource = resources[i];
      }
    }

    if (resource) {
      // We found a resource which is ready and in the right order
      execute(resource);
    }
  }

  var obj = {
    
    setup: function(options) {
      setup = options;
      sock = new SockJS('http://' + setup.host + '/jstream');
      addListeners();
    },

    executed: function(name, gid) {

      var group = groups[gid];

      group.resources.forEach(function(resource) {
        if (resource.name == name) {
          resource.state = states.EXECUTED;
        }
      });

      runCbResource(gid, name, true);

      console.log(name + " executed");

      executeNext(gid);
    },

    require: function(names, cbGroup, cbResource) {

      var gid = groups.length;

      groups.push({
        id: gid,
        resources: [],
        cbGroup: cbGroup,
        cbResource: cbResource
      });

      names.forEach(function(name) {

        var parts = name.split('.');

        groups[gid].resources.push({
          gid: gid,
          type: parts[parts.length - 1],
          name: name,
          state: states.LOADING,
          content: null,
        });
      });

      if (!sock.readyState) {
        queue.push(groups[gid]);
      } else {
        require(groups[gid]);
      }
    }
  }

  return obj;

})(this);
