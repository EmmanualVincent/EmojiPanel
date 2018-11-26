(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 */

var fbemitter = {
  EventEmitter: require('./lib/BaseEventEmitter'),
  EmitterSubscription : require('./lib/EmitterSubscription')
};

module.exports = fbemitter;

},{"./lib/BaseEventEmitter":2,"./lib/EmitterSubscription":3}],2:[function(require,module,exports){
(function (process){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule BaseEventEmitter
 * @typechecks
 */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var EmitterSubscription = require('./EmitterSubscription');
var EventSubscriptionVendor = require('./EventSubscriptionVendor');

var emptyFunction = require('fbjs/lib/emptyFunction');
var invariant = require('fbjs/lib/invariant');

/**
 * @class BaseEventEmitter
 * @description
 * An EventEmitter is responsible for managing a set of listeners and publishing
 * events to them when it is told that such events happened. In addition to the
 * data for the given event it also sends a event control object which allows
 * the listeners/handlers to prevent the default behavior of the given event.
 *
 * The emitter is designed to be generic enough to support all the different
 * contexts in which one might want to emit events. It is a simple multicast
 * mechanism on top of which extra functionality can be composed. For example, a
 * more advanced emitter may use an EventHolder and EventFactory.
 */

var BaseEventEmitter = (function () {
  /**
   * @constructor
   */

  function BaseEventEmitter() {
    _classCallCheck(this, BaseEventEmitter);

    this._subscriber = new EventSubscriptionVendor();
    this._currentSubscription = null;
  }

  /**
   * Adds a listener to be invoked when events of the specified type are
   * emitted. An optional calling context may be provided. The data arguments
   * emitted will be passed to the listener function.
   *
   * TODO: Annotate the listener arg's type. This is tricky because listeners
   *       can be invoked with varargs.
   *
   * @param {string} eventType - Name of the event to listen to
   * @param {function} listener - Function to invoke when the specified event is
   *   emitted
   * @param {*} context - Optional context object to use when invoking the
   *   listener
   */

  BaseEventEmitter.prototype.addListener = function addListener(eventType, listener, context) {
    return this._subscriber.addSubscription(eventType, new EmitterSubscription(this._subscriber, listener, context));
  };

  /**
   * Similar to addListener, except that the listener is removed after it is
   * invoked once.
   *
   * @param {string} eventType - Name of the event to listen to
   * @param {function} listener - Function to invoke only once when the
   *   specified event is emitted
   * @param {*} context - Optional context object to use when invoking the
   *   listener
   */

  BaseEventEmitter.prototype.once = function once(eventType, listener, context) {
    var emitter = this;
    return this.addListener(eventType, function () {
      emitter.removeCurrentListener();
      listener.apply(context, arguments);
    });
  };

  /**
   * Removes all of the registered listeners, including those registered as
   * listener maps.
   *
   * @param {?string} eventType - Optional name of the event whose registered
   *   listeners to remove
   */

  BaseEventEmitter.prototype.removeAllListeners = function removeAllListeners(eventType) {
    this._subscriber.removeAllSubscriptions(eventType);
  };

  /**
   * Provides an API that can be called during an eventing cycle to remove the
   * last listener that was invoked. This allows a developer to provide an event
   * object that can remove the listener (or listener map) during the
   * invocation.
   *
   * If it is called when not inside of an emitting cycle it will throw.
   *
   * @throws {Error} When called not during an eventing cycle
   *
   * @example
   *   var subscription = emitter.addListenerMap({
   *     someEvent: function(data, event) {
   *       console.log(data);
   *       emitter.removeCurrentListener();
   *     }
   *   });
   *
   *   emitter.emit('someEvent', 'abc'); // logs 'abc'
   *   emitter.emit('someEvent', 'def'); // does not log anything
   */

  BaseEventEmitter.prototype.removeCurrentListener = function removeCurrentListener() {
    !!!this._currentSubscription ? process.env.NODE_ENV !== 'production' ? invariant(false, 'Not in an emitting cycle; there is no current subscription') : invariant(false) : undefined;
    this._subscriber.removeSubscription(this._currentSubscription);
  };

  /**
   * Returns an array of listeners that are currently registered for the given
   * event.
   *
   * @param {string} eventType - Name of the event to query
   * @return {array}
   */

  BaseEventEmitter.prototype.listeners = function listeners(eventType) /* TODO: Array<EventSubscription> */{
    var subscriptions = this._subscriber.getSubscriptionsForType(eventType);
    return subscriptions ? subscriptions.filter(emptyFunction.thatReturnsTrue).map(function (subscription) {
      return subscription.listener;
    }) : [];
  };

  /**
   * Emits an event of the given type with the given data. All handlers of that
   * particular type will be notified.
   *
   * @param {string} eventType - Name of the event to emit
   * @param {*} Arbitrary arguments to be passed to each registered listener
   *
   * @example
   *   emitter.addListener('someEvent', function(message) {
   *     console.log(message);
   *   });
   *
   *   emitter.emit('someEvent', 'abc'); // logs 'abc'
   */

  BaseEventEmitter.prototype.emit = function emit(eventType) {
    var subscriptions = this._subscriber.getSubscriptionsForType(eventType);
    if (subscriptions) {
      var keys = Object.keys(subscriptions);
      for (var ii = 0; ii < keys.length; ii++) {
        var key = keys[ii];
        var subscription = subscriptions[key];
        // The subscription may have been removed during this event loop.
        if (subscription) {
          this._currentSubscription = subscription;
          this.__emitToSubscription.apply(this, [subscription].concat(Array.prototype.slice.call(arguments)));
        }
      }
      this._currentSubscription = null;
    }
  };

  /**
   * Provides a hook to override how the emitter emits an event to a specific
   * subscription. This allows you to set up logging and error boundaries
   * specific to your environment.
   *
   * @param {EmitterSubscription} subscription
   * @param {string} eventType
   * @param {*} Arbitrary arguments to be passed to each registered listener
   */

  BaseEventEmitter.prototype.__emitToSubscription = function __emitToSubscription(subscription, eventType) {
    var args = Array.prototype.slice.call(arguments, 2);
    subscription.listener.apply(subscription.context, args);
  };

  return BaseEventEmitter;
})();

module.exports = BaseEventEmitter;
}).call(this,require('_process'))

},{"./EmitterSubscription":3,"./EventSubscriptionVendor":5,"_process":8,"fbjs/lib/emptyFunction":6,"fbjs/lib/invariant":7}],3:[function(require,module,exports){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 * 
 * @providesModule EmitterSubscription
 * @typechecks
 */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventSubscription = require('./EventSubscription');

/**
 * EmitterSubscription represents a subscription with listener and context data.
 */

var EmitterSubscription = (function (_EventSubscription) {
  _inherits(EmitterSubscription, _EventSubscription);

  /**
   * @param {EventSubscriptionVendor} subscriber - The subscriber that controls
   *   this subscription
   * @param {function} listener - Function to invoke when the specified event is
   *   emitted
   * @param {*} context - Optional context object to use when invoking the
   *   listener
   */

  function EmitterSubscription(subscriber, listener, context) {
    _classCallCheck(this, EmitterSubscription);

    _EventSubscription.call(this, subscriber);
    this.listener = listener;
    this.context = context;
  }

  return EmitterSubscription;
})(EventSubscription);

module.exports = EmitterSubscription;
},{"./EventSubscription":4}],4:[function(require,module,exports){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule EventSubscription
 * @typechecks
 */

'use strict';

/**
 * EventSubscription represents a subscription to a particular event. It can
 * remove its own subscription.
 */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var EventSubscription = (function () {

  /**
   * @param {EventSubscriptionVendor} subscriber the subscriber that controls
   *   this subscription.
   */

  function EventSubscription(subscriber) {
    _classCallCheck(this, EventSubscription);

    this.subscriber = subscriber;
  }

  /**
   * Removes this subscription from the subscriber that controls it.
   */

  EventSubscription.prototype.remove = function remove() {
    if (this.subscriber) {
      this.subscriber.removeSubscription(this);
      this.subscriber = null;
    }
  };

  return EventSubscription;
})();

module.exports = EventSubscription;
},{}],5:[function(require,module,exports){
(function (process){
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 * 
 * @providesModule EventSubscriptionVendor
 * @typechecks
 */

'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var invariant = require('fbjs/lib/invariant');

/**
 * EventSubscriptionVendor stores a set of EventSubscriptions that are
 * subscribed to a particular event type.
 */

var EventSubscriptionVendor = (function () {
  function EventSubscriptionVendor() {
    _classCallCheck(this, EventSubscriptionVendor);

    this._subscriptionsForType = {};
    this._currentSubscription = null;
  }

  /**
   * Adds a subscription keyed by an event type.
   *
   * @param {string} eventType
   * @param {EventSubscription} subscription
   */

  EventSubscriptionVendor.prototype.addSubscription = function addSubscription(eventType, subscription) {
    !(subscription.subscriber === this) ? process.env.NODE_ENV !== 'production' ? invariant(false, 'The subscriber of the subscription is incorrectly set.') : invariant(false) : undefined;
    if (!this._subscriptionsForType[eventType]) {
      this._subscriptionsForType[eventType] = [];
    }
    var key = this._subscriptionsForType[eventType].length;
    this._subscriptionsForType[eventType].push(subscription);
    subscription.eventType = eventType;
    subscription.key = key;
    return subscription;
  };

  /**
   * Removes a bulk set of the subscriptions.
   *
   * @param {?string} eventType - Optional name of the event type whose
   *   registered supscriptions to remove, if null remove all subscriptions.
   */

  EventSubscriptionVendor.prototype.removeAllSubscriptions = function removeAllSubscriptions(eventType) {
    if (eventType === undefined) {
      this._subscriptionsForType = {};
    } else {
      delete this._subscriptionsForType[eventType];
    }
  };

  /**
   * Removes a specific subscription. Instead of calling this function, call
   * `subscription.remove()` directly.
   *
   * @param {object} subscription
   */

  EventSubscriptionVendor.prototype.removeSubscription = function removeSubscription(subscription) {
    var eventType = subscription.eventType;
    var key = subscription.key;

    var subscriptionsForType = this._subscriptionsForType[eventType];
    if (subscriptionsForType) {
      delete subscriptionsForType[key];
    }
  };

  /**
   * Returns the array of subscriptions that are currently registered for the
   * given event type.
   *
   * Note: This array can be potentially sparse as subscriptions are deleted
   * from it when they are removed.
   *
   * TODO: This returns a nullable array. wat?
   *
   * @param {string} eventType
   * @return {?array}
   */

  EventSubscriptionVendor.prototype.getSubscriptionsForType = function getSubscriptionsForType(eventType) {
    return this._subscriptionsForType[eventType];
  };

  return EventSubscriptionVendor;
})();

module.exports = EventSubscriptionVendor;
}).call(this,require('_process'))

},{"_process":8,"fbjs/lib/invariant":7}],6:[function(require,module,exports){
"use strict";

/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * 
 */

function makeEmptyFunction(arg) {
  return function () {
    return arg;
  };
}

/**
 * This function accepts and discards inputs; it has no side effects. This is
 * primarily useful idiomatically for overridable function endpoints which
 * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
 */
var emptyFunction = function emptyFunction() {};

emptyFunction.thatReturns = makeEmptyFunction;
emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
emptyFunction.thatReturnsNull = makeEmptyFunction(null);
emptyFunction.thatReturnsThis = function () {
  return this;
};
emptyFunction.thatReturnsArgument = function (arg) {
  return arg;
};

module.exports = emptyFunction;
},{}],7:[function(require,module,exports){
(function (process){
/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

'use strict';

/**
 * Use invariant() to assert state which your program assumes to be true.
 *
 * Provide sprintf-style format (only %s is supported) and arguments
 * to provide information about what broke and what you were
 * expecting.
 *
 * The invariant message will be stripped in production, but the invariant
 * will remain to ensure logic does not differ in production.
 */

var validateFormat = function validateFormat(format) {};

if (process.env.NODE_ENV !== 'production') {
  validateFormat = function validateFormat(format) {
    if (format === undefined) {
      throw new Error('invariant requires an error message argument');
    }
  };
}

function invariant(condition, format, a, b, c, d, e, f) {
  validateFormat(format);

  if (!condition) {
    var error;
    if (format === undefined) {
      error = new Error('Minified exception occurred; use the non-minified dev environment ' + 'for the full error message and additional helpful warnings.');
    } else {
      var args = [a, b, c, d, e, f];
      var argIndex = 0;
      error = new Error(format.replace(/%s/g, function () {
        return args[argIndex++];
      }));
      error.name = 'Invariant Violation';
    }

    error.framesToPop = 1; // we don't care about invariant's own frame
    throw error;
  }
}

module.exports = invariant;
}).call(this,require('_process'))

},{"_process":8}],8:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],9:[function(require,module,exports){
/*! tether 1.4.4 */

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof exports === 'object') {
    module.exports = factory();
  } else {
    root.Tether = factory();
  }
}(this, function() {

'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var TetherBase = undefined;
if (typeof TetherBase === 'undefined') {
  TetherBase = { modules: [] };
}

var zeroElement = null;

// Same as native getBoundingClientRect, except it takes into account parent <frame> offsets
// if the element lies within a nested document (<frame> or <iframe>-like).
function getActualBoundingClientRect(node) {
  var boundingRect = node.getBoundingClientRect();

  // The original object returned by getBoundingClientRect is immutable, so we clone it
  // We can't use extend because the properties are not considered part of the object by hasOwnProperty in IE9
  var rect = {};
  for (var k in boundingRect) {
    rect[k] = boundingRect[k];
  }

  if (node.ownerDocument !== document) {
    var _frameElement = node.ownerDocument.defaultView.frameElement;
    if (_frameElement) {
      var frameRect = getActualBoundingClientRect(_frameElement);
      rect.top += frameRect.top;
      rect.bottom += frameRect.top;
      rect.left += frameRect.left;
      rect.right += frameRect.left;
    }
  }

  return rect;
}

function getScrollParents(el) {
  // In firefox if the el is inside an iframe with display: none; window.getComputedStyle() will return null;
  // https://bugzilla.mozilla.org/show_bug.cgi?id=548397
  var computedStyle = getComputedStyle(el) || {};
  var position = computedStyle.position;
  var parents = [];

  if (position === 'fixed') {
    return [el];
  }

  var parent = el;
  while ((parent = parent.parentNode) && parent && parent.nodeType === 1) {
    var style = undefined;
    try {
      style = getComputedStyle(parent);
    } catch (err) {}

    if (typeof style === 'undefined' || style === null) {
      parents.push(parent);
      return parents;
    }

    var _style = style;
    var overflow = _style.overflow;
    var overflowX = _style.overflowX;
    var overflowY = _style.overflowY;

    if (/(auto|scroll|overlay)/.test(overflow + overflowY + overflowX)) {
      if (position !== 'absolute' || ['relative', 'absolute', 'fixed'].indexOf(style.position) >= 0) {
        parents.push(parent);
      }
    }
  }

  parents.push(el.ownerDocument.body);

  // If the node is within a frame, account for the parent window scroll
  if (el.ownerDocument !== document) {
    parents.push(el.ownerDocument.defaultView);
  }

  return parents;
}

var uniqueId = (function () {
  var id = 0;
  return function () {
    return ++id;
  };
})();

var zeroPosCache = {};
var getOrigin = function getOrigin() {
  // getBoundingClientRect is unfortunately too accurate.  It introduces a pixel or two of
  // jitter as the user scrolls that messes with our ability to detect if two positions
  // are equivilant or not.  We place an element at the top left of the page that will
  // get the same jitter, so we can cancel the two out.
  var node = zeroElement;
  if (!node || !document.body.contains(node)) {
    node = document.createElement('div');
    node.setAttribute('data-tether-id', uniqueId());
    extend(node.style, {
      top: 0,
      left: 0,
      position: 'absolute'
    });

    document.body.appendChild(node);

    zeroElement = node;
  }

  var id = node.getAttribute('data-tether-id');
  if (typeof zeroPosCache[id] === 'undefined') {
    zeroPosCache[id] = getActualBoundingClientRect(node);

    // Clear the cache when this position call is done
    defer(function () {
      delete zeroPosCache[id];
    });
  }

  return zeroPosCache[id];
};

function removeUtilElements() {
  if (zeroElement) {
    document.body.removeChild(zeroElement);
  }
  zeroElement = null;
};

function getBounds(el) {
  var doc = undefined;
  if (el === document) {
    doc = document;
    el = document.documentElement;
  } else {
    doc = el.ownerDocument;
  }

  var docEl = doc.documentElement;

  var box = getActualBoundingClientRect(el);

  var origin = getOrigin();

  box.top -= origin.top;
  box.left -= origin.left;

  if (typeof box.width === 'undefined') {
    box.width = document.body.scrollWidth - box.left - box.right;
  }
  if (typeof box.height === 'undefined') {
    box.height = document.body.scrollHeight - box.top - box.bottom;
  }

  box.top = box.top - docEl.clientTop;
  box.left = box.left - docEl.clientLeft;
  box.right = doc.body.clientWidth - box.width - box.left;
  box.bottom = doc.body.clientHeight - box.height - box.top;

  return box;
}

function getOffsetParent(el) {
  return el.offsetParent || document.documentElement;
}

var _scrollBarSize = null;
function getScrollBarSize() {
  if (_scrollBarSize) {
    return _scrollBarSize;
  }
  var inner = document.createElement('div');
  inner.style.width = '100%';
  inner.style.height = '200px';

  var outer = document.createElement('div');
  extend(outer.style, {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    visibility: 'hidden',
    width: '200px',
    height: '150px',
    overflow: 'hidden'
  });

  outer.appendChild(inner);

  document.body.appendChild(outer);

  var widthContained = inner.offsetWidth;
  outer.style.overflow = 'scroll';
  var widthScroll = inner.offsetWidth;

  if (widthContained === widthScroll) {
    widthScroll = outer.clientWidth;
  }

  document.body.removeChild(outer);

  var width = widthContained - widthScroll;

  _scrollBarSize = { width: width, height: width };
  return _scrollBarSize;
}

function extend() {
  var out = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  var args = [];

  Array.prototype.push.apply(args, arguments);

  args.slice(1).forEach(function (obj) {
    if (obj) {
      for (var key in obj) {
        if (({}).hasOwnProperty.call(obj, key)) {
          out[key] = obj[key];
        }
      }
    }
  });

  return out;
}

function removeClass(el, name) {
  if (typeof el.classList !== 'undefined') {
    name.split(' ').forEach(function (cls) {
      if (cls.trim()) {
        el.classList.remove(cls);
      }
    });
  } else {
    var regex = new RegExp('(^| )' + name.split(' ').join('|') + '( |$)', 'gi');
    var className = getClassName(el).replace(regex, ' ');
    setClassName(el, className);
  }
}

function addClass(el, name) {
  if (typeof el.classList !== 'undefined') {
    name.split(' ').forEach(function (cls) {
      if (cls.trim()) {
        el.classList.add(cls);
      }
    });
  } else {
    removeClass(el, name);
    var cls = getClassName(el) + (' ' + name);
    setClassName(el, cls);
  }
}

function hasClass(el, name) {
  if (typeof el.classList !== 'undefined') {
    return el.classList.contains(name);
  }
  var className = getClassName(el);
  return new RegExp('(^| )' + name + '( |$)', 'gi').test(className);
}

function getClassName(el) {
  // Can't use just SVGAnimatedString here since nodes within a Frame in IE have
  // completely separately SVGAnimatedString base classes
  if (el.className instanceof el.ownerDocument.defaultView.SVGAnimatedString) {
    return el.className.baseVal;
  }
  return el.className;
}

function setClassName(el, className) {
  el.setAttribute('class', className);
}

function updateClasses(el, add, all) {
  // Of the set of 'all' classes, we need the 'add' classes, and only the
  // 'add' classes to be set.
  all.forEach(function (cls) {
    if (add.indexOf(cls) === -1 && hasClass(el, cls)) {
      removeClass(el, cls);
    }
  });

  add.forEach(function (cls) {
    if (!hasClass(el, cls)) {
      addClass(el, cls);
    }
  });
}

var deferred = [];

var defer = function defer(fn) {
  deferred.push(fn);
};

var flush = function flush() {
  var fn = undefined;
  while (fn = deferred.pop()) {
    fn();
  }
};

var Evented = (function () {
  function Evented() {
    _classCallCheck(this, Evented);
  }

  _createClass(Evented, [{
    key: 'on',
    value: function on(event, handler, ctx) {
      var once = arguments.length <= 3 || arguments[3] === undefined ? false : arguments[3];

      if (typeof this.bindings === 'undefined') {
        this.bindings = {};
      }
      if (typeof this.bindings[event] === 'undefined') {
        this.bindings[event] = [];
      }
      this.bindings[event].push({ handler: handler, ctx: ctx, once: once });
    }
  }, {
    key: 'once',
    value: function once(event, handler, ctx) {
      this.on(event, handler, ctx, true);
    }
  }, {
    key: 'off',
    value: function off(event, handler) {
      if (typeof this.bindings === 'undefined' || typeof this.bindings[event] === 'undefined') {
        return;
      }

      if (typeof handler === 'undefined') {
        delete this.bindings[event];
      } else {
        var i = 0;
        while (i < this.bindings[event].length) {
          if (this.bindings[event][i].handler === handler) {
            this.bindings[event].splice(i, 1);
          } else {
            ++i;
          }
        }
      }
    }
  }, {
    key: 'trigger',
    value: function trigger(event) {
      if (typeof this.bindings !== 'undefined' && this.bindings[event]) {
        var i = 0;

        for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        while (i < this.bindings[event].length) {
          var _bindings$event$i = this.bindings[event][i];
          var handler = _bindings$event$i.handler;
          var ctx = _bindings$event$i.ctx;
          var once = _bindings$event$i.once;

          var context = ctx;
          if (typeof context === 'undefined') {
            context = this;
          }

          handler.apply(context, args);

          if (once) {
            this.bindings[event].splice(i, 1);
          } else {
            ++i;
          }
        }
      }
    }
  }]);

  return Evented;
})();

TetherBase.Utils = {
  getActualBoundingClientRect: getActualBoundingClientRect,
  getScrollParents: getScrollParents,
  getBounds: getBounds,
  getOffsetParent: getOffsetParent,
  extend: extend,
  addClass: addClass,
  removeClass: removeClass,
  hasClass: hasClass,
  updateClasses: updateClasses,
  defer: defer,
  flush: flush,
  uniqueId: uniqueId,
  Evented: Evented,
  getScrollBarSize: getScrollBarSize,
  removeUtilElements: removeUtilElements
};
/* globals TetherBase, performance */

'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x6, _x7, _x8) { var _again = true; _function: while (_again) { var object = _x6, property = _x7, receiver = _x8; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x6 = parent; _x7 = property; _x8 = receiver; _again = true; desc = parent = undefined; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

if (typeof TetherBase === 'undefined') {
  throw new Error('You must include the utils.js file before tether.js');
}

var _TetherBase$Utils = TetherBase.Utils;
var getScrollParents = _TetherBase$Utils.getScrollParents;
var getBounds = _TetherBase$Utils.getBounds;
var getOffsetParent = _TetherBase$Utils.getOffsetParent;
var extend = _TetherBase$Utils.extend;
var addClass = _TetherBase$Utils.addClass;
var removeClass = _TetherBase$Utils.removeClass;
var updateClasses = _TetherBase$Utils.updateClasses;
var defer = _TetherBase$Utils.defer;
var flush = _TetherBase$Utils.flush;
var getScrollBarSize = _TetherBase$Utils.getScrollBarSize;
var removeUtilElements = _TetherBase$Utils.removeUtilElements;

function within(a, b) {
  var diff = arguments.length <= 2 || arguments[2] === undefined ? 1 : arguments[2];

  return a + diff >= b && b >= a - diff;
}

var transformKey = (function () {
  if (typeof document === 'undefined') {
    return '';
  }
  var el = document.createElement('div');

  var transforms = ['transform', 'WebkitTransform', 'OTransform', 'MozTransform', 'msTransform'];
  for (var i = 0; i < transforms.length; ++i) {
    var key = transforms[i];
    if (el.style[key] !== undefined) {
      return key;
    }
  }
})();

var tethers = [];

var position = function position() {
  tethers.forEach(function (tether) {
    tether.position(false);
  });
  flush();
};

function now() {
  if (typeof performance === 'object' && typeof performance.now === 'function') {
    return performance.now();
  }
  return +new Date();
}

(function () {
  var lastCall = null;
  var lastDuration = null;
  var pendingTimeout = null;

  var tick = function tick() {
    if (typeof lastDuration !== 'undefined' && lastDuration > 16) {
      // We voluntarily throttle ourselves if we can't manage 60fps
      lastDuration = Math.min(lastDuration - 16, 250);

      // Just in case this is the last event, remember to position just once more
      pendingTimeout = setTimeout(tick, 250);
      return;
    }

    if (typeof lastCall !== 'undefined' && now() - lastCall < 10) {
      // Some browsers call events a little too frequently, refuse to run more than is reasonable
      return;
    }

    if (pendingTimeout != null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }

    lastCall = now();
    position();
    lastDuration = now() - lastCall;
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener !== 'undefined') {
    ['resize', 'scroll', 'touchmove'].forEach(function (event) {
      window.addEventListener(event, tick);
    });
  }
})();

var MIRROR_LR = {
  center: 'center',
  left: 'right',
  right: 'left'
};

var MIRROR_TB = {
  middle: 'middle',
  top: 'bottom',
  bottom: 'top'
};

var OFFSET_MAP = {
  top: 0,
  left: 0,
  middle: '50%',
  center: '50%',
  bottom: '100%',
  right: '100%'
};

var autoToFixedAttachment = function autoToFixedAttachment(attachment, relativeToAttachment) {
  var left = attachment.left;
  var top = attachment.top;

  if (left === 'auto') {
    left = MIRROR_LR[relativeToAttachment.left];
  }

  if (top === 'auto') {
    top = MIRROR_TB[relativeToAttachment.top];
  }

  return { left: left, top: top };
};

var attachmentToOffset = function attachmentToOffset(attachment) {
  var left = attachment.left;
  var top = attachment.top;

  if (typeof OFFSET_MAP[attachment.left] !== 'undefined') {
    left = OFFSET_MAP[attachment.left];
  }

  if (typeof OFFSET_MAP[attachment.top] !== 'undefined') {
    top = OFFSET_MAP[attachment.top];
  }

  return { left: left, top: top };
};

function addOffset() {
  var out = { top: 0, left: 0 };

  for (var _len = arguments.length, offsets = Array(_len), _key = 0; _key < _len; _key++) {
    offsets[_key] = arguments[_key];
  }

  offsets.forEach(function (_ref) {
    var top = _ref.top;
    var left = _ref.left;

    if (typeof top === 'string') {
      top = parseFloat(top, 10);
    }
    if (typeof left === 'string') {
      left = parseFloat(left, 10);
    }

    out.top += top;
    out.left += left;
  });

  return out;
}

function offsetToPx(offset, size) {
  if (typeof offset.left === 'string' && offset.left.indexOf('%') !== -1) {
    offset.left = parseFloat(offset.left, 10) / 100 * size.width;
  }
  if (typeof offset.top === 'string' && offset.top.indexOf('%') !== -1) {
    offset.top = parseFloat(offset.top, 10) / 100 * size.height;
  }

  return offset;
}

var parseOffset = function parseOffset(value) {
  var _value$split = value.split(' ');

  var _value$split2 = _slicedToArray(_value$split, 2);

  var top = _value$split2[0];
  var left = _value$split2[1];

  return { top: top, left: left };
};
var parseAttachment = parseOffset;

var TetherClass = (function (_Evented) {
  _inherits(TetherClass, _Evented);

  function TetherClass(options) {
    var _this = this;

    _classCallCheck(this, TetherClass);

    _get(Object.getPrototypeOf(TetherClass.prototype), 'constructor', this).call(this);
    this.position = this.position.bind(this);

    tethers.push(this);

    this.history = [];

    this.setOptions(options, false);

    TetherBase.modules.forEach(function (module) {
      if (typeof module.initialize !== 'undefined') {
        module.initialize.call(_this);
      }
    });

    this.position();
  }

  _createClass(TetherClass, [{
    key: 'getClass',
    value: function getClass() {
      var key = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
      var classes = this.options.classes;

      if (typeof classes !== 'undefined' && classes[key]) {
        return this.options.classes[key];
      } else if (this.options.classPrefix) {
        return this.options.classPrefix + '-' + key;
      } else {
        return key;
      }
    }
  }, {
    key: 'setOptions',
    value: function setOptions(options) {
      var _this2 = this;

      var pos = arguments.length <= 1 || arguments[1] === undefined ? true : arguments[1];

      var defaults = {
        offset: '0 0',
        targetOffset: '0 0',
        targetAttachment: 'auto auto',
        classPrefix: 'tether'
      };

      this.options = extend(defaults, options);

      var _options = this.options;
      var element = _options.element;
      var target = _options.target;
      var targetModifier = _options.targetModifier;

      this.element = element;
      this.target = target;
      this.targetModifier = targetModifier;

      if (this.target === 'viewport') {
        this.target = document.body;
        this.targetModifier = 'visible';
      } else if (this.target === 'scroll-handle') {
        this.target = document.body;
        this.targetModifier = 'scroll-handle';
      }

      ['element', 'target'].forEach(function (key) {
        if (typeof _this2[key] === 'undefined') {
          throw new Error('Tether Error: Both element and target must be defined');
        }

        if (typeof _this2[key].jquery !== 'undefined') {
          _this2[key] = _this2[key][0];
        } else if (typeof _this2[key] === 'string') {
          _this2[key] = document.querySelector(_this2[key]);
        }
      });

      addClass(this.element, this.getClass('element'));
      if (!(this.options.addTargetClasses === false)) {
        addClass(this.target, this.getClass('target'));
      }

      if (!this.options.attachment) {
        throw new Error('Tether Error: You must provide an attachment');
      }

      this.targetAttachment = parseAttachment(this.options.targetAttachment);
      this.attachment = parseAttachment(this.options.attachment);
      this.offset = parseOffset(this.options.offset);
      this.targetOffset = parseOffset(this.options.targetOffset);

      if (typeof this.scrollParents !== 'undefined') {
        this.disable();
      }

      if (this.targetModifier === 'scroll-handle') {
        this.scrollParents = [this.target];
      } else {
        this.scrollParents = getScrollParents(this.target);
      }

      if (!(this.options.enabled === false)) {
        this.enable(pos);
      }
    }
  }, {
    key: 'getTargetBounds',
    value: function getTargetBounds() {
      if (typeof this.targetModifier !== 'undefined') {
        if (this.targetModifier === 'visible') {
          if (this.target === document.body) {
            return { top: pageYOffset, left: pageXOffset, height: innerHeight, width: innerWidth };
          } else {
            var bounds = getBounds(this.target);

            var out = {
              height: bounds.height,
              width: bounds.width,
              top: bounds.top,
              left: bounds.left
            };

            out.height = Math.min(out.height, bounds.height - (pageYOffset - bounds.top));
            out.height = Math.min(out.height, bounds.height - (bounds.top + bounds.height - (pageYOffset + innerHeight)));
            out.height = Math.min(innerHeight, out.height);
            out.height -= 2;

            out.width = Math.min(out.width, bounds.width - (pageXOffset - bounds.left));
            out.width = Math.min(out.width, bounds.width - (bounds.left + bounds.width - (pageXOffset + innerWidth)));
            out.width = Math.min(innerWidth, out.width);
            out.width -= 2;

            if (out.top < pageYOffset) {
              out.top = pageYOffset;
            }
            if (out.left < pageXOffset) {
              out.left = pageXOffset;
            }

            return out;
          }
        } else if (this.targetModifier === 'scroll-handle') {
          var bounds = undefined;
          var target = this.target;
          if (target === document.body) {
            target = document.documentElement;

            bounds = {
              left: pageXOffset,
              top: pageYOffset,
              height: innerHeight,
              width: innerWidth
            };
          } else {
            bounds = getBounds(target);
          }

          var style = getComputedStyle(target);

          var hasBottomScroll = target.scrollWidth > target.clientWidth || [style.overflow, style.overflowX].indexOf('scroll') >= 0 || this.target !== document.body;

          var scrollBottom = 0;
          if (hasBottomScroll) {
            scrollBottom = 15;
          }

          var height = bounds.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth) - scrollBottom;

          var out = {
            width: 15,
            height: height * 0.975 * (height / target.scrollHeight),
            left: bounds.left + bounds.width - parseFloat(style.borderLeftWidth) - 15
          };

          var fitAdj = 0;
          if (height < 408 && this.target === document.body) {
            fitAdj = -0.00011 * Math.pow(height, 2) - 0.00727 * height + 22.58;
          }

          if (this.target !== document.body) {
            out.height = Math.max(out.height, 24);
          }

          var scrollPercentage = this.target.scrollTop / (target.scrollHeight - height);
          out.top = scrollPercentage * (height - out.height - fitAdj) + bounds.top + parseFloat(style.borderTopWidth);

          if (this.target === document.body) {
            out.height = Math.max(out.height, 24);
          }

          return out;
        }
      } else {
        return getBounds(this.target);
      }
    }
  }, {
    key: 'clearCache',
    value: function clearCache() {
      this._cache = {};
    }
  }, {
    key: 'cache',
    value: function cache(k, getter) {
      // More than one module will often need the same DOM info, so
      // we keep a cache which is cleared on each position call
      if (typeof this._cache === 'undefined') {
        this._cache = {};
      }

      if (typeof this._cache[k] === 'undefined') {
        this._cache[k] = getter.call(this);
      }

      return this._cache[k];
    }
  }, {
    key: 'enable',
    value: function enable() {
      var _this3 = this;

      var pos = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

      if (!(this.options.addTargetClasses === false)) {
        addClass(this.target, this.getClass('enabled'));
      }
      addClass(this.element, this.getClass('enabled'));
      this.enabled = true;

      this.scrollParents.forEach(function (parent) {
        if (parent !== _this3.target.ownerDocument) {
          parent.addEventListener('scroll', _this3.position);
        }
      });

      if (pos) {
        this.position();
      }
    }
  }, {
    key: 'disable',
    value: function disable() {
      var _this4 = this;

      removeClass(this.target, this.getClass('enabled'));
      removeClass(this.element, this.getClass('enabled'));
      this.enabled = false;

      if (typeof this.scrollParents !== 'undefined') {
        this.scrollParents.forEach(function (parent) {
          parent.removeEventListener('scroll', _this4.position);
        });
      }
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      var _this5 = this;

      this.disable();

      tethers.forEach(function (tether, i) {
        if (tether === _this5) {
          tethers.splice(i, 1);
        }
      });

      // Remove any elements we were using for convenience from the DOM
      if (tethers.length === 0) {
        removeUtilElements();
      }
    }
  }, {
    key: 'updateAttachClasses',
    value: function updateAttachClasses(elementAttach, targetAttach) {
      var _this6 = this;

      elementAttach = elementAttach || this.attachment;
      targetAttach = targetAttach || this.targetAttachment;
      var sides = ['left', 'top', 'bottom', 'right', 'middle', 'center'];

      if (typeof this._addAttachClasses !== 'undefined' && this._addAttachClasses.length) {
        // updateAttachClasses can be called more than once in a position call, so
        // we need to clean up after ourselves such that when the last defer gets
        // ran it doesn't add any extra classes from previous calls.
        this._addAttachClasses.splice(0, this._addAttachClasses.length);
      }

      if (typeof this._addAttachClasses === 'undefined') {
        this._addAttachClasses = [];
      }
      var add = this._addAttachClasses;

      if (elementAttach.top) {
        add.push(this.getClass('element-attached') + '-' + elementAttach.top);
      }
      if (elementAttach.left) {
        add.push(this.getClass('element-attached') + '-' + elementAttach.left);
      }
      if (targetAttach.top) {
        add.push(this.getClass('target-attached') + '-' + targetAttach.top);
      }
      if (targetAttach.left) {
        add.push(this.getClass('target-attached') + '-' + targetAttach.left);
      }

      var all = [];
      sides.forEach(function (side) {
        all.push(_this6.getClass('element-attached') + '-' + side);
        all.push(_this6.getClass('target-attached') + '-' + side);
      });

      defer(function () {
        if (!(typeof _this6._addAttachClasses !== 'undefined')) {
          return;
        }

        updateClasses(_this6.element, _this6._addAttachClasses, all);
        if (!(_this6.options.addTargetClasses === false)) {
          updateClasses(_this6.target, _this6._addAttachClasses, all);
        }

        delete _this6._addAttachClasses;
      });
    }
  }, {
    key: 'position',
    value: function position() {
      var _this7 = this;

      var flushChanges = arguments.length <= 0 || arguments[0] === undefined ? true : arguments[0];

      // flushChanges commits the changes immediately, leave true unless you are positioning multiple
      // tethers (in which case call Tether.Utils.flush yourself when you're done)

      if (!this.enabled) {
        return;
      }

      this.clearCache();

      // Turn 'auto' attachments into the appropriate corner or edge
      var targetAttachment = autoToFixedAttachment(this.targetAttachment, this.attachment);

      this.updateAttachClasses(this.attachment, targetAttachment);

      var elementPos = this.cache('element-bounds', function () {
        return getBounds(_this7.element);
      });

      var width = elementPos.width;
      var height = elementPos.height;

      if (width === 0 && height === 0 && typeof this.lastSize !== 'undefined') {
        var _lastSize = this.lastSize;

        // We cache the height and width to make it possible to position elements that are
        // getting hidden.
        width = _lastSize.width;
        height = _lastSize.height;
      } else {
        this.lastSize = { width: width, height: height };
      }

      var targetPos = this.cache('target-bounds', function () {
        return _this7.getTargetBounds();
      });
      var targetSize = targetPos;

      // Get an actual px offset from the attachment
      var offset = offsetToPx(attachmentToOffset(this.attachment), { width: width, height: height });
      var targetOffset = offsetToPx(attachmentToOffset(targetAttachment), targetSize);

      var manualOffset = offsetToPx(this.offset, { width: width, height: height });
      var manualTargetOffset = offsetToPx(this.targetOffset, targetSize);

      // Add the manually provided offset
      offset = addOffset(offset, manualOffset);
      targetOffset = addOffset(targetOffset, manualTargetOffset);

      // It's now our goal to make (element position + offset) == (target position + target offset)
      var left = targetPos.left + targetOffset.left - offset.left;
      var top = targetPos.top + targetOffset.top - offset.top;

      for (var i = 0; i < TetherBase.modules.length; ++i) {
        var _module2 = TetherBase.modules[i];
        var ret = _module2.position.call(this, {
          left: left,
          top: top,
          targetAttachment: targetAttachment,
          targetPos: targetPos,
          elementPos: elementPos,
          offset: offset,
          targetOffset: targetOffset,
          manualOffset: manualOffset,
          manualTargetOffset: manualTargetOffset,
          scrollbarSize: scrollbarSize,
          attachment: this.attachment
        });

        if (ret === false) {
          return false;
        } else if (typeof ret === 'undefined' || typeof ret !== 'object') {
          continue;
        } else {
          top = ret.top;
          left = ret.left;
        }
      }

      // We describe the position three different ways to give the optimizer
      // a chance to decide the best possible way to position the element
      // with the fewest repaints.
      var next = {
        // It's position relative to the page (absolute positioning when
        // the element is a child of the body)
        page: {
          top: top,
          left: left
        },

        // It's position relative to the viewport (fixed positioning)
        viewport: {
          top: top - pageYOffset,
          bottom: pageYOffset - top - height + innerHeight,
          left: left - pageXOffset,
          right: pageXOffset - left - width + innerWidth
        }
      };

      var doc = this.target.ownerDocument;
      var win = doc.defaultView;

      var scrollbarSize = undefined;
      if (win.innerHeight > doc.documentElement.clientHeight) {
        scrollbarSize = this.cache('scrollbar-size', getScrollBarSize);
        next.viewport.bottom -= scrollbarSize.height;
      }

      if (win.innerWidth > doc.documentElement.clientWidth) {
        scrollbarSize = this.cache('scrollbar-size', getScrollBarSize);
        next.viewport.right -= scrollbarSize.width;
      }

      if (['', 'static'].indexOf(doc.body.style.position) === -1 || ['', 'static'].indexOf(doc.body.parentElement.style.position) === -1) {
        // Absolute positioning in the body will be relative to the page, not the 'initial containing block'
        next.page.bottom = doc.body.scrollHeight - top - height;
        next.page.right = doc.body.scrollWidth - left - width;
      }

      if (typeof this.options.optimizations !== 'undefined' && this.options.optimizations.moveElement !== false && !(typeof this.targetModifier !== 'undefined')) {
        (function () {
          var offsetParent = _this7.cache('target-offsetparent', function () {
            return getOffsetParent(_this7.target);
          });
          var offsetPosition = _this7.cache('target-offsetparent-bounds', function () {
            return getBounds(offsetParent);
          });
          var offsetParentStyle = getComputedStyle(offsetParent);
          var offsetParentSize = offsetPosition;

          var offsetBorder = {};
          ['Top', 'Left', 'Bottom', 'Right'].forEach(function (side) {
            offsetBorder[side.toLowerCase()] = parseFloat(offsetParentStyle['border' + side + 'Width']);
          });

          offsetPosition.right = doc.body.scrollWidth - offsetPosition.left - offsetParentSize.width + offsetBorder.right;
          offsetPosition.bottom = doc.body.scrollHeight - offsetPosition.top - offsetParentSize.height + offsetBorder.bottom;

          if (next.page.top >= offsetPosition.top + offsetBorder.top && next.page.bottom >= offsetPosition.bottom) {
            if (next.page.left >= offsetPosition.left + offsetBorder.left && next.page.right >= offsetPosition.right) {
              // We're within the visible part of the target's scroll parent
              var scrollTop = offsetParent.scrollTop;
              var scrollLeft = offsetParent.scrollLeft;

              // It's position relative to the target's offset parent (absolute positioning when
              // the element is moved to be a child of the target's offset parent).
              next.offset = {
                top: next.page.top - offsetPosition.top + scrollTop - offsetBorder.top,
                left: next.page.left - offsetPosition.left + scrollLeft - offsetBorder.left
              };
            }
          }
        })();
      }

      // We could also travel up the DOM and try each containing context, rather than only
      // looking at the body, but we're gonna get diminishing returns.

      this.move(next);

      this.history.unshift(next);

      if (this.history.length > 3) {
        this.history.pop();
      }

      if (flushChanges) {
        flush();
      }

      return true;
    }

    // THE ISSUE
  }, {
    key: 'move',
    value: function move(pos) {
      var _this8 = this;

      if (!(typeof this.element.parentNode !== 'undefined')) {
        return;
      }

      var same = {};

      for (var type in pos) {
        same[type] = {};

        for (var key in pos[type]) {
          var found = false;

          for (var i = 0; i < this.history.length; ++i) {
            var point = this.history[i];
            if (typeof point[type] !== 'undefined' && !within(point[type][key], pos[type][key])) {
              found = true;
              break;
            }
          }

          if (!found) {
            same[type][key] = true;
          }
        }
      }

      var css = { top: '', left: '', right: '', bottom: '' };

      var transcribe = function transcribe(_same, _pos) {
        var hasOptimizations = typeof _this8.options.optimizations !== 'undefined';
        var gpu = hasOptimizations ? _this8.options.optimizations.gpu : null;
        if (gpu !== false) {
          var yPos = undefined,
              xPos = undefined;
          if (_same.top) {
            css.top = 0;
            yPos = _pos.top;
          } else {
            css.bottom = 0;
            yPos = -_pos.bottom;
          }

          if (_same.left) {
            css.left = 0;
            xPos = _pos.left;
          } else {
            css.right = 0;
            xPos = -_pos.right;
          }

          if (window.matchMedia) {
            // HubSpot/tether#207
            var retina = window.matchMedia('only screen and (min-resolution: 1.3dppx)').matches || window.matchMedia('only screen and (-webkit-min-device-pixel-ratio: 1.3)').matches;
            if (!retina) {
              xPos = Math.round(xPos);
              yPos = Math.round(yPos);
            }
          }

          css[transformKey] = 'translateX(' + xPos + 'px) translateY(' + yPos + 'px)';

          if (transformKey !== 'msTransform') {
            // The Z transform will keep this in the GPU (faster, and prevents artifacts),
            // but IE9 doesn't support 3d transforms and will choke.
            css[transformKey] += " translateZ(0)";
          }
        } else {
          if (_same.top) {
            css.top = _pos.top + 'px';
          } else {
            css.bottom = _pos.bottom + 'px';
          }

          if (_same.left) {
            css.left = _pos.left + 'px';
          } else {
            css.right = _pos.right + 'px';
          }
        }
      };

      var moved = false;
      if ((same.page.top || same.page.bottom) && (same.page.left || same.page.right)) {
        css.position = 'absolute';
        transcribe(same.page, pos.page);
      } else if ((same.viewport.top || same.viewport.bottom) && (same.viewport.left || same.viewport.right)) {
        css.position = 'fixed';
        transcribe(same.viewport, pos.viewport);
      } else if (typeof same.offset !== 'undefined' && same.offset.top && same.offset.left) {
        (function () {
          css.position = 'absolute';
          var offsetParent = _this8.cache('target-offsetparent', function () {
            return getOffsetParent(_this8.target);
          });

          if (getOffsetParent(_this8.element) !== offsetParent) {
            defer(function () {
              _this8.element.parentNode.removeChild(_this8.element);
              offsetParent.appendChild(_this8.element);
            });
          }

          transcribe(same.offset, pos.offset);
          moved = true;
        })();
      } else {
        css.position = 'absolute';
        transcribe({ top: true, left: true }, pos.page);
      }

      if (!moved) {
        if (this.options.bodyElement) {
          if (this.element.parentNode !== this.options.bodyElement) {
            this.options.bodyElement.appendChild(this.element);
          }
        } else {
          var isFullscreenElement = function isFullscreenElement(e) {
            var d = e.ownerDocument;
            var fe = d.fullscreenElement || d.webkitFullscreenElement || d.mozFullScreenElement || d.msFullscreenElement;
            return fe === e;
          };

          var offsetParentIsBody = true;

          var currentNode = this.element.parentNode;
          while (currentNode && currentNode.nodeType === 1 && currentNode.tagName !== 'BODY' && !isFullscreenElement(currentNode)) {
            if (getComputedStyle(currentNode).position !== 'static') {
              offsetParentIsBody = false;
              break;
            }

            currentNode = currentNode.parentNode;
          }

          if (!offsetParentIsBody) {
            this.element.parentNode.removeChild(this.element);
            this.element.ownerDocument.body.appendChild(this.element);
          }
        }
      }

      // Any css change will trigger a repaint, so let's avoid one if nothing changed
      var writeCSS = {};
      var write = false;
      for (var key in css) {
        var val = css[key];
        var elVal = this.element.style[key];

        if (elVal !== val) {
          write = true;
          writeCSS[key] = val;
        }
      }

      if (write) {
        defer(function () {
          extend(_this8.element.style, writeCSS);
          _this8.trigger('repositioned');
        });
      }
    }
  }]);

  return TetherClass;
})(Evented);

TetherClass.modules = [];

TetherBase.position = position;

var Tether = extend(TetherClass, TetherBase);
/* globals TetherBase */

'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

var _TetherBase$Utils = TetherBase.Utils;
var getBounds = _TetherBase$Utils.getBounds;
var extend = _TetherBase$Utils.extend;
var updateClasses = _TetherBase$Utils.updateClasses;
var defer = _TetherBase$Utils.defer;

var BOUNDS_FORMAT = ['left', 'top', 'right', 'bottom'];

function getBoundingRect(tether, to) {
  if (to === 'scrollParent') {
    to = tether.scrollParents[0];
  } else if (to === 'window') {
    to = [pageXOffset, pageYOffset, innerWidth + pageXOffset, innerHeight + pageYOffset];
  }

  if (to === document) {
    to = to.documentElement;
  }

  if (typeof to.nodeType !== 'undefined') {
    (function () {
      var node = to;
      var size = getBounds(to);
      var pos = size;
      var style = getComputedStyle(to);

      to = [pos.left, pos.top, size.width + pos.left, size.height + pos.top];

      // Account any parent Frames scroll offset
      if (node.ownerDocument !== document) {
        var win = node.ownerDocument.defaultView;
        to[0] += win.pageXOffset;
        to[1] += win.pageYOffset;
        to[2] += win.pageXOffset;
        to[3] += win.pageYOffset;
      }

      BOUNDS_FORMAT.forEach(function (side, i) {
        side = side[0].toUpperCase() + side.substr(1);
        if (side === 'Top' || side === 'Left') {
          to[i] += parseFloat(style['border' + side + 'Width']);
        } else {
          to[i] -= parseFloat(style['border' + side + 'Width']);
        }
      });
    })();
  }

  return to;
}

TetherBase.modules.push({
  position: function position(_ref) {
    var _this = this;

    var top = _ref.top;
    var left = _ref.left;
    var targetAttachment = _ref.targetAttachment;

    if (!this.options.constraints) {
      return true;
    }

    var _cache = this.cache('element-bounds', function () {
      return getBounds(_this.element);
    });

    var height = _cache.height;
    var width = _cache.width;

    if (width === 0 && height === 0 && typeof this.lastSize !== 'undefined') {
      var _lastSize = this.lastSize;

      // Handle the item getting hidden as a result of our positioning without glitching
      // the classes in and out
      width = _lastSize.width;
      height = _lastSize.height;
    }

    var targetSize = this.cache('target-bounds', function () {
      return _this.getTargetBounds();
    });

    var targetHeight = targetSize.height;
    var targetWidth = targetSize.width;

    var allClasses = [this.getClass('pinned'), this.getClass('out-of-bounds')];

    this.options.constraints.forEach(function (constraint) {
      var outOfBoundsClass = constraint.outOfBoundsClass;
      var pinnedClass = constraint.pinnedClass;

      if (outOfBoundsClass) {
        allClasses.push(outOfBoundsClass);
      }
      if (pinnedClass) {
        allClasses.push(pinnedClass);
      }
    });

    allClasses.forEach(function (cls) {
      ['left', 'top', 'right', 'bottom'].forEach(function (side) {
        allClasses.push(cls + '-' + side);
      });
    });

    var addClasses = [];

    var tAttachment = extend({}, targetAttachment);
    var eAttachment = extend({}, this.attachment);

    this.options.constraints.forEach(function (constraint) {
      var to = constraint.to;
      var attachment = constraint.attachment;
      var pin = constraint.pin;

      if (typeof attachment === 'undefined') {
        attachment = '';
      }

      var changeAttachX = undefined,
          changeAttachY = undefined;
      if (attachment.indexOf(' ') >= 0) {
        var _attachment$split = attachment.split(' ');

        var _attachment$split2 = _slicedToArray(_attachment$split, 2);

        changeAttachY = _attachment$split2[0];
        changeAttachX = _attachment$split2[1];
      } else {
        changeAttachX = changeAttachY = attachment;
      }

      var bounds = getBoundingRect(_this, to);

      if (changeAttachY === 'target' || changeAttachY === 'both') {
        if (top < bounds[1] && tAttachment.top === 'top') {
          top += targetHeight;
          tAttachment.top = 'bottom';
        }

        if (top + height > bounds[3] && tAttachment.top === 'bottom') {
          top -= targetHeight;
          tAttachment.top = 'top';
        }
      }

      if (changeAttachY === 'together') {
        if (tAttachment.top === 'top') {
          if (eAttachment.top === 'bottom' && top < bounds[1]) {
            top += targetHeight;
            tAttachment.top = 'bottom';

            top += height;
            eAttachment.top = 'top';
          } else if (eAttachment.top === 'top' && top + height > bounds[3] && top - (height - targetHeight) >= bounds[1]) {
            top -= height - targetHeight;
            tAttachment.top = 'bottom';

            eAttachment.top = 'bottom';
          }
        }

        if (tAttachment.top === 'bottom') {
          if (eAttachment.top === 'top' && top + height > bounds[3]) {
            top -= targetHeight;
            tAttachment.top = 'top';

            top -= height;
            eAttachment.top = 'bottom';
          } else if (eAttachment.top === 'bottom' && top < bounds[1] && top + (height * 2 - targetHeight) <= bounds[3]) {
            top += height - targetHeight;
            tAttachment.top = 'top';

            eAttachment.top = 'top';
          }
        }

        if (tAttachment.top === 'middle') {
          if (top + height > bounds[3] && eAttachment.top === 'top') {
            top -= height;
            eAttachment.top = 'bottom';
          } else if (top < bounds[1] && eAttachment.top === 'bottom') {
            top += height;
            eAttachment.top = 'top';
          }
        }
      }

      if (changeAttachX === 'target' || changeAttachX === 'both') {
        if (left < bounds[0] && tAttachment.left === 'left') {
          left += targetWidth;
          tAttachment.left = 'right';
        }

        if (left + width > bounds[2] && tAttachment.left === 'right') {
          left -= targetWidth;
          tAttachment.left = 'left';
        }
      }

      if (changeAttachX === 'together') {
        if (left < bounds[0] && tAttachment.left === 'left') {
          if (eAttachment.left === 'right') {
            left += targetWidth;
            tAttachment.left = 'right';

            left += width;
            eAttachment.left = 'left';
          } else if (eAttachment.left === 'left') {
            left += targetWidth;
            tAttachment.left = 'right';

            left -= width;
            eAttachment.left = 'right';
          }
        } else if (left + width > bounds[2] && tAttachment.left === 'right') {
          if (eAttachment.left === 'left') {
            left -= targetWidth;
            tAttachment.left = 'left';

            left -= width;
            eAttachment.left = 'right';
          } else if (eAttachment.left === 'right') {
            left -= targetWidth;
            tAttachment.left = 'left';

            left += width;
            eAttachment.left = 'left';
          }
        } else if (tAttachment.left === 'center') {
          if (left + width > bounds[2] && eAttachment.left === 'left') {
            left -= width;
            eAttachment.left = 'right';
          } else if (left < bounds[0] && eAttachment.left === 'right') {
            left += width;
            eAttachment.left = 'left';
          }
        }
      }

      if (changeAttachY === 'element' || changeAttachY === 'both') {
        if (top < bounds[1] && eAttachment.top === 'bottom') {
          top += height;
          eAttachment.top = 'top';
        }

        if (top + height > bounds[3] && eAttachment.top === 'top') {
          top -= height;
          eAttachment.top = 'bottom';
        }
      }

      if (changeAttachX === 'element' || changeAttachX === 'both') {
        if (left < bounds[0]) {
          if (eAttachment.left === 'right') {
            left += width;
            eAttachment.left = 'left';
          } else if (eAttachment.left === 'center') {
            left += width / 2;
            eAttachment.left = 'left';
          }
        }

        if (left + width > bounds[2]) {
          if (eAttachment.left === 'left') {
            left -= width;
            eAttachment.left = 'right';
          } else if (eAttachment.left === 'center') {
            left -= width / 2;
            eAttachment.left = 'right';
          }
        }
      }

      if (typeof pin === 'string') {
        pin = pin.split(',').map(function (p) {
          return p.trim();
        });
      } else if (pin === true) {
        pin = ['top', 'left', 'right', 'bottom'];
      }

      pin = pin || [];

      var pinned = [];
      var oob = [];

      if (top < bounds[1]) {
        if (pin.indexOf('top') >= 0) {
          top = bounds[1];
          pinned.push('top');
        } else {
          oob.push('top');
        }
      }

      if (top + height > bounds[3]) {
        if (pin.indexOf('bottom') >= 0) {
          top = bounds[3] - height;
          pinned.push('bottom');
        } else {
          oob.push('bottom');
        }
      }

      if (left < bounds[0]) {
        if (pin.indexOf('left') >= 0) {
          left = bounds[0];
          pinned.push('left');
        } else {
          oob.push('left');
        }
      }

      if (left + width > bounds[2]) {
        if (pin.indexOf('right') >= 0) {
          left = bounds[2] - width;
          pinned.push('right');
        } else {
          oob.push('right');
        }
      }

      if (pinned.length) {
        (function () {
          var pinnedClass = undefined;
          if (typeof _this.options.pinnedClass !== 'undefined') {
            pinnedClass = _this.options.pinnedClass;
          } else {
            pinnedClass = _this.getClass('pinned');
          }

          addClasses.push(pinnedClass);
          pinned.forEach(function (side) {
            addClasses.push(pinnedClass + '-' + side);
          });
        })();
      }

      if (oob.length) {
        (function () {
          var oobClass = undefined;
          if (typeof _this.options.outOfBoundsClass !== 'undefined') {
            oobClass = _this.options.outOfBoundsClass;
          } else {
            oobClass = _this.getClass('out-of-bounds');
          }

          addClasses.push(oobClass);
          oob.forEach(function (side) {
            addClasses.push(oobClass + '-' + side);
          });
        })();
      }

      if (pinned.indexOf('left') >= 0 || pinned.indexOf('right') >= 0) {
        eAttachment.left = tAttachment.left = false;
      }
      if (pinned.indexOf('top') >= 0 || pinned.indexOf('bottom') >= 0) {
        eAttachment.top = tAttachment.top = false;
      }

      if (tAttachment.top !== targetAttachment.top || tAttachment.left !== targetAttachment.left || eAttachment.top !== _this.attachment.top || eAttachment.left !== _this.attachment.left) {
        _this.updateAttachClasses(eAttachment, tAttachment);
        _this.trigger('update', {
          attachment: eAttachment,
          targetAttachment: tAttachment
        });
      }
    });

    defer(function () {
      if (!(_this.options.addTargetClasses === false)) {
        updateClasses(_this.target, addClasses, allClasses);
      }
      updateClasses(_this.element, addClasses, allClasses);
    });

    return { top: top, left: left };
  }
});
/* globals TetherBase */

'use strict';

var _TetherBase$Utils = TetherBase.Utils;
var getBounds = _TetherBase$Utils.getBounds;
var updateClasses = _TetherBase$Utils.updateClasses;
var defer = _TetherBase$Utils.defer;

TetherBase.modules.push({
  position: function position(_ref) {
    var _this = this;

    var top = _ref.top;
    var left = _ref.left;

    var _cache = this.cache('element-bounds', function () {
      return getBounds(_this.element);
    });

    var height = _cache.height;
    var width = _cache.width;

    var targetPos = this.getTargetBounds();

    var bottom = top + height;
    var right = left + width;

    var abutted = [];
    if (top <= targetPos.bottom && bottom >= targetPos.top) {
      ['left', 'right'].forEach(function (side) {
        var targetPosSide = targetPos[side];
        if (targetPosSide === left || targetPosSide === right) {
          abutted.push(side);
        }
      });
    }

    if (left <= targetPos.right && right >= targetPos.left) {
      ['top', 'bottom'].forEach(function (side) {
        var targetPosSide = targetPos[side];
        if (targetPosSide === top || targetPosSide === bottom) {
          abutted.push(side);
        }
      });
    }

    var allClasses = [];
    var addClasses = [];

    var sides = ['left', 'top', 'right', 'bottom'];
    allClasses.push(this.getClass('abutted'));
    sides.forEach(function (side) {
      allClasses.push(_this.getClass('abutted') + '-' + side);
    });

    if (abutted.length) {
      addClasses.push(this.getClass('abutted'));
    }

    abutted.forEach(function (side) {
      addClasses.push(_this.getClass('abutted') + '-' + side);
    });

    defer(function () {
      if (!(_this.options.addTargetClasses === false)) {
        updateClasses(_this.target, addClasses, allClasses);
      }
      updateClasses(_this.element, addClasses, allClasses);
    });

    return true;
  }
});
/* globals TetherBase */

'use strict';

var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

TetherBase.modules.push({
  position: function position(_ref) {
    var top = _ref.top;
    var left = _ref.left;

    if (!this.options.shift) {
      return;
    }

    var shift = this.options.shift;
    if (typeof this.options.shift === 'function') {
      shift = this.options.shift.call(this, { top: top, left: left });
    }

    var shiftTop = undefined,
        shiftLeft = undefined;
    if (typeof shift === 'string') {
      shift = shift.split(' ');
      shift[1] = shift[1] || shift[0];

      var _shift = shift;

      var _shift2 = _slicedToArray(_shift, 2);

      shiftTop = _shift2[0];
      shiftLeft = _shift2[1];

      shiftTop = parseFloat(shiftTop, 10);
      shiftLeft = parseFloat(shiftLeft, 10);
    } else {
      shiftTop = shift.top;
      shiftLeft = shift.left;
    }

    top += shiftTop;
    left += shiftLeft;

    return { top: top, left: left };
  }
});
return Tether;

}));

},{}],10:[function(require,module,exports){
'use strict';

var panel = 'EmojiPanel';

module.exports = {
    panel: panel,
    open: panel + '--open',
    trigger: panel + '--trigger',

    icons: "icon_pack",
    iconpick: "icon_picker",
    emojipick: "emoji_picker",
    emoji: 'emoji',
    svg: panel + '__svg',

    tooltip: panel + '__tooltip',

    content: panel + '__content',
    header: panel + '__header',
    query: panel + '__query',
    searchInput: panel + '__queryInput',
    searchTitle: panel + '__searchTitle',
    frequentTitle: panel + '__frequentTitle',

    results: panel + '__results',
    noResults: panel + '__noResults',
    category: panel + '__category',
    categories: panel + '__categories',

    footer: panel + '__footer',
    brand: panel + '__brand',
    btnModifier: panel + '__btnModifier',
    btnModifierToggle: panel + '__btnModifierToggle',
    modifierDropdown: panel + '__modifierDropdown'
};

},{}],11:[function(require,module,exports){
'use strict';

var Tether = require('tether');

var Emojis = require('./emojis');

var Create = function Create(options, emit, toggle) {
    if (options.editable) {
        // Set the caret offset on the input
        var handleChange = function handleChange(e) {
            options.editable.dataset.offset = getCaretPosition(options.editable);
        };
        options.editable.addEventListener('keyup', handleChange);
        options.editable.addEventListener('change', handleChange);
        options.editable.addEventListener('click', handleChange);
    }

    // Create the dropdown panel
    var panel = document.createElement('div');
    if (options.panel_type == "emoji") {
        panel.classList.add(options.classnames.panel);
        panel.classList.add(options.classnames.emojipick);
    } else if (options.panel_type == "icon") {
        panel.classList.add(options.classnames.panel);
        panel.classList.add(options.classnames.iconpick);
    }

    var content = document.createElement('div');
    content.classList.add(options.classnames.content);
    panel.appendChild(content);

    var searchInput = void 0;
    var results = void 0;
    var emptyState = void 0;
    var frequentTitle = void 0;

    if (options.trigger) {
        panel.classList.add(options.classnames.trigger);
        // Listen for the trigger
        options.trigger.addEventListener('click', function () {
            return toggle();
        });

        // Create the tooltip
        options.trigger.setAttribute('title', options.locale.add);
        var tooltip = document.createElement('span');
        tooltip.classList.add(options.classnames.tooltip);
        tooltip.innerHTML = options.locale.add;
        options.trigger.appendChild(tooltip);
    }

    // Create the category links
    var header = document.createElement('header');
    header.classList.add(options.classnames.header);
    content.appendChild(header);

    var categories = document.createElement('div');
    categories.classList.add(options.classnames.categories);
    header.appendChild(categories);

    for (var i = 0; i < 9; i++) {
        var categoryLink = document.createElement('button');
        categoryLink.classList.add('temp');
        categories.appendChild(categoryLink);
    }

    // Create the list
    results = document.createElement('div');
    results.classList.add(options.classnames.results);
    content.appendChild(results);

    // Create the search input
    if (options.search == true) {
        var query = document.createElement('div');
        query.classList.add(options.classnames.query);
        header.appendChild(query);

        searchInput = document.createElement('input');
        searchInput.classList.add(options.classnames.searchInput);
        searchInput.setAttribute('type', 'text');
        searchInput.setAttribute('autoComplete', 'off');
        searchInput.setAttribute('placeholder', options.locale.search);
        query.appendChild(searchInput);

        var icon = document.createElement('div');
        icon.innerHTML = options.icons.search;
        query.appendChild(icon);

        var searchTitle = document.createElement('p');
        searchTitle.classList.add(options.classnames.category, options.classnames.searchTitle);
        searchTitle.style.display = 'none';
        searchTitle.innerHTML = options.locale.search_results;
        results.appendChild(searchTitle);

        emptyState = document.createElement('span');
        emptyState.classList.add(options.classnames.noResults);
        emptyState.innerHTML = options.locale.no_results;
        results.appendChild(emptyState);
    }

    if (options.frequent == true) {
        var frequentList = localStorage.getItem('EmojiPanel-frequent');
        if (frequentList) {
            frequentList = JSON.parse(frequentList);
        } else {
            frequentList = [];
        }
        frequentTitle = document.createElement('p');
        frequentTitle.classList.add(options.classnames.category, options.classnames.frequentTitle);
        frequentTitle.innerHTML = options.locale.frequent;
        if (frequentList.length == 0) {
            frequentTitle.style.display = 'none';
        }
        results.appendChild(frequentTitle);

        var frequentResults = document.createElement('div');
        frequentResults.classList.add('EmojiPanel-frequent');

        frequentList.forEach(function (emoji) {
            frequentResults.appendChild(Emojis.createButton(emoji, options, emit));
        });
        results.appendChild(frequentResults);
    }

    var loadingTitle = document.createElement('p');
    loadingTitle.classList.add(options.classnames.category);
    loadingTitle.textContent = options.locale.loading;
    results.appendChild(loadingTitle);
    for (var _i = 0; _i < 9 * 8; _i++) {
        var tempEmoji = document.createElement('button');
        tempEmoji.classList.add('temp');
        results.appendChild(tempEmoji);
    }

    var footer = document.createElement('footer');
    footer.classList.add(options.classnames.footer);
    panel.appendChild(footer);

    if (options.locale.brand) {
        var brand = document.createElement('a');
        brand.classList.add(options.classnames.brand);
        brand.setAttribute('href', 'https://emojipanel.js.org');
        brand.textContent = options.locale.brand;
        footer.appendChild(brand);
    }

    // Append the dropdown menu to the container
    options.container.appendChild(panel);

    // Tether the dropdown to the trigger
    var tether = void 0;
    if (options.trigger && options.tether) {
        var placements = ['top', 'right', 'bottom', 'left'];
        if (placements.indexOf(options.placement) == -1) {
            throw new Error('Invalid attachment \'' + options.placement + '\'. Valid placements are \'' + placements.join('\', \'') + '\'.');
        }

        var attachment = void 0;
        var targetAttachment = void 0;
        switch (options.placement) {
            case placements[0]:case placements[2]:
                attachment = (options.placement == placements[0] ? placements[2] : placements[0]) + ' center';
                targetAttachment = (options.placement == placements[0] ? placements[0] : placements[2]) + ' center';
                break;
            case placements[1]:case placements[3]:
                attachment = 'top ' + (options.placement == placements[1] ? placements[3] : placements[1]);
                targetAttachment = 'top ' + (options.placement == placements[1] ? placements[1] : placements[3]);
                break;
        }

        tether = new Tether({
            element: panel,
            target: options.trigger,
            attachment: attachment,
            targetAttachment: targetAttachment
        });
    }

    // Return the panel element so we can update it later
    return {
        panel: panel,
        tether: tether
    };
};

var getCaretPosition = function getCaretPosition(el) {
    var caretOffset = 0;
    var doc = el.ownerDocument || el.document;
    var win = doc.defaultView || doc.parentWindow;
    var sel = void 0;
    if (typeof win.getSelection != 'undefined') {
        sel = win.getSelection();
        if (sel.rangeCount > 0) {
            var range = win.getSelection().getRangeAt(0);
            var preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(el);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            caretOffset = preCaretRange.toString().length;
        }
    } else if ((sel = doc.selection) && sel.type != 'Control') {
        var textRange = sel.createRange();
        var preCaretTextRange = doc.body.createTextRange();
        preCaretTextRange.moveToElementText(el);
        preCaretTextRange.setEndPoint('EndToEnd', textRange);
        caretOffset = preCaretTextRange.text.length;
    }

    return caretOffset;
};

module.exports = Create;

},{"./emojis":12,"tether":9}],12:[function(require,module,exports){
'use strict';

var modifiers = require('./modifiers');

var Emojis = {
    load: function load(options) {
        // Load and inject the SVG sprite into the DOM
        var svgPromise = Promise.resolve();
        if (options.pack_url && !document.querySelector(options.classnames.svg)) {
            svgPromise = new Promise(function (resolve) {
                var svgXhr = new XMLHttpRequest();
                svgXhr.open('GET', options.pack_url, true);
                svgXhr.onload = function () {
                    var container = document.createElement('div');
                    container.classList.add(options.classnames.svg);
                    container.style.display = 'none';
                    container.innerHTML = svgXhr.responseText;
                    document.body.appendChild(container);
                    resolve();
                };
                svgXhr.send();
            });
        }

        var jsonPromise = void 0;
        // Load the emojis json
        if (options.panel_type == "emoji") {
            var json = localStorage.getItem('EmojiPanel-json');
            jsonPromise = Promise.resolve(json);
            if (json == null) {
                jsonPromise = new Promise(function (resolve) {
                    var emojiXhr = new XMLHttpRequest();
                    emojiXhr.open('GET', options.json_url, true);
                    emojiXhr.onreadystatechange = function () {
                        if (emojiXhr.readyState == XMLHttpRequest.DONE && emojiXhr.status == 200) {
                            var _json = JSON.parse(emojiXhr.responseText);
                            localStorage.setItem('EmojiPanel-json', emojiXhr.responseText);
                            resolve(_json);
                        }
                    };
                    emojiXhr.send();
                });
            } else {
                jsonPromise = new Promise(function (resolve) {
                    var json = JSON.parse(localStorage.getItem('EmojiPanel-json'));
                    resolve(json);
                });
            }
        } else if (options.panel_type == "icon") {
            // const json = localStorage.getItem('IconPanel-json');
            // jsonPromise = Promise.resolve(json)
            // if(json == null) {
            jsonPromise = new Promise(function (resolve) {
                var emojiXhr = new XMLHttpRequest();
                emojiXhr.open('GET', options.json_url, true);
                emojiXhr.onreadystatechange = function () {
                    if (emojiXhr.readyState == XMLHttpRequest.DONE && emojiXhr.status == 200) {
                        var _json2 = JSON.parse(emojiXhr.responseText);
                        //localStorage.setItem('IconPanel-json',emojiXhr.responseText);
                        resolve(_json2);
                    }
                };
                emojiXhr.send();
            });
            // }
            // else{
            //     jsonPromise = new Promise(resolve => {
            //         const json = JSON.parse(localStorage.getItem('IconPanel-json'));
            //         resolve(json);
            //     })
            // }
        } else if (options.panel_type == "giph") {

            jsonPromise = new Promise(function (resolve) {
                var emojiXhr = new XMLHttpRequest();
                emojiXhr.open('GET', "http://api.giphy.com/v1/gifs/search?q=funny+cat&api_key=7yc1te83tzamTb7B9tbTGGf0PQENT0mw&limit=5", true);
                emojiXhr.onreadystatechange = function () {
                    if (emojiXhr.readyState == XMLHttpRequest.DONE && emojiXhr.status == 200) {
                        var _json3 = JSON.parse(emojiXhr.responseText);
                        resolve(_json3.data);
                    }
                };
                emojiXhr.send();
            });
        }

        return Promise.all([svgPromise, jsonPromise]);
    },
    createEl: function createEl(inputElement, options, baseUrl) {
        if (options.panel_type == "emoji") {

            if (options.pack_url) {
                if (document.querySelector('.' + options.classnames.svg + ' [id="' + inputElement.unicode + '"')) {
                    return '<svg viewBox="0 0 20 20"><use xlink:href="#' + inputElement.unicode + '"></use></svg>';
                }
            }
            return inputElement.char;
            // Fallback to the emoji char if the pack does not have the sprite, or no pack
        } else if (options.panel_type == "icon") {
            return "<img src=" + baseUrl + inputElement.icon_url + ">";
        }
    },
    createButton: function createButton(inputElement, options, emit, baseUrl) {

        var button = document.createElement('button');
        button.setAttribute('type', 'button');

        if (options.panel_type == "emoji") {

            if (inputElement.fitzpatrick && options.fitzpatrick) {
                // Remove existing modifiers
                Object.keys(modifiers).forEach(function (i) {
                    return inputElement.unicode = inputElement.unicode.replace(modifiers[i].unicode, '');
                });
                Object.keys(modifiers).forEach(function (i) {
                    return inputElement.char = inputElement.char.replace(modifiers[i].char, '');
                });

                // Append fitzpatrick modifier
                inputElement.unicode += modifiers[options.fitzpatrick].unicode;
                inputElement.char += modifiers[options.fitzpatrick].char;
            }

            button.innerHTML = Emojis.createEl(inputElement, options);
            button.classList.add('emoji');
            button.dataset.unicode = inputElement.unicode;
            button.dataset.char = inputElement.char;
            button.dataset.category = inputElement.category;
            button.dataset.name = inputElement.name;
            button.title = inputElement.name;
            if (inputElement.fitzpatrick) {
                button.dataset.fitzpatrick = inputElement.fitzpatrick;
            }
            if (emit) {
                button.addEventListener('click', function () {
                    emit('select', inputElement);

                    if (options.editable) {
                        Emojis.write(inputElement, options);
                    }
                });
            }
        } else if (options.panel_type == "icon") {

            button.innerHTML = Emojis.createEl(inputElement, options, baseUrl);
            button.classList.add('icon_pack');
            button.dataset.name = inputElement.name;

            if (emit) {
                button.addEventListener('click', function () {
                    emit('select', inputElement);

                    if (options.editable) {
                        Emojis.write(inputElement, options);
                    }
                });
            }
        }
        return button;
    },
    write: function write(inputElement, options) {
        var input = options.editable;
        if (!input) {
            return;
        }
        if (options.panel_type == "emoji") {

            // Insert the emoji at the end of the text by default
            var offset = input.textContent.length;
            if (input.dataset.offset) {
                // Insert the emoji where the rich editor caret was
                offset = input.dataset.offset;
            }

            // Insert the pictographImage
            var pictographs = input.parentNode.querySelector('.EmojiPanel__pictographs');
            var url = 'https://abs.twimg.com/emoji/v2/72x72/' + emoji.unicode + '.png';
            var image = document.createElement('img');
            image.classList.add('RichEditor-pictographImage');
            image.setAttribute('src', url);
            image.setAttribute('draggable', false);
            pictographs.appendChild(image);

            var span = document.createElement('span');
            span.classList.add('EmojiPanel__pictographText');
            span.setAttribute('title', emoji.name);
            span.setAttribute('aria-label', emoji.name);
            span.dataset.pictographText = emoji.char;
            span.dataset.pictographImage = url;
            span.innerHTML = '&emsp;';

            // If it's empty, remove the default content of the input
            var div = input.querySelector('div');
            if (div.innerHTML == '<br>') {
                div.innerHTML = '';
            }

            // Replace each pictograph span with it's native character
            var picts = div.querySelectorAll('.EmojiPanel__pictographText');
            [].forEach.call(picts, function (pict) {
                div.replaceChild(document.createTextNode(pict.dataset.pictographText), pict);
            });

            // Split content into array, insert emoji at offset index
            var content = emojiAware.split(div.textContent);
            content.splice(offset, 0, emoji.char);
            content = content.join('');

            div.textContent = content;

            // Trigger a refresh of the input
            var event = document.createEvent('HTMLEvents');
            event.initEvent('mousedown', false, true);
            input.dispatchEvent(event);

            // Update the offset to after the inserted emoji
            input.dataset.offset = parseInt(input.dataset.offset, 10) + 1;

            if (options.frequent == true) {
                Frequent.add(emoji, Emojis.createButton);
            }
        } else if (options.panel_type == "icon") {}
    }
};

module.exports = Emojis;

},{"./modifiers":15}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('fbemitter'),
    EventEmitter = _require.EventEmitter;

var Create = require('./create');
var Emojis = require('./emojis');
var List = require('./list');
var classnames = require('./classnames');

var defaults = {
    search: true,
    frequent: true,
    fitzpatrick: 'a',
    hidden_categories: [],
    pack_url: null,
    // panel_type: 'emoji',
    // json_url: '/emojis.json',
    // panel_type: 'icon',
    // json_url: '/iconSet.json',
    panel_type: 'giph',
    // json_url: '/iconSet.json',
    tether: true,
    placement: 'bottom',

    locale: {
        add: 'Add emoji',
        brand: 'EmojiPanel',
        frequent: 'Frequently used',
        loading: 'Loading...',
        no_results: 'No results',
        search: 'Search',
        search_results: 'Search results'
    },
    icons: {
        search: '<span class="fa fa-search"></span>'
    },
    classnames: classnames
};

var EmojiPanel = function (_EventEmitter) {
    _inherits(EmojiPanel, _EventEmitter);

    function EmojiPanel(options) {
        _classCallCheck(this, EmojiPanel);

        var _this = _possibleConstructorReturn(this, (EmojiPanel.__proto__ || Object.getPrototypeOf(EmojiPanel)).call(this));

        _this.options = Object.assign({}, defaults, options);

        var els = ['container', 'trigger', 'editable'];
        els.forEach(function (el) {
            if (typeof _this.options[el] == 'string') {
                _this.options[el] = document.querySelector(_this.options[el]);
            }
        });

        var create = Create(_this.options, _this.emit.bind(_this), _this.toggle.bind(_this));
        _this.panel = create.panel;
        _this.tether = create.tether;

        Emojis.load(_this.options).then(function (res) {
            List(_this.options, _this.panel, res[1], _this.emit.bind(_this));
        });
        return _this;
    }

    _createClass(EmojiPanel, [{
        key: 'toggle',
        value: function toggle() {
            var open = this.panel.classList.toggle(this.options.classnames.open);
            var searchInput = this.panel.querySelector('.' + this.options.classnames.searchInput);

            this.emit('toggle', open);
            if (open && this.options.search && searchInput) {
                searchInput.focus();
            }
        }
    }, {
        key: 'reposition',
        value: function reposition() {
            if (this.tether) {
                this.tether.position();
            }
        }
    }]);

    return EmojiPanel;
}(EventEmitter);

exports.default = EmojiPanel;


if (typeof window != 'undefined') {
    window.EmojiPanel = EmojiPanel;
}

},{"./classnames":10,"./create":11,"./emojis":12,"./list":14,"fbemitter":1}],14:[function(require,module,exports){
'use strict';

var Emojis = require('./emojis');
var modifiers = require('./modifiers');

var list = function list(options, panel, json, emit) {
    var categories = panel.querySelector('.' + options.classnames.categories);
    var searchInput = panel.querySelector('.' + options.classnames.searchInput);
    var searchTitle = panel.querySelector('.' + options.classnames.searchTitle);
    var frequentTitle = panel.querySelector('.' + options.classnames.frequentTitle);
    var results = panel.querySelector('.' + options.classnames.results);
    var emptyState = panel.querySelector('.' + options.classnames.noResults);
    var footer = panel.querySelector('.' + options.classnames.footer);

    // Update the category links
    while (categories.firstChild) {
        categories.removeChild(categories.firstChild);
    }
    if (options.panel_type != "giph") {
        Object.keys(json).forEach(function (i) {
            var category = json[i];
            console.log(category);
            // Don't show the link to a hidden category
            if (options.hidden_categories.indexOf(category.name) > -1) {
                return;
            }

            var categoryLink = document.createElement('button');

            categoryLink.setAttribute('title', category.name);
            if (options.panel_type == "emoji") {
                categoryLink.classList.add(options.classnames.emoji);
                categoryLink.innerHTML = Emojis.createEl(category.icon, options);
            } else if (options.panel_type == "icon") {
                categoryLink.classList.add("header_icons");
                categoryLink.innerHTML = Emojis.createEl(category.icon_pack, options, category.base_url);
            }

            categoryLink.addEventListener('click', function (e) {
                var strippedSpace = category.name.replace(/\s/g, "_");
                var title = options.container.querySelector('#' + strippedSpace);
                scrollTo(results, title.offsetTop - results.offsetTop, 500);
            });
            categories.appendChild(categoryLink);
        });
    } else {
        Object.keys(json).forEach(function (i) {
            var image_url = json[i].images.original.url;;
            var imageTemplate = document.createElement('img');
            imageTemplate.src = image_url;
            console.log(results);
            results.appendChild(imageTemplate);
            // console.log(category.images.original.url)
        });
    }

    // credits for this piece of code(scrollTo pure js) to adnJosh https://gist.github.com/andjosh
    function scrollTo(element, to, duration) {
        var start = element.scrollTop,
            change = to - start,
            currentTime = 0,
            increment = 20;

        var animateScroll = function animateScroll() {
            currentTime += increment;
            var val = Math.easeInOutQuad(currentTime, start, change, duration);
            element.scrollTop = val;
            if (currentTime < duration) {
                setTimeout(animateScroll, increment);
            }
        };
        animateScroll();
    }
    if (options.panel_type != "giph") {
        //t = current time
        //b = start value
        //c = change in value
        //d = duration
        Math.easeInOutQuad = function (t, b, c, d) {
            t /= d / 2;
            if (t < 1) return c / 2 * t * t + b;
            t--;
            return -c / 2 * (t * (t - 2) - 1) + b;
        };

        // Handle the search input
        if (options.search == true) {

            searchInput.addEventListener('input', function (e) {
                var emojis = void 0,
                    icons = void 0;
                if (options.panel_type == "emoji") {
                    emojis = results.querySelectorAll('.' + options.classnames.emoji);
                } else if (options.panel_type == "icon") {
                    icons = results.querySelectorAll('.' + options.classnames.icons);
                }

                var titles = results.querySelectorAll('.' + options.classnames.category);

                var frequentList = localStorage.getItem('EmojiPanel-frequent');
                if (frequentList) {
                    frequentList = JSON.parse(frequentList);
                } else {
                    frequentList = [];
                }

                var value = e.target.value.replace(/-/g, '').toLowerCase();
                if (value.length > 0) {
                    var matched = [];
                    Object.keys(json).forEach(function (i) {
                        var category = json[i];
                        if (options.panel_type == "emoji") {
                            category.emojis.forEach(function (emoji) {
                                var keywordMatch = emoji.keywords.find(function (keyword) {
                                    keyword = keyword.replace(/-/g, '').toLowerCase();
                                    return keyword.indexOf(value) > -1;
                                });
                                if (keywordMatch) {
                                    matched.push(emoji.unicode);
                                }
                            });
                        } else if (options.panel_type == "icon") {
                            category.icons.forEach(function (icon) {
                                var keywordMatch = icon.keywords.find(function (keyword) {
                                    keyword = keyword.replace(/-/g, '').toLowerCase();
                                    return keyword.indexOf(value) > -1;
                                });
                                if (keywordMatch) {
                                    matched.push(icon.name);
                                }
                            });
                        }
                    });
                    if (matched.length == 0) {
                        emptyState.style.display = 'block';
                    } else {
                        emptyState.style.display = 'none';
                    }

                    emit('search', { value: value, matched: matched });

                    if (options.panel_type == "emoji") {
                        [].forEach.call(emojis, function (emoji) {
                            if (matched.indexOf(emoji.dataset.unicode) == -1) {
                                emoji.style.display = 'none';
                            } else {
                                emoji.style.display = 'inline-block';
                            }
                        });
                    } else if (options.panel_type == "icon") {
                        [].forEach.call(icons, function (icon) {
                            if (matched.indexOf(icon.dataset.name) == -1) {
                                icon.style.display = 'none';
                            } else {
                                icon.style.display = 'inline-block';
                            }
                        });
                    }

                    [].forEach.call(titles, function (title) {
                        title.style.display = 'none';
                    });
                    searchTitle.style.display = 'block';

                    if (options.frequent == true) {
                        frequentTitle.style.display = 'none';
                    }
                } else {
                    var _emojis = results.querySelectorAll('.' + options.classnames.emoji);
                    var _icons = results.querySelectorAll('.' + options.classnames.icons);

                    if (options.panel_type == "emoji") {
                        [].forEach.call(_emojis, function (emoji) {
                            emoji.style.display = 'inline-block';
                        });
                    } else if (options.panel_type == "icon") {
                        [].forEach.call(_icons, function (icon) {
                            icon.style.display = 'inline-block';
                        });
                    }
                    [].forEach.call(titles, function (title) {
                        title.style.display = 'block';
                    });
                    searchTitle.style.display = 'none';
                    emptyState.style.display = 'none';

                    if (options.frequent == true) {
                        if (frequentList.length > 0) {
                            frequentTitle.style.display = 'block';
                        } else {
                            frequentTitle.style.display = 'none';
                        }
                    }
                }
            });
        }

        // Fill the results with emojis
        while (results.firstChild) {
            results.removeChild(results.firstChild);
        }

        Object.keys(json).forEach(function (i) {
            var category = json[i];

            // Don't show any hidden categories
            if (options.hidden_categories.indexOf(category.name) > -1 || category.name == 'modifier') {
                return;
            }

            // Create the category title
            var title = document.createElement('p');
            title.classList.add(options.classnames.category);
            var strippedSpace = category.name.replace(/\s/g, "_");
            title.id = strippedSpace;
            var categoryName = category.name.replace(/_/g, ' ').replace(/\w\S*/g, function (name) {
                return name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();
            }).replace('And', '&amp;');
            title.innerHTML = categoryName;
            results.appendChild(title);

            // Create the emoji buttons
            if (options.panel_type == "emoji") {
                category.emojis.forEach(function (emoji) {
                    results.appendChild(Emojis.createButton(emoji, options, emit));
                });
            } else if (options.panel_type == "icon") {
                category.icons.forEach(function (icon) {
                    results.appendChild(Emojis.createButton(icon, options, emit, category.base_url));
                });
            }
        });

        if (options.fitzpatrick && options.panel_type == "emoji") {
            // Create the fitzpatrick modifier button
            var hand = { // ✋
                unicode: '270b' + modifiers[options.fitzpatrick].unicode,
                char: '✋'
            };
            var modifierDropdown = void 0;
            var modifierToggle = document.createElement('button');
            modifierToggle.setAttribute('type', 'button');
            modifierToggle.classList.add(options.classnames.btnModifier, options.classnames.btnModifierToggle, options.classnames.emoji);
            modifierToggle.innerHTML = Emojis.createEl(hand, options);
            modifierToggle.addEventListener('click', function () {
                modifierDropdown.classList.toggle('active');
                modifierToggle.classList.toggle('active');
            });
            footer.appendChild(modifierToggle);

            modifierDropdown = document.createElement('div');
            modifierDropdown.classList.add(options.classnames.modifierDropdown);
            Object.keys(modifiers).forEach(function (m) {
                var modifier = Object.assign({}, modifiers[m]);
                modifier.unicode = '270b' + modifier.unicode;
                modifier.char = '✋' + modifier.char;
                var modifierBtn = document.createElement('button');
                modifierBtn.setAttribute('type', 'button');
                modifierBtn.classList.add(options.classnames.btnModifier, options.classnames.emoji);
                modifierBtn.dataset.modifier = m;
                modifierBtn.innerHTML = Emojis.createEl(modifier, options);

                modifierBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();

                    modifierToggle.classList.remove('active');
                    modifierToggle.innerHTML = Emojis.createEl(modifier, options);

                    options.fitzpatrick = modifierBtn.dataset.modifier;
                    modifierDropdown.classList.remove('active');

                    // Refresh every emoji in any list with new skin tone
                    var emojis = [].forEach.call(options.container.querySelectorAll('.' + options.classnames.results + '  .' + options.classnames.emoji), function (emoji) {
                        if (emoji.dataset.fitzpatrick) {
                            var emojiObj = {
                                unicode: emoji.dataset.unicode,
                                char: emoji.dataset.char,
                                fitzpatrick: true,
                                category: emoji.dataset.category,
                                name: emoji.dataset.name
                            };
                            emoji.parentNode.replaceChild(Emojis.createButton(emojiObj, options, emit), emoji);
                        }
                    });
                });

                modifierDropdown.appendChild(modifierBtn);
            });
            footer.appendChild(modifierDropdown);
        }
    }
};

module.exports = list;

},{"./emojis":12,"./modifiers":15}],15:[function(require,module,exports){
'use strict';

module.exports = {
    a: {
        unicode: '',
        char: ''
    },
    b: {
        unicode: '-1f3fb',
        char: '🏻'
    },
    c: {
        unicode: '-1f3fc',
        char: '🏼'
    },
    d: {
        unicode: '-1f3fd',
        char: '🏽'
    },
    e: {
        unicode: '-1f3fe',
        char: '🏾'
    },
    f: {
        unicode: '-1f3ff',
        char: '🏿'
    }
};

},{}]},{},[13])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmJlbWl0dGVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZiZW1pdHRlci9saWIvQmFzZUV2ZW50RW1pdHRlci5qcyIsIm5vZGVfbW9kdWxlcy9mYmVtaXR0ZXIvbGliL0VtaXR0ZXJTdWJzY3JpcHRpb24uanMiLCJub2RlX21vZHVsZXMvZmJlbWl0dGVyL2xpYi9FdmVudFN1YnNjcmlwdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9mYmVtaXR0ZXIvbGliL0V2ZW50U3Vic2NyaXB0aW9uVmVuZG9yLmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2VtcHR5RnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvZmJqcy9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy90ZXRoZXIvZGlzdC9qcy90ZXRoZXIuanMiLCJzcmMvY2xhc3NuYW1lcy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZW1vamlzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL2xpc3QuanMiLCJzcmMvbW9kaWZpZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM5TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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TSxPQUFOLENBQWMsV0FBakIsRUFBOEI7QUFDMUIsZ0NBQU0sV0FBVztBQUNiLHlDQUFTLE1BQU0sT0FBTixDQUFjLE9BRFY7QUFFYixzQ0FBTSxNQUFNLE9BQU4sQ0FBYyxJQUZQO0FBR2IsNkNBQWEsSUFIQTtBQUliLDBDQUFVLE1BQU0sT0FBTixDQUFjLFFBSlg7QUFLYixzQ0FBTSxNQUFNLE9BQU4sQ0FBYztBQUxQLDZCQUFqQjtBQU9BLGtDQUFNLFVBQU4sQ0FBaUIsWUFBakIsQ0FBOEIsT0FBTyxZQUFQLENBQW9CLFFBQXBCLEVBQThCLE9BQTlCLEVBQXVDLElBQXZDLENBQTlCLEVBQTRFLEtBQTVFO0FBQ0g7QUFDSixxQkFYYyxDQUFmO0FBWUgsaUJBdkJEOztBQXlCQSxpQ0FBaUIsV0FBakIsQ0FBNkIsV0FBN0I7QUFDSCxhQXBDRDtBQXFDQSxtQkFBTyxXQUFQLENBQW1CLGdCQUFuQjtBQUNIO0FBQ0o7QUFDSixDQTNTRDs7QUE2U0EsT0FBTyxPQUFQLEdBQWlCLElBQWpCOzs7OztBQ2hUQSxPQUFPLE9BQVAsR0FBaUI7QUFDYixPQUFHO0FBQ0MsaUJBQVMsRUFEVjtBQUVDLGNBQU07QUFGUCxLQURVO0FBS2IsT0FBRztBQUNDLGlCQUFTLFFBRFY7QUFFQyxjQUFNO0FBRlAsS0FMVTtBQVNiLE9BQUc7QUFDQyxpQkFBUyxRQURWO0FBRUMsY0FBTTtBQUZQLEtBVFU7QUFhYixPQUFHO0FBQ0MsaUJBQVMsUUFEVjtBQUVDLGNBQU07QUFGUCxLQWJVO0FBaUJiLE9BQUc7QUFDQyxpQkFBUyxRQURWO0FBRUMsY0FBTTtBQUZQLEtBakJVO0FBcUJiLE9BQUc7QUFDQyxpQkFBUyxRQURWO0FBRUMsY0FBTTtBQUZQO0FBckJVLENBQWpCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24oKXtmdW5jdGlvbiByKGUsbix0KXtmdW5jdGlvbiBvKGksZil7aWYoIW5baV0pe2lmKCFlW2ldKXt2YXIgYz1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlO2lmKCFmJiZjKXJldHVybiBjKGksITApO2lmKHUpcmV0dXJuIHUoaSwhMCk7dmFyIGE9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitpK1wiJ1wiKTt0aHJvdyBhLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsYX12YXIgcD1uW2ldPXtleHBvcnRzOnt9fTtlW2ldWzBdLmNhbGwocC5leHBvcnRzLGZ1bmN0aW9uKHIpe3ZhciBuPWVbaV1bMV1bcl07cmV0dXJuIG8obnx8cil9LHAscC5leHBvcnRzLHIsZSxuLHQpfXJldHVybiBuW2ldLmV4cG9ydHN9Zm9yKHZhciB1PVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmUsaT0wO2k8dC5sZW5ndGg7aSsrKW8odFtpXSk7cmV0dXJuIG99cmV0dXJuIHJ9KSgpIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICovXG5cbnZhciBmYmVtaXR0ZXIgPSB7XG4gIEV2ZW50RW1pdHRlcjogcmVxdWlyZSgnLi9saWIvQmFzZUV2ZW50RW1pdHRlcicpLFxuICBFbWl0dGVyU3Vic2NyaXB0aW9uIDogcmVxdWlyZSgnLi9saWIvRW1pdHRlclN1YnNjcmlwdGlvbicpXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZiZW1pdHRlcjtcbiIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBAcHJvdmlkZXNNb2R1bGUgQmFzZUV2ZW50RW1pdHRlclxuICogQHR5cGVjaGVja3NcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG52YXIgRW1pdHRlclN1YnNjcmlwdGlvbiA9IHJlcXVpcmUoJy4vRW1pdHRlclN1YnNjcmlwdGlvbicpO1xudmFyIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yID0gcmVxdWlyZSgnLi9FdmVudFN1YnNjcmlwdGlvblZlbmRvcicpO1xuXG52YXIgZW1wdHlGdW5jdGlvbiA9IHJlcXVpcmUoJ2ZianMvbGliL2VtcHR5RnVuY3Rpb24nKTtcbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxuLyoqXG4gKiBAY2xhc3MgQmFzZUV2ZW50RW1pdHRlclxuICogQGRlc2NyaXB0aW9uXG4gKiBBbiBFdmVudEVtaXR0ZXIgaXMgcmVzcG9uc2libGUgZm9yIG1hbmFnaW5nIGEgc2V0IG9mIGxpc3RlbmVycyBhbmQgcHVibGlzaGluZ1xuICogZXZlbnRzIHRvIHRoZW0gd2hlbiBpdCBpcyB0b2xkIHRoYXQgc3VjaCBldmVudHMgaGFwcGVuZWQuIEluIGFkZGl0aW9uIHRvIHRoZVxuICogZGF0YSBmb3IgdGhlIGdpdmVuIGV2ZW50IGl0IGFsc28gc2VuZHMgYSBldmVudCBjb250cm9sIG9iamVjdCB3aGljaCBhbGxvd3NcbiAqIHRoZSBsaXN0ZW5lcnMvaGFuZGxlcnMgdG8gcHJldmVudCB0aGUgZGVmYXVsdCBiZWhhdmlvciBvZiB0aGUgZ2l2ZW4gZXZlbnQuXG4gKlxuICogVGhlIGVtaXR0ZXIgaXMgZGVzaWduZWQgdG8gYmUgZ2VuZXJpYyBlbm91Z2ggdG8gc3VwcG9ydCBhbGwgdGhlIGRpZmZlcmVudFxuICogY29udGV4dHMgaW4gd2hpY2ggb25lIG1pZ2h0IHdhbnQgdG8gZW1pdCBldmVudHMuIEl0IGlzIGEgc2ltcGxlIG11bHRpY2FzdFxuICogbWVjaGFuaXNtIG9uIHRvcCBvZiB3aGljaCBleHRyYSBmdW5jdGlvbmFsaXR5IGNhbiBiZSBjb21wb3NlZC4gRm9yIGV4YW1wbGUsIGFcbiAqIG1vcmUgYWR2YW5jZWQgZW1pdHRlciBtYXkgdXNlIGFuIEV2ZW50SG9sZGVyIGFuZCBFdmVudEZhY3RvcnkuXG4gKi9cblxudmFyIEJhc2VFdmVudEVtaXR0ZXIgPSAoZnVuY3Rpb24gKCkge1xuICAvKipcbiAgICogQGNvbnN0cnVjdG9yXG4gICAqL1xuXG4gIGZ1bmN0aW9uIEJhc2VFdmVudEVtaXR0ZXIoKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEJhc2VFdmVudEVtaXR0ZXIpO1xuXG4gICAgdGhpcy5fc3Vic2NyaWJlciA9IG5ldyBFdmVudFN1YnNjcmlwdGlvblZlbmRvcigpO1xuICAgIHRoaXMuX2N1cnJlbnRTdWJzY3JpcHRpb24gPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBsaXN0ZW5lciB0byBiZSBpbnZva2VkIHdoZW4gZXZlbnRzIG9mIHRoZSBzcGVjaWZpZWQgdHlwZSBhcmVcbiAgICogZW1pdHRlZC4gQW4gb3B0aW9uYWwgY2FsbGluZyBjb250ZXh0IG1heSBiZSBwcm92aWRlZC4gVGhlIGRhdGEgYXJndW1lbnRzXG4gICAqIGVtaXR0ZWQgd2lsbCBiZSBwYXNzZWQgdG8gdGhlIGxpc3RlbmVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBUT0RPOiBBbm5vdGF0ZSB0aGUgbGlzdGVuZXIgYXJnJ3MgdHlwZS4gVGhpcyBpcyB0cmlja3kgYmVjYXVzZSBsaXN0ZW5lcnNcbiAgICogICAgICAgY2FuIGJlIGludm9rZWQgd2l0aCB2YXJhcmdzLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gbGlzdGVuIHRvXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gRnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gdGhlIHNwZWNpZmllZCBldmVudCBpc1xuICAgKiAgIGVtaXR0ZWRcbiAgICogQHBhcmFtIHsqfSBjb250ZXh0IC0gT3B0aW9uYWwgY29udGV4dCBvYmplY3QgdG8gdXNlIHdoZW4gaW52b2tpbmcgdGhlXG4gICAqICAgbGlzdGVuZXJcbiAgICovXG5cbiAgQmFzZUV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbiBhZGRMaXN0ZW5lcihldmVudFR5cGUsIGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgcmV0dXJuIHRoaXMuX3N1YnNjcmliZXIuYWRkU3Vic2NyaXB0aW9uKGV2ZW50VHlwZSwgbmV3IEVtaXR0ZXJTdWJzY3JpcHRpb24odGhpcy5fc3Vic2NyaWJlciwgbGlzdGVuZXIsIGNvbnRleHQpKTtcbiAgfTtcblxuICAvKipcbiAgICogU2ltaWxhciB0byBhZGRMaXN0ZW5lciwgZXhjZXB0IHRoYXQgdGhlIGxpc3RlbmVyIGlzIHJlbW92ZWQgYWZ0ZXIgaXQgaXNcbiAgICogaW52b2tlZCBvbmNlLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gbGlzdGVuIHRvXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gRnVuY3Rpb24gdG8gaW52b2tlIG9ubHkgb25jZSB3aGVuIHRoZVxuICAgKiAgIHNwZWNpZmllZCBldmVudCBpcyBlbWl0dGVkXG4gICAqIEBwYXJhbSB7Kn0gY29udGV4dCAtIE9wdGlvbmFsIGNvbnRleHQgb2JqZWN0IHRvIHVzZSB3aGVuIGludm9raW5nIHRoZVxuICAgKiAgIGxpc3RlbmVyXG4gICAqL1xuXG4gIEJhc2VFdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbiBvbmNlKGV2ZW50VHlwZSwgbGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICB2YXIgZW1pdHRlciA9IHRoaXM7XG4gICAgcmV0dXJuIHRoaXMuYWRkTGlzdGVuZXIoZXZlbnRUeXBlLCBmdW5jdGlvbiAoKSB7XG4gICAgICBlbWl0dGVyLnJlbW92ZUN1cnJlbnRMaXN0ZW5lcigpO1xuICAgICAgbGlzdGVuZXIuYXBwbHkoY29udGV4dCwgYXJndW1lbnRzKTtcbiAgICB9KTtcbiAgfTtcblxuICAvKipcbiAgICogUmVtb3ZlcyBhbGwgb2YgdGhlIHJlZ2lzdGVyZWQgbGlzdGVuZXJzLCBpbmNsdWRpbmcgdGhvc2UgcmVnaXN0ZXJlZCBhc1xuICAgKiBsaXN0ZW5lciBtYXBzLlxuICAgKlxuICAgKiBAcGFyYW0gez9zdHJpbmd9IGV2ZW50VHlwZSAtIE9wdGlvbmFsIG5hbWUgb2YgdGhlIGV2ZW50IHdob3NlIHJlZ2lzdGVyZWRcbiAgICogICBsaXN0ZW5lcnMgdG8gcmVtb3ZlXG4gICAqL1xuXG4gIEJhc2VFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uIHJlbW92ZUFsbExpc3RlbmVycyhldmVudFR5cGUpIHtcbiAgICB0aGlzLl9zdWJzY3JpYmVyLnJlbW92ZUFsbFN1YnNjcmlwdGlvbnMoZXZlbnRUeXBlKTtcbiAgfTtcblxuICAvKipcbiAgICogUHJvdmlkZXMgYW4gQVBJIHRoYXQgY2FuIGJlIGNhbGxlZCBkdXJpbmcgYW4gZXZlbnRpbmcgY3ljbGUgdG8gcmVtb3ZlIHRoZVxuICAgKiBsYXN0IGxpc3RlbmVyIHRoYXQgd2FzIGludm9rZWQuIFRoaXMgYWxsb3dzIGEgZGV2ZWxvcGVyIHRvIHByb3ZpZGUgYW4gZXZlbnRcbiAgICogb2JqZWN0IHRoYXQgY2FuIHJlbW92ZSB0aGUgbGlzdGVuZXIgKG9yIGxpc3RlbmVyIG1hcCkgZHVyaW5nIHRoZVxuICAgKiBpbnZvY2F0aW9uLlxuICAgKlxuICAgKiBJZiBpdCBpcyBjYWxsZWQgd2hlbiBub3QgaW5zaWRlIG9mIGFuIGVtaXR0aW5nIGN5Y2xlIGl0IHdpbGwgdGhyb3cuXG4gICAqXG4gICAqIEB0aHJvd3Mge0Vycm9yfSBXaGVuIGNhbGxlZCBub3QgZHVyaW5nIGFuIGV2ZW50aW5nIGN5Y2xlXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqICAgdmFyIHN1YnNjcmlwdGlvbiA9IGVtaXR0ZXIuYWRkTGlzdGVuZXJNYXAoe1xuICAgKiAgICAgc29tZUV2ZW50OiBmdW5jdGlvbihkYXRhLCBldmVudCkge1xuICAgKiAgICAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgICogICAgICAgZW1pdHRlci5yZW1vdmVDdXJyZW50TGlzdGVuZXIoKTtcbiAgICogICAgIH1cbiAgICogICB9KTtcbiAgICpcbiAgICogICBlbWl0dGVyLmVtaXQoJ3NvbWVFdmVudCcsICdhYmMnKTsgLy8gbG9ncyAnYWJjJ1xuICAgKiAgIGVtaXR0ZXIuZW1pdCgnc29tZUV2ZW50JywgJ2RlZicpOyAvLyBkb2VzIG5vdCBsb2cgYW55dGhpbmdcbiAgICovXG5cbiAgQmFzZUV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQ3VycmVudExpc3RlbmVyID0gZnVuY3Rpb24gcmVtb3ZlQ3VycmVudExpc3RlbmVyKCkge1xuICAgICEhIXRoaXMuX2N1cnJlbnRTdWJzY3JpcHRpb24gPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnTm90IGluIGFuIGVtaXR0aW5nIGN5Y2xlOyB0aGVyZSBpcyBubyBjdXJyZW50IHN1YnNjcmlwdGlvbicpIDogaW52YXJpYW50KGZhbHNlKSA6IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9zdWJzY3JpYmVyLnJlbW92ZVN1YnNjcmlwdGlvbih0aGlzLl9jdXJyZW50U3Vic2NyaXB0aW9uKTtcbiAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyBhbiBhcnJheSBvZiBsaXN0ZW5lcnMgdGhhdCBhcmUgY3VycmVudGx5IHJlZ2lzdGVyZWQgZm9yIHRoZSBnaXZlblxuICAgKiBldmVudC5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZSAtIE5hbWUgb2YgdGhlIGV2ZW50IHRvIHF1ZXJ5XG4gICAqIEByZXR1cm4ge2FycmF5fVxuICAgKi9cblxuICBCYXNlRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5saXN0ZW5lcnMgPSBmdW5jdGlvbiBsaXN0ZW5lcnMoZXZlbnRUeXBlKSAvKiBUT0RPOiBBcnJheTxFdmVudFN1YnNjcmlwdGlvbj4gKi97XG4gICAgdmFyIHN1YnNjcmlwdGlvbnMgPSB0aGlzLl9zdWJzY3JpYmVyLmdldFN1YnNjcmlwdGlvbnNGb3JUeXBlKGV2ZW50VHlwZSk7XG4gICAgcmV0dXJuIHN1YnNjcmlwdGlvbnMgPyBzdWJzY3JpcHRpb25zLmZpbHRlcihlbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zVHJ1ZSkubWFwKGZ1bmN0aW9uIChzdWJzY3JpcHRpb24pIHtcbiAgICAgIHJldHVybiBzdWJzY3JpcHRpb24ubGlzdGVuZXI7XG4gICAgfSkgOiBbXTtcbiAgfTtcblxuICAvKipcbiAgICogRW1pdHMgYW4gZXZlbnQgb2YgdGhlIGdpdmVuIHR5cGUgd2l0aCB0aGUgZ2l2ZW4gZGF0YS4gQWxsIGhhbmRsZXJzIG9mIHRoYXRcbiAgICogcGFydGljdWxhciB0eXBlIHdpbGwgYmUgbm90aWZpZWQuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBlbWl0XG4gICAqIEBwYXJhbSB7Kn0gQXJiaXRyYXJ5IGFyZ3VtZW50cyB0byBiZSBwYXNzZWQgdG8gZWFjaCByZWdpc3RlcmVkIGxpc3RlbmVyXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqICAgZW1pdHRlci5hZGRMaXN0ZW5lcignc29tZUV2ZW50JywgZnVuY3Rpb24obWVzc2FnZSkge1xuICAgKiAgICAgY29uc29sZS5sb2cobWVzc2FnZSk7XG4gICAqICAgfSk7XG4gICAqXG4gICAqICAgZW1pdHRlci5lbWl0KCdzb21lRXZlbnQnLCAnYWJjJyk7IC8vIGxvZ3MgJ2FiYydcbiAgICovXG5cbiAgQmFzZUV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uIGVtaXQoZXZlbnRUeXBlKSB7XG4gICAgdmFyIHN1YnNjcmlwdGlvbnMgPSB0aGlzLl9zdWJzY3JpYmVyLmdldFN1YnNjcmlwdGlvbnNGb3JUeXBlKGV2ZW50VHlwZSk7XG4gICAgaWYgKHN1YnNjcmlwdGlvbnMpIHtcbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMoc3Vic2NyaXB0aW9ucyk7XG4gICAgICBmb3IgKHZhciBpaSA9IDA7IGlpIDwga2V5cy5sZW5ndGg7IGlpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGtleXNbaWldO1xuICAgICAgICB2YXIgc3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9uc1trZXldO1xuICAgICAgICAvLyBUaGUgc3Vic2NyaXB0aW9uIG1heSBoYXZlIGJlZW4gcmVtb3ZlZCBkdXJpbmcgdGhpcyBldmVudCBsb29wLlxuICAgICAgICBpZiAoc3Vic2NyaXB0aW9uKSB7XG4gICAgICAgICAgdGhpcy5fY3VycmVudFN1YnNjcmlwdGlvbiA9IHN1YnNjcmlwdGlvbjtcbiAgICAgICAgICB0aGlzLl9fZW1pdFRvU3Vic2NyaXB0aW9uLmFwcGx5KHRoaXMsIFtzdWJzY3JpcHRpb25dLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHRoaXMuX2N1cnJlbnRTdWJzY3JpcHRpb24gPSBudWxsO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUHJvdmlkZXMgYSBob29rIHRvIG92ZXJyaWRlIGhvdyB0aGUgZW1pdHRlciBlbWl0cyBhbiBldmVudCB0byBhIHNwZWNpZmljXG4gICAqIHN1YnNjcmlwdGlvbi4gVGhpcyBhbGxvd3MgeW91IHRvIHNldCB1cCBsb2dnaW5nIGFuZCBlcnJvciBib3VuZGFyaWVzXG4gICAqIHNwZWNpZmljIHRvIHlvdXIgZW52aXJvbm1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7RW1pdHRlclN1YnNjcmlwdGlvbn0gc3Vic2NyaXB0aW9uXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGVcbiAgICogQHBhcmFtIHsqfSBBcmJpdHJhcnkgYXJndW1lbnRzIHRvIGJlIHBhc3NlZCB0byBlYWNoIHJlZ2lzdGVyZWQgbGlzdGVuZXJcbiAgICovXG5cbiAgQmFzZUV2ZW50RW1pdHRlci5wcm90b3R5cGUuX19lbWl0VG9TdWJzY3JpcHRpb24gPSBmdW5jdGlvbiBfX2VtaXRUb1N1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24sIGV2ZW50VHlwZSkge1xuICAgIHZhciBhcmdzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKTtcbiAgICBzdWJzY3JpcHRpb24ubGlzdGVuZXIuYXBwbHkoc3Vic2NyaXB0aW9uLmNvbnRleHQsIGFyZ3MpO1xuICB9O1xuXG4gIHJldHVybiBCYXNlRXZlbnRFbWl0dGVyO1xufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBCYXNlRXZlbnRFbWl0dGVyOyIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqIFxuICogQHByb3ZpZGVzTW9kdWxlIEVtaXR0ZXJTdWJzY3JpcHRpb25cbiAqIEB0eXBlY2hlY2tzXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxudmFyIEV2ZW50U3Vic2NyaXB0aW9uID0gcmVxdWlyZSgnLi9FdmVudFN1YnNjcmlwdGlvbicpO1xuXG4vKipcbiAqIEVtaXR0ZXJTdWJzY3JpcHRpb24gcmVwcmVzZW50cyBhIHN1YnNjcmlwdGlvbiB3aXRoIGxpc3RlbmVyIGFuZCBjb250ZXh0IGRhdGEuXG4gKi9cblxudmFyIEVtaXR0ZXJTdWJzY3JpcHRpb24gPSAoZnVuY3Rpb24gKF9FdmVudFN1YnNjcmlwdGlvbikge1xuICBfaW5oZXJpdHMoRW1pdHRlclN1YnNjcmlwdGlvbiwgX0V2ZW50U3Vic2NyaXB0aW9uKTtcblxuICAvKipcbiAgICogQHBhcmFtIHtFdmVudFN1YnNjcmlwdGlvblZlbmRvcn0gc3Vic2NyaWJlciAtIFRoZSBzdWJzY3JpYmVyIHRoYXQgY29udHJvbHNcbiAgICogICB0aGlzIHN1YnNjcmlwdGlvblxuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIEZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIHRoZSBzcGVjaWZpZWQgZXZlbnQgaXNcbiAgICogICBlbWl0dGVkXG4gICAqIEBwYXJhbSB7Kn0gY29udGV4dCAtIE9wdGlvbmFsIGNvbnRleHQgb2JqZWN0IHRvIHVzZSB3aGVuIGludm9raW5nIHRoZVxuICAgKiAgIGxpc3RlbmVyXG4gICAqL1xuXG4gIGZ1bmN0aW9uIEVtaXR0ZXJTdWJzY3JpcHRpb24oc3Vic2NyaWJlciwgbGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRW1pdHRlclN1YnNjcmlwdGlvbik7XG5cbiAgICBfRXZlbnRTdWJzY3JpcHRpb24uY2FsbCh0aGlzLCBzdWJzY3JpYmVyKTtcbiAgICB0aGlzLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgfVxuXG4gIHJldHVybiBFbWl0dGVyU3Vic2NyaXB0aW9uO1xufSkoRXZlbnRTdWJzY3JpcHRpb24pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVtaXR0ZXJTdWJzY3JpcHRpb247IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIEBwcm92aWRlc01vZHVsZSBFdmVudFN1YnNjcmlwdGlvblxuICogQHR5cGVjaGVja3NcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogRXZlbnRTdWJzY3JpcHRpb24gcmVwcmVzZW50cyBhIHN1YnNjcmlwdGlvbiB0byBhIHBhcnRpY3VsYXIgZXZlbnQuIEl0IGNhblxuICogcmVtb3ZlIGl0cyBvd24gc3Vic2NyaXB0aW9uLlxuICovXG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG52YXIgRXZlbnRTdWJzY3JpcHRpb24gPSAoZnVuY3Rpb24gKCkge1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0V2ZW50U3Vic2NyaXB0aW9uVmVuZG9yfSBzdWJzY3JpYmVyIHRoZSBzdWJzY3JpYmVyIHRoYXQgY29udHJvbHNcbiAgICogICB0aGlzIHN1YnNjcmlwdGlvbi5cbiAgICovXG5cbiAgZnVuY3Rpb24gRXZlbnRTdWJzY3JpcHRpb24oc3Vic2NyaWJlcikge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBFdmVudFN1YnNjcmlwdGlvbik7XG5cbiAgICB0aGlzLnN1YnNjcmliZXIgPSBzdWJzY3JpYmVyO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgdGhpcyBzdWJzY3JpcHRpb24gZnJvbSB0aGUgc3Vic2NyaWJlciB0aGF0IGNvbnRyb2xzIGl0LlxuICAgKi9cblxuICBFdmVudFN1YnNjcmlwdGlvbi5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gcmVtb3ZlKCkge1xuICAgIGlmICh0aGlzLnN1YnNjcmliZXIpIHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlci5yZW1vdmVTdWJzY3JpcHRpb24odGhpcyk7XG4gICAgICB0aGlzLnN1YnNjcmliZXIgPSBudWxsO1xuICAgIH1cbiAgfTtcblxuICByZXR1cm4gRXZlbnRTdWJzY3JpcHRpb247XG59KSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50U3Vic2NyaXB0aW9uOyIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqIFxuICogQHByb3ZpZGVzTW9kdWxlIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yXG4gKiBAdHlwZWNoZWNrc1xuICovXG5cbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBpbnZhcmlhbnQgPSByZXF1aXJlKCdmYmpzL2xpYi9pbnZhcmlhbnQnKTtcblxuLyoqXG4gKiBFdmVudFN1YnNjcmlwdGlvblZlbmRvciBzdG9yZXMgYSBzZXQgb2YgRXZlbnRTdWJzY3JpcHRpb25zIHRoYXQgYXJlXG4gKiBzdWJzY3JpYmVkIHRvIGEgcGFydGljdWxhciBldmVudCB0eXBlLlxuICovXG5cbnZhciBFdmVudFN1YnNjcmlwdGlvblZlbmRvciA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yKCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBFdmVudFN1YnNjcmlwdGlvblZlbmRvcik7XG5cbiAgICB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZSA9IHt9O1xuICAgIHRoaXMuX2N1cnJlbnRTdWJzY3JpcHRpb24gPSBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgYSBzdWJzY3JpcHRpb24ga2V5ZWQgYnkgYW4gZXZlbnQgdHlwZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZVxuICAgKiBAcGFyYW0ge0V2ZW50U3Vic2NyaXB0aW9ufSBzdWJzY3JpcHRpb25cbiAgICovXG5cbiAgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IucHJvdG90eXBlLmFkZFN1YnNjcmlwdGlvbiA9IGZ1bmN0aW9uIGFkZFN1YnNjcmlwdGlvbihldmVudFR5cGUsIHN1YnNjcmlwdGlvbikge1xuICAgICEoc3Vic2NyaXB0aW9uLnN1YnNjcmliZXIgPT09IHRoaXMpID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ1RoZSBzdWJzY3JpYmVyIG9mIHRoZSBzdWJzY3JpcHRpb24gaXMgaW5jb3JyZWN0bHkgc2V0LicpIDogaW52YXJpYW50KGZhbHNlKSA6IHVuZGVmaW5lZDtcbiAgICBpZiAoIXRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlW2V2ZW50VHlwZV0pIHtcbiAgICAgIHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlW2V2ZW50VHlwZV0gPSBbXTtcbiAgICB9XG4gICAgdmFyIGtleSA9IHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlW2V2ZW50VHlwZV0ubGVuZ3RoO1xuICAgIHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlW2V2ZW50VHlwZV0ucHVzaChzdWJzY3JpcHRpb24pO1xuICAgIHN1YnNjcmlwdGlvbi5ldmVudFR5cGUgPSBldmVudFR5cGU7XG4gICAgc3Vic2NyaXB0aW9uLmtleSA9IGtleTtcbiAgICByZXR1cm4gc3Vic2NyaXB0aW9uO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgYnVsayBzZXQgb2YgdGhlIHN1YnNjcmlwdGlvbnMuXG4gICAqXG4gICAqIEBwYXJhbSB7P3N0cmluZ30gZXZlbnRUeXBlIC0gT3B0aW9uYWwgbmFtZSBvZiB0aGUgZXZlbnQgdHlwZSB3aG9zZVxuICAgKiAgIHJlZ2lzdGVyZWQgc3Vwc2NyaXB0aW9ucyB0byByZW1vdmUsIGlmIG51bGwgcmVtb3ZlIGFsbCBzdWJzY3JpcHRpb25zLlxuICAgKi9cblxuICBFdmVudFN1YnNjcmlwdGlvblZlbmRvci5wcm90b3R5cGUucmVtb3ZlQWxsU3Vic2NyaXB0aW9ucyA9IGZ1bmN0aW9uIHJlbW92ZUFsbFN1YnNjcmlwdGlvbnMoZXZlbnRUeXBlKSB7XG4gICAgaWYgKGV2ZW50VHlwZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZSA9IHt9O1xuICAgIH0gZWxzZSB7XG4gICAgICBkZWxldGUgdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGVbZXZlbnRUeXBlXTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBzcGVjaWZpYyBzdWJzY3JpcHRpb24uIEluc3RlYWQgb2YgY2FsbGluZyB0aGlzIGZ1bmN0aW9uLCBjYWxsXG4gICAqIGBzdWJzY3JpcHRpb24ucmVtb3ZlKClgIGRpcmVjdGx5LlxuICAgKlxuICAgKiBAcGFyYW0ge29iamVjdH0gc3Vic2NyaXB0aW9uXG4gICAqL1xuXG4gIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yLnByb3RvdHlwZS5yZW1vdmVTdWJzY3JpcHRpb24gPSBmdW5jdGlvbiByZW1vdmVTdWJzY3JpcHRpb24oc3Vic2NyaXB0aW9uKSB7XG4gICAgdmFyIGV2ZW50VHlwZSA9IHN1YnNjcmlwdGlvbi5ldmVudFR5cGU7XG4gICAgdmFyIGtleSA9IHN1YnNjcmlwdGlvbi5rZXk7XG5cbiAgICB2YXIgc3Vic2NyaXB0aW9uc0ZvclR5cGUgPSB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZVtldmVudFR5cGVdO1xuICAgIGlmIChzdWJzY3JpcHRpb25zRm9yVHlwZSkge1xuICAgICAgZGVsZXRlIHN1YnNjcmlwdGlvbnNGb3JUeXBlW2tleV07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSBhcnJheSBvZiBzdWJzY3JpcHRpb25zIHRoYXQgYXJlIGN1cnJlbnRseSByZWdpc3RlcmVkIGZvciB0aGVcbiAgICogZ2l2ZW4gZXZlbnQgdHlwZS5cbiAgICpcbiAgICogTm90ZTogVGhpcyBhcnJheSBjYW4gYmUgcG90ZW50aWFsbHkgc3BhcnNlIGFzIHN1YnNjcmlwdGlvbnMgYXJlIGRlbGV0ZWRcbiAgICogZnJvbSBpdCB3aGVuIHRoZXkgYXJlIHJlbW92ZWQuXG4gICAqXG4gICAqIFRPRE86IFRoaXMgcmV0dXJucyBhIG51bGxhYmxlIGFycmF5LiB3YXQ/XG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGVcbiAgICogQHJldHVybiB7P2FycmF5fVxuICAgKi9cblxuICBFdmVudFN1YnNjcmlwdGlvblZlbmRvci5wcm90b3R5cGUuZ2V0U3Vic2NyaXB0aW9uc0ZvclR5cGUgPSBmdW5jdGlvbiBnZXRTdWJzY3JpcHRpb25zRm9yVHlwZShldmVudFR5cGUpIHtcbiAgICByZXR1cm4gdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGVbZXZlbnRUeXBlXTtcbiAgfTtcblxuICByZXR1cm4gRXZlbnRTdWJzY3JpcHRpb25WZW5kb3I7XG59KSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yOyIsIlwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqIENvcHlyaWdodCAoYykgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLlxuICpcbiAqIFxuICovXG5cbmZ1bmN0aW9uIG1ha2VFbXB0eUZ1bmN0aW9uKGFyZykge1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBhcmc7XG4gIH07XG59XG5cbi8qKlxuICogVGhpcyBmdW5jdGlvbiBhY2NlcHRzIGFuZCBkaXNjYXJkcyBpbnB1dHM7IGl0IGhhcyBubyBzaWRlIGVmZmVjdHMuIFRoaXMgaXNcbiAqIHByaW1hcmlseSB1c2VmdWwgaWRpb21hdGljYWxseSBmb3Igb3ZlcnJpZGFibGUgZnVuY3Rpb24gZW5kcG9pbnRzIHdoaWNoXG4gKiBhbHdheXMgbmVlZCB0byBiZSBjYWxsYWJsZSwgc2luY2UgSlMgbGFja3MgYSBudWxsLWNhbGwgaWRpb20gYWxhIENvY29hLlxuICovXG52YXIgZW1wdHlGdW5jdGlvbiA9IGZ1bmN0aW9uIGVtcHR5RnVuY3Rpb24oKSB7fTtcblxuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJucyA9IG1ha2VFbXB0eUZ1bmN0aW9uO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc0ZhbHNlID0gbWFrZUVtcHR5RnVuY3Rpb24oZmFsc2UpO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc1RydWUgPSBtYWtlRW1wdHlGdW5jdGlvbih0cnVlKTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNOdWxsID0gbWFrZUVtcHR5RnVuY3Rpb24obnVsbCk7XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zVGhpcyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXM7XG59O1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc0FyZ3VtZW50ID0gZnVuY3Rpb24gKGFyZykge1xuICByZXR1cm4gYXJnO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBlbXB0eUZ1bmN0aW9uOyIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuXG4gKlxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBVc2UgaW52YXJpYW50KCkgdG8gYXNzZXJ0IHN0YXRlIHdoaWNoIHlvdXIgcHJvZ3JhbSBhc3N1bWVzIHRvIGJlIHRydWUuXG4gKlxuICogUHJvdmlkZSBzcHJpbnRmLXN0eWxlIGZvcm1hdCAob25seSAlcyBpcyBzdXBwb3J0ZWQpIGFuZCBhcmd1bWVudHNcbiAqIHRvIHByb3ZpZGUgaW5mb3JtYXRpb24gYWJvdXQgd2hhdCBicm9rZSBhbmQgd2hhdCB5b3Ugd2VyZVxuICogZXhwZWN0aW5nLlxuICpcbiAqIFRoZSBpbnZhcmlhbnQgbWVzc2FnZSB3aWxsIGJlIHN0cmlwcGVkIGluIHByb2R1Y3Rpb24sIGJ1dCB0aGUgaW52YXJpYW50XG4gKiB3aWxsIHJlbWFpbiB0byBlbnN1cmUgbG9naWMgZG9lcyBub3QgZGlmZmVyIGluIHByb2R1Y3Rpb24uXG4gKi9cblxudmFyIHZhbGlkYXRlRm9ybWF0ID0gZnVuY3Rpb24gdmFsaWRhdGVGb3JtYXQoZm9ybWF0KSB7fTtcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdmFsaWRhdGVGb3JtYXQgPSBmdW5jdGlvbiB2YWxpZGF0ZUZvcm1hdChmb3JtYXQpIHtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW52YXJpYW50IHJlcXVpcmVzIGFuIGVycm9yIG1lc3NhZ2UgYXJndW1lbnQnKTtcbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIGludmFyaWFudChjb25kaXRpb24sIGZvcm1hdCwgYSwgYiwgYywgZCwgZSwgZikge1xuICB2YWxpZGF0ZUZvcm1hdChmb3JtYXQpO1xuXG4gIGlmICghY29uZGl0aW9uKSB7XG4gICAgdmFyIGVycm9yO1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoJ01pbmlmaWVkIGV4Y2VwdGlvbiBvY2N1cnJlZDsgdXNlIHRoZSBub24tbWluaWZpZWQgZGV2IGVudmlyb25tZW50ICcgKyAnZm9yIHRoZSBmdWxsIGVycm9yIG1lc3NhZ2UgYW5kIGFkZGl0aW9uYWwgaGVscGZ1bCB3YXJuaW5ncy4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGFyZ3MgPSBbYSwgYiwgYywgZCwgZSwgZl07XG4gICAgICB2YXIgYXJnSW5kZXggPSAwO1xuICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoZm9ybWF0LnJlcGxhY2UoLyVzL2csIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGFyZ3NbYXJnSW5kZXgrK107XG4gICAgICB9KSk7XG4gICAgICBlcnJvci5uYW1lID0gJ0ludmFyaWFudCBWaW9sYXRpb24nO1xuICAgIH1cblxuICAgIGVycm9yLmZyYW1lc1RvUG9wID0gMTsgLy8gd2UgZG9uJ3QgY2FyZSBhYm91dCBpbnZhcmlhbnQncyBvd24gZnJhbWVcbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGludmFyaWFudDsiLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxuLy8gY2FjaGVkIGZyb20gd2hhdGV2ZXIgZ2xvYmFsIGlzIHByZXNlbnQgc28gdGhhdCB0ZXN0IHJ1bm5lcnMgdGhhdCBzdHViIGl0XG4vLyBkb24ndCBicmVhayB0aGluZ3MuICBCdXQgd2UgbmVlZCB0byB3cmFwIGl0IGluIGEgdHJ5IGNhdGNoIGluIGNhc2UgaXQgaXNcbi8vIHdyYXBwZWQgaW4gc3RyaWN0IG1vZGUgY29kZSB3aGljaCBkb2Vzbid0IGRlZmluZSBhbnkgZ2xvYmFscy4gIEl0J3MgaW5zaWRlIGFcbi8vIGZ1bmN0aW9uIGJlY2F1c2UgdHJ5L2NhdGNoZXMgZGVvcHRpbWl6ZSBpbiBjZXJ0YWluIGVuZ2luZXMuXG5cbnZhciBjYWNoZWRTZXRUaW1lb3V0O1xudmFyIGNhY2hlZENsZWFyVGltZW91dDtcblxuZnVuY3Rpb24gZGVmYXVsdFNldFRpbW91dCgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3NldFRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbmZ1bmN0aW9uIGRlZmF1bHRDbGVhclRpbWVvdXQgKCkge1xuICAgIHRocm93IG5ldyBFcnJvcignY2xlYXJUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG4oZnVuY3Rpb24gKCkge1xuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2V0VGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGlmICh0eXBlb2YgY2xlYXJUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBkZWZhdWx0Q2xlYXJUaW1lb3V0O1xuICAgIH1cbn0gKCkpXG5mdW5jdGlvbiBydW5UaW1lb3V0KGZ1bikge1xuICAgIGlmIChjYWNoZWRTZXRUaW1lb3V0ID09PSBzZXRUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICAvLyBpZiBzZXRUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkU2V0VGltZW91dCA9PT0gZGVmYXVsdFNldFRpbW91dCB8fCAhY2FjaGVkU2V0VGltZW91dCkgJiYgc2V0VGltZW91dCkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dChmdW4sIDApO1xuICAgIH0gY2F0Y2goZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwobnVsbCwgZnVuLCAwKTtcbiAgICAgICAgfSBjYXRjaChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yXG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKHRoaXMsIGZ1biwgMCk7XG4gICAgICAgIH1cbiAgICB9XG5cblxufVxuZnVuY3Rpb24gcnVuQ2xlYXJUaW1lb3V0KG1hcmtlcikge1xuICAgIGlmIChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGNsZWFyVGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICAvLyBpZiBjbGVhclRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRDbGVhclRpbWVvdXQgPT09IGRlZmF1bHRDbGVhclRpbWVvdXQgfHwgIWNhY2hlZENsZWFyVGltZW91dCkgJiYgY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgcmV0dXJuIGNsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCAgdHJ1c3QgdGhlIGdsb2JhbCBvYmplY3Qgd2hlbiBjYWxsZWQgbm9ybWFsbHlcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbChudWxsLCBtYXJrZXIpO1xuICAgICAgICB9IGNhdGNoIChlKXtcbiAgICAgICAgICAgIC8vIHNhbWUgYXMgYWJvdmUgYnV0IHdoZW4gaXQncyBhIHZlcnNpb24gb2YgSS5FLiB0aGF0IG11c3QgaGF2ZSB0aGUgZ2xvYmFsIG9iamVjdCBmb3IgJ3RoaXMnLCBob3BmdWxseSBvdXIgY29udGV4dCBjb3JyZWN0IG90aGVyd2lzZSBpdCB3aWxsIHRocm93IGEgZ2xvYmFsIGVycm9yLlxuICAgICAgICAgICAgLy8gU29tZSB2ZXJzaW9ucyBvZiBJLkUuIGhhdmUgZGlmZmVyZW50IHJ1bGVzIGZvciBjbGVhclRpbWVvdXQgdnMgc2V0VGltZW91dFxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKHRoaXMsIG1hcmtlcik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuXG59XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBpZiAoIWRyYWluaW5nIHx8ICFjdXJyZW50UXVldWUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBydW5UaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBydW5DbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBydW5UaW1lb3V0KGRyYWluUXVldWUpO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnByZXBlbmRPbmNlTGlzdGVuZXIgPSBub29wO1xuXG5wcm9jZXNzLmxpc3RlbmVycyA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBbXSB9XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiLyohIHRldGhlciAxLjQuNCAqL1xuXG4oZnVuY3Rpb24ocm9vdCwgZmFjdG9yeSkge1xuICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kKSB7XG4gICAgZGVmaW5lKFtdLCBmYWN0b3J5KTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTtcbiAgfSBlbHNlIHtcbiAgICByb290LlRldGhlciA9IGZhY3RvcnkoKTtcbiAgfVxufSh0aGlzLCBmdW5jdGlvbigpIHtcblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpO1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIFRldGhlckJhc2UgPSB1bmRlZmluZWQ7XG5pZiAodHlwZW9mIFRldGhlckJhc2UgPT09ICd1bmRlZmluZWQnKSB7XG4gIFRldGhlckJhc2UgPSB7IG1vZHVsZXM6IFtdIH07XG59XG5cbnZhciB6ZXJvRWxlbWVudCA9IG51bGw7XG5cbi8vIFNhbWUgYXMgbmF0aXZlIGdldEJvdW5kaW5nQ2xpZW50UmVjdCwgZXhjZXB0IGl0IHRha2VzIGludG8gYWNjb3VudCBwYXJlbnQgPGZyYW1lPiBvZmZzZXRzXG4vLyBpZiB0aGUgZWxlbWVudCBsaWVzIHdpdGhpbiBhIG5lc3RlZCBkb2N1bWVudCAoPGZyYW1lPiBvciA8aWZyYW1lPi1saWtlKS5cbmZ1bmN0aW9uIGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdChub2RlKSB7XG4gIHZhciBib3VuZGluZ1JlY3QgPSBub2RlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXG4gIC8vIFRoZSBvcmlnaW5hbCBvYmplY3QgcmV0dXJuZWQgYnkgZ2V0Qm91bmRpbmdDbGllbnRSZWN0IGlzIGltbXV0YWJsZSwgc28gd2UgY2xvbmUgaXRcbiAgLy8gV2UgY2FuJ3QgdXNlIGV4dGVuZCBiZWNhdXNlIHRoZSBwcm9wZXJ0aWVzIGFyZSBub3QgY29uc2lkZXJlZCBwYXJ0IG9mIHRoZSBvYmplY3QgYnkgaGFzT3duUHJvcGVydHkgaW4gSUU5XG4gIHZhciByZWN0ID0ge307XG4gIGZvciAodmFyIGsgaW4gYm91bmRpbmdSZWN0KSB7XG4gICAgcmVjdFtrXSA9IGJvdW5kaW5nUmVjdFtrXTtcbiAgfVxuXG4gIGlmIChub2RlLm93bmVyRG9jdW1lbnQgIT09IGRvY3VtZW50KSB7XG4gICAgdmFyIF9mcmFtZUVsZW1lbnQgPSBub2RlLm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuZnJhbWVFbGVtZW50O1xuICAgIGlmIChfZnJhbWVFbGVtZW50KSB7XG4gICAgICB2YXIgZnJhbWVSZWN0ID0gZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0KF9mcmFtZUVsZW1lbnQpO1xuICAgICAgcmVjdC50b3AgKz0gZnJhbWVSZWN0LnRvcDtcbiAgICAgIHJlY3QuYm90dG9tICs9IGZyYW1lUmVjdC50b3A7XG4gICAgICByZWN0LmxlZnQgKz0gZnJhbWVSZWN0LmxlZnQ7XG4gICAgICByZWN0LnJpZ2h0ICs9IGZyYW1lUmVjdC5sZWZ0O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWN0O1xufVxuXG5mdW5jdGlvbiBnZXRTY3JvbGxQYXJlbnRzKGVsKSB7XG4gIC8vIEluIGZpcmVmb3ggaWYgdGhlIGVsIGlzIGluc2lkZSBhbiBpZnJhbWUgd2l0aCBkaXNwbGF5OiBub25lOyB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZSgpIHdpbGwgcmV0dXJuIG51bGw7XG4gIC8vIGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTU0ODM5N1xuICB2YXIgY29tcHV0ZWRTdHlsZSA9IGdldENvbXB1dGVkU3R5bGUoZWwpIHx8IHt9O1xuICB2YXIgcG9zaXRpb24gPSBjb21wdXRlZFN0eWxlLnBvc2l0aW9uO1xuICB2YXIgcGFyZW50cyA9IFtdO1xuXG4gIGlmIChwb3NpdGlvbiA9PT0gJ2ZpeGVkJykge1xuICAgIHJldHVybiBbZWxdO1xuICB9XG5cbiAgdmFyIHBhcmVudCA9IGVsO1xuICB3aGlsZSAoKHBhcmVudCA9IHBhcmVudC5wYXJlbnROb2RlKSAmJiBwYXJlbnQgJiYgcGFyZW50Lm5vZGVUeXBlID09PSAxKSB7XG4gICAgdmFyIHN0eWxlID0gdW5kZWZpbmVkO1xuICAgIHRyeSB7XG4gICAgICBzdHlsZSA9IGdldENvbXB1dGVkU3R5bGUocGFyZW50KTtcbiAgICB9IGNhdGNoIChlcnIpIHt9XG5cbiAgICBpZiAodHlwZW9mIHN0eWxlID09PSAndW5kZWZpbmVkJyB8fCBzdHlsZSA9PT0gbnVsbCkge1xuICAgICAgcGFyZW50cy5wdXNoKHBhcmVudCk7XG4gICAgICByZXR1cm4gcGFyZW50cztcbiAgICB9XG5cbiAgICB2YXIgX3N0eWxlID0gc3R5bGU7XG4gICAgdmFyIG92ZXJmbG93ID0gX3N0eWxlLm92ZXJmbG93O1xuICAgIHZhciBvdmVyZmxvd1ggPSBfc3R5bGUub3ZlcmZsb3dYO1xuICAgIHZhciBvdmVyZmxvd1kgPSBfc3R5bGUub3ZlcmZsb3dZO1xuXG4gICAgaWYgKC8oYXV0b3xzY3JvbGx8b3ZlcmxheSkvLnRlc3Qob3ZlcmZsb3cgKyBvdmVyZmxvd1kgKyBvdmVyZmxvd1gpKSB7XG4gICAgICBpZiAocG9zaXRpb24gIT09ICdhYnNvbHV0ZScgfHwgWydyZWxhdGl2ZScsICdhYnNvbHV0ZScsICdmaXhlZCddLmluZGV4T2Yoc3R5bGUucG9zaXRpb24pID49IDApIHtcbiAgICAgICAgcGFyZW50cy5wdXNoKHBhcmVudCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGFyZW50cy5wdXNoKGVsLm93bmVyRG9jdW1lbnQuYm9keSk7XG5cbiAgLy8gSWYgdGhlIG5vZGUgaXMgd2l0aGluIGEgZnJhbWUsIGFjY291bnQgZm9yIHRoZSBwYXJlbnQgd2luZG93IHNjcm9sbFxuICBpZiAoZWwub3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICBwYXJlbnRzLnB1c2goZWwub3duZXJEb2N1bWVudC5kZWZhdWx0Vmlldyk7XG4gIH1cblxuICByZXR1cm4gcGFyZW50cztcbn1cblxudmFyIHVuaXF1ZUlkID0gKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGlkID0gMDtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gKytpZDtcbiAgfTtcbn0pKCk7XG5cbnZhciB6ZXJvUG9zQ2FjaGUgPSB7fTtcbnZhciBnZXRPcmlnaW4gPSBmdW5jdGlvbiBnZXRPcmlnaW4oKSB7XG4gIC8vIGdldEJvdW5kaW5nQ2xpZW50UmVjdCBpcyB1bmZvcnR1bmF0ZWx5IHRvbyBhY2N1cmF0ZS4gIEl0IGludHJvZHVjZXMgYSBwaXhlbCBvciB0d28gb2ZcbiAgLy8gaml0dGVyIGFzIHRoZSB1c2VyIHNjcm9sbHMgdGhhdCBtZXNzZXMgd2l0aCBvdXIgYWJpbGl0eSB0byBkZXRlY3QgaWYgdHdvIHBvc2l0aW9uc1xuICAvLyBhcmUgZXF1aXZpbGFudCBvciBub3QuICBXZSBwbGFjZSBhbiBlbGVtZW50IGF0IHRoZSB0b3AgbGVmdCBvZiB0aGUgcGFnZSB0aGF0IHdpbGxcbiAgLy8gZ2V0IHRoZSBzYW1lIGppdHRlciwgc28gd2UgY2FuIGNhbmNlbCB0aGUgdHdvIG91dC5cbiAgdmFyIG5vZGUgPSB6ZXJvRWxlbWVudDtcbiAgaWYgKCFub2RlIHx8ICFkb2N1bWVudC5ib2R5LmNvbnRhaW5zKG5vZGUpKSB7XG4gICAgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIG5vZGUuc2V0QXR0cmlidXRlKCdkYXRhLXRldGhlci1pZCcsIHVuaXF1ZUlkKCkpO1xuICAgIGV4dGVuZChub2RlLnN0eWxlLCB7XG4gICAgICB0b3A6IDAsXG4gICAgICBsZWZ0OiAwLFxuICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZSdcbiAgICB9KTtcblxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSk7XG5cbiAgICB6ZXJvRWxlbWVudCA9IG5vZGU7XG4gIH1cblxuICB2YXIgaWQgPSBub2RlLmdldEF0dHJpYnV0ZSgnZGF0YS10ZXRoZXItaWQnKTtcbiAgaWYgKHR5cGVvZiB6ZXJvUG9zQ2FjaGVbaWRdID09PSAndW5kZWZpbmVkJykge1xuICAgIHplcm9Qb3NDYWNoZVtpZF0gPSBnZXRBY3R1YWxCb3VuZGluZ0NsaWVudFJlY3Qobm9kZSk7XG5cbiAgICAvLyBDbGVhciB0aGUgY2FjaGUgd2hlbiB0aGlzIHBvc2l0aW9uIGNhbGwgaXMgZG9uZVxuICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgIGRlbGV0ZSB6ZXJvUG9zQ2FjaGVbaWRdO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHplcm9Qb3NDYWNoZVtpZF07XG59O1xuXG5mdW5jdGlvbiByZW1vdmVVdGlsRWxlbWVudHMoKSB7XG4gIGlmICh6ZXJvRWxlbWVudCkge1xuICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQoemVyb0VsZW1lbnQpO1xuICB9XG4gIHplcm9FbGVtZW50ID0gbnVsbDtcbn07XG5cbmZ1bmN0aW9uIGdldEJvdW5kcyhlbCkge1xuICB2YXIgZG9jID0gdW5kZWZpbmVkO1xuICBpZiAoZWwgPT09IGRvY3VtZW50KSB7XG4gICAgZG9jID0gZG9jdW1lbnQ7XG4gICAgZWwgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gIH0gZWxzZSB7XG4gICAgZG9jID0gZWwub3duZXJEb2N1bWVudDtcbiAgfVxuXG4gIHZhciBkb2NFbCA9IGRvYy5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgdmFyIGJveCA9IGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdChlbCk7XG5cbiAgdmFyIG9yaWdpbiA9IGdldE9yaWdpbigpO1xuXG4gIGJveC50b3AgLT0gb3JpZ2luLnRvcDtcbiAgYm94LmxlZnQgLT0gb3JpZ2luLmxlZnQ7XG5cbiAgaWYgKHR5cGVvZiBib3gud2lkdGggPT09ICd1bmRlZmluZWQnKSB7XG4gICAgYm94LndpZHRoID0gZG9jdW1lbnQuYm9keS5zY3JvbGxXaWR0aCAtIGJveC5sZWZ0IC0gYm94LnJpZ2h0O1xuICB9XG4gIGlmICh0eXBlb2YgYm94LmhlaWdodCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBib3guaGVpZ2h0ID0gZG9jdW1lbnQuYm9keS5zY3JvbGxIZWlnaHQgLSBib3gudG9wIC0gYm94LmJvdHRvbTtcbiAgfVxuXG4gIGJveC50b3AgPSBib3gudG9wIC0gZG9jRWwuY2xpZW50VG9wO1xuICBib3gubGVmdCA9IGJveC5sZWZ0IC0gZG9jRWwuY2xpZW50TGVmdDtcbiAgYm94LnJpZ2h0ID0gZG9jLmJvZHkuY2xpZW50V2lkdGggLSBib3gud2lkdGggLSBib3gubGVmdDtcbiAgYm94LmJvdHRvbSA9IGRvYy5ib2R5LmNsaWVudEhlaWdodCAtIGJveC5oZWlnaHQgLSBib3gudG9wO1xuXG4gIHJldHVybiBib3g7XG59XG5cbmZ1bmN0aW9uIGdldE9mZnNldFBhcmVudChlbCkge1xuICByZXR1cm4gZWwub2Zmc2V0UGFyZW50IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcbn1cblxudmFyIF9zY3JvbGxCYXJTaXplID0gbnVsbDtcbmZ1bmN0aW9uIGdldFNjcm9sbEJhclNpemUoKSB7XG4gIGlmIChfc2Nyb2xsQmFyU2l6ZSkge1xuICAgIHJldHVybiBfc2Nyb2xsQmFyU2l6ZTtcbiAgfVxuICB2YXIgaW5uZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgaW5uZXIuc3R5bGUud2lkdGggPSAnMTAwJSc7XG4gIGlubmVyLnN0eWxlLmhlaWdodCA9ICcyMDBweCc7XG5cbiAgdmFyIG91dGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGV4dGVuZChvdXRlci5zdHlsZSwge1xuICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxuICAgIHRvcDogMCxcbiAgICBsZWZ0OiAwLFxuICAgIHBvaW50ZXJFdmVudHM6ICdub25lJyxcbiAgICB2aXNpYmlsaXR5OiAnaGlkZGVuJyxcbiAgICB3aWR0aDogJzIwMHB4JyxcbiAgICBoZWlnaHQ6ICcxNTBweCcsXG4gICAgb3ZlcmZsb3c6ICdoaWRkZW4nXG4gIH0pO1xuXG4gIG91dGVyLmFwcGVuZENoaWxkKGlubmVyKTtcblxuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG91dGVyKTtcblxuICB2YXIgd2lkdGhDb250YWluZWQgPSBpbm5lci5vZmZzZXRXaWR0aDtcbiAgb3V0ZXIuc3R5bGUub3ZlcmZsb3cgPSAnc2Nyb2xsJztcbiAgdmFyIHdpZHRoU2Nyb2xsID0gaW5uZXIub2Zmc2V0V2lkdGg7XG5cbiAgaWYgKHdpZHRoQ29udGFpbmVkID09PSB3aWR0aFNjcm9sbCkge1xuICAgIHdpZHRoU2Nyb2xsID0gb3V0ZXIuY2xpZW50V2lkdGg7XG4gIH1cblxuICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKG91dGVyKTtcblxuICB2YXIgd2lkdGggPSB3aWR0aENvbnRhaW5lZCAtIHdpZHRoU2Nyb2xsO1xuXG4gIF9zY3JvbGxCYXJTaXplID0geyB3aWR0aDogd2lkdGgsIGhlaWdodDogd2lkdGggfTtcbiAgcmV0dXJuIF9zY3JvbGxCYXJTaXplO1xufVxuXG5mdW5jdGlvbiBleHRlbmQoKSB7XG4gIHZhciBvdXQgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1swXTtcblxuICB2YXIgYXJncyA9IFtdO1xuXG4gIEFycmF5LnByb3RvdHlwZS5wdXNoLmFwcGx5KGFyZ3MsIGFyZ3VtZW50cyk7XG5cbiAgYXJncy5zbGljZSgxKS5mb3JFYWNoKGZ1bmN0aW9uIChvYmopIHtcbiAgICBpZiAob2JqKSB7XG4gICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIGlmICgoe30pLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpKSB7XG4gICAgICAgICAgb3V0W2tleV0gPSBvYmpba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlQ2xhc3MoZWwsIG5hbWUpIHtcbiAgaWYgKHR5cGVvZiBlbC5jbGFzc0xpc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbmFtZS5zcGxpdCgnICcpLmZvckVhY2goZnVuY3Rpb24gKGNscykge1xuICAgICAgaWYgKGNscy50cmltKCkpIHtcbiAgICAgICAgZWwuY2xhc3NMaXN0LnJlbW92ZShjbHMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHZhciByZWdleCA9IG5ldyBSZWdFeHAoJyhefCApJyArIG5hbWUuc3BsaXQoJyAnKS5qb2luKCd8JykgKyAnKCB8JCknLCAnZ2knKTtcbiAgICB2YXIgY2xhc3NOYW1lID0gZ2V0Q2xhc3NOYW1lKGVsKS5yZXBsYWNlKHJlZ2V4LCAnICcpO1xuICAgIHNldENsYXNzTmFtZShlbCwgY2xhc3NOYW1lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhZGRDbGFzcyhlbCwgbmFtZSkge1xuICBpZiAodHlwZW9mIGVsLmNsYXNzTGlzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBuYW1lLnNwbGl0KCcgJykuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgICBpZiAoY2xzLnRyaW0oKSkge1xuICAgICAgICBlbC5jbGFzc0xpc3QuYWRkKGNscyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgcmVtb3ZlQ2xhc3MoZWwsIG5hbWUpO1xuICAgIHZhciBjbHMgPSBnZXRDbGFzc05hbWUoZWwpICsgKCcgJyArIG5hbWUpO1xuICAgIHNldENsYXNzTmFtZShlbCwgY2xzKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYXNDbGFzcyhlbCwgbmFtZSkge1xuICBpZiAodHlwZW9mIGVsLmNsYXNzTGlzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gZWwuY2xhc3NMaXN0LmNvbnRhaW5zKG5hbWUpO1xuICB9XG4gIHZhciBjbGFzc05hbWUgPSBnZXRDbGFzc05hbWUoZWwpO1xuICByZXR1cm4gbmV3IFJlZ0V4cCgnKF58ICknICsgbmFtZSArICcoIHwkKScsICdnaScpLnRlc3QoY2xhc3NOYW1lKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q2xhc3NOYW1lKGVsKSB7XG4gIC8vIENhbid0IHVzZSBqdXN0IFNWR0FuaW1hdGVkU3RyaW5nIGhlcmUgc2luY2Ugbm9kZXMgd2l0aGluIGEgRnJhbWUgaW4gSUUgaGF2ZVxuICAvLyBjb21wbGV0ZWx5IHNlcGFyYXRlbHkgU1ZHQW5pbWF0ZWRTdHJpbmcgYmFzZSBjbGFzc2VzXG4gIGlmIChlbC5jbGFzc05hbWUgaW5zdGFuY2VvZiBlbC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LlNWR0FuaW1hdGVkU3RyaW5nKSB7XG4gICAgcmV0dXJuIGVsLmNsYXNzTmFtZS5iYXNlVmFsO1xuICB9XG4gIHJldHVybiBlbC5jbGFzc05hbWU7XG59XG5cbmZ1bmN0aW9uIHNldENsYXNzTmFtZShlbCwgY2xhc3NOYW1lKSB7XG4gIGVsLnNldEF0dHJpYnV0ZSgnY2xhc3MnLCBjbGFzc05hbWUpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDbGFzc2VzKGVsLCBhZGQsIGFsbCkge1xuICAvLyBPZiB0aGUgc2V0IG9mICdhbGwnIGNsYXNzZXMsIHdlIG5lZWQgdGhlICdhZGQnIGNsYXNzZXMsIGFuZCBvbmx5IHRoZVxuICAvLyAnYWRkJyBjbGFzc2VzIHRvIGJlIHNldC5cbiAgYWxsLmZvckVhY2goZnVuY3Rpb24gKGNscykge1xuICAgIGlmIChhZGQuaW5kZXhPZihjbHMpID09PSAtMSAmJiBoYXNDbGFzcyhlbCwgY2xzKSkge1xuICAgICAgcmVtb3ZlQ2xhc3MoZWwsIGNscyk7XG4gICAgfVxuICB9KTtcblxuICBhZGQuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgaWYgKCFoYXNDbGFzcyhlbCwgY2xzKSkge1xuICAgICAgYWRkQ2xhc3MoZWwsIGNscyk7XG4gICAgfVxuICB9KTtcbn1cblxudmFyIGRlZmVycmVkID0gW107XG5cbnZhciBkZWZlciA9IGZ1bmN0aW9uIGRlZmVyKGZuKSB7XG4gIGRlZmVycmVkLnB1c2goZm4pO1xufTtcblxudmFyIGZsdXNoID0gZnVuY3Rpb24gZmx1c2goKSB7XG4gIHZhciBmbiA9IHVuZGVmaW5lZDtcbiAgd2hpbGUgKGZuID0gZGVmZXJyZWQucG9wKCkpIHtcbiAgICBmbigpO1xuICB9XG59O1xuXG52YXIgRXZlbnRlZCA9IChmdW5jdGlvbiAoKSB7XG4gIGZ1bmN0aW9uIEV2ZW50ZWQoKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEV2ZW50ZWQpO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKEV2ZW50ZWQsIFt7XG4gICAga2V5OiAnb24nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvbihldmVudCwgaGFuZGxlciwgY3R4KSB7XG4gICAgICB2YXIgb25jZSA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMyB8fCBhcmd1bWVudHNbM10gPT09IHVuZGVmaW5lZCA/IGZhbHNlIDogYXJndW1lbnRzWzNdO1xuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuYmluZGluZ3MgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ3MgPSB7fTtcbiAgICAgIH1cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5iaW5kaW5nc1tldmVudF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ3NbZXZlbnRdID0gW107XG4gICAgICB9XG4gICAgICB0aGlzLmJpbmRpbmdzW2V2ZW50XS5wdXNoKHsgaGFuZGxlcjogaGFuZGxlciwgY3R4OiBjdHgsIG9uY2U6IG9uY2UgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb25jZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG9uY2UoZXZlbnQsIGhhbmRsZXIsIGN0eCkge1xuICAgICAgdGhpcy5vbihldmVudCwgaGFuZGxlciwgY3R4LCB0cnVlKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdvZmYnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvZmYoZXZlbnQsIGhhbmRsZXIpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5iaW5kaW5ncyA9PT0gJ3VuZGVmaW5lZCcgfHwgdHlwZW9mIHRoaXMuYmluZGluZ3NbZXZlbnRdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgaGFuZGxlciA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgZGVsZXRlIHRoaXMuYmluZGluZ3NbZXZlbnRdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICB3aGlsZSAoaSA8IHRoaXMuYmluZGluZ3NbZXZlbnRdLmxlbmd0aCkge1xuICAgICAgICAgIGlmICh0aGlzLmJpbmRpbmdzW2V2ZW50XVtpXS5oYW5kbGVyID09PSBoYW5kbGVyKSB7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmdzW2V2ZW50XS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd0cmlnZ2VyJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gdHJpZ2dlcihldmVudCkge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLmJpbmRpbmdzICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLmJpbmRpbmdzW2V2ZW50XSkge1xuICAgICAgICB2YXIgaSA9IDA7XG5cbiAgICAgICAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIGFyZ3MgPSBBcnJheShfbGVuID4gMSA/IF9sZW4gLSAxIDogMCksIF9rZXkgPSAxOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG4gICAgICAgICAgYXJnc1tfa2V5IC0gMV0gPSBhcmd1bWVudHNbX2tleV07XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAoaSA8IHRoaXMuYmluZGluZ3NbZXZlbnRdLmxlbmd0aCkge1xuICAgICAgICAgIHZhciBfYmluZGluZ3MkZXZlbnQkaSA9IHRoaXMuYmluZGluZ3NbZXZlbnRdW2ldO1xuICAgICAgICAgIHZhciBoYW5kbGVyID0gX2JpbmRpbmdzJGV2ZW50JGkuaGFuZGxlcjtcbiAgICAgICAgICB2YXIgY3R4ID0gX2JpbmRpbmdzJGV2ZW50JGkuY3R4O1xuICAgICAgICAgIHZhciBvbmNlID0gX2JpbmRpbmdzJGV2ZW50JGkub25jZTtcblxuICAgICAgICAgIHZhciBjb250ZXh0ID0gY3R4O1xuICAgICAgICAgIGlmICh0eXBlb2YgY29udGV4dCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIGNvbnRleHQgPSB0aGlzO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGhhbmRsZXIuYXBwbHkoY29udGV4dCwgYXJncyk7XG5cbiAgICAgICAgICBpZiAob25jZSkge1xuICAgICAgICAgICAgdGhpcy5iaW5kaW5nc1tldmVudF0uc3BsaWNlKGksIDEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICArK2k7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIEV2ZW50ZWQ7XG59KSgpO1xuXG5UZXRoZXJCYXNlLlV0aWxzID0ge1xuICBnZXRBY3R1YWxCb3VuZGluZ0NsaWVudFJlY3Q6IGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdCxcbiAgZ2V0U2Nyb2xsUGFyZW50czogZ2V0U2Nyb2xsUGFyZW50cyxcbiAgZ2V0Qm91bmRzOiBnZXRCb3VuZHMsXG4gIGdldE9mZnNldFBhcmVudDogZ2V0T2Zmc2V0UGFyZW50LFxuICBleHRlbmQ6IGV4dGVuZCxcbiAgYWRkQ2xhc3M6IGFkZENsYXNzLFxuICByZW1vdmVDbGFzczogcmVtb3ZlQ2xhc3MsXG4gIGhhc0NsYXNzOiBoYXNDbGFzcyxcbiAgdXBkYXRlQ2xhc3NlczogdXBkYXRlQ2xhc3NlcyxcbiAgZGVmZXI6IGRlZmVyLFxuICBmbHVzaDogZmx1c2gsXG4gIHVuaXF1ZUlkOiB1bmlxdWVJZCxcbiAgRXZlbnRlZDogRXZlbnRlZCxcbiAgZ2V0U2Nyb2xsQmFyU2l6ZTogZ2V0U2Nyb2xsQmFyU2l6ZSxcbiAgcmVtb3ZlVXRpbEVsZW1lbnRzOiByZW1vdmVVdGlsRWxlbWVudHNcbn07XG4vKiBnbG9iYWxzIFRldGhlckJhc2UsIHBlcmZvcm1hbmNlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9zbGljZWRUb0FycmF5ID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gc2xpY2VJdGVyYXRvcihhcnIsIGkpIHsgdmFyIF9hcnIgPSBbXTsgdmFyIF9uID0gdHJ1ZTsgdmFyIF9kID0gZmFsc2U7IHZhciBfZSA9IHVuZGVmaW5lZDsgdHJ5IHsgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkgeyBfYXJyLnB1c2goX3MudmFsdWUpOyBpZiAoaSAmJiBfYXJyLmxlbmd0aCA9PT0gaSkgYnJlYWs7IH0gfSBjYXRjaCAoZXJyKSB7IF9kID0gdHJ1ZTsgX2UgPSBlcnI7IH0gZmluYWxseSB7IHRyeSB7IGlmICghX24gJiYgX2lbJ3JldHVybiddKSBfaVsncmV0dXJuJ10oKTsgfSBmaW5hbGx5IHsgaWYgKF9kKSB0aHJvdyBfZTsgfSB9IHJldHVybiBfYXJyOyB9IHJldHVybiBmdW5jdGlvbiAoYXJyLCBpKSB7IGlmIChBcnJheS5pc0FycmF5KGFycikpIHsgcmV0dXJuIGFycjsgfSBlbHNlIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGFycikpIHsgcmV0dXJuIHNsaWNlSXRlcmF0b3IoYXJyLCBpKTsgfSBlbHNlIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBhdHRlbXB0IHRvIGRlc3RydWN0dXJlIG5vbi1pdGVyYWJsZSBpbnN0YW5jZScpOyB9IH07IH0pKCk7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKCd2YWx1ZScgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0pKCk7XG5cbnZhciBfZ2V0ID0gZnVuY3Rpb24gZ2V0KF94NiwgX3g3LCBfeDgpIHsgdmFyIF9hZ2FpbiA9IHRydWU7IF9mdW5jdGlvbjogd2hpbGUgKF9hZ2FpbikgeyB2YXIgb2JqZWN0ID0gX3g2LCBwcm9wZXJ0eSA9IF94NywgcmVjZWl2ZXIgPSBfeDg7IF9hZ2FpbiA9IGZhbHNlOyBpZiAob2JqZWN0ID09PSBudWxsKSBvYmplY3QgPSBGdW5jdGlvbi5wcm90b3R5cGU7IHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmplY3QsIHByb3BlcnR5KTsgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkgeyB2YXIgcGFyZW50ID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iamVjdCk7IGlmIChwYXJlbnQgPT09IG51bGwpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSBlbHNlIHsgX3g2ID0gcGFyZW50OyBfeDcgPSBwcm9wZXJ0eTsgX3g4ID0gcmVjZWl2ZXI7IF9hZ2FpbiA9IHRydWU7IGRlc2MgPSBwYXJlbnQgPSB1bmRlZmluZWQ7IGNvbnRpbnVlIF9mdW5jdGlvbjsgfSB9IGVsc2UgaWYgKCd2YWx1ZScgaW4gZGVzYykgeyByZXR1cm4gZGVzYy52YWx1ZTsgfSBlbHNlIHsgdmFyIGdldHRlciA9IGRlc2MuZ2V0OyBpZiAoZ2V0dGVyID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSByZXR1cm4gZ2V0dGVyLmNhbGwocmVjZWl2ZXIpOyB9IH0gfTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbmZ1bmN0aW9uIF9pbmhlcml0cyhzdWJDbGFzcywgc3VwZXJDbGFzcykgeyBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09ICdmdW5jdGlvbicgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90ICcgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7IH0gc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7IGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBzdWJDbGFzcywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSB9KTsgaWYgKHN1cGVyQ2xhc3MpIE9iamVjdC5zZXRQcm90b3R5cGVPZiA/IE9iamVjdC5zZXRQcm90b3R5cGVPZihzdWJDbGFzcywgc3VwZXJDbGFzcykgOiBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzOyB9XG5cbmlmICh0eXBlb2YgVGV0aGVyQmFzZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBpbmNsdWRlIHRoZSB1dGlscy5qcyBmaWxlIGJlZm9yZSB0ZXRoZXIuanMnKTtcbn1cblxudmFyIF9UZXRoZXJCYXNlJFV0aWxzID0gVGV0aGVyQmFzZS5VdGlscztcbnZhciBnZXRTY3JvbGxQYXJlbnRzID0gX1RldGhlckJhc2UkVXRpbHMuZ2V0U2Nyb2xsUGFyZW50cztcbnZhciBnZXRCb3VuZHMgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRCb3VuZHM7XG52YXIgZ2V0T2Zmc2V0UGFyZW50ID0gX1RldGhlckJhc2UkVXRpbHMuZ2V0T2Zmc2V0UGFyZW50O1xudmFyIGV4dGVuZCA9IF9UZXRoZXJCYXNlJFV0aWxzLmV4dGVuZDtcbnZhciBhZGRDbGFzcyA9IF9UZXRoZXJCYXNlJFV0aWxzLmFkZENsYXNzO1xudmFyIHJlbW92ZUNsYXNzID0gX1RldGhlckJhc2UkVXRpbHMucmVtb3ZlQ2xhc3M7XG52YXIgdXBkYXRlQ2xhc3NlcyA9IF9UZXRoZXJCYXNlJFV0aWxzLnVwZGF0ZUNsYXNzZXM7XG52YXIgZGVmZXIgPSBfVGV0aGVyQmFzZSRVdGlscy5kZWZlcjtcbnZhciBmbHVzaCA9IF9UZXRoZXJCYXNlJFV0aWxzLmZsdXNoO1xudmFyIGdldFNjcm9sbEJhclNpemUgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRTY3JvbGxCYXJTaXplO1xudmFyIHJlbW92ZVV0aWxFbGVtZW50cyA9IF9UZXRoZXJCYXNlJFV0aWxzLnJlbW92ZVV0aWxFbGVtZW50cztcblxuZnVuY3Rpb24gd2l0aGluKGEsIGIpIHtcbiAgdmFyIGRpZmYgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDIgfHwgYXJndW1lbnRzWzJdID09PSB1bmRlZmluZWQgPyAxIDogYXJndW1lbnRzWzJdO1xuXG4gIHJldHVybiBhICsgZGlmZiA+PSBiICYmIGIgPj0gYSAtIGRpZmY7XG59XG5cbnZhciB0cmFuc2Zvcm1LZXkgPSAoZnVuY3Rpb24gKCkge1xuICBpZiAodHlwZW9mIGRvY3VtZW50ID09PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiAnJztcbiAgfVxuICB2YXIgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICB2YXIgdHJhbnNmb3JtcyA9IFsndHJhbnNmb3JtJywgJ1dlYmtpdFRyYW5zZm9ybScsICdPVHJhbnNmb3JtJywgJ01velRyYW5zZm9ybScsICdtc1RyYW5zZm9ybSddO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHRyYW5zZm9ybXMubGVuZ3RoOyArK2kpIHtcbiAgICB2YXIga2V5ID0gdHJhbnNmb3Jtc1tpXTtcbiAgICBpZiAoZWwuc3R5bGVba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4ga2V5O1xuICAgIH1cbiAgfVxufSkoKTtcblxudmFyIHRldGhlcnMgPSBbXTtcblxudmFyIHBvc2l0aW9uID0gZnVuY3Rpb24gcG9zaXRpb24oKSB7XG4gIHRldGhlcnMuZm9yRWFjaChmdW5jdGlvbiAodGV0aGVyKSB7XG4gICAgdGV0aGVyLnBvc2l0aW9uKGZhbHNlKTtcbiAgfSk7XG4gIGZsdXNoKCk7XG59O1xuXG5mdW5jdGlvbiBub3coKSB7XG4gIGlmICh0eXBlb2YgcGVyZm9ybWFuY2UgPT09ICdvYmplY3QnICYmIHR5cGVvZiBwZXJmb3JtYW5jZS5ub3cgPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gcGVyZm9ybWFuY2Uubm93KCk7XG4gIH1cbiAgcmV0dXJuICtuZXcgRGF0ZSgpO1xufVxuXG4oZnVuY3Rpb24gKCkge1xuICB2YXIgbGFzdENhbGwgPSBudWxsO1xuICB2YXIgbGFzdER1cmF0aW9uID0gbnVsbDtcbiAgdmFyIHBlbmRpbmdUaW1lb3V0ID0gbnVsbDtcblxuICB2YXIgdGljayA9IGZ1bmN0aW9uIHRpY2soKSB7XG4gICAgaWYgKHR5cGVvZiBsYXN0RHVyYXRpb24gIT09ICd1bmRlZmluZWQnICYmIGxhc3REdXJhdGlvbiA+IDE2KSB7XG4gICAgICAvLyBXZSB2b2x1bnRhcmlseSB0aHJvdHRsZSBvdXJzZWx2ZXMgaWYgd2UgY2FuJ3QgbWFuYWdlIDYwZnBzXG4gICAgICBsYXN0RHVyYXRpb24gPSBNYXRoLm1pbihsYXN0RHVyYXRpb24gLSAxNiwgMjUwKTtcblxuICAgICAgLy8gSnVzdCBpbiBjYXNlIHRoaXMgaXMgdGhlIGxhc3QgZXZlbnQsIHJlbWVtYmVyIHRvIHBvc2l0aW9uIGp1c3Qgb25jZSBtb3JlXG4gICAgICBwZW5kaW5nVGltZW91dCA9IHNldFRpbWVvdXQodGljaywgMjUwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGxhc3RDYWxsICE9PSAndW5kZWZpbmVkJyAmJiBub3coKSAtIGxhc3RDYWxsIDwgMTApIHtcbiAgICAgIC8vIFNvbWUgYnJvd3NlcnMgY2FsbCBldmVudHMgYSBsaXR0bGUgdG9vIGZyZXF1ZW50bHksIHJlZnVzZSB0byBydW4gbW9yZSB0aGFuIGlzIHJlYXNvbmFibGVcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAocGVuZGluZ1RpbWVvdXQgIT0gbnVsbCkge1xuICAgICAgY2xlYXJUaW1lb3V0KHBlbmRpbmdUaW1lb3V0KTtcbiAgICAgIHBlbmRpbmdUaW1lb3V0ID0gbnVsbDtcbiAgICB9XG5cbiAgICBsYXN0Q2FsbCA9IG5vdygpO1xuICAgIHBvc2l0aW9uKCk7XG4gICAgbGFzdER1cmF0aW9uID0gbm93KCkgLSBsYXN0Q2FsbDtcbiAgfTtcblxuICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIFsncmVzaXplJywgJ3Njcm9sbCcsICd0b3VjaG1vdmUnXS5mb3JFYWNoKGZ1bmN0aW9uIChldmVudCkge1xuICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIHRpY2spO1xuICAgIH0pO1xuICB9XG59KSgpO1xuXG52YXIgTUlSUk9SX0xSID0ge1xuICBjZW50ZXI6ICdjZW50ZXInLFxuICBsZWZ0OiAncmlnaHQnLFxuICByaWdodDogJ2xlZnQnXG59O1xuXG52YXIgTUlSUk9SX1RCID0ge1xuICBtaWRkbGU6ICdtaWRkbGUnLFxuICB0b3A6ICdib3R0b20nLFxuICBib3R0b206ICd0b3AnXG59O1xuXG52YXIgT0ZGU0VUX01BUCA9IHtcbiAgdG9wOiAwLFxuICBsZWZ0OiAwLFxuICBtaWRkbGU6ICc1MCUnLFxuICBjZW50ZXI6ICc1MCUnLFxuICBib3R0b206ICcxMDAlJyxcbiAgcmlnaHQ6ICcxMDAlJ1xufTtcblxudmFyIGF1dG9Ub0ZpeGVkQXR0YWNobWVudCA9IGZ1bmN0aW9uIGF1dG9Ub0ZpeGVkQXR0YWNobWVudChhdHRhY2htZW50LCByZWxhdGl2ZVRvQXR0YWNobWVudCkge1xuICB2YXIgbGVmdCA9IGF0dGFjaG1lbnQubGVmdDtcbiAgdmFyIHRvcCA9IGF0dGFjaG1lbnQudG9wO1xuXG4gIGlmIChsZWZ0ID09PSAnYXV0bycpIHtcbiAgICBsZWZ0ID0gTUlSUk9SX0xSW3JlbGF0aXZlVG9BdHRhY2htZW50LmxlZnRdO1xuICB9XG5cbiAgaWYgKHRvcCA9PT0gJ2F1dG8nKSB7XG4gICAgdG9wID0gTUlSUk9SX1RCW3JlbGF0aXZlVG9BdHRhY2htZW50LnRvcF07XG4gIH1cblxuICByZXR1cm4geyBsZWZ0OiBsZWZ0LCB0b3A6IHRvcCB9O1xufTtcblxudmFyIGF0dGFjaG1lbnRUb09mZnNldCA9IGZ1bmN0aW9uIGF0dGFjaG1lbnRUb09mZnNldChhdHRhY2htZW50KSB7XG4gIHZhciBsZWZ0ID0gYXR0YWNobWVudC5sZWZ0O1xuICB2YXIgdG9wID0gYXR0YWNobWVudC50b3A7XG5cbiAgaWYgKHR5cGVvZiBPRkZTRVRfTUFQW2F0dGFjaG1lbnQubGVmdF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbGVmdCA9IE9GRlNFVF9NQVBbYXR0YWNobWVudC5sZWZ0XTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgT0ZGU0VUX01BUFthdHRhY2htZW50LnRvcF0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgdG9wID0gT0ZGU0VUX01BUFthdHRhY2htZW50LnRvcF07XG4gIH1cblxuICByZXR1cm4geyBsZWZ0OiBsZWZ0LCB0b3A6IHRvcCB9O1xufTtcblxuZnVuY3Rpb24gYWRkT2Zmc2V0KCkge1xuICB2YXIgb3V0ID0geyB0b3A6IDAsIGxlZnQ6IDAgfTtcblxuICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgb2Zmc2V0cyA9IEFycmF5KF9sZW4pLCBfa2V5ID0gMDsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgIG9mZnNldHNbX2tleV0gPSBhcmd1bWVudHNbX2tleV07XG4gIH1cblxuICBvZmZzZXRzLmZvckVhY2goZnVuY3Rpb24gKF9yZWYpIHtcbiAgICB2YXIgdG9wID0gX3JlZi50b3A7XG4gICAgdmFyIGxlZnQgPSBfcmVmLmxlZnQ7XG5cbiAgICBpZiAodHlwZW9mIHRvcCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRvcCA9IHBhcnNlRmxvYXQodG9wLCAxMCk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgbGVmdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGxlZnQgPSBwYXJzZUZsb2F0KGxlZnQsIDEwKTtcbiAgICB9XG5cbiAgICBvdXQudG9wICs9IHRvcDtcbiAgICBvdXQubGVmdCArPSBsZWZ0O1xuICB9KTtcblxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBvZmZzZXRUb1B4KG9mZnNldCwgc2l6ZSkge1xuICBpZiAodHlwZW9mIG9mZnNldC5sZWZ0ID09PSAnc3RyaW5nJyAmJiBvZmZzZXQubGVmdC5pbmRleE9mKCclJykgIT09IC0xKSB7XG4gICAgb2Zmc2V0LmxlZnQgPSBwYXJzZUZsb2F0KG9mZnNldC5sZWZ0LCAxMCkgLyAxMDAgKiBzaXplLndpZHRoO1xuICB9XG4gIGlmICh0eXBlb2Ygb2Zmc2V0LnRvcCA9PT0gJ3N0cmluZycgJiYgb2Zmc2V0LnRvcC5pbmRleE9mKCclJykgIT09IC0xKSB7XG4gICAgb2Zmc2V0LnRvcCA9IHBhcnNlRmxvYXQob2Zmc2V0LnRvcCwgMTApIC8gMTAwICogc2l6ZS5oZWlnaHQ7XG4gIH1cblxuICByZXR1cm4gb2Zmc2V0O1xufVxuXG52YXIgcGFyc2VPZmZzZXQgPSBmdW5jdGlvbiBwYXJzZU9mZnNldCh2YWx1ZSkge1xuICB2YXIgX3ZhbHVlJHNwbGl0ID0gdmFsdWUuc3BsaXQoJyAnKTtcblxuICB2YXIgX3ZhbHVlJHNwbGl0MiA9IF9zbGljZWRUb0FycmF5KF92YWx1ZSRzcGxpdCwgMik7XG5cbiAgdmFyIHRvcCA9IF92YWx1ZSRzcGxpdDJbMF07XG4gIHZhciBsZWZ0ID0gX3ZhbHVlJHNwbGl0MlsxXTtcblxuICByZXR1cm4geyB0b3A6IHRvcCwgbGVmdDogbGVmdCB9O1xufTtcbnZhciBwYXJzZUF0dGFjaG1lbnQgPSBwYXJzZU9mZnNldDtcblxudmFyIFRldGhlckNsYXNzID0gKGZ1bmN0aW9uIChfRXZlbnRlZCkge1xuICBfaW5oZXJpdHMoVGV0aGVyQ2xhc3MsIF9FdmVudGVkKTtcblxuICBmdW5jdGlvbiBUZXRoZXJDbGFzcyhvcHRpb25zKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBUZXRoZXJDbGFzcyk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihUZXRoZXJDbGFzcy5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIHRoaXMucG9zaXRpb24gPSB0aGlzLnBvc2l0aW9uLmJpbmQodGhpcyk7XG5cbiAgICB0ZXRoZXJzLnB1c2godGhpcyk7XG5cbiAgICB0aGlzLmhpc3RvcnkgPSBbXTtcblxuICAgIHRoaXMuc2V0T3B0aW9ucyhvcHRpb25zLCBmYWxzZSk7XG5cbiAgICBUZXRoZXJCYXNlLm1vZHVsZXMuZm9yRWFjaChmdW5jdGlvbiAobW9kdWxlKSB7XG4gICAgICBpZiAodHlwZW9mIG1vZHVsZS5pbml0aWFsaXplICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBtb2R1bGUuaW5pdGlhbGl6ZS5jYWxsKF90aGlzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHRoaXMucG9zaXRpb24oKTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhUZXRoZXJDbGFzcywgW3tcbiAgICBrZXk6ICdnZXRDbGFzcycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldENsYXNzKCkge1xuICAgICAgdmFyIGtleSA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/ICcnIDogYXJndW1lbnRzWzBdO1xuICAgICAgdmFyIGNsYXNzZXMgPSB0aGlzLm9wdGlvbnMuY2xhc3NlcztcblxuICAgICAgaWYgKHR5cGVvZiBjbGFzc2VzICE9PSAndW5kZWZpbmVkJyAmJiBjbGFzc2VzW2tleV0pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5jbGFzc2VzW2tleV07XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5jbGFzc1ByZWZpeCkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmNsYXNzUHJlZml4ICsgJy0nICsga2V5O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGtleTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdzZXRPcHRpb25zJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2V0T3B0aW9ucyhvcHRpb25zKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgdmFyIHBvcyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMSB8fCBhcmd1bWVudHNbMV0gPT09IHVuZGVmaW5lZCA/IHRydWUgOiBhcmd1bWVudHNbMV07XG5cbiAgICAgIHZhciBkZWZhdWx0cyA9IHtcbiAgICAgICAgb2Zmc2V0OiAnMCAwJyxcbiAgICAgICAgdGFyZ2V0T2Zmc2V0OiAnMCAwJyxcbiAgICAgICAgdGFyZ2V0QXR0YWNobWVudDogJ2F1dG8gYXV0bycsXG4gICAgICAgIGNsYXNzUHJlZml4OiAndGV0aGVyJ1xuICAgICAgfTtcblxuICAgICAgdGhpcy5vcHRpb25zID0gZXh0ZW5kKGRlZmF1bHRzLCBvcHRpb25zKTtcblxuICAgICAgdmFyIF9vcHRpb25zID0gdGhpcy5vcHRpb25zO1xuICAgICAgdmFyIGVsZW1lbnQgPSBfb3B0aW9ucy5lbGVtZW50O1xuICAgICAgdmFyIHRhcmdldCA9IF9vcHRpb25zLnRhcmdldDtcbiAgICAgIHZhciB0YXJnZXRNb2RpZmllciA9IF9vcHRpb25zLnRhcmdldE1vZGlmaWVyO1xuXG4gICAgICB0aGlzLmVsZW1lbnQgPSBlbGVtZW50O1xuICAgICAgdGhpcy50YXJnZXQgPSB0YXJnZXQ7XG4gICAgICB0aGlzLnRhcmdldE1vZGlmaWVyID0gdGFyZ2V0TW9kaWZpZXI7XG5cbiAgICAgIGlmICh0aGlzLnRhcmdldCA9PT0gJ3ZpZXdwb3J0Jykge1xuICAgICAgICB0aGlzLnRhcmdldCA9IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIHRoaXMudGFyZ2V0TW9kaWZpZXIgPSAndmlzaWJsZSc7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMudGFyZ2V0ID09PSAnc2Nyb2xsLWhhbmRsZScpIHtcbiAgICAgICAgdGhpcy50YXJnZXQgPSBkb2N1bWVudC5ib2R5O1xuICAgICAgICB0aGlzLnRhcmdldE1vZGlmaWVyID0gJ3Njcm9sbC1oYW5kbGUnO1xuICAgICAgfVxuXG4gICAgICBbJ2VsZW1lbnQnLCAndGFyZ2V0J10uZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgIGlmICh0eXBlb2YgX3RoaXMyW2tleV0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUZXRoZXIgRXJyb3I6IEJvdGggZWxlbWVudCBhbmQgdGFyZ2V0IG11c3QgYmUgZGVmaW5lZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBfdGhpczJba2V5XS5qcXVlcnkgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgX3RoaXMyW2tleV0gPSBfdGhpczJba2V5XVswXTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgX3RoaXMyW2tleV0gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgX3RoaXMyW2tleV0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKF90aGlzMltrZXldKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGFkZENsYXNzKHRoaXMuZWxlbWVudCwgdGhpcy5nZXRDbGFzcygnZWxlbWVudCcpKTtcbiAgICAgIGlmICghKHRoaXMub3B0aW9ucy5hZGRUYXJnZXRDbGFzc2VzID09PSBmYWxzZSkpIHtcbiAgICAgICAgYWRkQ2xhc3ModGhpcy50YXJnZXQsIHRoaXMuZ2V0Q2xhc3MoJ3RhcmdldCcpKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuYXR0YWNobWVudCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RldGhlciBFcnJvcjogWW91IG11c3QgcHJvdmlkZSBhbiBhdHRhY2htZW50Jyk7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudGFyZ2V0QXR0YWNobWVudCA9IHBhcnNlQXR0YWNobWVudCh0aGlzLm9wdGlvbnMudGFyZ2V0QXR0YWNobWVudCk7XG4gICAgICB0aGlzLmF0dGFjaG1lbnQgPSBwYXJzZUF0dGFjaG1lbnQodGhpcy5vcHRpb25zLmF0dGFjaG1lbnQpO1xuICAgICAgdGhpcy5vZmZzZXQgPSBwYXJzZU9mZnNldCh0aGlzLm9wdGlvbnMub2Zmc2V0KTtcbiAgICAgIHRoaXMudGFyZ2V0T2Zmc2V0ID0gcGFyc2VPZmZzZXQodGhpcy5vcHRpb25zLnRhcmdldE9mZnNldCk7XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5zY3JvbGxQYXJlbnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLmRpc2FibGUoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudGFyZ2V0TW9kaWZpZXIgPT09ICdzY3JvbGwtaGFuZGxlJykge1xuICAgICAgICB0aGlzLnNjcm9sbFBhcmVudHMgPSBbdGhpcy50YXJnZXRdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zY3JvbGxQYXJlbnRzID0gZ2V0U2Nyb2xsUGFyZW50cyh0aGlzLnRhcmdldCk7XG4gICAgICB9XG5cbiAgICAgIGlmICghKHRoaXMub3B0aW9ucy5lbmFibGVkID09PSBmYWxzZSkpIHtcbiAgICAgICAgdGhpcy5lbmFibGUocG9zKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdnZXRUYXJnZXRCb3VuZHMnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRUYXJnZXRCb3VuZHMoKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMudGFyZ2V0TW9kaWZpZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmICh0aGlzLnRhcmdldE1vZGlmaWVyID09PSAndmlzaWJsZScpIHtcbiAgICAgICAgICBpZiAodGhpcy50YXJnZXQgPT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgICAgIHJldHVybiB7IHRvcDogcGFnZVlPZmZzZXQsIGxlZnQ6IHBhZ2VYT2Zmc2V0LCBoZWlnaHQ6IGlubmVySGVpZ2h0LCB3aWR0aDogaW5uZXJXaWR0aCB9O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgYm91bmRzID0gZ2V0Qm91bmRzKHRoaXMudGFyZ2V0KTtcblxuICAgICAgICAgICAgdmFyIG91dCA9IHtcbiAgICAgICAgICAgICAgaGVpZ2h0OiBib3VuZHMuaGVpZ2h0LFxuICAgICAgICAgICAgICB3aWR0aDogYm91bmRzLndpZHRoLFxuICAgICAgICAgICAgICB0b3A6IGJvdW5kcy50b3AsXG4gICAgICAgICAgICAgIGxlZnQ6IGJvdW5kcy5sZWZ0XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5taW4ob3V0LmhlaWdodCwgYm91bmRzLmhlaWdodCAtIChwYWdlWU9mZnNldCAtIGJvdW5kcy50b3ApKTtcbiAgICAgICAgICAgIG91dC5oZWlnaHQgPSBNYXRoLm1pbihvdXQuaGVpZ2h0LCBib3VuZHMuaGVpZ2h0IC0gKGJvdW5kcy50b3AgKyBib3VuZHMuaGVpZ2h0IC0gKHBhZ2VZT2Zmc2V0ICsgaW5uZXJIZWlnaHQpKSk7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5taW4oaW5uZXJIZWlnaHQsIG91dC5oZWlnaHQpO1xuICAgICAgICAgICAgb3V0LmhlaWdodCAtPSAyO1xuXG4gICAgICAgICAgICBvdXQud2lkdGggPSBNYXRoLm1pbihvdXQud2lkdGgsIGJvdW5kcy53aWR0aCAtIChwYWdlWE9mZnNldCAtIGJvdW5kcy5sZWZ0KSk7XG4gICAgICAgICAgICBvdXQud2lkdGggPSBNYXRoLm1pbihvdXQud2lkdGgsIGJvdW5kcy53aWR0aCAtIChib3VuZHMubGVmdCArIGJvdW5kcy53aWR0aCAtIChwYWdlWE9mZnNldCArIGlubmVyV2lkdGgpKSk7XG4gICAgICAgICAgICBvdXQud2lkdGggPSBNYXRoLm1pbihpbm5lcldpZHRoLCBvdXQud2lkdGgpO1xuICAgICAgICAgICAgb3V0LndpZHRoIC09IDI7XG5cbiAgICAgICAgICAgIGlmIChvdXQudG9wIDwgcGFnZVlPZmZzZXQpIHtcbiAgICAgICAgICAgICAgb3V0LnRvcCA9IHBhZ2VZT2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKG91dC5sZWZ0IDwgcGFnZVhPZmZzZXQpIHtcbiAgICAgICAgICAgICAgb3V0LmxlZnQgPSBwYWdlWE9mZnNldDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy50YXJnZXRNb2RpZmllciA9PT0gJ3Njcm9sbC1oYW5kbGUnKSB7XG4gICAgICAgICAgdmFyIGJvdW5kcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB2YXIgdGFyZ2V0ID0gdGhpcy50YXJnZXQ7XG4gICAgICAgICAgaWYgKHRhcmdldCA9PT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICAgICAgdGFyZ2V0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuXG4gICAgICAgICAgICBib3VuZHMgPSB7XG4gICAgICAgICAgICAgIGxlZnQ6IHBhZ2VYT2Zmc2V0LFxuICAgICAgICAgICAgICB0b3A6IHBhZ2VZT2Zmc2V0LFxuICAgICAgICAgICAgICBoZWlnaHQ6IGlubmVySGVpZ2h0LFxuICAgICAgICAgICAgICB3aWR0aDogaW5uZXJXaWR0aFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYm91bmRzID0gZ2V0Qm91bmRzKHRhcmdldCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZSh0YXJnZXQpO1xuXG4gICAgICAgICAgdmFyIGhhc0JvdHRvbVNjcm9sbCA9IHRhcmdldC5zY3JvbGxXaWR0aCA+IHRhcmdldC5jbGllbnRXaWR0aCB8fCBbc3R5bGUub3ZlcmZsb3csIHN0eWxlLm92ZXJmbG93WF0uaW5kZXhPZignc2Nyb2xsJykgPj0gMCB8fCB0aGlzLnRhcmdldCAhPT0gZG9jdW1lbnQuYm9keTtcblxuICAgICAgICAgIHZhciBzY3JvbGxCb3R0b20gPSAwO1xuICAgICAgICAgIGlmIChoYXNCb3R0b21TY3JvbGwpIHtcbiAgICAgICAgICAgIHNjcm9sbEJvdHRvbSA9IDE1O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBoZWlnaHQgPSBib3VuZHMuaGVpZ2h0IC0gcGFyc2VGbG9hdChzdHlsZS5ib3JkZXJUb3BXaWR0aCkgLSBwYXJzZUZsb2F0KHN0eWxlLmJvcmRlckJvdHRvbVdpZHRoKSAtIHNjcm9sbEJvdHRvbTtcblxuICAgICAgICAgIHZhciBvdXQgPSB7XG4gICAgICAgICAgICB3aWR0aDogMTUsXG4gICAgICAgICAgICBoZWlnaHQ6IGhlaWdodCAqIDAuOTc1ICogKGhlaWdodCAvIHRhcmdldC5zY3JvbGxIZWlnaHQpLFxuICAgICAgICAgICAgbGVmdDogYm91bmRzLmxlZnQgKyBib3VuZHMud2lkdGggLSBwYXJzZUZsb2F0KHN0eWxlLmJvcmRlckxlZnRXaWR0aCkgLSAxNVxuICAgICAgICAgIH07XG5cbiAgICAgICAgICB2YXIgZml0QWRqID0gMDtcbiAgICAgICAgICBpZiAoaGVpZ2h0IDwgNDA4ICYmIHRoaXMudGFyZ2V0ID09PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICBmaXRBZGogPSAtMC4wMDAxMSAqIE1hdGgucG93KGhlaWdodCwgMikgLSAwLjAwNzI3ICogaGVpZ2h0ICsgMjIuNTg7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHRoaXMudGFyZ2V0ICE9PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5tYXgob3V0LmhlaWdodCwgMjQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBzY3JvbGxQZXJjZW50YWdlID0gdGhpcy50YXJnZXQuc2Nyb2xsVG9wIC8gKHRhcmdldC5zY3JvbGxIZWlnaHQgLSBoZWlnaHQpO1xuICAgICAgICAgIG91dC50b3AgPSBzY3JvbGxQZXJjZW50YWdlICogKGhlaWdodCAtIG91dC5oZWlnaHQgLSBmaXRBZGopICsgYm91bmRzLnRvcCArIHBhcnNlRmxvYXQoc3R5bGUuYm9yZGVyVG9wV2lkdGgpO1xuXG4gICAgICAgICAgaWYgKHRoaXMudGFyZ2V0ID09PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5tYXgob3V0LmhlaWdodCwgMjQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHJldHVybiBvdXQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBnZXRCb3VuZHModGhpcy50YXJnZXQpO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2NsZWFyQ2FjaGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjbGVhckNhY2hlKCkge1xuICAgICAgdGhpcy5fY2FjaGUgPSB7fTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdjYWNoZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGNhY2hlKGssIGdldHRlcikge1xuICAgICAgLy8gTW9yZSB0aGFuIG9uZSBtb2R1bGUgd2lsbCBvZnRlbiBuZWVkIHRoZSBzYW1lIERPTSBpbmZvLCBzb1xuICAgICAgLy8gd2Uga2VlcCBhIGNhY2hlIHdoaWNoIGlzIGNsZWFyZWQgb24gZWFjaCBwb3NpdGlvbiBjYWxsXG4gICAgICBpZiAodHlwZW9mIHRoaXMuX2NhY2hlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLl9jYWNoZSA9IHt9O1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuX2NhY2hlW2tdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLl9jYWNoZVtrXSA9IGdldHRlci5jYWxsKHRoaXMpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdGhpcy5fY2FjaGVba107XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZW5hYmxlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZW5hYmxlKCkge1xuICAgICAgdmFyIF90aGlzMyA9IHRoaXM7XG5cbiAgICAgIHZhciBwb3MgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB0cnVlIDogYXJndW1lbnRzWzBdO1xuXG4gICAgICBpZiAoISh0aGlzLm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgIGFkZENsYXNzKHRoaXMudGFyZ2V0LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgfVxuICAgICAgYWRkQ2xhc3ModGhpcy5lbGVtZW50LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgdGhpcy5lbmFibGVkID0gdHJ1ZTtcblxuICAgICAgdGhpcy5zY3JvbGxQYXJlbnRzLmZvckVhY2goZnVuY3Rpb24gKHBhcmVudCkge1xuICAgICAgICBpZiAocGFyZW50ICE9PSBfdGhpczMudGFyZ2V0Lm93bmVyRG9jdW1lbnQpIHtcbiAgICAgICAgICBwYXJlbnQuYWRkRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgX3RoaXMzLnBvc2l0aW9uKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChwb3MpIHtcbiAgICAgICAgdGhpcy5wb3NpdGlvbigpO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2Rpc2FibGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkaXNhYmxlKCkge1xuICAgICAgdmFyIF90aGlzNCA9IHRoaXM7XG5cbiAgICAgIHJlbW92ZUNsYXNzKHRoaXMudGFyZ2V0LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgcmVtb3ZlQ2xhc3ModGhpcy5lbGVtZW50LCB0aGlzLmdldENsYXNzKCdlbmFibGVkJykpO1xuICAgICAgdGhpcy5lbmFibGVkID0gZmFsc2U7XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5zY3JvbGxQYXJlbnRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLnNjcm9sbFBhcmVudHMuZm9yRWFjaChmdW5jdGlvbiAocGFyZW50KSB7XG4gICAgICAgICAgcGFyZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIF90aGlzNC5wb3NpdGlvbik7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2Rlc3Ryb3knLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgICAgdmFyIF90aGlzNSA9IHRoaXM7XG5cbiAgICAgIHRoaXMuZGlzYWJsZSgpO1xuXG4gICAgICB0ZXRoZXJzLmZvckVhY2goZnVuY3Rpb24gKHRldGhlciwgaSkge1xuICAgICAgICBpZiAodGV0aGVyID09PSBfdGhpczUpIHtcbiAgICAgICAgICB0ZXRoZXJzLnNwbGljZShpLCAxKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIC8vIFJlbW92ZSBhbnkgZWxlbWVudHMgd2Ugd2VyZSB1c2luZyBmb3IgY29udmVuaWVuY2UgZnJvbSB0aGUgRE9NXG4gICAgICBpZiAodGV0aGVycy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmVtb3ZlVXRpbEVsZW1lbnRzKCk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndXBkYXRlQXR0YWNoQ2xhc3NlcycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHVwZGF0ZUF0dGFjaENsYXNzZXMoZWxlbWVudEF0dGFjaCwgdGFyZ2V0QXR0YWNoKSB7XG4gICAgICB2YXIgX3RoaXM2ID0gdGhpcztcblxuICAgICAgZWxlbWVudEF0dGFjaCA9IGVsZW1lbnRBdHRhY2ggfHwgdGhpcy5hdHRhY2htZW50O1xuICAgICAgdGFyZ2V0QXR0YWNoID0gdGFyZ2V0QXR0YWNoIHx8IHRoaXMudGFyZ2V0QXR0YWNobWVudDtcbiAgICAgIHZhciBzaWRlcyA9IFsnbGVmdCcsICd0b3AnLCAnYm90dG9tJywgJ3JpZ2h0JywgJ21pZGRsZScsICdjZW50ZXInXTtcblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzLmxlbmd0aCkge1xuICAgICAgICAvLyB1cGRhdGVBdHRhY2hDbGFzc2VzIGNhbiBiZSBjYWxsZWQgbW9yZSB0aGFuIG9uY2UgaW4gYSBwb3NpdGlvbiBjYWxsLCBzb1xuICAgICAgICAvLyB3ZSBuZWVkIHRvIGNsZWFuIHVwIGFmdGVyIG91cnNlbHZlcyBzdWNoIHRoYXQgd2hlbiB0aGUgbGFzdCBkZWZlciBnZXRzXG4gICAgICAgIC8vIHJhbiBpdCBkb2Vzbid0IGFkZCBhbnkgZXh0cmEgY2xhc3NlcyBmcm9tIHByZXZpb3VzIGNhbGxzLlxuICAgICAgICB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzLnNwbGljZSgwLCB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzLmxlbmd0aCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5fYWRkQXR0YWNoQ2xhc3NlcyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5fYWRkQXR0YWNoQ2xhc3NlcyA9IFtdO1xuICAgICAgfVxuICAgICAgdmFyIGFkZCA9IHRoaXMuX2FkZEF0dGFjaENsYXNzZXM7XG5cbiAgICAgIGlmIChlbGVtZW50QXR0YWNoLnRvcCkge1xuICAgICAgICBhZGQucHVzaCh0aGlzLmdldENsYXNzKCdlbGVtZW50LWF0dGFjaGVkJykgKyAnLScgKyBlbGVtZW50QXR0YWNoLnRvcCk7XG4gICAgICB9XG4gICAgICBpZiAoZWxlbWVudEF0dGFjaC5sZWZ0KSB7XG4gICAgICAgIGFkZC5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ2VsZW1lbnQtYXR0YWNoZWQnKSArICctJyArIGVsZW1lbnRBdHRhY2gubGVmdCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0QXR0YWNoLnRvcCkge1xuICAgICAgICBhZGQucHVzaCh0aGlzLmdldENsYXNzKCd0YXJnZXQtYXR0YWNoZWQnKSArICctJyArIHRhcmdldEF0dGFjaC50b3ApO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldEF0dGFjaC5sZWZ0KSB7XG4gICAgICAgIGFkZC5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ3RhcmdldC1hdHRhY2hlZCcpICsgJy0nICsgdGFyZ2V0QXR0YWNoLmxlZnQpO1xuICAgICAgfVxuXG4gICAgICB2YXIgYWxsID0gW107XG4gICAgICBzaWRlcy5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgIGFsbC5wdXNoKF90aGlzNi5nZXRDbGFzcygnZWxlbWVudC1hdHRhY2hlZCcpICsgJy0nICsgc2lkZSk7XG4gICAgICAgIGFsbC5wdXNoKF90aGlzNi5nZXRDbGFzcygndGFyZ2V0LWF0dGFjaGVkJykgKyAnLScgKyBzaWRlKTtcbiAgICAgIH0pO1xuXG4gICAgICBkZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghKHR5cGVvZiBfdGhpczYuX2FkZEF0dGFjaENsYXNzZXMgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXM2LmVsZW1lbnQsIF90aGlzNi5fYWRkQXR0YWNoQ2xhc3NlcywgYWxsKTtcbiAgICAgICAgaWYgKCEoX3RoaXM2Lm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpczYudGFyZ2V0LCBfdGhpczYuX2FkZEF0dGFjaENsYXNzZXMsIGFsbCk7XG4gICAgICAgIH1cblxuICAgICAgICBkZWxldGUgX3RoaXM2Ll9hZGRBdHRhY2hDbGFzc2VzO1xuICAgICAgfSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAncG9zaXRpb24nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwb3NpdGlvbigpIHtcbiAgICAgIHZhciBfdGhpczcgPSB0aGlzO1xuXG4gICAgICB2YXIgZmx1c2hDaGFuZ2VzID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGFyZ3VtZW50c1swXTtcblxuICAgICAgLy8gZmx1c2hDaGFuZ2VzIGNvbW1pdHMgdGhlIGNoYW5nZXMgaW1tZWRpYXRlbHksIGxlYXZlIHRydWUgdW5sZXNzIHlvdSBhcmUgcG9zaXRpb25pbmcgbXVsdGlwbGVcbiAgICAgIC8vIHRldGhlcnMgKGluIHdoaWNoIGNhc2UgY2FsbCBUZXRoZXIuVXRpbHMuZmx1c2ggeW91cnNlbGYgd2hlbiB5b3UncmUgZG9uZSlcblxuICAgICAgaWYgKCF0aGlzLmVuYWJsZWQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmNsZWFyQ2FjaGUoKTtcblxuICAgICAgLy8gVHVybiAnYXV0bycgYXR0YWNobWVudHMgaW50byB0aGUgYXBwcm9wcmlhdGUgY29ybmVyIG9yIGVkZ2VcbiAgICAgIHZhciB0YXJnZXRBdHRhY2htZW50ID0gYXV0b1RvRml4ZWRBdHRhY2htZW50KHRoaXMudGFyZ2V0QXR0YWNobWVudCwgdGhpcy5hdHRhY2htZW50KTtcblxuICAgICAgdGhpcy51cGRhdGVBdHRhY2hDbGFzc2VzKHRoaXMuYXR0YWNobWVudCwgdGFyZ2V0QXR0YWNobWVudCk7XG5cbiAgICAgIHZhciBlbGVtZW50UG9zID0gdGhpcy5jYWNoZSgnZWxlbWVudC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBnZXRCb3VuZHMoX3RoaXM3LmVsZW1lbnQpO1xuICAgICAgfSk7XG5cbiAgICAgIHZhciB3aWR0aCA9IGVsZW1lbnRQb3Mud2lkdGg7XG4gICAgICB2YXIgaGVpZ2h0ID0gZWxlbWVudFBvcy5oZWlnaHQ7XG5cbiAgICAgIGlmICh3aWR0aCA9PT0gMCAmJiBoZWlnaHQgPT09IDAgJiYgdHlwZW9mIHRoaXMubGFzdFNpemUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHZhciBfbGFzdFNpemUgPSB0aGlzLmxhc3RTaXplO1xuXG4gICAgICAgIC8vIFdlIGNhY2hlIHRoZSBoZWlnaHQgYW5kIHdpZHRoIHRvIG1ha2UgaXQgcG9zc2libGUgdG8gcG9zaXRpb24gZWxlbWVudHMgdGhhdCBhcmVcbiAgICAgICAgLy8gZ2V0dGluZyBoaWRkZW4uXG4gICAgICAgIHdpZHRoID0gX2xhc3RTaXplLndpZHRoO1xuICAgICAgICBoZWlnaHQgPSBfbGFzdFNpemUuaGVpZ2h0O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sYXN0U2l6ZSA9IHsgd2lkdGg6IHdpZHRoLCBoZWlnaHQ6IGhlaWdodCB9O1xuICAgICAgfVxuXG4gICAgICB2YXIgdGFyZ2V0UG9zID0gdGhpcy5jYWNoZSgndGFyZ2V0LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIF90aGlzNy5nZXRUYXJnZXRCb3VuZHMoKTtcbiAgICAgIH0pO1xuICAgICAgdmFyIHRhcmdldFNpemUgPSB0YXJnZXRQb3M7XG5cbiAgICAgIC8vIEdldCBhbiBhY3R1YWwgcHggb2Zmc2V0IGZyb20gdGhlIGF0dGFjaG1lbnRcbiAgICAgIHZhciBvZmZzZXQgPSBvZmZzZXRUb1B4KGF0dGFjaG1lbnRUb09mZnNldCh0aGlzLmF0dGFjaG1lbnQpLCB7IHdpZHRoOiB3aWR0aCwgaGVpZ2h0OiBoZWlnaHQgfSk7XG4gICAgICB2YXIgdGFyZ2V0T2Zmc2V0ID0gb2Zmc2V0VG9QeChhdHRhY2htZW50VG9PZmZzZXQodGFyZ2V0QXR0YWNobWVudCksIHRhcmdldFNpemUpO1xuXG4gICAgICB2YXIgbWFudWFsT2Zmc2V0ID0gb2Zmc2V0VG9QeCh0aGlzLm9mZnNldCwgeyB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH0pO1xuICAgICAgdmFyIG1hbnVhbFRhcmdldE9mZnNldCA9IG9mZnNldFRvUHgodGhpcy50YXJnZXRPZmZzZXQsIHRhcmdldFNpemUpO1xuXG4gICAgICAvLyBBZGQgdGhlIG1hbnVhbGx5IHByb3ZpZGVkIG9mZnNldFxuICAgICAgb2Zmc2V0ID0gYWRkT2Zmc2V0KG9mZnNldCwgbWFudWFsT2Zmc2V0KTtcbiAgICAgIHRhcmdldE9mZnNldCA9IGFkZE9mZnNldCh0YXJnZXRPZmZzZXQsIG1hbnVhbFRhcmdldE9mZnNldCk7XG5cbiAgICAgIC8vIEl0J3Mgbm93IG91ciBnb2FsIHRvIG1ha2UgKGVsZW1lbnQgcG9zaXRpb24gKyBvZmZzZXQpID09ICh0YXJnZXQgcG9zaXRpb24gKyB0YXJnZXQgb2Zmc2V0KVxuICAgICAgdmFyIGxlZnQgPSB0YXJnZXRQb3MubGVmdCArIHRhcmdldE9mZnNldC5sZWZ0IC0gb2Zmc2V0LmxlZnQ7XG4gICAgICB2YXIgdG9wID0gdGFyZ2V0UG9zLnRvcCArIHRhcmdldE9mZnNldC50b3AgLSBvZmZzZXQudG9wO1xuXG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IFRldGhlckJhc2UubW9kdWxlcy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgX21vZHVsZTIgPSBUZXRoZXJCYXNlLm1vZHVsZXNbaV07XG4gICAgICAgIHZhciByZXQgPSBfbW9kdWxlMi5wb3NpdGlvbi5jYWxsKHRoaXMsIHtcbiAgICAgICAgICBsZWZ0OiBsZWZ0LFxuICAgICAgICAgIHRvcDogdG9wLFxuICAgICAgICAgIHRhcmdldEF0dGFjaG1lbnQ6IHRhcmdldEF0dGFjaG1lbnQsXG4gICAgICAgICAgdGFyZ2V0UG9zOiB0YXJnZXRQb3MsXG4gICAgICAgICAgZWxlbWVudFBvczogZWxlbWVudFBvcyxcbiAgICAgICAgICBvZmZzZXQ6IG9mZnNldCxcbiAgICAgICAgICB0YXJnZXRPZmZzZXQ6IHRhcmdldE9mZnNldCxcbiAgICAgICAgICBtYW51YWxPZmZzZXQ6IG1hbnVhbE9mZnNldCxcbiAgICAgICAgICBtYW51YWxUYXJnZXRPZmZzZXQ6IG1hbnVhbFRhcmdldE9mZnNldCxcbiAgICAgICAgICBzY3JvbGxiYXJTaXplOiBzY3JvbGxiYXJTaXplLFxuICAgICAgICAgIGF0dGFjaG1lbnQ6IHRoaXMuYXR0YWNobWVudFxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocmV0ID09PSBmYWxzZSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcmV0ID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgcmV0ICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRvcCA9IHJldC50b3A7XG4gICAgICAgICAgbGVmdCA9IHJldC5sZWZ0O1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIGRlc2NyaWJlIHRoZSBwb3NpdGlvbiB0aHJlZSBkaWZmZXJlbnQgd2F5cyB0byBnaXZlIHRoZSBvcHRpbWl6ZXJcbiAgICAgIC8vIGEgY2hhbmNlIHRvIGRlY2lkZSB0aGUgYmVzdCBwb3NzaWJsZSB3YXkgdG8gcG9zaXRpb24gdGhlIGVsZW1lbnRcbiAgICAgIC8vIHdpdGggdGhlIGZld2VzdCByZXBhaW50cy5cbiAgICAgIHZhciBuZXh0ID0ge1xuICAgICAgICAvLyBJdCdzIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSBwYWdlIChhYnNvbHV0ZSBwb3NpdGlvbmluZyB3aGVuXG4gICAgICAgIC8vIHRoZSBlbGVtZW50IGlzIGEgY2hpbGQgb2YgdGhlIGJvZHkpXG4gICAgICAgIHBhZ2U6IHtcbiAgICAgICAgICB0b3A6IHRvcCxcbiAgICAgICAgICBsZWZ0OiBsZWZ0XG4gICAgICAgIH0sXG5cbiAgICAgICAgLy8gSXQncyBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgdmlld3BvcnQgKGZpeGVkIHBvc2l0aW9uaW5nKVxuICAgICAgICB2aWV3cG9ydDoge1xuICAgICAgICAgIHRvcDogdG9wIC0gcGFnZVlPZmZzZXQsXG4gICAgICAgICAgYm90dG9tOiBwYWdlWU9mZnNldCAtIHRvcCAtIGhlaWdodCArIGlubmVySGVpZ2h0LFxuICAgICAgICAgIGxlZnQ6IGxlZnQgLSBwYWdlWE9mZnNldCxcbiAgICAgICAgICByaWdodDogcGFnZVhPZmZzZXQgLSBsZWZ0IC0gd2lkdGggKyBpbm5lcldpZHRoXG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHZhciBkb2MgPSB0aGlzLnRhcmdldC5vd25lckRvY3VtZW50O1xuICAgICAgdmFyIHdpbiA9IGRvYy5kZWZhdWx0VmlldztcblxuICAgICAgdmFyIHNjcm9sbGJhclNpemUgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAod2luLmlubmVySGVpZ2h0ID4gZG9jLmRvY3VtZW50RWxlbWVudC5jbGllbnRIZWlnaHQpIHtcbiAgICAgICAgc2Nyb2xsYmFyU2l6ZSA9IHRoaXMuY2FjaGUoJ3Njcm9sbGJhci1zaXplJywgZ2V0U2Nyb2xsQmFyU2l6ZSk7XG4gICAgICAgIG5leHQudmlld3BvcnQuYm90dG9tIC09IHNjcm9sbGJhclNpemUuaGVpZ2h0O1xuICAgICAgfVxuXG4gICAgICBpZiAod2luLmlubmVyV2lkdGggPiBkb2MuZG9jdW1lbnRFbGVtZW50LmNsaWVudFdpZHRoKSB7XG4gICAgICAgIHNjcm9sbGJhclNpemUgPSB0aGlzLmNhY2hlKCdzY3JvbGxiYXItc2l6ZScsIGdldFNjcm9sbEJhclNpemUpO1xuICAgICAgICBuZXh0LnZpZXdwb3J0LnJpZ2h0IC09IHNjcm9sbGJhclNpemUud2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmIChbJycsICdzdGF0aWMnXS5pbmRleE9mKGRvYy5ib2R5LnN0eWxlLnBvc2l0aW9uKSA9PT0gLTEgfHwgWycnLCAnc3RhdGljJ10uaW5kZXhPZihkb2MuYm9keS5wYXJlbnRFbGVtZW50LnN0eWxlLnBvc2l0aW9uKSA9PT0gLTEpIHtcbiAgICAgICAgLy8gQWJzb2x1dGUgcG9zaXRpb25pbmcgaW4gdGhlIGJvZHkgd2lsbCBiZSByZWxhdGl2ZSB0byB0aGUgcGFnZSwgbm90IHRoZSAnaW5pdGlhbCBjb250YWluaW5nIGJsb2NrJ1xuICAgICAgICBuZXh0LnBhZ2UuYm90dG9tID0gZG9jLmJvZHkuc2Nyb2xsSGVpZ2h0IC0gdG9wIC0gaGVpZ2h0O1xuICAgICAgICBuZXh0LnBhZ2UucmlnaHQgPSBkb2MuYm9keS5zY3JvbGxXaWR0aCAtIGxlZnQgLSB3aWR0aDtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMub3B0aW1pemF0aW9ucyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5vcHRpb25zLm9wdGltaXphdGlvbnMubW92ZUVsZW1lbnQgIT09IGZhbHNlICYmICEodHlwZW9mIHRoaXMudGFyZ2V0TW9kaWZpZXIgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnQgPSBfdGhpczcuY2FjaGUoJ3RhcmdldC1vZmZzZXRwYXJlbnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0T2Zmc2V0UGFyZW50KF90aGlzNy50YXJnZXQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHZhciBvZmZzZXRQb3NpdGlvbiA9IF90aGlzNy5jYWNoZSgndGFyZ2V0LW9mZnNldHBhcmVudC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0Qm91bmRzKG9mZnNldFBhcmVudCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdmFyIG9mZnNldFBhcmVudFN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShvZmZzZXRQYXJlbnQpO1xuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnRTaXplID0gb2Zmc2V0UG9zaXRpb247XG5cbiAgICAgICAgICB2YXIgb2Zmc2V0Qm9yZGVyID0ge307XG4gICAgICAgICAgWydUb3AnLCAnTGVmdCcsICdCb3R0b20nLCAnUmlnaHQnXS5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgICAgICBvZmZzZXRCb3JkZXJbc2lkZS50b0xvd2VyQ2FzZSgpXSA9IHBhcnNlRmxvYXQob2Zmc2V0UGFyZW50U3R5bGVbJ2JvcmRlcicgKyBzaWRlICsgJ1dpZHRoJ10pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgb2Zmc2V0UG9zaXRpb24ucmlnaHQgPSBkb2MuYm9keS5zY3JvbGxXaWR0aCAtIG9mZnNldFBvc2l0aW9uLmxlZnQgLSBvZmZzZXRQYXJlbnRTaXplLndpZHRoICsgb2Zmc2V0Qm9yZGVyLnJpZ2h0O1xuICAgICAgICAgIG9mZnNldFBvc2l0aW9uLmJvdHRvbSA9IGRvYy5ib2R5LnNjcm9sbEhlaWdodCAtIG9mZnNldFBvc2l0aW9uLnRvcCAtIG9mZnNldFBhcmVudFNpemUuaGVpZ2h0ICsgb2Zmc2V0Qm9yZGVyLmJvdHRvbTtcblxuICAgICAgICAgIGlmIChuZXh0LnBhZ2UudG9wID49IG9mZnNldFBvc2l0aW9uLnRvcCArIG9mZnNldEJvcmRlci50b3AgJiYgbmV4dC5wYWdlLmJvdHRvbSA+PSBvZmZzZXRQb3NpdGlvbi5ib3R0b20pIHtcbiAgICAgICAgICAgIGlmIChuZXh0LnBhZ2UubGVmdCA+PSBvZmZzZXRQb3NpdGlvbi5sZWZ0ICsgb2Zmc2V0Qm9yZGVyLmxlZnQgJiYgbmV4dC5wYWdlLnJpZ2h0ID49IG9mZnNldFBvc2l0aW9uLnJpZ2h0KSB7XG4gICAgICAgICAgICAgIC8vIFdlJ3JlIHdpdGhpbiB0aGUgdmlzaWJsZSBwYXJ0IG9mIHRoZSB0YXJnZXQncyBzY3JvbGwgcGFyZW50XG4gICAgICAgICAgICAgIHZhciBzY3JvbGxUb3AgPSBvZmZzZXRQYXJlbnQuc2Nyb2xsVG9wO1xuICAgICAgICAgICAgICB2YXIgc2Nyb2xsTGVmdCA9IG9mZnNldFBhcmVudC5zY3JvbGxMZWZ0O1xuXG4gICAgICAgICAgICAgIC8vIEl0J3MgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIHRhcmdldCdzIG9mZnNldCBwYXJlbnQgKGFic29sdXRlIHBvc2l0aW9uaW5nIHdoZW5cbiAgICAgICAgICAgICAgLy8gdGhlIGVsZW1lbnQgaXMgbW92ZWQgdG8gYmUgYSBjaGlsZCBvZiB0aGUgdGFyZ2V0J3Mgb2Zmc2V0IHBhcmVudCkuXG4gICAgICAgICAgICAgIG5leHQub2Zmc2V0ID0ge1xuICAgICAgICAgICAgICAgIHRvcDogbmV4dC5wYWdlLnRvcCAtIG9mZnNldFBvc2l0aW9uLnRvcCArIHNjcm9sbFRvcCAtIG9mZnNldEJvcmRlci50b3AsXG4gICAgICAgICAgICAgICAgbGVmdDogbmV4dC5wYWdlLmxlZnQgLSBvZmZzZXRQb3NpdGlvbi5sZWZ0ICsgc2Nyb2xsTGVmdCAtIG9mZnNldEJvcmRlci5sZWZ0XG4gICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpO1xuICAgICAgfVxuXG4gICAgICAvLyBXZSBjb3VsZCBhbHNvIHRyYXZlbCB1cCB0aGUgRE9NIGFuZCB0cnkgZWFjaCBjb250YWluaW5nIGNvbnRleHQsIHJhdGhlciB0aGFuIG9ubHlcbiAgICAgIC8vIGxvb2tpbmcgYXQgdGhlIGJvZHksIGJ1dCB3ZSdyZSBnb25uYSBnZXQgZGltaW5pc2hpbmcgcmV0dXJucy5cblxuICAgICAgdGhpcy5tb3ZlKG5leHQpO1xuXG4gICAgICB0aGlzLmhpc3RvcnkudW5zaGlmdChuZXh0KTtcblxuICAgICAgaWYgKHRoaXMuaGlzdG9yeS5sZW5ndGggPiAzKSB7XG4gICAgICAgIHRoaXMuaGlzdG9yeS5wb3AoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKGZsdXNoQ2hhbmdlcykge1xuICAgICAgICBmbHVzaCgpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBUSEUgSVNTVUVcbiAgfSwge1xuICAgIGtleTogJ21vdmUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBtb3ZlKHBvcykge1xuICAgICAgdmFyIF90aGlzOCA9IHRoaXM7XG5cbiAgICAgIGlmICghKHR5cGVvZiB0aGlzLmVsZW1lbnQucGFyZW50Tm9kZSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdmFyIHNhbWUgPSB7fTtcblxuICAgICAgZm9yICh2YXIgdHlwZSBpbiBwb3MpIHtcbiAgICAgICAgc2FtZVt0eXBlXSA9IHt9O1xuXG4gICAgICAgIGZvciAodmFyIGtleSBpbiBwb3NbdHlwZV0pIHtcbiAgICAgICAgICB2YXIgZm91bmQgPSBmYWxzZTtcblxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5oaXN0b3J5Lmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgICB2YXIgcG9pbnQgPSB0aGlzLmhpc3RvcnlbaV07XG4gICAgICAgICAgICBpZiAodHlwZW9mIHBvaW50W3R5cGVdICE9PSAndW5kZWZpbmVkJyAmJiAhd2l0aGluKHBvaW50W3R5cGVdW2tleV0sIHBvc1t0eXBlXVtrZXldKSkge1xuICAgICAgICAgICAgICBmb3VuZCA9IHRydWU7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghZm91bmQpIHtcbiAgICAgICAgICAgIHNhbWVbdHlwZV1ba2V5XSA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHZhciBjc3MgPSB7IHRvcDogJycsIGxlZnQ6ICcnLCByaWdodDogJycsIGJvdHRvbTogJycgfTtcblxuICAgICAgdmFyIHRyYW5zY3JpYmUgPSBmdW5jdGlvbiB0cmFuc2NyaWJlKF9zYW1lLCBfcG9zKSB7XG4gICAgICAgIHZhciBoYXNPcHRpbWl6YXRpb25zID0gdHlwZW9mIF90aGlzOC5vcHRpb25zLm9wdGltaXphdGlvbnMgIT09ICd1bmRlZmluZWQnO1xuICAgICAgICB2YXIgZ3B1ID0gaGFzT3B0aW1pemF0aW9ucyA/IF90aGlzOC5vcHRpb25zLm9wdGltaXphdGlvbnMuZ3B1IDogbnVsbDtcbiAgICAgICAgaWYgKGdwdSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICB2YXIgeVBvcyA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgeFBvcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAoX3NhbWUudG9wKSB7XG4gICAgICAgICAgICBjc3MudG9wID0gMDtcbiAgICAgICAgICAgIHlQb3MgPSBfcG9zLnRvcDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3NzLmJvdHRvbSA9IDA7XG4gICAgICAgICAgICB5UG9zID0gLV9wb3MuYm90dG9tO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChfc2FtZS5sZWZ0KSB7XG4gICAgICAgICAgICBjc3MubGVmdCA9IDA7XG4gICAgICAgICAgICB4UG9zID0gX3Bvcy5sZWZ0O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjc3MucmlnaHQgPSAwO1xuICAgICAgICAgICAgeFBvcyA9IC1fcG9zLnJpZ2h0O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh3aW5kb3cubWF0Y2hNZWRpYSkge1xuICAgICAgICAgICAgLy8gSHViU3BvdC90ZXRoZXIjMjA3XG4gICAgICAgICAgICB2YXIgcmV0aW5hID0gd2luZG93Lm1hdGNoTWVkaWEoJ29ubHkgc2NyZWVuIGFuZCAobWluLXJlc29sdXRpb246IDEuM2RwcHgpJykubWF0Y2hlcyB8fCB3aW5kb3cubWF0Y2hNZWRpYSgnb25seSBzY3JlZW4gYW5kICgtd2Via2l0LW1pbi1kZXZpY2UtcGl4ZWwtcmF0aW86IDEuMyknKS5tYXRjaGVzO1xuICAgICAgICAgICAgaWYgKCFyZXRpbmEpIHtcbiAgICAgICAgICAgICAgeFBvcyA9IE1hdGgucm91bmQoeFBvcyk7XG4gICAgICAgICAgICAgIHlQb3MgPSBNYXRoLnJvdW5kKHlQb3MpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNzc1t0cmFuc2Zvcm1LZXldID0gJ3RyYW5zbGF0ZVgoJyArIHhQb3MgKyAncHgpIHRyYW5zbGF0ZVkoJyArIHlQb3MgKyAncHgpJztcblxuICAgICAgICAgIGlmICh0cmFuc2Zvcm1LZXkgIT09ICdtc1RyYW5zZm9ybScpIHtcbiAgICAgICAgICAgIC8vIFRoZSBaIHRyYW5zZm9ybSB3aWxsIGtlZXAgdGhpcyBpbiB0aGUgR1BVIChmYXN0ZXIsIGFuZCBwcmV2ZW50cyBhcnRpZmFjdHMpLFxuICAgICAgICAgICAgLy8gYnV0IElFOSBkb2Vzbid0IHN1cHBvcnQgM2QgdHJhbnNmb3JtcyBhbmQgd2lsbCBjaG9rZS5cbiAgICAgICAgICAgIGNzc1t0cmFuc2Zvcm1LZXldICs9IFwiIHRyYW5zbGF0ZVooMClcIjtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKF9zYW1lLnRvcCkge1xuICAgICAgICAgICAgY3NzLnRvcCA9IF9wb3MudG9wICsgJ3B4JztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3NzLmJvdHRvbSA9IF9wb3MuYm90dG9tICsgJ3B4JztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoX3NhbWUubGVmdCkge1xuICAgICAgICAgICAgY3NzLmxlZnQgPSBfcG9zLmxlZnQgKyAncHgnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjc3MucmlnaHQgPSBfcG9zLnJpZ2h0ICsgJ3B4JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG5cbiAgICAgIHZhciBtb3ZlZCA9IGZhbHNlO1xuICAgICAgaWYgKChzYW1lLnBhZ2UudG9wIHx8IHNhbWUucGFnZS5ib3R0b20pICYmIChzYW1lLnBhZ2UubGVmdCB8fCBzYW1lLnBhZ2UucmlnaHQpKSB7XG4gICAgICAgIGNzcy5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIHRyYW5zY3JpYmUoc2FtZS5wYWdlLCBwb3MucGFnZSk7XG4gICAgICB9IGVsc2UgaWYgKChzYW1lLnZpZXdwb3J0LnRvcCB8fCBzYW1lLnZpZXdwb3J0LmJvdHRvbSkgJiYgKHNhbWUudmlld3BvcnQubGVmdCB8fCBzYW1lLnZpZXdwb3J0LnJpZ2h0KSkge1xuICAgICAgICBjc3MucG9zaXRpb24gPSAnZml4ZWQnO1xuICAgICAgICB0cmFuc2NyaWJlKHNhbWUudmlld3BvcnQsIHBvcy52aWV3cG9ydCk7XG4gICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzYW1lLm9mZnNldCAhPT0gJ3VuZGVmaW5lZCcgJiYgc2FtZS5vZmZzZXQudG9wICYmIHNhbWUub2Zmc2V0LmxlZnQpIHtcbiAgICAgICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBjc3MucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnQgPSBfdGhpczguY2FjaGUoJ3RhcmdldC1vZmZzZXRwYXJlbnQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0T2Zmc2V0UGFyZW50KF90aGlzOC50YXJnZXQpO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgaWYgKGdldE9mZnNldFBhcmVudChfdGhpczguZWxlbWVudCkgIT09IG9mZnNldFBhcmVudCkge1xuICAgICAgICAgICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICBfdGhpczguZWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKF90aGlzOC5lbGVtZW50KTtcbiAgICAgICAgICAgICAgb2Zmc2V0UGFyZW50LmFwcGVuZENoaWxkKF90aGlzOC5lbGVtZW50KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRyYW5zY3JpYmUoc2FtZS5vZmZzZXQsIHBvcy5vZmZzZXQpO1xuICAgICAgICAgIG1vdmVkID0gdHJ1ZTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNzcy5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIHRyYW5zY3JpYmUoeyB0b3A6IHRydWUsIGxlZnQ6IHRydWUgfSwgcG9zLnBhZ2UpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIW1vdmVkKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYm9keUVsZW1lbnQpIHtcbiAgICAgICAgICBpZiAodGhpcy5lbGVtZW50LnBhcmVudE5vZGUgIT09IHRoaXMub3B0aW9ucy5ib2R5RWxlbWVudCkge1xuICAgICAgICAgICAgdGhpcy5vcHRpb25zLmJvZHlFbGVtZW50LmFwcGVuZENoaWxkKHRoaXMuZWxlbWVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhciBpc0Z1bGxzY3JlZW5FbGVtZW50ID0gZnVuY3Rpb24gaXNGdWxsc2NyZWVuRWxlbWVudChlKSB7XG4gICAgICAgICAgICB2YXIgZCA9IGUub3duZXJEb2N1bWVudDtcbiAgICAgICAgICAgIHZhciBmZSA9IGQuZnVsbHNjcmVlbkVsZW1lbnQgfHwgZC53ZWJraXRGdWxsc2NyZWVuRWxlbWVudCB8fCBkLm1vekZ1bGxTY3JlZW5FbGVtZW50IHx8IGQubXNGdWxsc2NyZWVuRWxlbWVudDtcbiAgICAgICAgICAgIHJldHVybiBmZSA9PT0gZTtcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgdmFyIG9mZnNldFBhcmVudElzQm9keSA9IHRydWU7XG5cbiAgICAgICAgICB2YXIgY3VycmVudE5vZGUgPSB0aGlzLmVsZW1lbnQucGFyZW50Tm9kZTtcbiAgICAgICAgICB3aGlsZSAoY3VycmVudE5vZGUgJiYgY3VycmVudE5vZGUubm9kZVR5cGUgPT09IDEgJiYgY3VycmVudE5vZGUudGFnTmFtZSAhPT0gJ0JPRFknICYmICFpc0Z1bGxzY3JlZW5FbGVtZW50KGN1cnJlbnROb2RlKSkge1xuICAgICAgICAgICAgaWYgKGdldENvbXB1dGVkU3R5bGUoY3VycmVudE5vZGUpLnBvc2l0aW9uICE9PSAnc3RhdGljJykge1xuICAgICAgICAgICAgICBvZmZzZXRQYXJlbnRJc0JvZHkgPSBmYWxzZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGN1cnJlbnROb2RlID0gY3VycmVudE5vZGUucGFyZW50Tm9kZTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIW9mZnNldFBhcmVudElzQm9keSkge1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5lbGVtZW50KTtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5vd25lckRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gQW55IGNzcyBjaGFuZ2Ugd2lsbCB0cmlnZ2VyIGEgcmVwYWludCwgc28gbGV0J3MgYXZvaWQgb25lIGlmIG5vdGhpbmcgY2hhbmdlZFxuICAgICAgdmFyIHdyaXRlQ1NTID0ge307XG4gICAgICB2YXIgd3JpdGUgPSBmYWxzZTtcbiAgICAgIGZvciAodmFyIGtleSBpbiBjc3MpIHtcbiAgICAgICAgdmFyIHZhbCA9IGNzc1trZXldO1xuICAgICAgICB2YXIgZWxWYWwgPSB0aGlzLmVsZW1lbnQuc3R5bGVba2V5XTtcblxuICAgICAgICBpZiAoZWxWYWwgIT09IHZhbCkge1xuICAgICAgICAgIHdyaXRlID0gdHJ1ZTtcbiAgICAgICAgICB3cml0ZUNTU1trZXldID0gdmFsO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh3cml0ZSkge1xuICAgICAgICBkZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZXh0ZW5kKF90aGlzOC5lbGVtZW50LnN0eWxlLCB3cml0ZUNTUyk7XG4gICAgICAgICAgX3RoaXM4LnRyaWdnZXIoJ3JlcG9zaXRpb25lZCcpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gVGV0aGVyQ2xhc3M7XG59KShFdmVudGVkKTtcblxuVGV0aGVyQ2xhc3MubW9kdWxlcyA9IFtdO1xuXG5UZXRoZXJCYXNlLnBvc2l0aW9uID0gcG9zaXRpb247XG5cbnZhciBUZXRoZXIgPSBleHRlbmQoVGV0aGVyQ2xhc3MsIFRldGhlckJhc2UpO1xuLyogZ2xvYmFscyBUZXRoZXJCYXNlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9zbGljZWRUb0FycmF5ID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gc2xpY2VJdGVyYXRvcihhcnIsIGkpIHsgdmFyIF9hcnIgPSBbXTsgdmFyIF9uID0gdHJ1ZTsgdmFyIF9kID0gZmFsc2U7IHZhciBfZSA9IHVuZGVmaW5lZDsgdHJ5IHsgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkgeyBfYXJyLnB1c2goX3MudmFsdWUpOyBpZiAoaSAmJiBfYXJyLmxlbmd0aCA9PT0gaSkgYnJlYWs7IH0gfSBjYXRjaCAoZXJyKSB7IF9kID0gdHJ1ZTsgX2UgPSBlcnI7IH0gZmluYWxseSB7IHRyeSB7IGlmICghX24gJiYgX2lbJ3JldHVybiddKSBfaVsncmV0dXJuJ10oKTsgfSBmaW5hbGx5IHsgaWYgKF9kKSB0aHJvdyBfZTsgfSB9IHJldHVybiBfYXJyOyB9IHJldHVybiBmdW5jdGlvbiAoYXJyLCBpKSB7IGlmIChBcnJheS5pc0FycmF5KGFycikpIHsgcmV0dXJuIGFycjsgfSBlbHNlIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGFycikpIHsgcmV0dXJuIHNsaWNlSXRlcmF0b3IoYXJyLCBpKTsgfSBlbHNlIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBhdHRlbXB0IHRvIGRlc3RydWN0dXJlIG5vbi1pdGVyYWJsZSBpbnN0YW5jZScpOyB9IH07IH0pKCk7XG5cbnZhciBfVGV0aGVyQmFzZSRVdGlscyA9IFRldGhlckJhc2UuVXRpbHM7XG52YXIgZ2V0Qm91bmRzID0gX1RldGhlckJhc2UkVXRpbHMuZ2V0Qm91bmRzO1xudmFyIGV4dGVuZCA9IF9UZXRoZXJCYXNlJFV0aWxzLmV4dGVuZDtcbnZhciB1cGRhdGVDbGFzc2VzID0gX1RldGhlckJhc2UkVXRpbHMudXBkYXRlQ2xhc3NlcztcbnZhciBkZWZlciA9IF9UZXRoZXJCYXNlJFV0aWxzLmRlZmVyO1xuXG52YXIgQk9VTkRTX0ZPUk1BVCA9IFsnbGVmdCcsICd0b3AnLCAncmlnaHQnLCAnYm90dG9tJ107XG5cbmZ1bmN0aW9uIGdldEJvdW5kaW5nUmVjdCh0ZXRoZXIsIHRvKSB7XG4gIGlmICh0byA9PT0gJ3Njcm9sbFBhcmVudCcpIHtcbiAgICB0byA9IHRldGhlci5zY3JvbGxQYXJlbnRzWzBdO1xuICB9IGVsc2UgaWYgKHRvID09PSAnd2luZG93Jykge1xuICAgIHRvID0gW3BhZ2VYT2Zmc2V0LCBwYWdlWU9mZnNldCwgaW5uZXJXaWR0aCArIHBhZ2VYT2Zmc2V0LCBpbm5lckhlaWdodCArIHBhZ2VZT2Zmc2V0XTtcbiAgfVxuXG4gIGlmICh0byA9PT0gZG9jdW1lbnQpIHtcbiAgICB0byA9IHRvLmRvY3VtZW50RWxlbWVudDtcbiAgfVxuXG4gIGlmICh0eXBlb2YgdG8ubm9kZVR5cGUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBub2RlID0gdG87XG4gICAgICB2YXIgc2l6ZSA9IGdldEJvdW5kcyh0byk7XG4gICAgICB2YXIgcG9zID0gc2l6ZTtcbiAgICAgIHZhciBzdHlsZSA9IGdldENvbXB1dGVkU3R5bGUodG8pO1xuXG4gICAgICB0byA9IFtwb3MubGVmdCwgcG9zLnRvcCwgc2l6ZS53aWR0aCArIHBvcy5sZWZ0LCBzaXplLmhlaWdodCArIHBvcy50b3BdO1xuXG4gICAgICAvLyBBY2NvdW50IGFueSBwYXJlbnQgRnJhbWVzIHNjcm9sbCBvZmZzZXRcbiAgICAgIGlmIChub2RlLm93bmVyRG9jdW1lbnQgIT09IGRvY3VtZW50KSB7XG4gICAgICAgIHZhciB3aW4gPSBub2RlLm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXc7XG4gICAgICAgIHRvWzBdICs9IHdpbi5wYWdlWE9mZnNldDtcbiAgICAgICAgdG9bMV0gKz0gd2luLnBhZ2VZT2Zmc2V0O1xuICAgICAgICB0b1syXSArPSB3aW4ucGFnZVhPZmZzZXQ7XG4gICAgICAgIHRvWzNdICs9IHdpbi5wYWdlWU9mZnNldDtcbiAgICAgIH1cblxuICAgICAgQk9VTkRTX0ZPUk1BVC5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlLCBpKSB7XG4gICAgICAgIHNpZGUgPSBzaWRlWzBdLnRvVXBwZXJDYXNlKCkgKyBzaWRlLnN1YnN0cigxKTtcbiAgICAgICAgaWYgKHNpZGUgPT09ICdUb3AnIHx8IHNpZGUgPT09ICdMZWZ0Jykge1xuICAgICAgICAgIHRvW2ldICs9IHBhcnNlRmxvYXQoc3R5bGVbJ2JvcmRlcicgKyBzaWRlICsgJ1dpZHRoJ10pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRvW2ldIC09IHBhcnNlRmxvYXQoc3R5bGVbJ2JvcmRlcicgKyBzaWRlICsgJ1dpZHRoJ10pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KSgpO1xuICB9XG5cbiAgcmV0dXJuIHRvO1xufVxuXG5UZXRoZXJCYXNlLm1vZHVsZXMucHVzaCh7XG4gIHBvc2l0aW9uOiBmdW5jdGlvbiBwb3NpdGlvbihfcmVmKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIHZhciB0b3AgPSBfcmVmLnRvcDtcbiAgICB2YXIgbGVmdCA9IF9yZWYubGVmdDtcbiAgICB2YXIgdGFyZ2V0QXR0YWNobWVudCA9IF9yZWYudGFyZ2V0QXR0YWNobWVudDtcblxuICAgIGlmICghdGhpcy5vcHRpb25zLmNvbnN0cmFpbnRzKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgX2NhY2hlID0gdGhpcy5jYWNoZSgnZWxlbWVudC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gZ2V0Qm91bmRzKF90aGlzLmVsZW1lbnQpO1xuICAgIH0pO1xuXG4gICAgdmFyIGhlaWdodCA9IF9jYWNoZS5oZWlnaHQ7XG4gICAgdmFyIHdpZHRoID0gX2NhY2hlLndpZHRoO1xuXG4gICAgaWYgKHdpZHRoID09PSAwICYmIGhlaWdodCA9PT0gMCAmJiB0eXBlb2YgdGhpcy5sYXN0U2l6ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHZhciBfbGFzdFNpemUgPSB0aGlzLmxhc3RTaXplO1xuXG4gICAgICAvLyBIYW5kbGUgdGhlIGl0ZW0gZ2V0dGluZyBoaWRkZW4gYXMgYSByZXN1bHQgb2Ygb3VyIHBvc2l0aW9uaW5nIHdpdGhvdXQgZ2xpdGNoaW5nXG4gICAgICAvLyB0aGUgY2xhc3NlcyBpbiBhbmQgb3V0XG4gICAgICB3aWR0aCA9IF9sYXN0U2l6ZS53aWR0aDtcbiAgICAgIGhlaWdodCA9IF9sYXN0U2l6ZS5oZWlnaHQ7XG4gICAgfVxuXG4gICAgdmFyIHRhcmdldFNpemUgPSB0aGlzLmNhY2hlKCd0YXJnZXQtYm91bmRzJywgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIF90aGlzLmdldFRhcmdldEJvdW5kcygpO1xuICAgIH0pO1xuXG4gICAgdmFyIHRhcmdldEhlaWdodCA9IHRhcmdldFNpemUuaGVpZ2h0O1xuICAgIHZhciB0YXJnZXRXaWR0aCA9IHRhcmdldFNpemUud2lkdGg7XG5cbiAgICB2YXIgYWxsQ2xhc3NlcyA9IFt0aGlzLmdldENsYXNzKCdwaW5uZWQnKSwgdGhpcy5nZXRDbGFzcygnb3V0LW9mLWJvdW5kcycpXTtcblxuICAgIHRoaXMub3B0aW9ucy5jb25zdHJhaW50cy5mb3JFYWNoKGZ1bmN0aW9uIChjb25zdHJhaW50KSB7XG4gICAgICB2YXIgb3V0T2ZCb3VuZHNDbGFzcyA9IGNvbnN0cmFpbnQub3V0T2ZCb3VuZHNDbGFzcztcbiAgICAgIHZhciBwaW5uZWRDbGFzcyA9IGNvbnN0cmFpbnQucGlubmVkQ2xhc3M7XG5cbiAgICAgIGlmIChvdXRPZkJvdW5kc0NsYXNzKSB7XG4gICAgICAgIGFsbENsYXNzZXMucHVzaChvdXRPZkJvdW5kc0NsYXNzKTtcbiAgICAgIH1cbiAgICAgIGlmIChwaW5uZWRDbGFzcykge1xuICAgICAgICBhbGxDbGFzc2VzLnB1c2gocGlubmVkQ2xhc3MpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgYWxsQ2xhc3Nlcy5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICAgIFsnbGVmdCcsICd0b3AnLCAncmlnaHQnLCAnYm90dG9tJ10uZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICBhbGxDbGFzc2VzLnB1c2goY2xzICsgJy0nICsgc2lkZSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIHZhciBhZGRDbGFzc2VzID0gW107XG5cbiAgICB2YXIgdEF0dGFjaG1lbnQgPSBleHRlbmQoe30sIHRhcmdldEF0dGFjaG1lbnQpO1xuICAgIHZhciBlQXR0YWNobWVudCA9IGV4dGVuZCh7fSwgdGhpcy5hdHRhY2htZW50KTtcblxuICAgIHRoaXMub3B0aW9ucy5jb25zdHJhaW50cy5mb3JFYWNoKGZ1bmN0aW9uIChjb25zdHJhaW50KSB7XG4gICAgICB2YXIgdG8gPSBjb25zdHJhaW50LnRvO1xuICAgICAgdmFyIGF0dGFjaG1lbnQgPSBjb25zdHJhaW50LmF0dGFjaG1lbnQ7XG4gICAgICB2YXIgcGluID0gY29uc3RyYWludC5waW47XG5cbiAgICAgIGlmICh0eXBlb2YgYXR0YWNobWVudCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgYXR0YWNobWVudCA9ICcnO1xuICAgICAgfVxuXG4gICAgICB2YXIgY2hhbmdlQXR0YWNoWCA9IHVuZGVmaW5lZCxcbiAgICAgICAgICBjaGFuZ2VBdHRhY2hZID0gdW5kZWZpbmVkO1xuICAgICAgaWYgKGF0dGFjaG1lbnQuaW5kZXhPZignICcpID49IDApIHtcbiAgICAgICAgdmFyIF9hdHRhY2htZW50JHNwbGl0ID0gYXR0YWNobWVudC5zcGxpdCgnICcpO1xuXG4gICAgICAgIHZhciBfYXR0YWNobWVudCRzcGxpdDIgPSBfc2xpY2VkVG9BcnJheShfYXR0YWNobWVudCRzcGxpdCwgMik7XG5cbiAgICAgICAgY2hhbmdlQXR0YWNoWSA9IF9hdHRhY2htZW50JHNwbGl0MlswXTtcbiAgICAgICAgY2hhbmdlQXR0YWNoWCA9IF9hdHRhY2htZW50JHNwbGl0MlsxXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNoYW5nZUF0dGFjaFggPSBjaGFuZ2VBdHRhY2hZID0gYXR0YWNobWVudDtcbiAgICAgIH1cblxuICAgICAgdmFyIGJvdW5kcyA9IGdldEJvdW5kaW5nUmVjdChfdGhpcywgdG8pO1xuXG4gICAgICBpZiAoY2hhbmdlQXR0YWNoWSA9PT0gJ3RhcmdldCcgfHwgY2hhbmdlQXR0YWNoWSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGlmICh0b3AgPCBib3VuZHNbMV0gJiYgdEF0dGFjaG1lbnQudG9wID09PSAndG9wJykge1xuICAgICAgICAgIHRvcCArPSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdICYmIHRBdHRhY2htZW50LnRvcCA9PT0gJ2JvdHRvbScpIHtcbiAgICAgICAgICB0b3AgLT0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgIHRBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hZID09PSAndG9nZXRoZXInKSB7XG4gICAgICAgIGlmICh0QXR0YWNobWVudC50b3AgPT09ICd0b3AnKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LnRvcCA9PT0gJ2JvdHRvbScgJiYgdG9wIDwgYm91bmRzWzFdKSB7XG4gICAgICAgICAgICB0b3AgKz0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG5cbiAgICAgICAgICAgIHRvcCArPSBoZWlnaHQ7XG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAndG9wJztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcgJiYgdG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdICYmIHRvcCAtIChoZWlnaHQgLSB0YXJnZXRIZWlnaHQpID49IGJvdW5kc1sxXSkge1xuICAgICAgICAgICAgdG9wIC09IGhlaWdodCAtIHRhcmdldEhlaWdodDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuXG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodEF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJykge1xuICAgICAgICAgIGlmIChlQXR0YWNobWVudC50b3AgPT09ICd0b3AnICYmIHRvcCArIGhlaWdodCA+IGJvdW5kc1szXSkge1xuICAgICAgICAgICAgdG9wIC09IHRhcmdldEhlaWdodDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuXG4gICAgICAgICAgICB0b3AgLT0gaGVpZ2h0O1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC50b3AgPT09ICdib3R0b20nICYmIHRvcCA8IGJvdW5kc1sxXSAmJiB0b3AgKyAoaGVpZ2h0ICogMiAtIHRhcmdldEhlaWdodCkgPD0gYm91bmRzWzNdKSB7XG4gICAgICAgICAgICB0b3AgKz0gaGVpZ2h0IC0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG5cbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0QXR0YWNobWVudC50b3AgPT09ICdtaWRkbGUnKSB7XG4gICAgICAgICAgaWYgKHRvcCArIGhlaWdodCA+IGJvdW5kc1szXSAmJiBlQXR0YWNobWVudC50b3AgPT09ICd0b3AnKSB7XG4gICAgICAgICAgICB0b3AgLT0gaGVpZ2h0O1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG4gICAgICAgICAgfSBlbHNlIGlmICh0b3AgPCBib3VuZHNbMV0gJiYgZUF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJykge1xuICAgICAgICAgICAgdG9wICs9IGhlaWdodDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY2hhbmdlQXR0YWNoWCA9PT0gJ3RhcmdldCcgfHwgY2hhbmdlQXR0YWNoWCA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGlmIChsZWZ0IDwgYm91bmRzWzBdICYmIHRBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgIGxlZnQgKz0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgdEF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGVmdCArIHdpZHRoID4gYm91bmRzWzJdICYmIHRBdHRhY2htZW50LmxlZnQgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICBsZWZ0IC09IHRhcmdldFdpZHRoO1xuICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFggPT09ICd0b2dldGhlcicpIHtcbiAgICAgICAgaWYgKGxlZnQgPCBib3VuZHNbMF0gJiYgdEF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICAgIGxlZnQgKz0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcblxuICAgICAgICAgICAgbGVmdCArPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAnbGVmdCcpIHtcbiAgICAgICAgICAgIGxlZnQgKz0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcblxuICAgICAgICAgICAgbGVmdCAtPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChsZWZ0ICsgd2lkdGggPiBib3VuZHNbMl0gJiYgdEF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAnbGVmdCcpIHtcbiAgICAgICAgICAgIGxlZnQgLT0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuXG4gICAgICAgICAgICBsZWZ0IC09IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgICBsZWZ0IC09IHRhcmdldFdpZHRoO1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcblxuICAgICAgICAgICAgbGVmdCArPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRBdHRhY2htZW50LmxlZnQgPT09ICdjZW50ZXInKSB7XG4gICAgICAgICAgaWYgKGxlZnQgKyB3aWR0aCA+IGJvdW5kc1syXSAmJiBlQXR0YWNobWVudC5sZWZ0ID09PSAnbGVmdCcpIHtcbiAgICAgICAgICAgIGxlZnQgLT0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKGxlZnQgPCBib3VuZHNbMF0gJiYgZUF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgICAgbGVmdCArPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hZID09PSAnZWxlbWVudCcgfHwgY2hhbmdlQXR0YWNoWSA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGlmICh0b3AgPCBib3VuZHNbMV0gJiYgZUF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJykge1xuICAgICAgICAgIHRvcCArPSBoZWlnaHQ7XG4gICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdICYmIGVBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcpIHtcbiAgICAgICAgICB0b3AgLT0gaGVpZ2h0O1xuICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hYID09PSAnZWxlbWVudCcgfHwgY2hhbmdlQXR0YWNoWCA9PT0gJ2JvdGgnKSB7XG4gICAgICAgIGlmIChsZWZ0IDwgYm91bmRzWzBdKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICAgIGxlZnQgKz0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ2NlbnRlcicpIHtcbiAgICAgICAgICAgIGxlZnQgKz0gd2lkdGggLyAyO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobGVmdCArIHdpZHRoID4gYm91bmRzWzJdKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgbGVmdCAtPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ2NlbnRlcicpIHtcbiAgICAgICAgICAgIGxlZnQgLT0gd2lkdGggLyAyO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgcGluID09PSAnc3RyaW5nJykge1xuICAgICAgICBwaW4gPSBwaW4uc3BsaXQoJywnKS5tYXAoZnVuY3Rpb24gKHApIHtcbiAgICAgICAgICByZXR1cm4gcC50cmltKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChwaW4gPT09IHRydWUpIHtcbiAgICAgICAgcGluID0gWyd0b3AnLCAnbGVmdCcsICdyaWdodCcsICdib3R0b20nXTtcbiAgICAgIH1cblxuICAgICAgcGluID0gcGluIHx8IFtdO1xuXG4gICAgICB2YXIgcGlubmVkID0gW107XG4gICAgICB2YXIgb29iID0gW107XG5cbiAgICAgIGlmICh0b3AgPCBib3VuZHNbMV0pIHtcbiAgICAgICAgaWYgKHBpbi5pbmRleE9mKCd0b3AnKSA+PSAwKSB7XG4gICAgICAgICAgdG9wID0gYm91bmRzWzFdO1xuICAgICAgICAgIHBpbm5lZC5wdXNoKCd0b3AnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvb2IucHVzaCgndG9wJyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHRvcCArIGhlaWdodCA+IGJvdW5kc1szXSkge1xuICAgICAgICBpZiAocGluLmluZGV4T2YoJ2JvdHRvbScpID49IDApIHtcbiAgICAgICAgICB0b3AgPSBib3VuZHNbM10gLSBoZWlnaHQ7XG4gICAgICAgICAgcGlubmVkLnB1c2goJ2JvdHRvbScpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9vYi5wdXNoKCdib3R0b20nKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobGVmdCA8IGJvdW5kc1swXSkge1xuICAgICAgICBpZiAocGluLmluZGV4T2YoJ2xlZnQnKSA+PSAwKSB7XG4gICAgICAgICAgbGVmdCA9IGJvdW5kc1swXTtcbiAgICAgICAgICBwaW5uZWQucHVzaCgnbGVmdCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9vYi5wdXNoKCdsZWZ0Jyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGxlZnQgKyB3aWR0aCA+IGJvdW5kc1syXSkge1xuICAgICAgICBpZiAocGluLmluZGV4T2YoJ3JpZ2h0JykgPj0gMCkge1xuICAgICAgICAgIGxlZnQgPSBib3VuZHNbMl0gLSB3aWR0aDtcbiAgICAgICAgICBwaW5uZWQucHVzaCgncmlnaHQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvb2IucHVzaCgncmlnaHQnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocGlubmVkLmxlbmd0aCkge1xuICAgICAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBwaW5uZWRDbGFzcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAodHlwZW9mIF90aGlzLm9wdGlvbnMucGlubmVkQ2xhc3MgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBwaW5uZWRDbGFzcyA9IF90aGlzLm9wdGlvbnMucGlubmVkQ2xhc3M7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHBpbm5lZENsYXNzID0gX3RoaXMuZ2V0Q2xhc3MoJ3Bpbm5lZCcpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGFkZENsYXNzZXMucHVzaChwaW5uZWRDbGFzcyk7XG4gICAgICAgICAgcGlubmVkLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgICAgICAgIGFkZENsYXNzZXMucHVzaChwaW5uZWRDbGFzcyArICctJyArIHNpZGUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAob29iLmxlbmd0aCkge1xuICAgICAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHZhciBvb2JDbGFzcyA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBpZiAodHlwZW9mIF90aGlzLm9wdGlvbnMub3V0T2ZCb3VuZHNDbGFzcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIG9vYkNsYXNzID0gX3RoaXMub3B0aW9ucy5vdXRPZkJvdW5kc0NsYXNzO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBvb2JDbGFzcyA9IF90aGlzLmdldENsYXNzKCdvdXQtb2YtYm91bmRzJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYWRkQ2xhc3Nlcy5wdXNoKG9vYkNsYXNzKTtcbiAgICAgICAgICBvb2IuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICAgICAgYWRkQ2xhc3Nlcy5wdXNoKG9vYkNsYXNzICsgJy0nICsgc2lkZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChwaW5uZWQuaW5kZXhPZignbGVmdCcpID49IDAgfHwgcGlubmVkLmluZGV4T2YoJ3JpZ2h0JykgPj0gMCkge1xuICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gdEF0dGFjaG1lbnQubGVmdCA9IGZhbHNlO1xuICAgICAgfVxuICAgICAgaWYgKHBpbm5lZC5pbmRleE9mKCd0b3AnKSA+PSAwIHx8IHBpbm5lZC5pbmRleE9mKCdib3R0b20nKSA+PSAwKSB7XG4gICAgICAgIGVBdHRhY2htZW50LnRvcCA9IHRBdHRhY2htZW50LnRvcCA9IGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAodEF0dGFjaG1lbnQudG9wICE9PSB0YXJnZXRBdHRhY2htZW50LnRvcCB8fCB0QXR0YWNobWVudC5sZWZ0ICE9PSB0YXJnZXRBdHRhY2htZW50LmxlZnQgfHwgZUF0dGFjaG1lbnQudG9wICE9PSBfdGhpcy5hdHRhY2htZW50LnRvcCB8fCBlQXR0YWNobWVudC5sZWZ0ICE9PSBfdGhpcy5hdHRhY2htZW50LmxlZnQpIHtcbiAgICAgICAgX3RoaXMudXBkYXRlQXR0YWNoQ2xhc3NlcyhlQXR0YWNobWVudCwgdEF0dGFjaG1lbnQpO1xuICAgICAgICBfdGhpcy50cmlnZ2VyKCd1cGRhdGUnLCB7XG4gICAgICAgICAgYXR0YWNobWVudDogZUF0dGFjaG1lbnQsXG4gICAgICAgICAgdGFyZ2V0QXR0YWNobWVudDogdEF0dGFjaG1lbnRcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBkZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIShfdGhpcy5vcHRpb25zLmFkZFRhcmdldENsYXNzZXMgPT09IGZhbHNlKSkge1xuICAgICAgICB1cGRhdGVDbGFzc2VzKF90aGlzLnRhcmdldCwgYWRkQ2xhc3NlcywgYWxsQ2xhc3Nlcyk7XG4gICAgICB9XG4gICAgICB1cGRhdGVDbGFzc2VzKF90aGlzLmVsZW1lbnQsIGFkZENsYXNzZXMsIGFsbENsYXNzZXMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQgfTtcbiAgfVxufSk7XG4vKiBnbG9iYWxzIFRldGhlckJhc2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX1RldGhlckJhc2UkVXRpbHMgPSBUZXRoZXJCYXNlLlV0aWxzO1xudmFyIGdldEJvdW5kcyA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldEJvdW5kcztcbnZhciB1cGRhdGVDbGFzc2VzID0gX1RldGhlckJhc2UkVXRpbHMudXBkYXRlQ2xhc3NlcztcbnZhciBkZWZlciA9IF9UZXRoZXJCYXNlJFV0aWxzLmRlZmVyO1xuXG5UZXRoZXJCYXNlLm1vZHVsZXMucHVzaCh7XG4gIHBvc2l0aW9uOiBmdW5jdGlvbiBwb3NpdGlvbihfcmVmKSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIHZhciB0b3AgPSBfcmVmLnRvcDtcbiAgICB2YXIgbGVmdCA9IF9yZWYubGVmdDtcblxuICAgIHZhciBfY2FjaGUgPSB0aGlzLmNhY2hlKCdlbGVtZW50LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBnZXRCb3VuZHMoX3RoaXMuZWxlbWVudCk7XG4gICAgfSk7XG5cbiAgICB2YXIgaGVpZ2h0ID0gX2NhY2hlLmhlaWdodDtcbiAgICB2YXIgd2lkdGggPSBfY2FjaGUud2lkdGg7XG5cbiAgICB2YXIgdGFyZ2V0UG9zID0gdGhpcy5nZXRUYXJnZXRCb3VuZHMoKTtcblxuICAgIHZhciBib3R0b20gPSB0b3AgKyBoZWlnaHQ7XG4gICAgdmFyIHJpZ2h0ID0gbGVmdCArIHdpZHRoO1xuXG4gICAgdmFyIGFidXR0ZWQgPSBbXTtcbiAgICBpZiAodG9wIDw9IHRhcmdldFBvcy5ib3R0b20gJiYgYm90dG9tID49IHRhcmdldFBvcy50b3ApIHtcbiAgICAgIFsnbGVmdCcsICdyaWdodCddLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgICAgdmFyIHRhcmdldFBvc1NpZGUgPSB0YXJnZXRQb3Nbc2lkZV07XG4gICAgICAgIGlmICh0YXJnZXRQb3NTaWRlID09PSBsZWZ0IHx8IHRhcmdldFBvc1NpZGUgPT09IHJpZ2h0KSB7XG4gICAgICAgICAgYWJ1dHRlZC5wdXNoKHNpZGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAobGVmdCA8PSB0YXJnZXRQb3MucmlnaHQgJiYgcmlnaHQgPj0gdGFyZ2V0UG9zLmxlZnQpIHtcbiAgICAgIFsndG9wJywgJ2JvdHRvbSddLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgICAgdmFyIHRhcmdldFBvc1NpZGUgPSB0YXJnZXRQb3Nbc2lkZV07XG4gICAgICAgIGlmICh0YXJnZXRQb3NTaWRlID09PSB0b3AgfHwgdGFyZ2V0UG9zU2lkZSA9PT0gYm90dG9tKSB7XG4gICAgICAgICAgYWJ1dHRlZC5wdXNoKHNpZGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgYWxsQ2xhc3NlcyA9IFtdO1xuICAgIHZhciBhZGRDbGFzc2VzID0gW107XG5cbiAgICB2YXIgc2lkZXMgPSBbJ2xlZnQnLCAndG9wJywgJ3JpZ2h0JywgJ2JvdHRvbSddO1xuICAgIGFsbENsYXNzZXMucHVzaCh0aGlzLmdldENsYXNzKCdhYnV0dGVkJykpO1xuICAgIHNpZGVzLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgIGFsbENsYXNzZXMucHVzaChfdGhpcy5nZXRDbGFzcygnYWJ1dHRlZCcpICsgJy0nICsgc2lkZSk7XG4gICAgfSk7XG5cbiAgICBpZiAoYWJ1dHRlZC5sZW5ndGgpIHtcbiAgICAgIGFkZENsYXNzZXMucHVzaCh0aGlzLmdldENsYXNzKCdhYnV0dGVkJykpO1xuICAgIH1cblxuICAgIGFidXR0ZWQuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgYWRkQ2xhc3Nlcy5wdXNoKF90aGlzLmdldENsYXNzKCdhYnV0dGVkJykgKyAnLScgKyBzaWRlKTtcbiAgICB9KTtcblxuICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghKF90aGlzLm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXMudGFyZ2V0LCBhZGRDbGFzc2VzLCBhbGxDbGFzc2VzKTtcbiAgICAgIH1cbiAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXMuZWxlbWVudCwgYWRkQ2xhc3NlcywgYWxsQ2xhc3Nlcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufSk7XG4vKiBnbG9iYWxzIFRldGhlckJhc2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3NsaWNlZFRvQXJyYXkgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkgeyB2YXIgX2FyciA9IFtdOyB2YXIgX24gPSB0cnVlOyB2YXIgX2QgPSBmYWxzZTsgdmFyIF9lID0gdW5kZWZpbmVkOyB0cnkgeyBmb3IgKHZhciBfaSA9IGFycltTeW1ib2wuaXRlcmF0b3JdKCksIF9zOyAhKF9uID0gKF9zID0gX2kubmV4dCgpKS5kb25lKTsgX24gPSB0cnVlKSB7IF9hcnIucHVzaChfcy52YWx1ZSk7IGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhazsgfSB9IGNhdGNoIChlcnIpIHsgX2QgPSB0cnVlOyBfZSA9IGVycjsgfSBmaW5hbGx5IHsgdHJ5IHsgaWYgKCFfbiAmJiBfaVsncmV0dXJuJ10pIF9pWydyZXR1cm4nXSgpOyB9IGZpbmFsbHkgeyBpZiAoX2QpIHRocm93IF9lOyB9IH0gcmV0dXJuIF9hcnI7IH0gcmV0dXJuIGZ1bmN0aW9uIChhcnIsIGkpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyByZXR1cm4gYXJyOyB9IGVsc2UgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkgeyByZXR1cm4gc2xpY2VJdGVyYXRvcihhcnIsIGkpOyB9IGVsc2UgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlJyk7IH0gfTsgfSkoKTtcblxuVGV0aGVyQmFzZS5tb2R1bGVzLnB1c2goe1xuICBwb3NpdGlvbjogZnVuY3Rpb24gcG9zaXRpb24oX3JlZikge1xuICAgIHZhciB0b3AgPSBfcmVmLnRvcDtcbiAgICB2YXIgbGVmdCA9IF9yZWYubGVmdDtcblxuICAgIGlmICghdGhpcy5vcHRpb25zLnNoaWZ0KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHNoaWZ0ID0gdGhpcy5vcHRpb25zLnNoaWZ0O1xuICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLnNoaWZ0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICBzaGlmdCA9IHRoaXMub3B0aW9ucy5zaGlmdC5jYWxsKHRoaXMsIHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQgfSk7XG4gICAgfVxuXG4gICAgdmFyIHNoaWZ0VG9wID0gdW5kZWZpbmVkLFxuICAgICAgICBzaGlmdExlZnQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKHR5cGVvZiBzaGlmdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHNoaWZ0ID0gc2hpZnQuc3BsaXQoJyAnKTtcbiAgICAgIHNoaWZ0WzFdID0gc2hpZnRbMV0gfHwgc2hpZnRbMF07XG5cbiAgICAgIHZhciBfc2hpZnQgPSBzaGlmdDtcblxuICAgICAgdmFyIF9zaGlmdDIgPSBfc2xpY2VkVG9BcnJheShfc2hpZnQsIDIpO1xuXG4gICAgICBzaGlmdFRvcCA9IF9zaGlmdDJbMF07XG4gICAgICBzaGlmdExlZnQgPSBfc2hpZnQyWzFdO1xuXG4gICAgICBzaGlmdFRvcCA9IHBhcnNlRmxvYXQoc2hpZnRUb3AsIDEwKTtcbiAgICAgIHNoaWZ0TGVmdCA9IHBhcnNlRmxvYXQoc2hpZnRMZWZ0LCAxMCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNoaWZ0VG9wID0gc2hpZnQudG9wO1xuICAgICAgc2hpZnRMZWZ0ID0gc2hpZnQubGVmdDtcbiAgICB9XG5cbiAgICB0b3AgKz0gc2hpZnRUb3A7XG4gICAgbGVmdCArPSBzaGlmdExlZnQ7XG5cbiAgICByZXR1cm4geyB0b3A6IHRvcCwgbGVmdDogbGVmdCB9O1xuICB9XG59KTtcbnJldHVybiBUZXRoZXI7XG5cbn0pKTtcbiIsImNvbnN0IHBhbmVsID0gJ0Vtb2ppUGFuZWwnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBwYW5lbCxcbiAgICBvcGVuOiBwYW5lbCArICctLW9wZW4nLFxuICAgIHRyaWdnZXI6IHBhbmVsICsgJy0tdHJpZ2dlcicsXG4gICAgXG4gICAgaWNvbnM6IFwiaWNvbl9wYWNrXCIsXG4gICAgaWNvbnBpY2s6IFwiaWNvbl9waWNrZXJcIixcbiAgICBlbW9qaXBpY2s6IFwiZW1vamlfcGlja2VyXCIsXG4gICAgZW1vamk6ICdlbW9qaScsXG4gICAgc3ZnOiBwYW5lbCArICdfX3N2ZycsXG5cbiAgICB0b29sdGlwOiBwYW5lbCArICdfX3Rvb2x0aXAnLFxuXG4gICAgY29udGVudDogcGFuZWwgKyAnX19jb250ZW50JyxcbiAgICBoZWFkZXI6IHBhbmVsICsgJ19faGVhZGVyJyxcbiAgICBxdWVyeTogcGFuZWwgKyAnX19xdWVyeScsXG4gICAgc2VhcmNoSW5wdXQ6IHBhbmVsICsgJ19fcXVlcnlJbnB1dCcsXG4gICAgc2VhcmNoVGl0bGU6IHBhbmVsICsgJ19fc2VhcmNoVGl0bGUnLFxuICAgIGZyZXF1ZW50VGl0bGU6IHBhbmVsICsgJ19fZnJlcXVlbnRUaXRsZScsXG5cbiAgICByZXN1bHRzOiBwYW5lbCArICdfX3Jlc3VsdHMnLFxuICAgIG5vUmVzdWx0czogcGFuZWwgKyAnX19ub1Jlc3VsdHMnLFxuICAgIGNhdGVnb3J5OiBwYW5lbCArICdfX2NhdGVnb3J5JyxcbiAgICBjYXRlZ29yaWVzOiBwYW5lbCArICdfX2NhdGVnb3JpZXMnLFxuXG4gICAgZm9vdGVyOiBwYW5lbCArICdfX2Zvb3RlcicsXG4gICAgYnJhbmQ6IHBhbmVsICsgJ19fYnJhbmQnLFxuICAgIGJ0bk1vZGlmaWVyOiBwYW5lbCArICdfX2J0bk1vZGlmaWVyJyxcbiAgICBidG5Nb2RpZmllclRvZ2dsZTogcGFuZWwgKyAnX19idG5Nb2RpZmllclRvZ2dsZScsXG4gICAgbW9kaWZpZXJEcm9wZG93bjogcGFuZWwgKyAnX19tb2RpZmllckRyb3Bkb3duJyxcbn07XG4iLCJjb25zdCBUZXRoZXIgPSByZXF1aXJlKCd0ZXRoZXInKTtcblxuY29uc3QgRW1vamlzID0gcmVxdWlyZSgnLi9lbW9qaXMnKTtcblxuY29uc3QgQ3JlYXRlID0gKG9wdGlvbnMsIGVtaXQsIHRvZ2dsZSkgPT4ge1xuICAgIGlmKG9wdGlvbnMuZWRpdGFibGUpIHtcbiAgICAgICAgLy8gU2V0IHRoZSBjYXJldCBvZmZzZXQgb24gdGhlIGlucHV0XG4gICAgICAgIGNvbnN0IGhhbmRsZUNoYW5nZSA9IGUgPT4ge1xuICAgICAgICAgICAgb3B0aW9ucy5lZGl0YWJsZS5kYXRhc2V0Lm9mZnNldCA9IGdldENhcmV0UG9zaXRpb24ob3B0aW9ucy5lZGl0YWJsZSk7XG4gICAgICAgIH07XG4gICAgICAgIG9wdGlvbnMuZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBoYW5kbGVDaGFuZ2UpO1xuICAgICAgICBvcHRpb25zLmVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGhhbmRsZUNoYW5nZSk7XG4gICAgICAgIG9wdGlvbnMuZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBoYW5kbGVDaGFuZ2UpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgZHJvcGRvd24gcGFuZWxcbiAgICBjb25zdCBwYW5lbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpXG4gICAge1xuICAgICAgICBwYW5lbC5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5wYW5lbCk7XG4gICAgICAgIHBhbmVsLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmVtb2ppcGljayk7IFxuICAgIH1cbiAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIil7XG4gICAgICAgIHBhbmVsLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnBhbmVsKTsgXG4gICAgICAgIHBhbmVsLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmljb25waWNrKTsgXG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGNvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb250ZW50LmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNvbnRlbnQpO1xuICAgIHBhbmVsLmFwcGVuZENoaWxkKGNvbnRlbnQpO1xuXG4gICAgbGV0IHNlYXJjaElucHV0O1xuICAgIGxldCByZXN1bHRzO1xuICAgIGxldCBlbXB0eVN0YXRlO1xuICAgIGxldCBmcmVxdWVudFRpdGxlO1xuXG4gICAgaWYob3B0aW9ucy50cmlnZ2VyKSB7XG4gICAgICAgIHBhbmVsLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnRyaWdnZXIpO1xuICAgICAgICAvLyBMaXN0ZW4gZm9yIHRoZSB0cmlnZ2VyXG4gICAgICAgIG9wdGlvbnMudHJpZ2dlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRvZ2dsZSgpKTtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIHRvb2x0aXBcbiAgICAgICAgb3B0aW9ucy50cmlnZ2VyLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBvcHRpb25zLmxvY2FsZS5hZGQpO1xuICAgICAgICBjb25zdCB0b29sdGlwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgICAgICB0b29sdGlwLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnRvb2x0aXApO1xuICAgICAgICB0b29sdGlwLmlubmVySFRNTCA9IG9wdGlvbnMubG9jYWxlLmFkZDtcbiAgICAgICAgb3B0aW9ucy50cmlnZ2VyLmFwcGVuZENoaWxkKHRvb2x0aXApO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSB0aGUgY2F0ZWdvcnkgbGlua3NcbiAgICBjb25zdCBoZWFkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdoZWFkZXInKTtcbiAgICBoZWFkZXIuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuaGVhZGVyKTtcbiAgICBjb250ZW50LmFwcGVuZENoaWxkKGhlYWRlcik7XG5cbiAgICBjb25zdCBjYXRlZ29yaWVzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY2F0ZWdvcmllcy5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5jYXRlZ29yaWVzKTtcbiAgICBoZWFkZXIuYXBwZW5kQ2hpbGQoY2F0ZWdvcmllcyk7XG5cbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgOTsgaSsrKSB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5TGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgICBjYXRlZ29yeUxpbmsuY2xhc3NMaXN0LmFkZCgndGVtcCcpO1xuICAgICAgICBjYXRlZ29yaWVzLmFwcGVuZENoaWxkKGNhdGVnb3J5TGluayk7XG4gICAgfVxuICAgIFxuICAgIC8vIENyZWF0ZSB0aGUgbGlzdFxuICAgIHJlc3VsdHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICByZXN1bHRzLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnJlc3VsdHMpO1xuICAgIGNvbnRlbnQuYXBwZW5kQ2hpbGQocmVzdWx0cyk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIHNlYXJjaCBpbnB1dFxuICAgIGlmKG9wdGlvbnMuc2VhcmNoID09IHRydWUpIHtcbiAgICAgICAgY29uc3QgcXVlcnkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgcXVlcnkuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMucXVlcnkpO1xuICAgICAgICBoZWFkZXIuYXBwZW5kQ2hpbGQocXVlcnkpO1xuXG4gICAgICAgIHNlYXJjaElucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcbiAgICAgICAgc2VhcmNoSW5wdXQuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuc2VhcmNoSW5wdXQpO1xuICAgICAgICBzZWFyY2hJbnB1dC5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAndGV4dCcpO1xuICAgICAgICBzZWFyY2hJbnB1dC5zZXRBdHRyaWJ1dGUoJ2F1dG9Db21wbGV0ZScsICdvZmYnKTtcbiAgICAgICAgc2VhcmNoSW5wdXQuc2V0QXR0cmlidXRlKCdwbGFjZWhvbGRlcicsIG9wdGlvbnMubG9jYWxlLnNlYXJjaCk7XG4gICAgICAgIHF1ZXJ5LmFwcGVuZENoaWxkKHNlYXJjaElucHV0KTtcblxuICAgICAgICBjb25zdCBpY29uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGljb24uaW5uZXJIVE1MID0gb3B0aW9ucy5pY29ucy5zZWFyY2g7XG4gICAgICAgIHF1ZXJ5LmFwcGVuZENoaWxkKGljb24pO1xuXG4gICAgICAgIGNvbnN0IHNlYXJjaFRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICAgICAgICBzZWFyY2hUaXRsZS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5jYXRlZ29yeSwgb3B0aW9ucy5jbGFzc25hbWVzLnNlYXJjaFRpdGxlKTtcbiAgICAgICAgc2VhcmNoVGl0bGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgc2VhcmNoVGl0bGUuaW5uZXJIVE1MID0gb3B0aW9ucy5sb2NhbGUuc2VhcmNoX3Jlc3VsdHM7XG4gICAgICAgIHJlc3VsdHMuYXBwZW5kQ2hpbGQoc2VhcmNoVGl0bGUpO1xuXG4gICAgICAgIGVtcHR5U3RhdGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIGVtcHR5U3RhdGUuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMubm9SZXN1bHRzKTtcbiAgICAgICAgZW1wdHlTdGF0ZS5pbm5lckhUTUwgPSBvcHRpb25zLmxvY2FsZS5ub19yZXN1bHRzO1xuICAgICAgICByZXN1bHRzLmFwcGVuZENoaWxkKGVtcHR5U3RhdGUpO1xuICAgIH1cblxuICAgIGlmKG9wdGlvbnMuZnJlcXVlbnQgPT0gdHJ1ZSkge1xuICAgICAgICBsZXQgZnJlcXVlbnRMaXN0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ0Vtb2ppUGFuZWwtZnJlcXVlbnQnKTtcbiAgICAgICAgaWYoZnJlcXVlbnRMaXN0KSB7XG4gICAgICAgICAgICBmcmVxdWVudExpc3QgPSBKU09OLnBhcnNlKGZyZXF1ZW50TGlzdCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmVxdWVudExpc3QgPSBbXTtcbiAgICAgICAgfVxuICAgICAgICBmcmVxdWVudFRpdGxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgncCcpO1xuICAgICAgICBmcmVxdWVudFRpdGxlLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3J5LCBvcHRpb25zLmNsYXNzbmFtZXMuZnJlcXVlbnRUaXRsZSk7XG4gICAgICAgIGZyZXF1ZW50VGl0bGUuaW5uZXJIVE1MID0gb3B0aW9ucy5sb2NhbGUuZnJlcXVlbnQ7XG4gICAgICAgIGlmKGZyZXF1ZW50TGlzdC5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgZnJlcXVlbnRUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdHMuYXBwZW5kQ2hpbGQoZnJlcXVlbnRUaXRsZSk7XG5cbiAgICAgICAgY29uc3QgZnJlcXVlbnRSZXN1bHRzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIGZyZXF1ZW50UmVzdWx0cy5jbGFzc0xpc3QuYWRkKCdFbW9qaVBhbmVsLWZyZXF1ZW50Jyk7XG5cbiAgICAgICAgZnJlcXVlbnRMaXN0LmZvckVhY2goZW1vamkgPT4ge1xuICAgICAgICAgICAgZnJlcXVlbnRSZXN1bHRzLmFwcGVuZENoaWxkKEVtb2ppcy5jcmVhdGVCdXR0b24oZW1vamksIG9wdGlvbnMsIGVtaXQpKTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJlc3VsdHMuYXBwZW5kQ2hpbGQoZnJlcXVlbnRSZXN1bHRzKTtcbiAgICB9XG5cbiAgICBjb25zdCBsb2FkaW5nVGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gICAgbG9hZGluZ1RpdGxlLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3J5KTtcbiAgICBsb2FkaW5nVGl0bGUudGV4dENvbnRlbnQgPSBvcHRpb25zLmxvY2FsZS5sb2FkaW5nO1xuICAgIHJlc3VsdHMuYXBwZW5kQ2hpbGQobG9hZGluZ1RpdGxlKTtcbiAgICBmb3IobGV0IGkgPSAwOyBpIDwgOSAqIDg7IGkrKykge1xuICAgICAgICBjb25zdCB0ZW1wRW1vamkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgICAgdGVtcEVtb2ppLmNsYXNzTGlzdC5hZGQoJ3RlbXAnKTtcbiAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZCh0ZW1wRW1vamkpO1xuICAgIH1cblxuICAgIGNvbnN0IGZvb3RlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2Zvb3RlcicpO1xuICAgIGZvb3Rlci5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5mb290ZXIpO1xuICAgIHBhbmVsLmFwcGVuZENoaWxkKGZvb3Rlcik7XG5cbiAgICBpZihvcHRpb25zLmxvY2FsZS5icmFuZCkge1xuICAgICAgICBjb25zdCBicmFuZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICAgICAgYnJhbmQuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuYnJhbmQpO1xuICAgICAgICBicmFuZC5zZXRBdHRyaWJ1dGUoJ2hyZWYnLCAnaHR0cHM6Ly9lbW9qaXBhbmVsLmpzLm9yZycpO1xuICAgICAgICBicmFuZC50ZXh0Q29udGVudCA9IG9wdGlvbnMubG9jYWxlLmJyYW5kO1xuICAgICAgICBmb290ZXIuYXBwZW5kQ2hpbGQoYnJhbmQpO1xuICAgIH1cblxuICAgIC8vIEFwcGVuZCB0aGUgZHJvcGRvd24gbWVudSB0byB0aGUgY29udGFpbmVyXG4gICAgb3B0aW9ucy5jb250YWluZXIuYXBwZW5kQ2hpbGQocGFuZWwpO1xuXG4gICAgLy8gVGV0aGVyIHRoZSBkcm9wZG93biB0byB0aGUgdHJpZ2dlclxuICAgIGxldCB0ZXRoZXI7XG4gICAgaWYob3B0aW9ucy50cmlnZ2VyICYmIG9wdGlvbnMudGV0aGVyKSB7XG4gICAgICAgIGNvbnN0IHBsYWNlbWVudHMgPSBbJ3RvcCcsICdyaWdodCcsICdib3R0b20nLCAnbGVmdCddO1xuICAgICAgICBpZihwbGFjZW1lbnRzLmluZGV4T2Yob3B0aW9ucy5wbGFjZW1lbnQpID09IC0xKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYXR0YWNobWVudCAnJHtvcHRpb25zLnBsYWNlbWVudH0nLiBWYWxpZCBwbGFjZW1lbnRzIGFyZSAnJHtwbGFjZW1lbnRzLmpvaW4oYCcsICdgKX0nLmApO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGF0dGFjaG1lbnQ7XG4gICAgICAgIGxldCB0YXJnZXRBdHRhY2htZW50O1xuICAgICAgICBzd2l0Y2gob3B0aW9ucy5wbGFjZW1lbnQpIHtcbiAgICAgICAgICAgIGNhc2UgcGxhY2VtZW50c1swXTogY2FzZSBwbGFjZW1lbnRzWzJdOlxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnQgPSAob3B0aW9ucy5wbGFjZW1lbnQgPT0gcGxhY2VtZW50c1swXSA/IHBsYWNlbWVudHNbMl0gOiBwbGFjZW1lbnRzWzBdKSArICcgY2VudGVyJztcbiAgICAgICAgICAgICAgICB0YXJnZXRBdHRhY2htZW50ID0gKG9wdGlvbnMucGxhY2VtZW50ID09IHBsYWNlbWVudHNbMF0gPyBwbGFjZW1lbnRzWzBdIDogcGxhY2VtZW50c1syXSkgKyAnIGNlbnRlcic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIHBsYWNlbWVudHNbMV06IGNhc2UgcGxhY2VtZW50c1szXTpcbiAgICAgICAgICAgICAgICBhdHRhY2htZW50ID0gJ3RvcCAnICsgKG9wdGlvbnMucGxhY2VtZW50ID09IHBsYWNlbWVudHNbMV0gPyBwbGFjZW1lbnRzWzNdIDogcGxhY2VtZW50c1sxXSk7XG4gICAgICAgICAgICAgICAgdGFyZ2V0QXR0YWNobWVudCA9ICd0b3AgJyArIChvcHRpb25zLnBsYWNlbWVudCA9PSBwbGFjZW1lbnRzWzFdID8gcGxhY2VtZW50c1sxXSA6IHBsYWNlbWVudHNbM10pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgdGV0aGVyID0gbmV3IFRldGhlcih7XG4gICAgICAgICAgICBlbGVtZW50OiBwYW5lbCxcbiAgICAgICAgICAgIHRhcmdldDogb3B0aW9ucy50cmlnZ2VyLFxuICAgICAgICAgICAgYXR0YWNobWVudCxcbiAgICAgICAgICAgIHRhcmdldEF0dGFjaG1lbnRcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gUmV0dXJuIHRoZSBwYW5lbCBlbGVtZW50IHNvIHdlIGNhbiB1cGRhdGUgaXQgbGF0ZXJcbiAgICByZXR1cm4ge1xuICAgICAgICBwYW5lbCxcbiAgICAgICAgdGV0aGVyXG4gICAgfTtcbn07XG5cbmNvbnN0IGdldENhcmV0UG9zaXRpb24gPSBlbCA9PiB7XG4gICAgbGV0IGNhcmV0T2Zmc2V0ID0gMDtcbiAgICBjb25zdCBkb2MgPSBlbC5vd25lckRvY3VtZW50IHx8IGVsLmRvY3VtZW50O1xuICAgIGNvbnN0IHdpbiA9IGRvYy5kZWZhdWx0VmlldyB8fCBkb2MucGFyZW50V2luZG93O1xuICAgIGxldCBzZWw7XG4gICAgaWYodHlwZW9mIHdpbi5nZXRTZWxlY3Rpb24gIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgc2VsID0gd2luLmdldFNlbGVjdGlvbigpO1xuICAgICAgICBpZihzZWwucmFuZ2VDb3VudCA+IDApIHtcbiAgICAgICAgICAgIGNvbnN0IHJhbmdlID0gd2luLmdldFNlbGVjdGlvbigpLmdldFJhbmdlQXQoMCk7XG4gICAgICAgICAgICBjb25zdCBwcmVDYXJldFJhbmdlID0gcmFuZ2UuY2xvbmVSYW5nZSgpO1xuICAgICAgICAgICAgcHJlQ2FyZXRSYW5nZS5zZWxlY3ROb2RlQ29udGVudHMoZWwpO1xuICAgICAgICAgICAgcHJlQ2FyZXRSYW5nZS5zZXRFbmQocmFuZ2UuZW5kQ29udGFpbmVyLCByYW5nZS5lbmRPZmZzZXQpO1xuICAgICAgICAgICAgY2FyZXRPZmZzZXQgPSBwcmVDYXJldFJhbmdlLnRvU3RyaW5nKCkubGVuZ3RoO1xuICAgICAgICB9XG4gICAgfSBlbHNlIGlmKChzZWwgPSBkb2Muc2VsZWN0aW9uKSAmJiBzZWwudHlwZSAhPSAnQ29udHJvbCcpIHtcbiAgICAgICAgY29uc3QgdGV4dFJhbmdlID0gc2VsLmNyZWF0ZVJhbmdlKCk7XG4gICAgICAgIGNvbnN0IHByZUNhcmV0VGV4dFJhbmdlID0gZG9jLmJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gICAgICAgIHByZUNhcmV0VGV4dFJhbmdlLm1vdmVUb0VsZW1lbnRUZXh0KGVsKTtcbiAgICAgICAgcHJlQ2FyZXRUZXh0UmFuZ2Uuc2V0RW5kUG9pbnQoJ0VuZFRvRW5kJywgdGV4dFJhbmdlKTtcbiAgICAgICAgY2FyZXRPZmZzZXQgPSBwcmVDYXJldFRleHRSYW5nZS50ZXh0Lmxlbmd0aDtcbiAgICB9XG4gICAgXG4gICAgcmV0dXJuIGNhcmV0T2Zmc2V0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDcmVhdGU7XG4iLCJjb25zdCBtb2RpZmllcnMgPSByZXF1aXJlKCcuL21vZGlmaWVycycpO1xuXG5jb25zdCBFbW9qaXMgPSB7XG4gICAgbG9hZDogb3B0aW9ucyA9PiB7XG4gICAgICAgIC8vIExvYWQgYW5kIGluamVjdCB0aGUgU1ZHIHNwcml0ZSBpbnRvIHRoZSBET01cbiAgICAgICAgbGV0IHN2Z1Byb21pc2UgPSBQcm9taXNlLnJlc29sdmUoKTtcbiAgICAgICAgaWYob3B0aW9ucy5wYWNrX3VybCAmJiAhZG9jdW1lbnQucXVlcnlTZWxlY3RvcihvcHRpb25zLmNsYXNzbmFtZXMuc3ZnKSkge1xuICAgICAgICAgICAgc3ZnUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN2Z1hociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgICAgIHN2Z1hoci5vcGVuKCdHRVQnLCBvcHRpb25zLnBhY2tfdXJsLCB0cnVlKTtcbiAgICAgICAgICAgICAgICBzdmdYaHIub25sb2FkID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnN2Zyk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gc3ZnWGhyLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChjb250YWluZXIpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBzdmdYaHIuc2VuZCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQganNvblByb21pc2U7XG4gICAgICAgIC8vIExvYWQgdGhlIGVtb2ppcyBqc29uXG4gICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNvbnN0IGpzb24gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnRW1vamlQYW5lbC1qc29uJyk7XG4gICAgICAgICAgICBqc29uUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZShqc29uKVxuICAgICAgICAgICAgaWYoanNvbiA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAganNvblByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZW1vamlYaHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIub3BlbignR0VUJywgb3B0aW9ucy5qc29uX3VybCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgIGVtb2ppWGhyLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKGVtb2ppWGhyLnJlYWR5U3RhdGUgPT0gWE1MSHR0cFJlcXVlc3QuRE9ORSAmJiBlbW9qaVhoci5zdGF0dXMgPT0gMjAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UoZW1vamlYaHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnRW1vamlQYW5lbC1qc29uJyxlbW9qaVhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoanNvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGVtb2ppWGhyLnNlbmQoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2V7XG4gICAgICAgICAgICAgICAganNvblByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ0Vtb2ppUGFuZWwtanNvbicpKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcbiAgICAgICAgICAgIC8vIGNvbnN0IGpzb24gPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnSWNvblBhbmVsLWpzb24nKTtcbiAgICAgICAgICAgIC8vIGpzb25Qcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGpzb24pXG4gICAgICAgICAgICAvLyBpZihqc29uID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbW9qaVhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgICAgICAgICBlbW9qaVhoci5vcGVuKCdHRVQnLCBvcHRpb25zLmpzb25fdXJsLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZW1vamlYaHIucmVhZHlTdGF0ZSA9PSBYTUxIdHRwUmVxdWVzdC5ET05FICYmIGVtb2ppWGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShlbW9qaVhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vbG9jYWxTdG9yYWdlLnNldEl0ZW0oJ0ljb25QYW5lbC1qc29uJyxlbW9qaVhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoanNvbik7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgICAgIGVtb2ppWGhyLnNlbmQoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICAgIC8vIGVsc2V7XG4gICAgICAgICAgICAvLyAgICAganNvblByb21pc2UgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgIC8vICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oJ0ljb25QYW5lbC1qc29uJykpO1xuICAgICAgICAgICAgLy8gICAgICAgICByZXNvbHZlKGpzb24pO1xuICAgICAgICAgICAgLy8gICAgIH0pXG4gICAgICAgICAgICAvLyB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJnaXBoXCIpe1xuXG4gICAgICAgICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVtb2ppWGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgZW1vamlYaHIub3BlbignR0VUJywgXCJodHRwOi8vYXBpLmdpcGh5LmNvbS92MS9naWZzL3NlYXJjaD9xPWZ1bm55K2NhdCZhcGlfa2V5PTd5YzF0ZTgzdHphbVRiN0I5dGJUR0dmMFBRRU5UMG13JmxpbWl0PTVcIiwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgZW1vamlYaHIub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZihlbW9qaVhoci5yZWFkeVN0YXRlID09IFhNTEh0dHBSZXF1ZXN0LkRPTkUgJiYgZW1vamlYaHIuc3RhdHVzID09IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UoZW1vamlYaHIucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoanNvbi5kYXRhKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgZW1vamlYaHIuc2VuZCgpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoWyBzdmdQcm9taXNlLCBqc29uUHJvbWlzZSBdKTtcbiAgICB9LFxuICAgIGNyZWF0ZUVsOiAoaW5wdXRFbGVtZW50LCBvcHRpb25zICwgYmFzZVVybCkgPT4ge1xuICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKXtcblxuICAgICAgICAgICAgaWYob3B0aW9ucy5wYWNrX3VybCkge1xuICAgICAgICAgICAgICAgIGlmKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYC4ke29wdGlvbnMuY2xhc3NuYW1lcy5zdmd9IFtpZD1cIiR7aW5wdXRFbGVtZW50LnVuaWNvZGV9XCJgKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiPjx1c2UgeGxpbms6aHJlZj1cIiMke2lucHV0RWxlbWVudC51bmljb2RlfVwiPjwvdXNlPjwvc3ZnPmA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGlucHV0RWxlbWVudC5jaGFyO1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gdGhlIGVtb2ppIGNoYXIgaWYgdGhlIHBhY2sgZG9lcyBub3QgaGF2ZSB0aGUgc3ByaXRlLCBvciBubyBwYWNrXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIHJldHVybiBcIjxpbWcgc3JjPVwiK2Jhc2VVcmwraW5wdXRFbGVtZW50Lmljb25fdXJsK1wiPlwiO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBjcmVhdGVCdXR0b246IChpbnB1dEVsZW1lbnQsIG9wdGlvbnMsIGVtaXQgLCBiYXNlVXJsKSA9PiB7XG5cbiAgICAgICAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAnYnV0dG9uJyk7XG5cbiAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIil7XG5cbiAgICAgICAgICAgIGlmKGlucHV0RWxlbWVudC5maXR6cGF0cmljayAmJiBvcHRpb25zLmZpdHpwYXRyaWNrKSB7XG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGV4aXN0aW5nIG1vZGlmaWVyc1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGlmaWVycykuZm9yRWFjaChpID0+IGlucHV0RWxlbWVudC51bmljb2RlID0gaW5wdXRFbGVtZW50LnVuaWNvZGUucmVwbGFjZShtb2RpZmllcnNbaV0udW5pY29kZSwgJycpKTtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RpZmllcnMpLmZvckVhY2goaSA9PiBpbnB1dEVsZW1lbnQuY2hhciA9IGlucHV0RWxlbWVudC5jaGFyLnJlcGxhY2UobW9kaWZpZXJzW2ldLmNoYXIsICcnKSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBcHBlbmQgZml0enBhdHJpY2sgbW9kaWZpZXJcbiAgICAgICAgICAgICAgICBpbnB1dEVsZW1lbnQudW5pY29kZSArPSBtb2RpZmllcnNbb3B0aW9ucy5maXR6cGF0cmlja10udW5pY29kZTtcbiAgICAgICAgICAgICAgICBpbnB1dEVsZW1lbnQuY2hhciArPSBtb2RpZmllcnNbb3B0aW9ucy5maXR6cGF0cmlja10uY2hhcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYnV0dG9uLmlubmVySFRNTCA9IEVtb2ppcy5jcmVhdGVFbChpbnB1dEVsZW1lbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2Vtb2ppJyk7XG4gICAgICAgICAgICBidXR0b24uZGF0YXNldC51bmljb2RlID0gaW5wdXRFbGVtZW50LnVuaWNvZGU7XG4gICAgICAgICAgICBidXR0b24uZGF0YXNldC5jaGFyID0gaW5wdXRFbGVtZW50LmNoYXI7XG4gICAgICAgICAgICBidXR0b24uZGF0YXNldC5jYXRlZ29yeSA9IGlucHV0RWxlbWVudC5jYXRlZ29yeTtcbiAgICAgICAgICAgIGJ1dHRvbi5kYXRhc2V0Lm5hbWUgPSBpbnB1dEVsZW1lbnQubmFtZTtcbiAgICAgICAgICAgIGJ1dHRvbi50aXRsZSA9IGlucHV0RWxlbWVudC5uYW1lO1xuICAgICAgICAgICAgaWYoaW5wdXRFbGVtZW50LmZpdHpwYXRyaWNrKSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLmRhdGFzZXQuZml0enBhdHJpY2sgPSBpbnB1dEVsZW1lbnQuZml0enBhdHJpY2s7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihlbWl0KSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBlbWl0KCdzZWxlY3QnLCBpbnB1dEVsZW1lbnQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMuZWRpdGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEVtb2ppcy53cml0ZShpbnB1dEVsZW1lbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpe1xuXG4gICAgICAgICAgICBidXR0b24uaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKGlucHV0RWxlbWVudCwgb3B0aW9ucyxiYXNlVXJsKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdpY29uX3BhY2snKTtcbiAgICAgICAgICAgIGJ1dHRvbi5kYXRhc2V0Lm5hbWUgPSBpbnB1dEVsZW1lbnQubmFtZTtcblxuICAgICAgICAgICAgaWYoZW1pdCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdCgnc2VsZWN0JywgaW5wdXRFbGVtZW50KTtcblxuICAgICAgICAgICAgICAgICAgICBpZihvcHRpb25zLmVkaXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBFbW9qaXMud3JpdGUoaW5wdXRFbGVtZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBidXR0b247XG4gICAgfSxcbiAgICB3cml0ZTogKGlucHV0RWxlbWVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBjb25zdCBpbnB1dCA9IG9wdGlvbnMuZWRpdGFibGU7XG4gICAgICAgIGlmKCFpbnB1dCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpe1xuXG4gICAgICAgICAgICAvLyBJbnNlcnQgdGhlIGVtb2ppIGF0IHRoZSBlbmQgb2YgdGhlIHRleHQgYnkgZGVmYXVsdFxuICAgICAgICAgICAgbGV0IG9mZnNldCA9IGlucHV0LnRleHRDb250ZW50Lmxlbmd0aDtcbiAgICAgICAgICAgIGlmKGlucHV0LmRhdGFzZXQub2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zZXJ0IHRoZSBlbW9qaSB3aGVyZSB0aGUgcmljaCBlZGl0b3IgY2FyZXQgd2FzXG4gICAgICAgICAgICAgICAgb2Zmc2V0ID0gaW5wdXQuZGF0YXNldC5vZmZzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEluc2VydCB0aGUgcGljdG9ncmFwaEltYWdlXG4gICAgICAgICAgICBjb25zdCBwaWN0b2dyYXBocyA9IGlucHV0LnBhcmVudE5vZGUucXVlcnlTZWxlY3RvcignLkVtb2ppUGFuZWxfX3BpY3RvZ3JhcGhzJyk7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hYnMudHdpbWcuY29tL2Vtb2ppL3YyLzcyeDcyLycgKyBlbW9qaS51bmljb2RlICsgJy5wbmcnO1xuICAgICAgICAgICAgY29uc3QgaW1hZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICAgIGltYWdlLmNsYXNzTGlzdC5hZGQoJ1JpY2hFZGl0b3ItcGljdG9ncmFwaEltYWdlJyk7XG4gICAgICAgICAgICBpbWFnZS5zZXRBdHRyaWJ1dGUoJ3NyYycsIHVybCk7XG4gICAgICAgICAgICBpbWFnZS5zZXRBdHRyaWJ1dGUoJ2RyYWdnYWJsZScsIGZhbHNlKTtcbiAgICAgICAgICAgIHBpY3RvZ3JhcGhzLmFwcGVuZENoaWxkKGltYWdlKTtcblxuICAgICAgICAgICAgY29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgIHNwYW4uY2xhc3NMaXN0LmFkZCgnRW1vamlQYW5lbF9fcGljdG9ncmFwaFRleHQnKTtcbiAgICAgICAgICAgIHNwYW4uc2V0QXR0cmlidXRlKCd0aXRsZScsIGVtb2ppLm5hbWUpO1xuICAgICAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBlbW9qaS5uYW1lKTtcbiAgICAgICAgICAgIHNwYW4uZGF0YXNldC5waWN0b2dyYXBoVGV4dCA9IGVtb2ppLmNoYXI7XG4gICAgICAgICAgICBzcGFuLmRhdGFzZXQucGljdG9ncmFwaEltYWdlID0gdXJsO1xuICAgICAgICAgICAgc3Bhbi5pbm5lckhUTUwgPSAnJmVtc3A7JztcblxuICAgICAgICAgICAgLy8gSWYgaXQncyBlbXB0eSwgcmVtb3ZlIHRoZSBkZWZhdWx0IGNvbnRlbnQgb2YgdGhlIGlucHV0XG4gICAgICAgICAgICBjb25zdCBkaXYgPSBpbnB1dC5xdWVyeVNlbGVjdG9yKCdkaXYnKTtcbiAgICAgICAgICAgIGlmKGRpdi5pbm5lckhUTUwgPT0gJzxicj4nKSB7XG4gICAgICAgICAgICAgICAgZGl2LmlubmVySFRNTCA9ICcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXBsYWNlIGVhY2ggcGljdG9ncmFwaCBzcGFuIHdpdGggaXQncyBuYXRpdmUgY2hhcmFjdGVyXG4gICAgICAgICAgICBjb25zdCBwaWN0cyA9IGRpdi5xdWVyeVNlbGVjdG9yQWxsKCcuRW1vamlQYW5lbF9fcGljdG9ncmFwaFRleHQnKTtcbiAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChwaWN0cywgcGljdCA9PiB7XG4gICAgICAgICAgICAgICAgZGl2LnJlcGxhY2VDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShwaWN0LmRhdGFzZXQucGljdG9ncmFwaFRleHQpLCBwaWN0KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBTcGxpdCBjb250ZW50IGludG8gYXJyYXksIGluc2VydCBlbW9qaSBhdCBvZmZzZXQgaW5kZXhcbiAgICAgICAgICAgIGxldCBjb250ZW50ID0gZW1vamlBd2FyZS5zcGxpdChkaXYudGV4dENvbnRlbnQpO1xuICAgICAgICAgICAgY29udGVudC5zcGxpY2Uob2Zmc2V0LCAwLCBlbW9qaS5jaGFyKTtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LmpvaW4oJycpO1xuXG4gICAgICAgICAgICBkaXYudGV4dENvbnRlbnQgPSBjb250ZW50O1xuXG4gICAgICAgICAgICAvLyBUcmlnZ2VyIGEgcmVmcmVzaCBvZiB0aGUgaW5wdXRcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0hUTUxFdmVudHMnKTtcbiAgICAgICAgICAgIGV2ZW50LmluaXRFdmVudCgnbW91c2Vkb3duJywgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgaW5wdXQuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgb2Zmc2V0IHRvIGFmdGVyIHRoZSBpbnNlcnRlZCBlbW9qaVxuICAgICAgICAgICAgaW5wdXQuZGF0YXNldC5vZmZzZXQgPSBwYXJzZUludChpbnB1dC5kYXRhc2V0Lm9mZnNldCwgMTApICsgMTtcblxuICAgICAgICAgICAgaWYob3B0aW9ucy5mcmVxdWVudCA9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgRnJlcXVlbnQuYWRkKGVtb2ppLCBFbW9qaXMuY3JlYXRlQnV0dG9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIil7XG5cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRW1vamlzO1xuIiwiY29uc3QgeyBFdmVudEVtaXR0ZXIgfSA9IHJlcXVpcmUoJ2ZiZW1pdHRlcicpO1xuXG5jb25zdCBDcmVhdGUgPSByZXF1aXJlKCcuL2NyZWF0ZScpO1xuY29uc3QgRW1vamlzID0gcmVxdWlyZSgnLi9lbW9qaXMnKTtcbmNvbnN0IExpc3QgPSByZXF1aXJlKCcuL2xpc3QnKTtcbmNvbnN0IGNsYXNzbmFtZXMgPSByZXF1aXJlKCcuL2NsYXNzbmFtZXMnKTtcblxuY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgc2VhcmNoOiB0cnVlLFxuICAgIGZyZXF1ZW50OiB0cnVlLFxuICAgIGZpdHpwYXRyaWNrOiAnYScsXG4gICAgaGlkZGVuX2NhdGVnb3JpZXM6IFtdLFxuICAgIHBhY2tfdXJsOiBudWxsLFxuICAgIC8vIHBhbmVsX3R5cGU6ICdlbW9qaScsXG4gICAgLy8ganNvbl91cmw6ICcvZW1vamlzLmpzb24nLFxuICAgIC8vIHBhbmVsX3R5cGU6ICdpY29uJyxcbiAgICAvLyBqc29uX3VybDogJy9pY29uU2V0Lmpzb24nLFxuICAgIHBhbmVsX3R5cGU6ICdnaXBoJyxcbiAgICAvLyBqc29uX3VybDogJy9pY29uU2V0Lmpzb24nLFxuICAgIHRldGhlcjogdHJ1ZSxcbiAgICBwbGFjZW1lbnQ6ICdib3R0b20nLFxuXG4gICAgbG9jYWxlOiB7XG4gICAgICAgIGFkZDogJ0FkZCBlbW9qaScsXG4gICAgICAgIGJyYW5kOiAnRW1vamlQYW5lbCcsXG4gICAgICAgIGZyZXF1ZW50OiAnRnJlcXVlbnRseSB1c2VkJyxcbiAgICAgICAgbG9hZGluZzogJ0xvYWRpbmcuLi4nLFxuICAgICAgICBub19yZXN1bHRzOiAnTm8gcmVzdWx0cycsXG4gICAgICAgIHNlYXJjaDogJ1NlYXJjaCcsXG4gICAgICAgIHNlYXJjaF9yZXN1bHRzOiAnU2VhcmNoIHJlc3VsdHMnXG4gICAgfSxcbiAgICBpY29uczoge1xuICAgICAgICBzZWFyY2g6ICc8c3BhbiBjbGFzcz1cImZhIGZhLXNlYXJjaFwiPjwvc3Bhbj4nXG4gICAgfSxcbiAgICBjbGFzc25hbWVzXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbW9qaVBhbmVsIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMsIG9wdGlvbnMpO1xuXG4gICAgICAgIGNvbnN0IGVscyA9IFsnY29udGFpbmVyJywgJ3RyaWdnZXInLCAnZWRpdGFibGUnXTtcbiAgICAgICAgZWxzLmZvckVhY2goZWwgPT4ge1xuICAgICAgICAgICAgaWYodHlwZW9mIHRoaXMub3B0aW9uc1tlbF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9wdGlvbnNbZWxdID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLm9wdGlvbnNbZWxdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY3JlYXRlID0gQ3JlYXRlKHRoaXMub3B0aW9ucywgdGhpcy5lbWl0LmJpbmQodGhpcyksIHRoaXMudG9nZ2xlLmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLnBhbmVsID0gY3JlYXRlLnBhbmVsO1xuICAgICAgICB0aGlzLnRldGhlciA9IGNyZWF0ZS50ZXRoZXI7XG5cbiAgICAgICAgRW1vamlzLmxvYWQodGhpcy5vcHRpb25zKVxuICAgICAgICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgICAgICAgICBMaXN0KHRoaXMub3B0aW9ucywgdGhpcy5wYW5lbCwgcmVzWzFdLCB0aGlzLmVtaXQuYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0b2dnbGUoKSB7XG4gICAgICAgIGNvbnN0IG9wZW4gPSB0aGlzLnBhbmVsLmNsYXNzTGlzdC50b2dnbGUodGhpcy5vcHRpb25zLmNsYXNzbmFtZXMub3Blbik7XG4gICAgICAgIGNvbnN0IHNlYXJjaElucHV0ID0gdGhpcy5wYW5lbC5xdWVyeVNlbGVjdG9yKCcuJyArIHRoaXMub3B0aW9ucy5jbGFzc25hbWVzLnNlYXJjaElucHV0KTtcblxuICAgICAgICB0aGlzLmVtaXQoJ3RvZ2dsZScsIG9wZW4pO1xuICAgICAgICBpZihvcGVuICYmIHRoaXMub3B0aW9ucy5zZWFyY2ggJiYgc2VhcmNoSW5wdXQpIHtcbiAgICAgICAgICAgIHNlYXJjaElucHV0LmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXBvc2l0aW9uKCkge1xuICAgICAgICBpZih0aGlzLnRldGhlcikge1xuICAgICAgICAgICAgdGhpcy50ZXRoZXIucG9zaXRpb24oKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuaWYodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5FbW9qaVBhbmVsID0gRW1vamlQYW5lbDtcbn1cbiIsImNvbnN0IEVtb2ppcyA9IHJlcXVpcmUoJy4vZW1vamlzJyk7XG5jb25zdCBtb2RpZmllcnMgPSByZXF1aXJlKCcuL21vZGlmaWVycycpO1xuXG5jb25zdCBsaXN0ID0gKG9wdGlvbnMsIHBhbmVsLCBqc29uLCBlbWl0KSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcmllcyA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3JpZXMpO1xuICAgIGNvbnN0IHNlYXJjaElucHV0ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuc2VhcmNoSW5wdXQpO1xuICAgIGNvbnN0IHNlYXJjaFRpdGxlID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuc2VhcmNoVGl0bGUpO1xuICAgIGNvbnN0IGZyZXF1ZW50VGl0bGUgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5mcmVxdWVudFRpdGxlKTtcbiAgICBjb25zdCByZXN1bHRzID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMucmVzdWx0cyk7XG4gICAgY29uc3QgZW1wdHlTdGF0ZSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLm5vUmVzdWx0cyk7XG4gICAgY29uc3QgZm9vdGVyID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuZm9vdGVyKTtcblxuICAgIC8vIFVwZGF0ZSB0aGUgY2F0ZWdvcnkgbGlua3NcbiAgICB3aGlsZSAoY2F0ZWdvcmllcy5maXJzdENoaWxkKSB7XG4gICAgICAgIGNhdGVnb3JpZXMucmVtb3ZlQ2hpbGQoY2F0ZWdvcmllcy5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgaWYob3B0aW9ucy5wYW5lbF90eXBlICE9IFwiZ2lwaFwiKXtcbiAgICAgICAgT2JqZWN0LmtleXMoanNvbikuZm9yRWFjaChpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5ID0ganNvbltpXTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNhdGVnb3J5KVxuICAgICAgICAgICAgLy8gRG9uJ3Qgc2hvdyB0aGUgbGluayB0byBhIGhpZGRlbiBjYXRlZ29yeVxuICAgICAgICAgICAgaWYob3B0aW9ucy5oaWRkZW5fY2F0ZWdvcmllcy5pbmRleE9mKGNhdGVnb3J5Lm5hbWUpID4gLTEpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5TGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXG4gICAgICAgICAgICBjYXRlZ29yeUxpbmsuc2V0QXR0cmlidXRlKCd0aXRsZScsIGNhdGVnb3J5Lm5hbWUpO1xuICAgICAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjYXRlZ29yeUxpbmsuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuZW1vamkpO1xuICAgICAgICAgICAgICAgIGNhdGVnb3J5TGluay5pbm5lckhUTUwgPSBFbW9qaXMuY3JlYXRlRWwoY2F0ZWdvcnkuaWNvbiwgb3B0aW9ucyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjYXRlZ29yeUxpbmsuY2xhc3NMaXN0LmFkZChcImhlYWRlcl9pY29uc1wiKTtcbiAgICAgICAgICAgICAgICBjYXRlZ29yeUxpbmsuaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKGNhdGVnb3J5Lmljb25fcGFjaywgb3B0aW9ucywgY2F0ZWdvcnkuYmFzZV91cmwpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjYXRlZ29yeUxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgICAgICAgICAgICAgICBsZXQgc3RyaXBwZWRTcGFjZSA9ICBjYXRlZ29yeS5uYW1lLnJlcGxhY2UoL1xccy9nLFwiX1wiKTtcbiAgICAgICAgICAgICAgICBjb25zdCB0aXRsZSA9IG9wdGlvbnMuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJyMnICsgc3RyaXBwZWRTcGFjZSk7XG4gICAgICAgICAgICAgICAgc2Nyb2xsVG8ocmVzdWx0cyAsIHRpdGxlLm9mZnNldFRvcCAtIHJlc3VsdHMub2Zmc2V0VG9wICwgNTAwKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgY2F0ZWdvcmllcy5hcHBlbmRDaGlsZChjYXRlZ29yeUxpbmspO1xuICAgICAgICB9KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIE9iamVjdC5rZXlzKGpzb24pLmZvckVhY2goaSA9PiB7XG4gICAgICAgICAgICBjb25zdCBpbWFnZV91cmwgPSBqc29uW2ldLmltYWdlcy5vcmlnaW5hbC51cmw7O1xuICAgICAgICAgICAgbGV0IGltYWdlVGVtcGxhdGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICAgIGltYWdlVGVtcGxhdGUuc3JjID0gaW1hZ2VfdXJsO1xuICAgICAgICAgICAgY29uc29sZS5sb2cocmVzdWx0cyk7XG4gICAgICAgICAgICByZXN1bHRzLmFwcGVuZENoaWxkKGltYWdlVGVtcGxhdGUpO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coY2F0ZWdvcnkuaW1hZ2VzLm9yaWdpbmFsLnVybClcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gY3JlZGl0cyBmb3IgdGhpcyBwaWVjZSBvZiBjb2RlKHNjcm9sbFRvIHB1cmUganMpIHRvIGFkbkpvc2ggaHR0cHM6Ly9naXN0LmdpdGh1Yi5jb20vYW5kam9zaFxuICAgIGZ1bmN0aW9uIHNjcm9sbFRvKGVsZW1lbnQsIHRvLCBkdXJhdGlvbikge1xuICAgICAgICB2YXIgc3RhcnQgPSBlbGVtZW50LnNjcm9sbFRvcCxcbiAgICAgICAgICAgIGNoYW5nZSA9IHRvIC0gc3RhcnQsXG4gICAgICAgICAgICBjdXJyZW50VGltZSA9IDAsXG4gICAgICAgICAgICBpbmNyZW1lbnQgPSAyMDtcblxuICAgICAgICB2YXIgYW5pbWF0ZVNjcm9sbCA9IGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICBjdXJyZW50VGltZSArPSBpbmNyZW1lbnQ7XG4gICAgICAgICAgICB2YXIgdmFsID0gTWF0aC5lYXNlSW5PdXRRdWFkKGN1cnJlbnRUaW1lLCBzdGFydCwgY2hhbmdlLCBkdXJhdGlvbik7XG4gICAgICAgICAgICBlbGVtZW50LnNjcm9sbFRvcCA9IHZhbDtcbiAgICAgICAgICAgIGlmKGN1cnJlbnRUaW1lIDwgZHVyYXRpb24pIHtcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KGFuaW1hdGVTY3JvbGwsIGluY3JlbWVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIGFuaW1hdGVTY3JvbGwoKTtcbiAgICB9XG4gICAgaWYob3B0aW9ucy5wYW5lbF90eXBlICE9IFwiZ2lwaFwiKXtcbiAgICAvL3QgPSBjdXJyZW50IHRpbWVcbiAgICAvL2IgPSBzdGFydCB2YWx1ZVxuICAgIC8vYyA9IGNoYW5nZSBpbiB2YWx1ZVxuICAgIC8vZCA9IGR1cmF0aW9uXG4gICAgTWF0aC5lYXNlSW5PdXRRdWFkID0gZnVuY3Rpb24gKHQsIGIsIGMsIGQpIHtcbiAgICAgIHQgLz0gZC8yO1xuICAgICAgICBpZiAodCA8IDEpIHJldHVybiBjLzIqdCp0ICsgYjtcbiAgICAgICAgdC0tO1xuICAgICAgICByZXR1cm4gLWMvMiAqICh0Kih0LTIpIC0gMSkgKyBiO1xuICAgIH07XG5cbiAgICAvLyBIYW5kbGUgdGhlIHNlYXJjaCBpbnB1dFxuICAgIGlmKG9wdGlvbnMuc2VhcmNoID09IHRydWUpIHtcblxuICAgICAgICBzZWFyY2hJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGUgPT4ge1xuICAgICAgICAgICAgbGV0IGVtb2ppcyAsICBpY29ucyA7XG4gICAgICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGVtb2ppcyA9IHJlc3VsdHMucXVlcnlTZWxlY3RvckFsbCgnLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuZW1vamkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgaWNvbnMgPSByZXN1bHRzLnF1ZXJ5U2VsZWN0b3JBbGwoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmljb25zKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdGl0bGVzID0gcmVzdWx0cy5xdWVyeVNlbGVjdG9yQWxsKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5jYXRlZ29yeSk7XG5cbiAgICAgICAgICAgIGxldCBmcmVxdWVudExpc3QgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnRW1vamlQYW5lbC1mcmVxdWVudCcpO1xuICAgICAgICAgICAgaWYoZnJlcXVlbnRMaXN0KSB7XG4gICAgICAgICAgICAgICAgZnJlcXVlbnRMaXN0ID0gSlNPTi5wYXJzZShmcmVxdWVudExpc3QpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmVxdWVudExpc3QgPSBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBlLnRhcmdldC52YWx1ZS5yZXBsYWNlKC8tL2csICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgaWYodmFsdWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNvbnN0IG1hdGNoZWQgPSBbXTtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhqc29uKS5mb3JFYWNoKGkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBjYXRlZ29yeSA9IGpzb25baV07XG4gICAgICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5LmVtb2ppcy5mb3JFYWNoKGVtb2ppID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXl3b3JkTWF0Y2ggPSBlbW9qaS5rZXl3b3Jkcy5maW5kKGtleXdvcmQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXl3b3JkID0ga2V5d29yZC5yZXBsYWNlKC8tL2csICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ga2V5d29yZC5pbmRleE9mKHZhbHVlKSA+IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGtleXdvcmRNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkLnB1c2goZW1vamkudW5pY29kZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5Lmljb25zLmZvckVhY2goaWNvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5d29yZE1hdGNoID0gaWNvbi5rZXl3b3Jkcy5maW5kKGtleXdvcmQgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXl3b3JkID0ga2V5d29yZC5yZXBsYWNlKC8tL2csICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4ga2V5d29yZC5pbmRleE9mKHZhbHVlKSA+IC0xO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKGtleXdvcmRNYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXRjaGVkLnB1c2goaWNvbi5uYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmKG1hdGNoZWQubGVuZ3RoID09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgZW1wdHlTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBlbXB0eVN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZW1pdCgnc2VhcmNoJywgeyB2YWx1ZSwgbWF0Y2hlZCB9KTtcblxuICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpe1xuICAgICAgICAgICAgICAgICAgICBbXS5mb3JFYWNoLmNhbGwoZW1vamlzLCBlbW9qaSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihtYXRjaGVkLmluZGV4T2YoZW1vamkuZGF0YXNldC51bmljb2RlKSA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcbiAgICAgICAgICAgICAgICAgICAgW10uZm9yRWFjaC5jYWxsKGljb25zLCBpY29uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKG1hdGNoZWQuaW5kZXhPZihpY29uLmRhdGFzZXQubmFtZSkgPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGljb24uc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBbXS5mb3JFYWNoLmNhbGwodGl0bGVzLCB0aXRsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc2VhcmNoVGl0bGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG5cbiAgICAgICAgICAgICAgICBpZihvcHRpb25zLmZyZXF1ZW50ID09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgZnJlcXVlbnRUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbGV0IGVtb2ppcyA9IHJlc3VsdHMucXVlcnlTZWxlY3RvckFsbCgnLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuZW1vamkpO1xuICAgICAgICAgICAgICAgIGxldCBpY29ucyA9IHJlc3VsdHMucXVlcnlTZWxlY3RvckFsbCgnLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuaWNvbnMpO1xuXG4gICAgICAgICAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIil7XG4gICAgICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChlbW9qaXMsIGVtb2ppID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcbiAgICAgICAgICAgICAgICAgICAgW10uZm9yRWFjaC5jYWxsKGljb25zLCBpY29uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGljb24uc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgW10uZm9yRWFjaC5jYWxsKHRpdGxlcywgdGl0bGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aXRsZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzZWFyY2hUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIGVtcHR5U3RhdGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblxuICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMuZnJlcXVlbnQgPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBpZihmcmVxdWVudExpc3QubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJlcXVlbnRUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyZXF1ZW50VGl0bGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gRmlsbCB0aGUgcmVzdWx0cyB3aXRoIGVtb2ppc1xuICAgIHdoaWxlIChyZXN1bHRzLmZpcnN0Q2hpbGQpIHtcbiAgICAgICAgcmVzdWx0cy5yZW1vdmVDaGlsZChyZXN1bHRzLmZpcnN0Q2hpbGQpO1xuICAgIH1cblxuICAgICAgICBPYmplY3Qua2V5cyhqc29uKS5mb3JFYWNoKGkgPT4ge1xuICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBqc29uW2ldO1xuXG4gICAgICAgICAgICAvLyBEb24ndCBzaG93IGFueSBoaWRkZW4gY2F0ZWdvcmllc1xuICAgICAgICAgICAgaWYob3B0aW9ucy5oaWRkZW5fY2F0ZWdvcmllcy5pbmRleE9mKGNhdGVnb3J5Lm5hbWUpID4gLTEgfHwgY2F0ZWdvcnkubmFtZSA9PSAnbW9kaWZpZXInKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIGNhdGVnb3J5IHRpdGxlXG4gICAgICAgICAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgICAgICAgICAgIHRpdGxlLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3J5KTtcbiAgICAgICAgICAgIGxldCBzdHJpcHBlZFNwYWNlID0gIGNhdGVnb3J5Lm5hbWUucmVwbGFjZSgvXFxzL2csXCJfXCIpO1xuICAgICAgICAgICAgdGl0bGUuaWQgPSBzdHJpcHBlZFNwYWNlO1xuICAgICAgICAgICAgbGV0IGNhdGVnb3J5TmFtZSA9IGNhdGVnb3J5Lm5hbWUucmVwbGFjZSgvXy9nLCAnICcpXG4gICAgICAgICAgICAgICAgLnJlcGxhY2UoL1xcd1xcUyovZywgKG5hbWUpID0+IG5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBuYW1lLnN1YnN0cigxKS50b0xvd2VyQ2FzZSgpKVxuICAgICAgICAgICAgICAgIC5yZXBsYWNlKCdBbmQnLCAnJmFtcDsnKTtcbiAgICAgICAgICAgIHRpdGxlLmlubmVySFRNTCA9IGNhdGVnb3J5TmFtZTtcbiAgICAgICAgICAgIHJlc3VsdHMuYXBwZW5kQ2hpbGQodGl0bGUpO1xuXG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIGVtb2ppIGJ1dHRvbnNcbiAgICAgICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpe1xuICAgICAgICAgICAgICAgIGNhdGVnb3J5LmVtb2ppcy5mb3JFYWNoKGZ1bmN0aW9uKGVtb2ppKXtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChFbW9qaXMuY3JlYXRlQnV0dG9uKGVtb2ppLCBvcHRpb25zLCBlbWl0KSk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcbiAgICAgICAgICAgICAgICBjYXRlZ29yeS5pY29ucy5mb3JFYWNoKGZ1bmN0aW9uKGljb24pe1xuICAgICAgICAgICAgICAgICAgICByZXN1bHRzLmFwcGVuZENoaWxkKEVtb2ppcy5jcmVhdGVCdXR0b24oaWNvbiwgb3B0aW9ucywgZW1pdCwgY2F0ZWdvcnkuYmFzZV91cmwpKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZigob3B0aW9ucy5maXR6cGF0cmljaykmJihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKSl7XG4gICAgICAgICAgICAvLyBDcmVhdGUgdGhlIGZpdHpwYXRyaWNrIG1vZGlmaWVyIGJ1dHRvblxuICAgICAgICAgICAgY29uc3QgaGFuZCA9IHsgLy8g4pyLXG4gICAgICAgICAgICAgICAgdW5pY29kZTogJzI3MGInICsgbW9kaWZpZXJzW29wdGlvbnMuZml0enBhdHJpY2tdLnVuaWNvZGUsXG4gICAgICAgICAgICAgICAgY2hhcjogJ+KciydcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBsZXQgbW9kaWZpZXJEcm9wZG93bjtcbiAgICAgICAgICAgIGNvbnN0IG1vZGlmaWVyVG9nZ2xlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBtb2RpZmllclRvZ2dsZS5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAnYnV0dG9uJyk7XG4gICAgICAgICAgICBtb2RpZmllclRvZ2dsZS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5idG5Nb2RpZmllciwgb3B0aW9ucy5jbGFzc25hbWVzLmJ0bk1vZGlmaWVyVG9nZ2xlLCBvcHRpb25zLmNsYXNzbmFtZXMuZW1vamkpO1xuICAgICAgICAgICAgbW9kaWZpZXJUb2dnbGUuaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKGhhbmQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgbW9kaWZpZXJUb2dnbGUuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgbW9kaWZpZXJEcm9wZG93bi5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmUnKTtcbiAgICAgICAgICAgICAgICBtb2RpZmllclRvZ2dsZS5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmUnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZm9vdGVyLmFwcGVuZENoaWxkKG1vZGlmaWVyVG9nZ2xlKTtcblxuICAgICAgICAgICAgbW9kaWZpZXJEcm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgbW9kaWZpZXJEcm9wZG93bi5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5tb2RpZmllckRyb3Bkb3duKTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGlmaWVycykuZm9yRWFjaChtID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBtb2RpZmllciA9IE9iamVjdC5hc3NpZ24oe30sIG1vZGlmaWVyc1ttXSk7XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIudW5pY29kZSA9ICcyNzBiJyArIG1vZGlmaWVyLnVuaWNvZGU7XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIuY2hhciA9ICfinIsnICsgbW9kaWZpZXIuY2hhcjtcbiAgICAgICAgICAgICAgICBjb25zdCBtb2RpZmllckJ0biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVyQnRuLnNldEF0dHJpYnV0ZSgndHlwZScsICdidXR0b24nKTtcbiAgICAgICAgICAgICAgICBtb2RpZmllckJ0bi5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5idG5Nb2RpZmllciwgb3B0aW9ucy5jbGFzc25hbWVzLmVtb2ppKTtcbiAgICAgICAgICAgICAgICBtb2RpZmllckJ0bi5kYXRhc2V0Lm1vZGlmaWVyID0gbTtcbiAgICAgICAgICAgICAgICBtb2RpZmllckJ0bi5pbm5lckhUTUwgPSBFbW9qaXMuY3JlYXRlRWwobW9kaWZpZXIsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgbW9kaWZpZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuXG4gICAgICAgICAgICAgICAgICAgIG1vZGlmaWVyVG9nZ2xlLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllclRvZ2dsZS5pbm5lckhUTUwgPSBFbW9qaXMuY3JlYXRlRWwobW9kaWZpZXIsIG9wdGlvbnMpO1xuXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbnMuZml0enBhdHJpY2sgPSBtb2RpZmllckJ0bi5kYXRhc2V0Lm1vZGlmaWVyO1xuICAgICAgICAgICAgICAgICAgICBtb2RpZmllckRyb3Bkb3duLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIFJlZnJlc2ggZXZlcnkgZW1vamkgaW4gYW55IGxpc3Qgd2l0aCBuZXcgc2tpbiB0b25lXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtb2ppcyA9IFtdLmZvckVhY2guY2FsbChvcHRpb25zLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yQWxsKGAuJHtvcHRpb25zLmNsYXNzbmFtZXMucmVzdWx0c30gIC4ke29wdGlvbnMuY2xhc3NuYW1lcy5lbW9qaX1gKSwgZW1vamkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZW1vamkuZGF0YXNldC5maXR6cGF0cmljaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtb2ppT2JqID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmljb2RlOiBlbW9qaS5kYXRhc2V0LnVuaWNvZGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXI6IGVtb2ppLmRhdGFzZXQuY2hhcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZml0enBhdHJpY2s6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBlbW9qaS5kYXRhc2V0LmNhdGVnb3J5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBlbW9qaS5kYXRhc2V0Lm5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1vamkucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoRW1vamlzLmNyZWF0ZUJ1dHRvbihlbW9qaU9iaiwgb3B0aW9ucywgZW1pdCksIGVtb2ppKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgICAgICBtb2RpZmllckRyb3Bkb3duLmFwcGVuZENoaWxkKG1vZGlmaWVyQnRuKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgZm9vdGVyLmFwcGVuZENoaWxkKG1vZGlmaWVyRHJvcGRvd24pO1xuICAgICAgICB9XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0O1xuIiwibW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgYToge1xuICAgICAgICB1bmljb2RlOiAnJyxcbiAgICAgICAgY2hhcjogJydcbiAgICB9LFxuICAgIGI6IHtcbiAgICAgICAgdW5pY29kZTogJy0xZjNmYicsXG4gICAgICAgIGNoYXI6ICfwn4+7J1xuICAgIH0sXG4gICAgYzoge1xuICAgICAgICB1bmljb2RlOiAnLTFmM2ZjJyxcbiAgICAgICAgY2hhcjogJ/Cfj7wnXG4gICAgfSxcbiAgICBkOiB7XG4gICAgICAgIHVuaWNvZGU6ICctMWYzZmQnLFxuICAgICAgICBjaGFyOiAn8J+PvSdcbiAgICB9LFxuICAgIGU6IHtcbiAgICAgICAgdW5pY29kZTogJy0xZjNmZScsXG4gICAgICAgIGNoYXI6ICfwn4++J1xuICAgIH0sXG4gICAgZjoge1xuICAgICAgICB1bmljb2RlOiAnLTFmM2ZmJyxcbiAgICAgICAgY2hhcjogJ/Cfj78nXG4gICAgfVxufTtcbiJdfQ==
