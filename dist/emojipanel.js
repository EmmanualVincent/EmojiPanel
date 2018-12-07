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
        }

        return Promise.all([svgPromise, jsonPromise]);
    },
    createEl: function createEl(inputElement, options, baseUrl, mediaType) {
        if (options.panel_type == "emoji") {

            if (options.pack_url) {
                if (document.querySelector('.' + options.classnames.svg + ' [id="' + inputElement.unicode + '"')) {
                    return '<svg viewBox="0 0 20 20"><use xlink:href="#' + inputElement.unicode + '"></use></svg>';
                }
            }
            return inputElement.char;
            // Fallback to the emoji char if the pack does not have the sprite, or no pack
        } else if (options.panel_type == "icon") {
            if (mediaType == "image") {
                return "<img src=" + baseUrl + inputElement.icon_url + ">";
            } else {
                return "<i class='fa " + inputElement.icon_url + "'></i>";
            }
        }
    },
    createButton: function createButton(inputElement, options, emit, baseUrl, mediaType) {

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

            button.innerHTML = Emojis.createEl(inputElement, options, baseUrl, mediaType);
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
    panel_type: 'icon',
    json_url: '/iconSet.json',
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
    Object.keys(json).forEach(function (i) {
        var category = json[i];

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
            categoryLink.innerHTML = Emojis.createEl(category.icon_pack, options, category.base_url, category.media_type);
        }

        categoryLink.addEventListener('click', function (e) {
            var strippedSpace = category.name.replace(/\s/g, "_");
            var title = options.container.querySelector('#' + strippedSpace);
            scrollTo(results, title.offsetTop - results.offsetTop, 500);
        });
        categories.appendChild(categoryLink);
    });

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
                results.appendChild(Emojis.createButton(icon, options, emit, category.base_url, category.media_type));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmJlbWl0dGVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZiZW1pdHRlci9saWIvQmFzZUV2ZW50RW1pdHRlci5qcyIsIm5vZGVfbW9kdWxlcy9mYmVtaXR0ZXIvbGliL0VtaXR0ZXJTdWJzY3JpcHRpb24uanMiLCJub2RlX21vZHVsZXMvZmJlbWl0dGVyL2xpYi9FdmVudFN1YnNjcmlwdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9mYmVtaXR0ZXIvbGliL0V2ZW50U3Vic2NyaXB0aW9uVmVuZG9yLmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2VtcHR5RnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvZmJqcy9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy90ZXRoZXIvZGlzdC9qcy90ZXRoZXIuanMiLCJzcmMvY2xhc3NuYW1lcy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZW1vamlzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL2xpc3QuanMiLCJzcmMvbW9kaWZpZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM5TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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TTtBQUZQLEtBYlU7QUFpQmIsT0FBRztBQUNDLGlCQUFTLFFBRFY7QUFFQyxjQUFNO0FBRlAsS0FqQlU7QUFxQmIsT0FBRztBQUNDLGlCQUFTLFFBRFY7QUFFQyxjQUFNO0FBRlA7QUFyQlUsQ0FBakIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbigpe2Z1bmN0aW9uIHIoZSxuLHQpe2Z1bmN0aW9uIG8oaSxmKXtpZighbltpXSl7aWYoIWVbaV0pe3ZhciBjPVwiZnVuY3Rpb25cIj09dHlwZW9mIHJlcXVpcmUmJnJlcXVpcmU7aWYoIWYmJmMpcmV0dXJuIGMoaSwhMCk7aWYodSlyZXR1cm4gdShpLCEwKTt2YXIgYT1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK2krXCInXCIpO3Rocm93IGEuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixhfXZhciBwPW5baV09e2V4cG9ydHM6e319O2VbaV1bMF0uY2FsbChwLmV4cG9ydHMsZnVuY3Rpb24ocil7dmFyIG49ZVtpXVsxXVtyXTtyZXR1cm4gbyhufHxyKX0scCxwLmV4cG9ydHMscixlLG4sdCl9cmV0dXJuIG5baV0uZXhwb3J0c31mb3IodmFyIHU9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZSxpPTA7aTx0Lmxlbmd0aDtpKyspbyh0W2ldKTtyZXR1cm4gb31yZXR1cm4gcn0pKCkiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKi9cblxudmFyIGZiZW1pdHRlciA9IHtcbiAgRXZlbnRFbWl0dGVyOiByZXF1aXJlKCcuL2xpYi9CYXNlRXZlbnRFbWl0dGVyJyksXG4gIEVtaXR0ZXJTdWJzY3JpcHRpb24gOiByZXF1aXJlKCcuL2xpYi9FbWl0dGVyU3Vic2NyaXB0aW9uJylcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZmJlbWl0dGVyO1xuIiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICpcbiAqIEBwcm92aWRlc01vZHVsZSBCYXNlRXZlbnRFbWl0dGVyXG4gKiBAdHlwZWNoZWNrc1xuICovXG5cbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBFbWl0dGVyU3Vic2NyaXB0aW9uID0gcmVxdWlyZSgnLi9FbWl0dGVyU3Vic2NyaXB0aW9uJyk7XG52YXIgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IgPSByZXF1aXJlKCcuL0V2ZW50U3Vic2NyaXB0aW9uVmVuZG9yJyk7XG5cbnZhciBlbXB0eUZ1bmN0aW9uID0gcmVxdWlyZSgnZmJqcy9saWIvZW1wdHlGdW5jdGlvbicpO1xudmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xuXG4vKipcbiAqIEBjbGFzcyBCYXNlRXZlbnRFbWl0dGVyXG4gKiBAZGVzY3JpcHRpb25cbiAqIEFuIEV2ZW50RW1pdHRlciBpcyByZXNwb25zaWJsZSBmb3IgbWFuYWdpbmcgYSBzZXQgb2YgbGlzdGVuZXJzIGFuZCBwdWJsaXNoaW5nXG4gKiBldmVudHMgdG8gdGhlbSB3aGVuIGl0IGlzIHRvbGQgdGhhdCBzdWNoIGV2ZW50cyBoYXBwZW5lZC4gSW4gYWRkaXRpb24gdG8gdGhlXG4gKiBkYXRhIGZvciB0aGUgZ2l2ZW4gZXZlbnQgaXQgYWxzbyBzZW5kcyBhIGV2ZW50IGNvbnRyb2wgb2JqZWN0IHdoaWNoIGFsbG93c1xuICogdGhlIGxpc3RlbmVycy9oYW5kbGVycyB0byBwcmV2ZW50IHRoZSBkZWZhdWx0IGJlaGF2aW9yIG9mIHRoZSBnaXZlbiBldmVudC5cbiAqXG4gKiBUaGUgZW1pdHRlciBpcyBkZXNpZ25lZCB0byBiZSBnZW5lcmljIGVub3VnaCB0byBzdXBwb3J0IGFsbCB0aGUgZGlmZmVyZW50XG4gKiBjb250ZXh0cyBpbiB3aGljaCBvbmUgbWlnaHQgd2FudCB0byBlbWl0IGV2ZW50cy4gSXQgaXMgYSBzaW1wbGUgbXVsdGljYXN0XG4gKiBtZWNoYW5pc20gb24gdG9wIG9mIHdoaWNoIGV4dHJhIGZ1bmN0aW9uYWxpdHkgY2FuIGJlIGNvbXBvc2VkLiBGb3IgZXhhbXBsZSwgYVxuICogbW9yZSBhZHZhbmNlZCBlbWl0dGVyIG1heSB1c2UgYW4gRXZlbnRIb2xkZXIgYW5kIEV2ZW50RmFjdG9yeS5cbiAqL1xuXG52YXIgQmFzZUV2ZW50RW1pdHRlciA9IChmdW5jdGlvbiAoKSB7XG4gIC8qKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICovXG5cbiAgZnVuY3Rpb24gQmFzZUV2ZW50RW1pdHRlcigpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgQmFzZUV2ZW50RW1pdHRlcik7XG5cbiAgICB0aGlzLl9zdWJzY3JpYmVyID0gbmV3IEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yKCk7XG4gICAgdGhpcy5fY3VycmVudFN1YnNjcmlwdGlvbiA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIGxpc3RlbmVyIHRvIGJlIGludm9rZWQgd2hlbiBldmVudHMgb2YgdGhlIHNwZWNpZmllZCB0eXBlIGFyZVxuICAgKiBlbWl0dGVkLiBBbiBvcHRpb25hbCBjYWxsaW5nIGNvbnRleHQgbWF5IGJlIHByb3ZpZGVkLiBUaGUgZGF0YSBhcmd1bWVudHNcbiAgICogZW1pdHRlZCB3aWxsIGJlIHBhc3NlZCB0byB0aGUgbGlzdGVuZXIgZnVuY3Rpb24uXG4gICAqXG4gICAqIFRPRE86IEFubm90YXRlIHRoZSBsaXN0ZW5lciBhcmcncyB0eXBlLiBUaGlzIGlzIHRyaWNreSBiZWNhdXNlIGxpc3RlbmVyc1xuICAgKiAgICAgICBjYW4gYmUgaW52b2tlZCB3aXRoIHZhcmFyZ3MuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW4gdG9cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlzdGVuZXIgLSBGdW5jdGlvbiB0byBpbnZva2Ugd2hlbiB0aGUgc3BlY2lmaWVkIGV2ZW50IGlzXG4gICAqICAgZW1pdHRlZFxuICAgKiBAcGFyYW0geyp9IGNvbnRleHQgLSBPcHRpb25hbCBjb250ZXh0IG9iamVjdCB0byB1c2Ugd2hlbiBpbnZva2luZyB0aGVcbiAgICogICBsaXN0ZW5lclxuICAgKi9cblxuICBCYXNlRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lciA9IGZ1bmN0aW9uIGFkZExpc3RlbmVyKGV2ZW50VHlwZSwgbGlzdGVuZXIsIGNvbnRleHQpIHtcbiAgICByZXR1cm4gdGhpcy5fc3Vic2NyaWJlci5hZGRTdWJzY3JpcHRpb24oZXZlbnRUeXBlLCBuZXcgRW1pdHRlclN1YnNjcmlwdGlvbih0aGlzLl9zdWJzY3JpYmVyLCBsaXN0ZW5lciwgY29udGV4dCkpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTaW1pbGFyIHRvIGFkZExpc3RlbmVyLCBleGNlcHQgdGhhdCB0aGUgbGlzdGVuZXIgaXMgcmVtb3ZlZCBhZnRlciBpdCBpc1xuICAgKiBpbnZva2VkIG9uY2UuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBsaXN0ZW4gdG9cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlzdGVuZXIgLSBGdW5jdGlvbiB0byBpbnZva2Ugb25seSBvbmNlIHdoZW4gdGhlXG4gICAqICAgc3BlY2lmaWVkIGV2ZW50IGlzIGVtaXR0ZWRcbiAgICogQHBhcmFtIHsqfSBjb250ZXh0IC0gT3B0aW9uYWwgY29udGV4dCBvYmplY3QgdG8gdXNlIHdoZW4gaW52b2tpbmcgdGhlXG4gICAqICAgbGlzdGVuZXJcbiAgICovXG5cbiAgQmFzZUV2ZW50RW1pdHRlci5wcm90b3R5cGUub25jZSA9IGZ1bmN0aW9uIG9uY2UoZXZlbnRUeXBlLCBsaXN0ZW5lciwgY29udGV4dCkge1xuICAgIHZhciBlbWl0dGVyID0gdGhpcztcbiAgICByZXR1cm4gdGhpcy5hZGRMaXN0ZW5lcihldmVudFR5cGUsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGVtaXR0ZXIucmVtb3ZlQ3VycmVudExpc3RlbmVyKCk7XG4gICAgICBsaXN0ZW5lci5hcHBseShjb250ZXh0LCBhcmd1bWVudHMpO1xuICAgIH0pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGFsbCBvZiB0aGUgcmVnaXN0ZXJlZCBsaXN0ZW5lcnMsIGluY2x1ZGluZyB0aG9zZSByZWdpc3RlcmVkIGFzXG4gICAqIGxpc3RlbmVyIG1hcHMuXG4gICAqXG4gICAqIEBwYXJhbSB7P3N0cmluZ30gZXZlbnRUeXBlIC0gT3B0aW9uYWwgbmFtZSBvZiB0aGUgZXZlbnQgd2hvc2UgcmVnaXN0ZXJlZFxuICAgKiAgIGxpc3RlbmVycyB0byByZW1vdmVcbiAgICovXG5cbiAgQmFzZUV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24gcmVtb3ZlQWxsTGlzdGVuZXJzKGV2ZW50VHlwZSkge1xuICAgIHRoaXMuX3N1YnNjcmliZXIucmVtb3ZlQWxsU3Vic2NyaXB0aW9ucyhldmVudFR5cGUpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBQcm92aWRlcyBhbiBBUEkgdGhhdCBjYW4gYmUgY2FsbGVkIGR1cmluZyBhbiBldmVudGluZyBjeWNsZSB0byByZW1vdmUgdGhlXG4gICAqIGxhc3QgbGlzdGVuZXIgdGhhdCB3YXMgaW52b2tlZC4gVGhpcyBhbGxvd3MgYSBkZXZlbG9wZXIgdG8gcHJvdmlkZSBhbiBldmVudFxuICAgKiBvYmplY3QgdGhhdCBjYW4gcmVtb3ZlIHRoZSBsaXN0ZW5lciAob3IgbGlzdGVuZXIgbWFwKSBkdXJpbmcgdGhlXG4gICAqIGludm9jYXRpb24uXG4gICAqXG4gICAqIElmIGl0IGlzIGNhbGxlZCB3aGVuIG5vdCBpbnNpZGUgb2YgYW4gZW1pdHRpbmcgY3ljbGUgaXQgd2lsbCB0aHJvdy5cbiAgICpcbiAgICogQHRocm93cyB7RXJyb3J9IFdoZW4gY2FsbGVkIG5vdCBkdXJpbmcgYW4gZXZlbnRpbmcgY3ljbGVcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogICB2YXIgc3Vic2NyaXB0aW9uID0gZW1pdHRlci5hZGRMaXN0ZW5lck1hcCh7XG4gICAqICAgICBzb21lRXZlbnQ6IGZ1bmN0aW9uKGRhdGEsIGV2ZW50KSB7XG4gICAqICAgICAgIGNvbnNvbGUubG9nKGRhdGEpO1xuICAgKiAgICAgICBlbWl0dGVyLnJlbW92ZUN1cnJlbnRMaXN0ZW5lcigpO1xuICAgKiAgICAgfVxuICAgKiAgIH0pO1xuICAgKlxuICAgKiAgIGVtaXR0ZXIuZW1pdCgnc29tZUV2ZW50JywgJ2FiYycpOyAvLyBsb2dzICdhYmMnXG4gICAqICAgZW1pdHRlci5lbWl0KCdzb21lRXZlbnQnLCAnZGVmJyk7IC8vIGRvZXMgbm90IGxvZyBhbnl0aGluZ1xuICAgKi9cblxuICBCYXNlRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVDdXJyZW50TGlzdGVuZXIgPSBmdW5jdGlvbiByZW1vdmVDdXJyZW50TGlzdGVuZXIoKSB7XG4gICAgISEhdGhpcy5fY3VycmVudFN1YnNjcmlwdGlvbiA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdOb3QgaW4gYW4gZW1pdHRpbmcgY3ljbGU7IHRoZXJlIGlzIG5vIGN1cnJlbnQgc3Vic2NyaXB0aW9uJykgOiBpbnZhcmlhbnQoZmFsc2UpIDogdW5kZWZpbmVkO1xuICAgIHRoaXMuX3N1YnNjcmliZXIucmVtb3ZlU3Vic2NyaXB0aW9uKHRoaXMuX2N1cnJlbnRTdWJzY3JpcHRpb24pO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGxpc3RlbmVycyB0aGF0IGFyZSBjdXJyZW50bHkgcmVnaXN0ZXJlZCBmb3IgdGhlIGdpdmVuXG4gICAqIGV2ZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gcXVlcnlcbiAgICogQHJldHVybiB7YXJyYXl9XG4gICAqL1xuXG4gIEJhc2VFdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uIGxpc3RlbmVycyhldmVudFR5cGUpIC8qIFRPRE86IEFycmF5PEV2ZW50U3Vic2NyaXB0aW9uPiAqL3tcbiAgICB2YXIgc3Vic2NyaXB0aW9ucyA9IHRoaXMuX3N1YnNjcmliZXIuZ2V0U3Vic2NyaXB0aW9uc0ZvclR5cGUoZXZlbnRUeXBlKTtcbiAgICByZXR1cm4gc3Vic2NyaXB0aW9ucyA/IHN1YnNjcmlwdGlvbnMuZmlsdGVyKGVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNUcnVlKS5tYXAoZnVuY3Rpb24gKHN1YnNjcmlwdGlvbikge1xuICAgICAgcmV0dXJuIHN1YnNjcmlwdGlvbi5saXN0ZW5lcjtcbiAgICB9KSA6IFtdO1xuICB9O1xuXG4gIC8qKlxuICAgKiBFbWl0cyBhbiBldmVudCBvZiB0aGUgZ2l2ZW4gdHlwZSB3aXRoIHRoZSBnaXZlbiBkYXRhLiBBbGwgaGFuZGxlcnMgb2YgdGhhdFxuICAgKiBwYXJ0aWN1bGFyIHR5cGUgd2lsbCBiZSBub3RpZmllZC5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZSAtIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGVtaXRcbiAgICogQHBhcmFtIHsqfSBBcmJpdHJhcnkgYXJndW1lbnRzIHRvIGJlIHBhc3NlZCB0byBlYWNoIHJlZ2lzdGVyZWQgbGlzdGVuZXJcbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogICBlbWl0dGVyLmFkZExpc3RlbmVyKCdzb21lRXZlbnQnLCBmdW5jdGlvbihtZXNzYWdlKSB7XG4gICAqICAgICBjb25zb2xlLmxvZyhtZXNzYWdlKTtcbiAgICogICB9KTtcbiAgICpcbiAgICogICBlbWl0dGVyLmVtaXQoJ3NvbWVFdmVudCcsICdhYmMnKTsgLy8gbG9ncyAnYWJjJ1xuICAgKi9cblxuICBCYXNlRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24gZW1pdChldmVudFR5cGUpIHtcbiAgICB2YXIgc3Vic2NyaXB0aW9ucyA9IHRoaXMuX3N1YnNjcmliZXIuZ2V0U3Vic2NyaXB0aW9uc0ZvclR5cGUoZXZlbnRUeXBlKTtcbiAgICBpZiAoc3Vic2NyaXB0aW9ucykge1xuICAgICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhzdWJzY3JpcHRpb25zKTtcbiAgICAgIGZvciAodmFyIGlpID0gMDsgaWkgPCBrZXlzLmxlbmd0aDsgaWkrKykge1xuICAgICAgICB2YXIga2V5ID0ga2V5c1tpaV07XG4gICAgICAgIHZhciBzdWJzY3JpcHRpb24gPSBzdWJzY3JpcHRpb25zW2tleV07XG4gICAgICAgIC8vIFRoZSBzdWJzY3JpcHRpb24gbWF5IGhhdmUgYmVlbiByZW1vdmVkIGR1cmluZyB0aGlzIGV2ZW50IGxvb3AuXG4gICAgICAgIGlmIChzdWJzY3JpcHRpb24pIHtcbiAgICAgICAgICB0aGlzLl9jdXJyZW50U3Vic2NyaXB0aW9uID0gc3Vic2NyaXB0aW9uO1xuICAgICAgICAgIHRoaXMuX19lbWl0VG9TdWJzY3JpcHRpb24uYXBwbHkodGhpcywgW3N1YnNjcmlwdGlvbl0uY29uY2F0KEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cykpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5fY3VycmVudFN1YnNjcmlwdGlvbiA9IG51bGw7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBQcm92aWRlcyBhIGhvb2sgdG8gb3ZlcnJpZGUgaG93IHRoZSBlbWl0dGVyIGVtaXRzIGFuIGV2ZW50IHRvIGEgc3BlY2lmaWNcbiAgICogc3Vic2NyaXB0aW9uLiBUaGlzIGFsbG93cyB5b3UgdG8gc2V0IHVwIGxvZ2dpbmcgYW5kIGVycm9yIGJvdW5kYXJpZXNcbiAgICogc3BlY2lmaWMgdG8geW91ciBlbnZpcm9ubWVudC5cbiAgICpcbiAgICogQHBhcmFtIHtFbWl0dGVyU3Vic2NyaXB0aW9ufSBzdWJzY3JpcHRpb25cbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZVxuICAgKiBAcGFyYW0geyp9IEFyYml0cmFyeSBhcmd1bWVudHMgdG8gYmUgcGFzc2VkIHRvIGVhY2ggcmVnaXN0ZXJlZCBsaXN0ZW5lclxuICAgKi9cblxuICBCYXNlRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fX2VtaXRUb1N1YnNjcmlwdGlvbiA9IGZ1bmN0aW9uIF9fZW1pdFRvU3Vic2NyaXB0aW9uKHN1YnNjcmlwdGlvbiwgZXZlbnRUeXBlKSB7XG4gICAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDIpO1xuICAgIHN1YnNjcmlwdGlvbi5saXN0ZW5lci5hcHBseShzdWJzY3JpcHRpb24uY29udGV4dCwgYXJncyk7XG4gIH07XG5cbiAgcmV0dXJuIEJhc2VFdmVudEVtaXR0ZXI7XG59KSgpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEJhc2VFdmVudEVtaXR0ZXI7IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICogXG4gKiBAcHJvdmlkZXNNb2R1bGUgRW1pdHRlclN1YnNjcmlwdGlvblxuICogQHR5cGVjaGVja3NcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG5mdW5jdGlvbiBfaW5oZXJpdHMoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHsgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSAnZnVuY3Rpb24nICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCAnICsgdHlwZW9mIHN1cGVyQ2xhc3MpOyB9IHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwgeyBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogc3ViQ2xhc3MsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0gfSk7IGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzczsgfVxuXG52YXIgRXZlbnRTdWJzY3JpcHRpb24gPSByZXF1aXJlKCcuL0V2ZW50U3Vic2NyaXB0aW9uJyk7XG5cbi8qKlxuICogRW1pdHRlclN1YnNjcmlwdGlvbiByZXByZXNlbnRzIGEgc3Vic2NyaXB0aW9uIHdpdGggbGlzdGVuZXIgYW5kIGNvbnRleHQgZGF0YS5cbiAqL1xuXG52YXIgRW1pdHRlclN1YnNjcmlwdGlvbiA9IChmdW5jdGlvbiAoX0V2ZW50U3Vic2NyaXB0aW9uKSB7XG4gIF9pbmhlcml0cyhFbWl0dGVyU3Vic2NyaXB0aW9uLCBfRXZlbnRTdWJzY3JpcHRpb24pO1xuXG4gIC8qKlxuICAgKiBAcGFyYW0ge0V2ZW50U3Vic2NyaXB0aW9uVmVuZG9yfSBzdWJzY3JpYmVyIC0gVGhlIHN1YnNjcmliZXIgdGhhdCBjb250cm9sc1xuICAgKiAgIHRoaXMgc3Vic2NyaXB0aW9uXG4gICAqIEBwYXJhbSB7ZnVuY3Rpb259IGxpc3RlbmVyIC0gRnVuY3Rpb24gdG8gaW52b2tlIHdoZW4gdGhlIHNwZWNpZmllZCBldmVudCBpc1xuICAgKiAgIGVtaXR0ZWRcbiAgICogQHBhcmFtIHsqfSBjb250ZXh0IC0gT3B0aW9uYWwgY29udGV4dCBvYmplY3QgdG8gdXNlIHdoZW4gaW52b2tpbmcgdGhlXG4gICAqICAgbGlzdGVuZXJcbiAgICovXG5cbiAgZnVuY3Rpb24gRW1pdHRlclN1YnNjcmlwdGlvbihzdWJzY3JpYmVyLCBsaXN0ZW5lciwgY29udGV4dCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBFbWl0dGVyU3Vic2NyaXB0aW9uKTtcblxuICAgIF9FdmVudFN1YnNjcmlwdGlvbi5jYWxsKHRoaXMsIHN1YnNjcmliZXIpO1xuICAgIHRoaXMubGlzdGVuZXIgPSBsaXN0ZW5lcjtcbiAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICB9XG5cbiAgcmV0dXJuIEVtaXR0ZXJTdWJzY3JpcHRpb247XG59KShFdmVudFN1YnNjcmlwdGlvbik7XG5cbm1vZHVsZS5leHBvcnRzID0gRW1pdHRlclN1YnNjcmlwdGlvbjsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogQHByb3ZpZGVzTW9kdWxlIEV2ZW50U3Vic2NyaXB0aW9uXG4gKiBAdHlwZWNoZWNrc1xuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBFdmVudFN1YnNjcmlwdGlvbiByZXByZXNlbnRzIGEgc3Vic2NyaXB0aW9uIHRvIGEgcGFydGljdWxhciBldmVudC4gSXQgY2FuXG4gKiByZW1vdmUgaXRzIG93biBzdWJzY3JpcHRpb24uXG4gKi9cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBFdmVudFN1YnNjcmlwdGlvbiA9IChmdW5jdGlvbiAoKSB7XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7RXZlbnRTdWJzY3JpcHRpb25WZW5kb3J9IHN1YnNjcmliZXIgdGhlIHN1YnNjcmliZXIgdGhhdCBjb250cm9sc1xuICAgKiAgIHRoaXMgc3Vic2NyaXB0aW9uLlxuICAgKi9cblxuICBmdW5jdGlvbiBFdmVudFN1YnNjcmlwdGlvbihzdWJzY3JpYmVyKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEV2ZW50U3Vic2NyaXB0aW9uKTtcblxuICAgIHRoaXMuc3Vic2NyaWJlciA9IHN1YnNjcmliZXI7XG4gIH1cblxuICAvKipcbiAgICogUmVtb3ZlcyB0aGlzIHN1YnNjcmlwdGlvbiBmcm9tIHRoZSBzdWJzY3JpYmVyIHRoYXQgY29udHJvbHMgaXQuXG4gICAqL1xuXG4gIEV2ZW50U3Vic2NyaXB0aW9uLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiByZW1vdmUoKSB7XG4gICAgaWYgKHRoaXMuc3Vic2NyaWJlcikge1xuICAgICAgdGhpcy5zdWJzY3JpYmVyLnJlbW92ZVN1YnNjcmlwdGlvbih0aGlzKTtcbiAgICAgIHRoaXMuc3Vic2NyaWJlciA9IG51bGw7XG4gICAgfVxuICB9O1xuXG4gIHJldHVybiBFdmVudFN1YnNjcmlwdGlvbjtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRTdWJzY3JpcHRpb247IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTQtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgQlNELXN0eWxlIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuIEFuIGFkZGl0aW9uYWwgZ3JhbnRcbiAqIG9mIHBhdGVudCByaWdodHMgY2FuIGJlIGZvdW5kIGluIHRoZSBQQVRFTlRTIGZpbGUgaW4gdGhlIHNhbWUgZGlyZWN0b3J5LlxuICogXG4gKiBAcHJvdmlkZXNNb2R1bGUgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3JcbiAqIEB0eXBlY2hlY2tzXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIGludmFyaWFudCA9IHJlcXVpcmUoJ2ZianMvbGliL2ludmFyaWFudCcpO1xuXG4vKipcbiAqIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yIHN0b3JlcyBhIHNldCBvZiBFdmVudFN1YnNjcmlwdGlvbnMgdGhhdCBhcmVcbiAqIHN1YnNjcmliZWQgdG8gYSBwYXJ0aWN1bGFyIGV2ZW50IHR5cGUuXG4gKi9cblxudmFyIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IoKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yKTtcblxuICAgIHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlID0ge307XG4gICAgdGhpcy5fY3VycmVudFN1YnNjcmlwdGlvbiA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogQWRkcyBhIHN1YnNjcmlwdGlvbiBrZXllZCBieSBhbiBldmVudCB0eXBlLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlXG4gICAqIEBwYXJhbSB7RXZlbnRTdWJzY3JpcHRpb259IHN1YnNjcmlwdGlvblxuICAgKi9cblxuICBFdmVudFN1YnNjcmlwdGlvblZlbmRvci5wcm90b3R5cGUuYWRkU3Vic2NyaXB0aW9uID0gZnVuY3Rpb24gYWRkU3Vic2NyaXB0aW9uKGV2ZW50VHlwZSwgc3Vic2NyaXB0aW9uKSB7XG4gICAgIShzdWJzY3JpcHRpb24uc3Vic2NyaWJlciA9PT0gdGhpcykgPyBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nID8gaW52YXJpYW50KGZhbHNlLCAnVGhlIHN1YnNjcmliZXIgb2YgdGhlIHN1YnNjcmlwdGlvbiBpcyBpbmNvcnJlY3RseSBzZXQuJykgOiBpbnZhcmlhbnQoZmFsc2UpIDogdW5kZWZpbmVkO1xuICAgIGlmICghdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGVbZXZlbnRUeXBlXSkge1xuICAgICAgdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGVbZXZlbnRUeXBlXSA9IFtdO1xuICAgIH1cbiAgICB2YXIga2V5ID0gdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGVbZXZlbnRUeXBlXS5sZW5ndGg7XG4gICAgdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGVbZXZlbnRUeXBlXS5wdXNoKHN1YnNjcmlwdGlvbik7XG4gICAgc3Vic2NyaXB0aW9uLmV2ZW50VHlwZSA9IGV2ZW50VHlwZTtcbiAgICBzdWJzY3JpcHRpb24ua2V5ID0ga2V5O1xuICAgIHJldHVybiBzdWJzY3JpcHRpb247XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYSBidWxrIHNldCBvZiB0aGUgc3Vic2NyaXB0aW9ucy5cbiAgICpcbiAgICogQHBhcmFtIHs/c3RyaW5nfSBldmVudFR5cGUgLSBPcHRpb25hbCBuYW1lIG9mIHRoZSBldmVudCB0eXBlIHdob3NlXG4gICAqICAgcmVnaXN0ZXJlZCBzdXBzY3JpcHRpb25zIHRvIHJlbW92ZSwgaWYgbnVsbCByZW1vdmUgYWxsIHN1YnNjcmlwdGlvbnMuXG4gICAqL1xuXG4gIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yLnByb3RvdHlwZS5yZW1vdmVBbGxTdWJzY3JpcHRpb25zID0gZnVuY3Rpb24gcmVtb3ZlQWxsU3Vic2NyaXB0aW9ucyhldmVudFR5cGUpIHtcbiAgICBpZiAoZXZlbnRUeXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlID0ge307XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlbGV0ZSB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZVtldmVudFR5cGVdO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUmVtb3ZlcyBhIHNwZWNpZmljIHN1YnNjcmlwdGlvbi4gSW5zdGVhZCBvZiBjYWxsaW5nIHRoaXMgZnVuY3Rpb24sIGNhbGxcbiAgICogYHN1YnNjcmlwdGlvbi5yZW1vdmUoKWAgZGlyZWN0bHkuXG4gICAqXG4gICAqIEBwYXJhbSB7b2JqZWN0fSBzdWJzY3JpcHRpb25cbiAgICovXG5cbiAgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IucHJvdG90eXBlLnJlbW92ZVN1YnNjcmlwdGlvbiA9IGZ1bmN0aW9uIHJlbW92ZVN1YnNjcmlwdGlvbihzdWJzY3JpcHRpb24pIHtcbiAgICB2YXIgZXZlbnRUeXBlID0gc3Vic2NyaXB0aW9uLmV2ZW50VHlwZTtcbiAgICB2YXIga2V5ID0gc3Vic2NyaXB0aW9uLmtleTtcblxuICAgIHZhciBzdWJzY3JpcHRpb25zRm9yVHlwZSA9IHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlW2V2ZW50VHlwZV07XG4gICAgaWYgKHN1YnNjcmlwdGlvbnNGb3JUeXBlKSB7XG4gICAgICBkZWxldGUgc3Vic2NyaXB0aW9uc0ZvclR5cGVba2V5XTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIGFycmF5IG9mIHN1YnNjcmlwdGlvbnMgdGhhdCBhcmUgY3VycmVudGx5IHJlZ2lzdGVyZWQgZm9yIHRoZVxuICAgKiBnaXZlbiBldmVudCB0eXBlLlxuICAgKlxuICAgKiBOb3RlOiBUaGlzIGFycmF5IGNhbiBiZSBwb3RlbnRpYWxseSBzcGFyc2UgYXMgc3Vic2NyaXB0aW9ucyBhcmUgZGVsZXRlZFxuICAgKiBmcm9tIGl0IHdoZW4gdGhleSBhcmUgcmVtb3ZlZC5cbiAgICpcbiAgICogVE9ETzogVGhpcyByZXR1cm5zIGEgbnVsbGFibGUgYXJyYXkuIHdhdD9cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZVxuICAgKiBAcmV0dXJuIHs/YXJyYXl9XG4gICAqL1xuXG4gIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yLnByb3RvdHlwZS5nZXRTdWJzY3JpcHRpb25zRm9yVHlwZSA9IGZ1bmN0aW9uIGdldFN1YnNjcmlwdGlvbnNGb3JUeXBlKGV2ZW50VHlwZSkge1xuICAgIHJldHVybiB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZVtldmVudFR5cGVdO1xuICB9O1xuXG4gIHJldHVybiBFdmVudFN1YnNjcmlwdGlvblZlbmRvcjtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRTdWJzY3JpcHRpb25WZW5kb3I7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDEzLXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKlxuICogVGhpcyBzb3VyY2UgY29kZSBpcyBsaWNlbnNlZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UgZm91bmQgaW4gdGhlXG4gKiBMSUNFTlNFIGZpbGUgaW4gdGhlIHJvb3QgZGlyZWN0b3J5IG9mIHRoaXMgc291cmNlIHRyZWUuXG4gKlxuICogXG4gKi9cblxuZnVuY3Rpb24gbWFrZUVtcHR5RnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGFyZztcbiAgfTtcbn1cblxuLyoqXG4gKiBUaGlzIGZ1bmN0aW9uIGFjY2VwdHMgYW5kIGRpc2NhcmRzIGlucHV0czsgaXQgaGFzIG5vIHNpZGUgZWZmZWN0cy4gVGhpcyBpc1xuICogcHJpbWFyaWx5IHVzZWZ1bCBpZGlvbWF0aWNhbGx5IGZvciBvdmVycmlkYWJsZSBmdW5jdGlvbiBlbmRwb2ludHMgd2hpY2hcbiAqIGFsd2F5cyBuZWVkIHRvIGJlIGNhbGxhYmxlLCBzaW5jZSBKUyBsYWNrcyBhIG51bGwtY2FsbCBpZGlvbSBhbGEgQ29jb2EuXG4gKi9cbnZhciBlbXB0eUZ1bmN0aW9uID0gZnVuY3Rpb24gZW1wdHlGdW5jdGlvbigpIHt9O1xuXG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zID0gbWFrZUVtcHR5RnVuY3Rpb247XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zRmFsc2UgPSBtYWtlRW1wdHlGdW5jdGlvbihmYWxzZSk7XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zVHJ1ZSA9IG1ha2VFbXB0eUZ1bmN0aW9uKHRydWUpO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc051bGwgPSBtYWtlRW1wdHlGdW5jdGlvbihudWxsKTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNUaGlzID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcztcbn07XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zQXJndW1lbnQgPSBmdW5jdGlvbiAoYXJnKSB7XG4gIHJldHVybiBhcmc7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGVtcHR5RnVuY3Rpb247IiwiLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFVzZSBpbnZhcmlhbnQoKSB0byBhc3NlcnQgc3RhdGUgd2hpY2ggeW91ciBwcm9ncmFtIGFzc3VtZXMgdG8gYmUgdHJ1ZS5cbiAqXG4gKiBQcm92aWRlIHNwcmludGYtc3R5bGUgZm9ybWF0IChvbmx5ICVzIGlzIHN1cHBvcnRlZCkgYW5kIGFyZ3VtZW50c1xuICogdG8gcHJvdmlkZSBpbmZvcm1hdGlvbiBhYm91dCB3aGF0IGJyb2tlIGFuZCB3aGF0IHlvdSB3ZXJlXG4gKiBleHBlY3RpbmcuXG4gKlxuICogVGhlIGludmFyaWFudCBtZXNzYWdlIHdpbGwgYmUgc3RyaXBwZWQgaW4gcHJvZHVjdGlvbiwgYnV0IHRoZSBpbnZhcmlhbnRcbiAqIHdpbGwgcmVtYWluIHRvIGVuc3VyZSBsb2dpYyBkb2VzIG5vdCBkaWZmZXIgaW4gcHJvZHVjdGlvbi5cbiAqL1xuXG52YXIgdmFsaWRhdGVGb3JtYXQgPSBmdW5jdGlvbiB2YWxpZGF0ZUZvcm1hdChmb3JtYXQpIHt9O1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICB2YWxpZGF0ZUZvcm1hdCA9IGZ1bmN0aW9uIHZhbGlkYXRlRm9ybWF0KGZvcm1hdCkge1xuICAgIGlmIChmb3JtYXQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnZhcmlhbnQgcmVxdWlyZXMgYW4gZXJyb3IgbWVzc2FnZSBhcmd1bWVudCcpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gaW52YXJpYW50KGNvbmRpdGlvbiwgZm9ybWF0LCBhLCBiLCBjLCBkLCBlLCBmKSB7XG4gIHZhbGlkYXRlRm9ybWF0KGZvcm1hdCk7XG5cbiAgaWYgKCFjb25kaXRpb24pIHtcbiAgICB2YXIgZXJyb3I7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcignTWluaWZpZWQgZXhjZXB0aW9uIG9jY3VycmVkOyB1c2UgdGhlIG5vbi1taW5pZmllZCBkZXYgZW52aXJvbm1lbnQgJyArICdmb3IgdGhlIGZ1bGwgZXJyb3IgbWVzc2FnZSBhbmQgYWRkaXRpb25hbCBoZWxwZnVsIHdhcm5pbmdzLicpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgYXJncyA9IFthLCBiLCBjLCBkLCBlLCBmXTtcbiAgICAgIHZhciBhcmdJbmRleCA9IDA7XG4gICAgICBlcnJvciA9IG5ldyBFcnJvcihmb3JtYXQucmVwbGFjZSgvJXMvZywgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gYXJnc1thcmdJbmRleCsrXTtcbiAgICAgIH0pKTtcbiAgICAgIGVycm9yLm5hbWUgPSAnSW52YXJpYW50IFZpb2xhdGlvbic7XG4gICAgfVxuXG4gICAgZXJyb3IuZnJhbWVzVG9Qb3AgPSAxOyAvLyB3ZSBkb24ndCBjYXJlIGFib3V0IGludmFyaWFudCdzIG93biBmcmFtZVxuICAgIHRocm93IGVycm9yO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaW52YXJpYW50OyIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xuXG4vLyBjYWNoZWQgZnJvbSB3aGF0ZXZlciBnbG9iYWwgaXMgcHJlc2VudCBzbyB0aGF0IHRlc3QgcnVubmVycyB0aGF0IHN0dWIgaXRcbi8vIGRvbid0IGJyZWFrIHRoaW5ncy4gIEJ1dCB3ZSBuZWVkIHRvIHdyYXAgaXQgaW4gYSB0cnkgY2F0Y2ggaW4gY2FzZSBpdCBpc1xuLy8gd3JhcHBlZCBpbiBzdHJpY3QgbW9kZSBjb2RlIHdoaWNoIGRvZXNuJ3QgZGVmaW5lIGFueSBnbG9iYWxzLiAgSXQncyBpbnNpZGUgYVxuLy8gZnVuY3Rpb24gYmVjYXVzZSB0cnkvY2F0Y2hlcyBkZW9wdGltaXplIGluIGNlcnRhaW4gZW5naW5lcy5cblxudmFyIGNhY2hlZFNldFRpbWVvdXQ7XG52YXIgY2FjaGVkQ2xlYXJUaW1lb3V0O1xuXG5mdW5jdGlvbiBkZWZhdWx0U2V0VGltb3V0KCkge1xuICAgIHRocm93IG5ldyBFcnJvcignc2V0VGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuZnVuY3Rpb24gZGVmYXVsdENsZWFyVGltZW91dCAoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdjbGVhclRpbWVvdXQgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbn1cbihmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBzZXRUaW1lb3V0ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gc2V0VGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjYWNoZWRTZXRUaW1lb3V0ID0gZGVmYXVsdFNldFRpbW91dDtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgaWYgKHR5cGVvZiBjbGVhclRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGNsZWFyVGltZW91dDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZENsZWFyVGltZW91dCA9IGRlZmF1bHRDbGVhclRpbWVvdXQ7XG4gICAgfVxufSAoKSlcbmZ1bmN0aW9uIHJ1blRpbWVvdXQoZnVuKSB7XG4gICAgaWYgKGNhY2hlZFNldFRpbWVvdXQgPT09IHNldFRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIC8vIGlmIHNldFRpbWVvdXQgd2Fzbid0IGF2YWlsYWJsZSBidXQgd2FzIGxhdHRlciBkZWZpbmVkXG4gICAgaWYgKChjYWNoZWRTZXRUaW1lb3V0ID09PSBkZWZhdWx0U2V0VGltb3V0IHx8ICFjYWNoZWRTZXRUaW1lb3V0KSAmJiBzZXRUaW1lb3V0KSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICByZXR1cm4gc2V0VGltZW91dChmdW4sIDApO1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICAvLyB3aGVuIHdoZW4gc29tZWJvZHkgaGFzIHNjcmV3ZWQgd2l0aCBzZXRUaW1lb3V0IGJ1dCBubyBJLkUuIG1hZGRuZXNzXG4gICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfSBjYXRjaChlKXtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIC8vIFdoZW4gd2UgYXJlIGluIEkuRS4gYnV0IHRoZSBzY3JpcHQgaGFzIGJlZW4gZXZhbGVkIHNvIEkuRS4gZG9lc24ndCB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbChudWxsLCBmdW4sIDApO1xuICAgICAgICB9IGNhdGNoKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3JcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRTZXRUaW1lb3V0LmNhbGwodGhpcywgZnVuLCAwKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG59XG5mdW5jdGlvbiBydW5DbGVhclRpbWVvdXQobWFya2VyKSB7XG4gICAgaWYgKGNhY2hlZENsZWFyVGltZW91dCA9PT0gY2xlYXJUaW1lb3V0KSB7XG4gICAgICAgIC8vbm9ybWFsIGVudmlyb21lbnRzIGluIHNhbmUgc2l0dWF0aW9uc1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIC8vIGlmIGNsZWFyVGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZENsZWFyVGltZW91dCA9PT0gZGVmYXVsdENsZWFyVGltZW91dCB8fCAhY2FjaGVkQ2xlYXJUaW1lb3V0KSAmJiBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICByZXR1cm4gY2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dChtYXJrZXIpO1xuICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0ICB0cnVzdCB0aGUgZ2xvYmFsIG9iamVjdCB3aGVuIGNhbGxlZCBub3JtYWxseVxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZENsZWFyVGltZW91dC5jYWxsKG51bGwsIG1hcmtlcik7XG4gICAgICAgIH0gY2F0Y2ggKGUpe1xuICAgICAgICAgICAgLy8gc2FtZSBhcyBhYm92ZSBidXQgd2hlbiBpdCdzIGEgdmVyc2lvbiBvZiBJLkUuIHRoYXQgbXVzdCBoYXZlIHRoZSBnbG9iYWwgb2JqZWN0IGZvciAndGhpcycsIGhvcGZ1bGx5IG91ciBjb250ZXh0IGNvcnJlY3Qgb3RoZXJ3aXNlIGl0IHdpbGwgdGhyb3cgYSBnbG9iYWwgZXJyb3IuXG4gICAgICAgICAgICAvLyBTb21lIHZlcnNpb25zIG9mIEkuRS4gaGF2ZSBkaWZmZXJlbnQgcnVsZXMgZm9yIGNsZWFyVGltZW91dCB2cyBzZXRUaW1lb3V0XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwodGhpcywgbWFya2VyKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG5cbn1cbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGlmICghZHJhaW5pbmcgfHwgIWN1cnJlbnRRdWV1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHJ1blRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIHJ1bkNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHJ1blRpbWVvdXQoZHJhaW5RdWV1ZSk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucHJlcGVuZE9uY2VMaXN0ZW5lciA9IG5vb3A7XG5cbnByb2Nlc3MubGlzdGVuZXJzID0gZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIFtdIH1cblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCIvKiEgdGV0aGVyIDEuNC40ICovXG5cbihmdW5jdGlvbihyb290LCBmYWN0b3J5KSB7XG4gIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICBkZWZpbmUoW10sIGZhY3RvcnkpO1xuICB9IGVsc2UgaWYgKHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0Jykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZmFjdG9yeSgpO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuVGV0aGVyID0gZmFjdG9yeSgpO1xuICB9XG59KHRoaXMsIGZ1bmN0aW9uKCkge1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKCd2YWx1ZScgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0pKCk7XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG52YXIgVGV0aGVyQmFzZSA9IHVuZGVmaW5lZDtcbmlmICh0eXBlb2YgVGV0aGVyQmFzZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgVGV0aGVyQmFzZSA9IHsgbW9kdWxlczogW10gfTtcbn1cblxudmFyIHplcm9FbGVtZW50ID0gbnVsbDtcblxuLy8gU2FtZSBhcyBuYXRpdmUgZ2V0Qm91bmRpbmdDbGllbnRSZWN0LCBleGNlcHQgaXQgdGFrZXMgaW50byBhY2NvdW50IHBhcmVudCA8ZnJhbWU+IG9mZnNldHNcbi8vIGlmIHRoZSBlbGVtZW50IGxpZXMgd2l0aGluIGEgbmVzdGVkIGRvY3VtZW50ICg8ZnJhbWU+IG9yIDxpZnJhbWU+LWxpa2UpLlxuZnVuY3Rpb24gZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0KG5vZGUpIHtcbiAgdmFyIGJvdW5kaW5nUmVjdCA9IG5vZGUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgLy8gVGhlIG9yaWdpbmFsIG9iamVjdCByZXR1cm5lZCBieSBnZXRCb3VuZGluZ0NsaWVudFJlY3QgaXMgaW1tdXRhYmxlLCBzbyB3ZSBjbG9uZSBpdFxuICAvLyBXZSBjYW4ndCB1c2UgZXh0ZW5kIGJlY2F1c2UgdGhlIHByb3BlcnRpZXMgYXJlIG5vdCBjb25zaWRlcmVkIHBhcnQgb2YgdGhlIG9iamVjdCBieSBoYXNPd25Qcm9wZXJ0eSBpbiBJRTlcbiAgdmFyIHJlY3QgPSB7fTtcbiAgZm9yICh2YXIgayBpbiBib3VuZGluZ1JlY3QpIHtcbiAgICByZWN0W2tdID0gYm91bmRpbmdSZWN0W2tdO1xuICB9XG5cbiAgaWYgKG5vZGUub3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICB2YXIgX2ZyYW1lRWxlbWVudCA9IG5vZGUub3duZXJEb2N1bWVudC5kZWZhdWx0Vmlldy5mcmFtZUVsZW1lbnQ7XG4gICAgaWYgKF9mcmFtZUVsZW1lbnQpIHtcbiAgICAgIHZhciBmcmFtZVJlY3QgPSBnZXRBY3R1YWxCb3VuZGluZ0NsaWVudFJlY3QoX2ZyYW1lRWxlbWVudCk7XG4gICAgICByZWN0LnRvcCArPSBmcmFtZVJlY3QudG9wO1xuICAgICAgcmVjdC5ib3R0b20gKz0gZnJhbWVSZWN0LnRvcDtcbiAgICAgIHJlY3QubGVmdCArPSBmcmFtZVJlY3QubGVmdDtcbiAgICAgIHJlY3QucmlnaHQgKz0gZnJhbWVSZWN0LmxlZnQ7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlY3Q7XG59XG5cbmZ1bmN0aW9uIGdldFNjcm9sbFBhcmVudHMoZWwpIHtcbiAgLy8gSW4gZmlyZWZveCBpZiB0aGUgZWwgaXMgaW5zaWRlIGFuIGlmcmFtZSB3aXRoIGRpc3BsYXk6IG5vbmU7IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKCkgd2lsbCByZXR1cm4gbnVsbDtcbiAgLy8gaHR0cHM6Ly9idWd6aWxsYS5tb3ppbGxhLm9yZy9zaG93X2J1Zy5jZ2k/aWQ9NTQ4Mzk3XG4gIHZhciBjb21wdXRlZFN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShlbCkgfHwge307XG4gIHZhciBwb3NpdGlvbiA9IGNvbXB1dGVkU3R5bGUucG9zaXRpb247XG4gIHZhciBwYXJlbnRzID0gW107XG5cbiAgaWYgKHBvc2l0aW9uID09PSAnZml4ZWQnKSB7XG4gICAgcmV0dXJuIFtlbF07XG4gIH1cblxuICB2YXIgcGFyZW50ID0gZWw7XG4gIHdoaWxlICgocGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGUpICYmIHBhcmVudCAmJiBwYXJlbnQubm9kZVR5cGUgPT09IDEpIHtcbiAgICB2YXIgc3R5bGUgPSB1bmRlZmluZWQ7XG4gICAgdHJ5IHtcbiAgICAgIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZShwYXJlbnQpO1xuICAgIH0gY2F0Y2ggKGVycikge31cblxuICAgIGlmICh0eXBlb2Ygc3R5bGUgPT09ICd1bmRlZmluZWQnIHx8IHN0eWxlID09PSBudWxsKSB7XG4gICAgICBwYXJlbnRzLnB1c2gocGFyZW50KTtcbiAgICAgIHJldHVybiBwYXJlbnRzO1xuICAgIH1cblxuICAgIHZhciBfc3R5bGUgPSBzdHlsZTtcbiAgICB2YXIgb3ZlcmZsb3cgPSBfc3R5bGUub3ZlcmZsb3c7XG4gICAgdmFyIG92ZXJmbG93WCA9IF9zdHlsZS5vdmVyZmxvd1g7XG4gICAgdmFyIG92ZXJmbG93WSA9IF9zdHlsZS5vdmVyZmxvd1k7XG5cbiAgICBpZiAoLyhhdXRvfHNjcm9sbHxvdmVybGF5KS8udGVzdChvdmVyZmxvdyArIG92ZXJmbG93WSArIG92ZXJmbG93WCkpIHtcbiAgICAgIGlmIChwb3NpdGlvbiAhPT0gJ2Fic29sdXRlJyB8fCBbJ3JlbGF0aXZlJywgJ2Fic29sdXRlJywgJ2ZpeGVkJ10uaW5kZXhPZihzdHlsZS5wb3NpdGlvbikgPj0gMCkge1xuICAgICAgICBwYXJlbnRzLnB1c2gocGFyZW50KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBwYXJlbnRzLnB1c2goZWwub3duZXJEb2N1bWVudC5ib2R5KTtcblxuICAvLyBJZiB0aGUgbm9kZSBpcyB3aXRoaW4gYSBmcmFtZSwgYWNjb3VudCBmb3IgdGhlIHBhcmVudCB3aW5kb3cgc2Nyb2xsXG4gIGlmIChlbC5vd25lckRvY3VtZW50ICE9PSBkb2N1bWVudCkge1xuICAgIHBhcmVudHMucHVzaChlbC5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3KTtcbiAgfVxuXG4gIHJldHVybiBwYXJlbnRzO1xufVxuXG52YXIgdW5pcXVlSWQgPSAoZnVuY3Rpb24gKCkge1xuICB2YXIgaWQgPSAwO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiArK2lkO1xuICB9O1xufSkoKTtcblxudmFyIHplcm9Qb3NDYWNoZSA9IHt9O1xudmFyIGdldE9yaWdpbiA9IGZ1bmN0aW9uIGdldE9yaWdpbigpIHtcbiAgLy8gZ2V0Qm91bmRpbmdDbGllbnRSZWN0IGlzIHVuZm9ydHVuYXRlbHkgdG9vIGFjY3VyYXRlLiAgSXQgaW50cm9kdWNlcyBhIHBpeGVsIG9yIHR3byBvZlxuICAvLyBqaXR0ZXIgYXMgdGhlIHVzZXIgc2Nyb2xscyB0aGF0IG1lc3NlcyB3aXRoIG91ciBhYmlsaXR5IHRvIGRldGVjdCBpZiB0d28gcG9zaXRpb25zXG4gIC8vIGFyZSBlcXVpdmlsYW50IG9yIG5vdC4gIFdlIHBsYWNlIGFuIGVsZW1lbnQgYXQgdGhlIHRvcCBsZWZ0IG9mIHRoZSBwYWdlIHRoYXQgd2lsbFxuICAvLyBnZXQgdGhlIHNhbWUgaml0dGVyLCBzbyB3ZSBjYW4gY2FuY2VsIHRoZSB0d28gb3V0LlxuICB2YXIgbm9kZSA9IHplcm9FbGVtZW50O1xuICBpZiAoIW5vZGUgfHwgIWRvY3VtZW50LmJvZHkuY29udGFpbnMobm9kZSkpIHtcbiAgICBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgbm9kZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtdGV0aGVyLWlkJywgdW5pcXVlSWQoKSk7XG4gICAgZXh0ZW5kKG5vZGUuc3R5bGUsIHtcbiAgICAgIHRvcDogMCxcbiAgICAgIGxlZnQ6IDAsXG4gICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJ1xuICAgIH0pO1xuXG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKTtcblxuICAgIHplcm9FbGVtZW50ID0gbm9kZTtcbiAgfVxuXG4gIHZhciBpZCA9IG5vZGUuZ2V0QXR0cmlidXRlKCdkYXRhLXRldGhlci1pZCcpO1xuICBpZiAodHlwZW9mIHplcm9Qb3NDYWNoZVtpZF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgemVyb1Bvc0NhY2hlW2lkXSA9IGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdChub2RlKTtcblxuICAgIC8vIENsZWFyIHRoZSBjYWNoZSB3aGVuIHRoaXMgcG9zaXRpb24gY2FsbCBpcyBkb25lXG4gICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgZGVsZXRlIHplcm9Qb3NDYWNoZVtpZF07XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gemVyb1Bvc0NhY2hlW2lkXTtcbn07XG5cbmZ1bmN0aW9uIHJlbW92ZVV0aWxFbGVtZW50cygpIHtcbiAgaWYgKHplcm9FbGVtZW50KSB7XG4gICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh6ZXJvRWxlbWVudCk7XG4gIH1cbiAgemVyb0VsZW1lbnQgPSBudWxsO1xufTtcblxuZnVuY3Rpb24gZ2V0Qm91bmRzKGVsKSB7XG4gIHZhciBkb2MgPSB1bmRlZmluZWQ7XG4gIGlmIChlbCA9PT0gZG9jdW1lbnQpIHtcbiAgICBkb2MgPSBkb2N1bWVudDtcbiAgICBlbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcbiAgfSBlbHNlIHtcbiAgICBkb2MgPSBlbC5vd25lckRvY3VtZW50O1xuICB9XG5cbiAgdmFyIGRvY0VsID0gZG9jLmRvY3VtZW50RWxlbWVudDtcblxuICB2YXIgYm94ID0gZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0KGVsKTtcblxuICB2YXIgb3JpZ2luID0gZ2V0T3JpZ2luKCk7XG5cbiAgYm94LnRvcCAtPSBvcmlnaW4udG9wO1xuICBib3gubGVmdCAtPSBvcmlnaW4ubGVmdDtcblxuICBpZiAodHlwZW9mIGJveC53aWR0aCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBib3gud2lkdGggPSBkb2N1bWVudC5ib2R5LnNjcm9sbFdpZHRoIC0gYm94LmxlZnQgLSBib3gucmlnaHQ7XG4gIH1cbiAgaWYgKHR5cGVvZiBib3guaGVpZ2h0ID09PSAndW5kZWZpbmVkJykge1xuICAgIGJveC5oZWlnaHQgPSBkb2N1bWVudC5ib2R5LnNjcm9sbEhlaWdodCAtIGJveC50b3AgLSBib3guYm90dG9tO1xuICB9XG5cbiAgYm94LnRvcCA9IGJveC50b3AgLSBkb2NFbC5jbGllbnRUb3A7XG4gIGJveC5sZWZ0ID0gYm94LmxlZnQgLSBkb2NFbC5jbGllbnRMZWZ0O1xuICBib3gucmlnaHQgPSBkb2MuYm9keS5jbGllbnRXaWR0aCAtIGJveC53aWR0aCAtIGJveC5sZWZ0O1xuICBib3guYm90dG9tID0gZG9jLmJvZHkuY2xpZW50SGVpZ2h0IC0gYm94LmhlaWdodCAtIGJveC50b3A7XG5cbiAgcmV0dXJuIGJveDtcbn1cblxuZnVuY3Rpb24gZ2V0T2Zmc2V0UGFyZW50KGVsKSB7XG4gIHJldHVybiBlbC5vZmZzZXRQYXJlbnQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xufVxuXG52YXIgX3Njcm9sbEJhclNpemUgPSBudWxsO1xuZnVuY3Rpb24gZ2V0U2Nyb2xsQmFyU2l6ZSgpIHtcbiAgaWYgKF9zY3JvbGxCYXJTaXplKSB7XG4gICAgcmV0dXJuIF9zY3JvbGxCYXJTaXplO1xuICB9XG4gIHZhciBpbm5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBpbm5lci5zdHlsZS53aWR0aCA9ICcxMDAlJztcbiAgaW5uZXIuc3R5bGUuaGVpZ2h0ID0gJzIwMHB4JztcblxuICB2YXIgb3V0ZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZXh0ZW5kKG91dGVyLnN0eWxlLCB7XG4gICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXG4gICAgdG9wOiAwLFxuICAgIGxlZnQ6IDAsXG4gICAgcG9pbnRlckV2ZW50czogJ25vbmUnLFxuICAgIHZpc2liaWxpdHk6ICdoaWRkZW4nLFxuICAgIHdpZHRoOiAnMjAwcHgnLFxuICAgIGhlaWdodDogJzE1MHB4JyxcbiAgICBvdmVyZmxvdzogJ2hpZGRlbidcbiAgfSk7XG5cbiAgb3V0ZXIuYXBwZW5kQ2hpbGQoaW5uZXIpO1xuXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQob3V0ZXIpO1xuXG4gIHZhciB3aWR0aENvbnRhaW5lZCA9IGlubmVyLm9mZnNldFdpZHRoO1xuICBvdXRlci5zdHlsZS5vdmVyZmxvdyA9ICdzY3JvbGwnO1xuICB2YXIgd2lkdGhTY3JvbGwgPSBpbm5lci5vZmZzZXRXaWR0aDtcblxuICBpZiAod2lkdGhDb250YWluZWQgPT09IHdpZHRoU2Nyb2xsKSB7XG4gICAgd2lkdGhTY3JvbGwgPSBvdXRlci5jbGllbnRXaWR0aDtcbiAgfVxuXG4gIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQob3V0ZXIpO1xuXG4gIHZhciB3aWR0aCA9IHdpZHRoQ29udGFpbmVkIC0gd2lkdGhTY3JvbGw7XG5cbiAgX3Njcm9sbEJhclNpemUgPSB7IHdpZHRoOiB3aWR0aCwgaGVpZ2h0OiB3aWR0aCB9O1xuICByZXR1cm4gX3Njcm9sbEJhclNpemU7XG59XG5cbmZ1bmN0aW9uIGV4dGVuZCgpIHtcbiAgdmFyIG91dCA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG4gIHZhciBhcmdzID0gW107XG5cbiAgQXJyYXkucHJvdG90eXBlLnB1c2guYXBwbHkoYXJncywgYXJndW1lbnRzKTtcblxuICBhcmdzLnNsaWNlKDEpLmZvckVhY2goZnVuY3Rpb24gKG9iaikge1xuICAgIGlmIChvYmopIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKCh7fSkuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICBvdXRba2V5XSA9IG9ialtrZXldO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiByZW1vdmVDbGFzcyhlbCwgbmFtZSkge1xuICBpZiAodHlwZW9mIGVsLmNsYXNzTGlzdCAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBuYW1lLnNwbGl0KCcgJykuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgICBpZiAoY2xzLnRyaW0oKSkge1xuICAgICAgICBlbC5jbGFzc0xpc3QucmVtb3ZlKGNscyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHJlZ2V4ID0gbmV3IFJlZ0V4cCgnKF58ICknICsgbmFtZS5zcGxpdCgnICcpLmpvaW4oJ3wnKSArICcoIHwkKScsICdnaScpO1xuICAgIHZhciBjbGFzc05hbWUgPSBnZXRDbGFzc05hbWUoZWwpLnJlcGxhY2UocmVnZXgsICcgJyk7XG4gICAgc2V0Q2xhc3NOYW1lKGVsLCBjbGFzc05hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFkZENsYXNzKGVsLCBuYW1lKSB7XG4gIGlmICh0eXBlb2YgZWwuY2xhc3NMaXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG5hbWUuc3BsaXQoJyAnKS5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICAgIGlmIChjbHMudHJpbSgpKSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICByZW1vdmVDbGFzcyhlbCwgbmFtZSk7XG4gICAgdmFyIGNscyA9IGdldENsYXNzTmFtZShlbCkgKyAoJyAnICsgbmFtZSk7XG4gICAgc2V0Q2xhc3NOYW1lKGVsLCBjbHMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhc0NsYXNzKGVsLCBuYW1lKSB7XG4gIGlmICh0eXBlb2YgZWwuY2xhc3NMaXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBlbC5jbGFzc0xpc3QuY29udGFpbnMobmFtZSk7XG4gIH1cbiAgdmFyIGNsYXNzTmFtZSA9IGdldENsYXNzTmFtZShlbCk7XG4gIHJldHVybiBuZXcgUmVnRXhwKCcoXnwgKScgKyBuYW1lICsgJyggfCQpJywgJ2dpJykudGVzdChjbGFzc05hbWUpO1xufVxuXG5mdW5jdGlvbiBnZXRDbGFzc05hbWUoZWwpIHtcbiAgLy8gQ2FuJ3QgdXNlIGp1c3QgU1ZHQW5pbWF0ZWRTdHJpbmcgaGVyZSBzaW5jZSBub2RlcyB3aXRoaW4gYSBGcmFtZSBpbiBJRSBoYXZlXG4gIC8vIGNvbXBsZXRlbHkgc2VwYXJhdGVseSBTVkdBbmltYXRlZFN0cmluZyBiYXNlIGNsYXNzZXNcbiAgaWYgKGVsLmNsYXNzTmFtZSBpbnN0YW5jZW9mIGVsLm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcuU1ZHQW5pbWF0ZWRTdHJpbmcpIHtcbiAgICByZXR1cm4gZWwuY2xhc3NOYW1lLmJhc2VWYWw7XG4gIH1cbiAgcmV0dXJuIGVsLmNsYXNzTmFtZTtcbn1cblxuZnVuY3Rpb24gc2V0Q2xhc3NOYW1lKGVsLCBjbGFzc05hbWUpIHtcbiAgZWwuc2V0QXR0cmlidXRlKCdjbGFzcycsIGNsYXNzTmFtZSk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNsYXNzZXMoZWwsIGFkZCwgYWxsKSB7XG4gIC8vIE9mIHRoZSBzZXQgb2YgJ2FsbCcgY2xhc3Nlcywgd2UgbmVlZCB0aGUgJ2FkZCcgY2xhc3NlcywgYW5kIG9ubHkgdGhlXG4gIC8vICdhZGQnIGNsYXNzZXMgdG8gYmUgc2V0LlxuICBhbGwuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgaWYgKGFkZC5pbmRleE9mKGNscykgPT09IC0xICYmIGhhc0NsYXNzKGVsLCBjbHMpKSB7XG4gICAgICByZW1vdmVDbGFzcyhlbCwgY2xzKTtcbiAgICB9XG4gIH0pO1xuXG4gIGFkZC5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICBpZiAoIWhhc0NsYXNzKGVsLCBjbHMpKSB7XG4gICAgICBhZGRDbGFzcyhlbCwgY2xzKTtcbiAgICB9XG4gIH0pO1xufVxuXG52YXIgZGVmZXJyZWQgPSBbXTtcblxudmFyIGRlZmVyID0gZnVuY3Rpb24gZGVmZXIoZm4pIHtcbiAgZGVmZXJyZWQucHVzaChmbik7XG59O1xuXG52YXIgZmx1c2ggPSBmdW5jdGlvbiBmbHVzaCgpIHtcbiAgdmFyIGZuID0gdW5kZWZpbmVkO1xuICB3aGlsZSAoZm4gPSBkZWZlcnJlZC5wb3AoKSkge1xuICAgIGZuKCk7XG4gIH1cbn07XG5cbnZhciBFdmVudGVkID0gKGZ1bmN0aW9uICgpIHtcbiAgZnVuY3Rpb24gRXZlbnRlZCgpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRXZlbnRlZCk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoRXZlbnRlZCwgW3tcbiAgICBrZXk6ICdvbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG9uKGV2ZW50LCBoYW5kbGVyLCBjdHgpIHtcbiAgICAgIHZhciBvbmNlID0gYXJndW1lbnRzLmxlbmd0aCA8PSAzIHx8IGFyZ3VtZW50c1szXSA9PT0gdW5kZWZpbmVkID8gZmFsc2UgOiBhcmd1bWVudHNbM107XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5iaW5kaW5ncyA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5ncyA9IHt9O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGVvZiB0aGlzLmJpbmRpbmdzW2V2ZW50XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nc1tldmVudF0gPSBbXTtcbiAgICAgIH1cbiAgICAgIHRoaXMuYmluZGluZ3NbZXZlbnRdLnB1c2goeyBoYW5kbGVyOiBoYW5kbGVyLCBjdHg6IGN0eCwgb25jZTogb25jZSB9KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdvbmNlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gb25jZShldmVudCwgaGFuZGxlciwgY3R4KSB7XG4gICAgICB0aGlzLm9uKGV2ZW50LCBoYW5kbGVyLCBjdHgsIHRydWUpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29mZicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG9mZihldmVudCwgaGFuZGxlcikge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLmJpbmRpbmdzID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgdGhpcy5iaW5kaW5nc1tldmVudF0gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBoYW5kbGVyID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICBkZWxldGUgdGhpcy5iaW5kaW5nc1tldmVudF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgIHdoaWxlIChpIDwgdGhpcy5iaW5kaW5nc1tldmVudF0ubGVuZ3RoKSB7XG4gICAgICAgICAgaWYgKHRoaXMuYmluZGluZ3NbZXZlbnRdW2ldLmhhbmRsZXIgPT09IGhhbmRsZXIpIHtcbiAgICAgICAgICAgIHRoaXMuYmluZGluZ3NbZXZlbnRdLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKytpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3RyaWdnZXInLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB0cmlnZ2VyKGV2ZW50KSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMuYmluZGluZ3MgIT09ICd1bmRlZmluZWQnICYmIHRoaXMuYmluZGluZ3NbZXZlbnRdKSB7XG4gICAgICAgIHZhciBpID0gMDtcblxuICAgICAgICBmb3IgKHZhciBfbGVuID0gYXJndW1lbnRzLmxlbmd0aCwgYXJncyA9IEFycmF5KF9sZW4gPiAxID8gX2xlbiAtIDEgOiAwKSwgX2tleSA9IDE7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICAgICAgICBhcmdzW19rZXkgLSAxXSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChpIDwgdGhpcy5iaW5kaW5nc1tldmVudF0ubGVuZ3RoKSB7XG4gICAgICAgICAgdmFyIF9iaW5kaW5ncyRldmVudCRpID0gdGhpcy5iaW5kaW5nc1tldmVudF1baV07XG4gICAgICAgICAgdmFyIGhhbmRsZXIgPSBfYmluZGluZ3MkZXZlbnQkaS5oYW5kbGVyO1xuICAgICAgICAgIHZhciBjdHggPSBfYmluZGluZ3MkZXZlbnQkaS5jdHg7XG4gICAgICAgICAgdmFyIG9uY2UgPSBfYmluZGluZ3MkZXZlbnQkaS5vbmNlO1xuXG4gICAgICAgICAgdmFyIGNvbnRleHQgPSBjdHg7XG4gICAgICAgICAgaWYgKHR5cGVvZiBjb250ZXh0ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgY29udGV4dCA9IHRoaXM7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaGFuZGxlci5hcHBseShjb250ZXh0LCBhcmdzKTtcblxuICAgICAgICAgIGlmIChvbmNlKSB7XG4gICAgICAgICAgICB0aGlzLmJpbmRpbmdzW2V2ZW50XS5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gRXZlbnRlZDtcbn0pKCk7XG5cblRldGhlckJhc2UuVXRpbHMgPSB7XG4gIGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdDogZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0LFxuICBnZXRTY3JvbGxQYXJlbnRzOiBnZXRTY3JvbGxQYXJlbnRzLFxuICBnZXRCb3VuZHM6IGdldEJvdW5kcyxcbiAgZ2V0T2Zmc2V0UGFyZW50OiBnZXRPZmZzZXRQYXJlbnQsXG4gIGV4dGVuZDogZXh0ZW5kLFxuICBhZGRDbGFzczogYWRkQ2xhc3MsXG4gIHJlbW92ZUNsYXNzOiByZW1vdmVDbGFzcyxcbiAgaGFzQ2xhc3M6IGhhc0NsYXNzLFxuICB1cGRhdGVDbGFzc2VzOiB1cGRhdGVDbGFzc2VzLFxuICBkZWZlcjogZGVmZXIsXG4gIGZsdXNoOiBmbHVzaCxcbiAgdW5pcXVlSWQ6IHVuaXF1ZUlkLFxuICBFdmVudGVkOiBFdmVudGVkLFxuICBnZXRTY3JvbGxCYXJTaXplOiBnZXRTY3JvbGxCYXJTaXplLFxuICByZW1vdmVVdGlsRWxlbWVudHM6IHJlbW92ZVV0aWxFbGVtZW50c1xufTtcbi8qIGdsb2JhbHMgVGV0aGVyQmFzZSwgcGVyZm9ybWFuY2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3NsaWNlZFRvQXJyYXkgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkgeyB2YXIgX2FyciA9IFtdOyB2YXIgX24gPSB0cnVlOyB2YXIgX2QgPSBmYWxzZTsgdmFyIF9lID0gdW5kZWZpbmVkOyB0cnkgeyBmb3IgKHZhciBfaSA9IGFycltTeW1ib2wuaXRlcmF0b3JdKCksIF9zOyAhKF9uID0gKF9zID0gX2kubmV4dCgpKS5kb25lKTsgX24gPSB0cnVlKSB7IF9hcnIucHVzaChfcy52YWx1ZSk7IGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhazsgfSB9IGNhdGNoIChlcnIpIHsgX2QgPSB0cnVlOyBfZSA9IGVycjsgfSBmaW5hbGx5IHsgdHJ5IHsgaWYgKCFfbiAmJiBfaVsncmV0dXJuJ10pIF9pWydyZXR1cm4nXSgpOyB9IGZpbmFsbHkgeyBpZiAoX2QpIHRocm93IF9lOyB9IH0gcmV0dXJuIF9hcnI7IH0gcmV0dXJuIGZ1bmN0aW9uIChhcnIsIGkpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyByZXR1cm4gYXJyOyB9IGVsc2UgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkgeyByZXR1cm4gc2xpY2VJdGVyYXRvcihhcnIsIGkpOyB9IGVsc2UgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlJyk7IH0gfTsgfSkoKTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxudmFyIF9nZXQgPSBmdW5jdGlvbiBnZXQoX3g2LCBfeDcsIF94OCkgeyB2YXIgX2FnYWluID0gdHJ1ZTsgX2Z1bmN0aW9uOiB3aGlsZSAoX2FnYWluKSB7IHZhciBvYmplY3QgPSBfeDYsIHByb3BlcnR5ID0gX3g3LCByZWNlaXZlciA9IF94ODsgX2FnYWluID0gZmFsc2U7IGlmIChvYmplY3QgPT09IG51bGwpIG9iamVjdCA9IEZ1bmN0aW9uLnByb3RvdHlwZTsgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwgcHJvcGVydHkpOyBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7IHZhciBwYXJlbnQgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqZWN0KTsgaWYgKHBhcmVudCA9PT0gbnVsbCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9IGVsc2UgeyBfeDYgPSBwYXJlbnQ7IF94NyA9IHByb3BlcnR5OyBfeDggPSByZWNlaXZlcjsgX2FnYWluID0gdHJ1ZTsgZGVzYyA9IHBhcmVudCA9IHVuZGVmaW5lZDsgY29udGludWUgX2Z1bmN0aW9uOyB9IH0gZWxzZSBpZiAoJ3ZhbHVlJyBpbiBkZXNjKSB7IHJldHVybiBkZXNjLnZhbHVlOyB9IGVsc2UgeyB2YXIgZ2V0dGVyID0gZGVzYy5nZXQ7IGlmIChnZXR0ZXIgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9IHJldHVybiBnZXR0ZXIuY2FsbChyZWNlaXZlcik7IH0gfSB9O1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxuaWYgKHR5cGVvZiBUZXRoZXJCYXNlID09PSAndW5kZWZpbmVkJykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IGluY2x1ZGUgdGhlIHV0aWxzLmpzIGZpbGUgYmVmb3JlIHRldGhlci5qcycpO1xufVxuXG52YXIgX1RldGhlckJhc2UkVXRpbHMgPSBUZXRoZXJCYXNlLlV0aWxzO1xudmFyIGdldFNjcm9sbFBhcmVudHMgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRTY3JvbGxQYXJlbnRzO1xudmFyIGdldEJvdW5kcyA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldEJvdW5kcztcbnZhciBnZXRPZmZzZXRQYXJlbnQgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRPZmZzZXRQYXJlbnQ7XG52YXIgZXh0ZW5kID0gX1RldGhlckJhc2UkVXRpbHMuZXh0ZW5kO1xudmFyIGFkZENsYXNzID0gX1RldGhlckJhc2UkVXRpbHMuYWRkQ2xhc3M7XG52YXIgcmVtb3ZlQ2xhc3MgPSBfVGV0aGVyQmFzZSRVdGlscy5yZW1vdmVDbGFzcztcbnZhciB1cGRhdGVDbGFzc2VzID0gX1RldGhlckJhc2UkVXRpbHMudXBkYXRlQ2xhc3NlcztcbnZhciBkZWZlciA9IF9UZXRoZXJCYXNlJFV0aWxzLmRlZmVyO1xudmFyIGZsdXNoID0gX1RldGhlckJhc2UkVXRpbHMuZmx1c2g7XG52YXIgZ2V0U2Nyb2xsQmFyU2l6ZSA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldFNjcm9sbEJhclNpemU7XG52YXIgcmVtb3ZlVXRpbEVsZW1lbnRzID0gX1RldGhlckJhc2UkVXRpbHMucmVtb3ZlVXRpbEVsZW1lbnRzO1xuXG5mdW5jdGlvbiB3aXRoaW4oYSwgYikge1xuICB2YXIgZGlmZiA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMiB8fCBhcmd1bWVudHNbMl0gPT09IHVuZGVmaW5lZCA/IDEgOiBhcmd1bWVudHNbMl07XG5cbiAgcmV0dXJuIGEgKyBkaWZmID49IGIgJiYgYiA+PSBhIC0gZGlmZjtcbn1cblxudmFyIHRyYW5zZm9ybUtleSA9IChmdW5jdGlvbiAoKSB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG4gIHZhciBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gIHZhciB0cmFuc2Zvcm1zID0gWyd0cmFuc2Zvcm0nLCAnV2Via2l0VHJhbnNmb3JtJywgJ09UcmFuc2Zvcm0nLCAnTW96VHJhbnNmb3JtJywgJ21zVHJhbnNmb3JtJ107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdHJhbnNmb3Jtcy5sZW5ndGg7ICsraSkge1xuICAgIHZhciBrZXkgPSB0cmFuc2Zvcm1zW2ldO1xuICAgIGlmIChlbC5zdHlsZVtrZXldICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBrZXk7XG4gICAgfVxuICB9XG59KSgpO1xuXG52YXIgdGV0aGVycyA9IFtdO1xuXG52YXIgcG9zaXRpb24gPSBmdW5jdGlvbiBwb3NpdGlvbigpIHtcbiAgdGV0aGVycy5mb3JFYWNoKGZ1bmN0aW9uICh0ZXRoZXIpIHtcbiAgICB0ZXRoZXIucG9zaXRpb24oZmFsc2UpO1xuICB9KTtcbiAgZmx1c2goKTtcbn07XG5cbmZ1bmN0aW9uIG5vdygpIHtcbiAgaWYgKHR5cGVvZiBwZXJmb3JtYW5jZSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHBlcmZvcm1hbmNlLm5vdyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBwZXJmb3JtYW5jZS5ub3coKTtcbiAgfVxuICByZXR1cm4gK25ldyBEYXRlKCk7XG59XG5cbihmdW5jdGlvbiAoKSB7XG4gIHZhciBsYXN0Q2FsbCA9IG51bGw7XG4gIHZhciBsYXN0RHVyYXRpb24gPSBudWxsO1xuICB2YXIgcGVuZGluZ1RpbWVvdXQgPSBudWxsO1xuXG4gIHZhciB0aWNrID0gZnVuY3Rpb24gdGljaygpIHtcbiAgICBpZiAodHlwZW9mIGxhc3REdXJhdGlvbiAhPT0gJ3VuZGVmaW5lZCcgJiYgbGFzdER1cmF0aW9uID4gMTYpIHtcbiAgICAgIC8vIFdlIHZvbHVudGFyaWx5IHRocm90dGxlIG91cnNlbHZlcyBpZiB3ZSBjYW4ndCBtYW5hZ2UgNjBmcHNcbiAgICAgIGxhc3REdXJhdGlvbiA9IE1hdGgubWluKGxhc3REdXJhdGlvbiAtIDE2LCAyNTApO1xuXG4gICAgICAvLyBKdXN0IGluIGNhc2UgdGhpcyBpcyB0aGUgbGFzdCBldmVudCwgcmVtZW1iZXIgdG8gcG9zaXRpb24ganVzdCBvbmNlIG1vcmVcbiAgICAgIHBlbmRpbmdUaW1lb3V0ID0gc2V0VGltZW91dCh0aWNrLCAyNTApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgbGFzdENhbGwgIT09ICd1bmRlZmluZWQnICYmIG5vdygpIC0gbGFzdENhbGwgPCAxMCkge1xuICAgICAgLy8gU29tZSBicm93c2VycyBjYWxsIGV2ZW50cyBhIGxpdHRsZSB0b28gZnJlcXVlbnRseSwgcmVmdXNlIHRvIHJ1biBtb3JlIHRoYW4gaXMgcmVhc29uYWJsZVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChwZW5kaW5nVGltZW91dCAhPSBudWxsKSB7XG4gICAgICBjbGVhclRpbWVvdXQocGVuZGluZ1RpbWVvdXQpO1xuICAgICAgcGVuZGluZ1RpbWVvdXQgPSBudWxsO1xuICAgIH1cblxuICAgIGxhc3RDYWxsID0gbm93KCk7XG4gICAgcG9zaXRpb24oKTtcbiAgICBsYXN0RHVyYXRpb24gPSBub3coKSAtIGxhc3RDYWxsO1xuICB9O1xuXG4gIGlmICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJiB0eXBlb2Ygd2luZG93LmFkZEV2ZW50TGlzdGVuZXIgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgWydyZXNpemUnLCAnc2Nyb2xsJywgJ3RvdWNobW92ZSddLmZvckVhY2goZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgdGljayk7XG4gICAgfSk7XG4gIH1cbn0pKCk7XG5cbnZhciBNSVJST1JfTFIgPSB7XG4gIGNlbnRlcjogJ2NlbnRlcicsXG4gIGxlZnQ6ICdyaWdodCcsXG4gIHJpZ2h0OiAnbGVmdCdcbn07XG5cbnZhciBNSVJST1JfVEIgPSB7XG4gIG1pZGRsZTogJ21pZGRsZScsXG4gIHRvcDogJ2JvdHRvbScsXG4gIGJvdHRvbTogJ3RvcCdcbn07XG5cbnZhciBPRkZTRVRfTUFQID0ge1xuICB0b3A6IDAsXG4gIGxlZnQ6IDAsXG4gIG1pZGRsZTogJzUwJScsXG4gIGNlbnRlcjogJzUwJScsXG4gIGJvdHRvbTogJzEwMCUnLFxuICByaWdodDogJzEwMCUnXG59O1xuXG52YXIgYXV0b1RvRml4ZWRBdHRhY2htZW50ID0gZnVuY3Rpb24gYXV0b1RvRml4ZWRBdHRhY2htZW50KGF0dGFjaG1lbnQsIHJlbGF0aXZlVG9BdHRhY2htZW50KSB7XG4gIHZhciBsZWZ0ID0gYXR0YWNobWVudC5sZWZ0O1xuICB2YXIgdG9wID0gYXR0YWNobWVudC50b3A7XG5cbiAgaWYgKGxlZnQgPT09ICdhdXRvJykge1xuICAgIGxlZnQgPSBNSVJST1JfTFJbcmVsYXRpdmVUb0F0dGFjaG1lbnQubGVmdF07XG4gIH1cblxuICBpZiAodG9wID09PSAnYXV0bycpIHtcbiAgICB0b3AgPSBNSVJST1JfVEJbcmVsYXRpdmVUb0F0dGFjaG1lbnQudG9wXTtcbiAgfVxuXG4gIHJldHVybiB7IGxlZnQ6IGxlZnQsIHRvcDogdG9wIH07XG59O1xuXG52YXIgYXR0YWNobWVudFRvT2Zmc2V0ID0gZnVuY3Rpb24gYXR0YWNobWVudFRvT2Zmc2V0KGF0dGFjaG1lbnQpIHtcbiAgdmFyIGxlZnQgPSBhdHRhY2htZW50LmxlZnQ7XG4gIHZhciB0b3AgPSBhdHRhY2htZW50LnRvcDtcblxuICBpZiAodHlwZW9mIE9GRlNFVF9NQVBbYXR0YWNobWVudC5sZWZ0XSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBsZWZ0ID0gT0ZGU0VUX01BUFthdHRhY2htZW50LmxlZnRdO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBPRkZTRVRfTUFQW2F0dGFjaG1lbnQudG9wXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB0b3AgPSBPRkZTRVRfTUFQW2F0dGFjaG1lbnQudG9wXTtcbiAgfVxuXG4gIHJldHVybiB7IGxlZnQ6IGxlZnQsIHRvcDogdG9wIH07XG59O1xuXG5mdW5jdGlvbiBhZGRPZmZzZXQoKSB7XG4gIHZhciBvdXQgPSB7IHRvcDogMCwgbGVmdDogMCB9O1xuXG4gIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBvZmZzZXRzID0gQXJyYXkoX2xlbiksIF9rZXkgPSAwOyBfa2V5IDwgX2xlbjsgX2tleSsrKSB7XG4gICAgb2Zmc2V0c1tfa2V5XSA9IGFyZ3VtZW50c1tfa2V5XTtcbiAgfVxuXG4gIG9mZnNldHMuZm9yRWFjaChmdW5jdGlvbiAoX3JlZikge1xuICAgIHZhciB0b3AgPSBfcmVmLnRvcDtcbiAgICB2YXIgbGVmdCA9IF9yZWYubGVmdDtcblxuICAgIGlmICh0eXBlb2YgdG9wID09PSAnc3RyaW5nJykge1xuICAgICAgdG9wID0gcGFyc2VGbG9hdCh0b3AsIDEwKTtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBsZWZ0ID09PSAnc3RyaW5nJykge1xuICAgICAgbGVmdCA9IHBhcnNlRmxvYXQobGVmdCwgMTApO1xuICAgIH1cblxuICAgIG91dC50b3AgKz0gdG9wO1xuICAgIG91dC5sZWZ0ICs9IGxlZnQ7XG4gIH0pO1xuXG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIG9mZnNldFRvUHgob2Zmc2V0LCBzaXplKSB7XG4gIGlmICh0eXBlb2Ygb2Zmc2V0LmxlZnQgPT09ICdzdHJpbmcnICYmIG9mZnNldC5sZWZ0LmluZGV4T2YoJyUnKSAhPT0gLTEpIHtcbiAgICBvZmZzZXQubGVmdCA9IHBhcnNlRmxvYXQob2Zmc2V0LmxlZnQsIDEwKSAvIDEwMCAqIHNpemUud2lkdGg7XG4gIH1cbiAgaWYgKHR5cGVvZiBvZmZzZXQudG9wID09PSAnc3RyaW5nJyAmJiBvZmZzZXQudG9wLmluZGV4T2YoJyUnKSAhPT0gLTEpIHtcbiAgICBvZmZzZXQudG9wID0gcGFyc2VGbG9hdChvZmZzZXQudG9wLCAxMCkgLyAxMDAgKiBzaXplLmhlaWdodDtcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQ7XG59XG5cbnZhciBwYXJzZU9mZnNldCA9IGZ1bmN0aW9uIHBhcnNlT2Zmc2V0KHZhbHVlKSB7XG4gIHZhciBfdmFsdWUkc3BsaXQgPSB2YWx1ZS5zcGxpdCgnICcpO1xuXG4gIHZhciBfdmFsdWUkc3BsaXQyID0gX3NsaWNlZFRvQXJyYXkoX3ZhbHVlJHNwbGl0LCAyKTtcblxuICB2YXIgdG9wID0gX3ZhbHVlJHNwbGl0MlswXTtcbiAgdmFyIGxlZnQgPSBfdmFsdWUkc3BsaXQyWzFdO1xuXG4gIHJldHVybiB7IHRvcDogdG9wLCBsZWZ0OiBsZWZ0IH07XG59O1xudmFyIHBhcnNlQXR0YWNobWVudCA9IHBhcnNlT2Zmc2V0O1xuXG52YXIgVGV0aGVyQ2xhc3MgPSAoZnVuY3Rpb24gKF9FdmVudGVkKSB7XG4gIF9pbmhlcml0cyhUZXRoZXJDbGFzcywgX0V2ZW50ZWQpO1xuXG4gIGZ1bmN0aW9uIFRldGhlckNsYXNzKG9wdGlvbnMpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIFRldGhlckNsYXNzKTtcblxuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKFRldGhlckNsYXNzLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgdGhpcy5wb3NpdGlvbiA9IHRoaXMucG9zaXRpb24uYmluZCh0aGlzKTtcblxuICAgIHRldGhlcnMucHVzaCh0aGlzKTtcblxuICAgIHRoaXMuaGlzdG9yeSA9IFtdO1xuXG4gICAgdGhpcy5zZXRPcHRpb25zKG9wdGlvbnMsIGZhbHNlKTtcblxuICAgIFRldGhlckJhc2UubW9kdWxlcy5mb3JFYWNoKGZ1bmN0aW9uIChtb2R1bGUpIHtcbiAgICAgIGlmICh0eXBlb2YgbW9kdWxlLmluaXRpYWxpemUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIG1vZHVsZS5pbml0aWFsaXplLmNhbGwoX3RoaXMpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgdGhpcy5wb3NpdGlvbigpO1xuICB9XG5cbiAgX2NyZWF0ZUNsYXNzKFRldGhlckNsYXNzLCBbe1xuICAgIGtleTogJ2dldENsYXNzJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0Q2xhc3MoKSB7XG4gICAgICB2YXIga2V5ID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gJycgOiBhcmd1bWVudHNbMF07XG4gICAgICB2YXIgY2xhc3NlcyA9IHRoaXMub3B0aW9ucy5jbGFzc2VzO1xuXG4gICAgICBpZiAodHlwZW9mIGNsYXNzZXMgIT09ICd1bmRlZmluZWQnICYmIGNsYXNzZXNba2V5XSkge1xuICAgICAgICByZXR1cm4gdGhpcy5vcHRpb25zLmNsYXNzZXNba2V5XTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLmNsYXNzUHJlZml4KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuY2xhc3NQcmVmaXggKyAnLScgKyBrZXk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ga2V5O1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3NldE9wdGlvbnMnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzZXRPcHRpb25zKG9wdGlvbnMpIHtcbiAgICAgIHZhciBfdGhpczIgPSB0aGlzO1xuXG4gICAgICB2YXIgcG9zID0gYXJndW1lbnRzLmxlbmd0aCA8PSAxIHx8IGFyZ3VtZW50c1sxXSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGFyZ3VtZW50c1sxXTtcblxuICAgICAgdmFyIGRlZmF1bHRzID0ge1xuICAgICAgICBvZmZzZXQ6ICcwIDAnLFxuICAgICAgICB0YXJnZXRPZmZzZXQ6ICcwIDAnLFxuICAgICAgICB0YXJnZXRBdHRhY2htZW50OiAnYXV0byBhdXRvJyxcbiAgICAgICAgY2xhc3NQcmVmaXg6ICd0ZXRoZXInXG4gICAgICB9O1xuXG4gICAgICB0aGlzLm9wdGlvbnMgPSBleHRlbmQoZGVmYXVsdHMsIG9wdGlvbnMpO1xuXG4gICAgICB2YXIgX29wdGlvbnMgPSB0aGlzLm9wdGlvbnM7XG4gICAgICB2YXIgZWxlbWVudCA9IF9vcHRpb25zLmVsZW1lbnQ7XG4gICAgICB2YXIgdGFyZ2V0ID0gX29wdGlvbnMudGFyZ2V0O1xuICAgICAgdmFyIHRhcmdldE1vZGlmaWVyID0gX29wdGlvbnMudGFyZ2V0TW9kaWZpZXI7XG5cbiAgICAgIHRoaXMuZWxlbWVudCA9IGVsZW1lbnQ7XG4gICAgICB0aGlzLnRhcmdldCA9IHRhcmdldDtcbiAgICAgIHRoaXMudGFyZ2V0TW9kaWZpZXIgPSB0YXJnZXRNb2RpZmllcjtcblxuICAgICAgaWYgKHRoaXMudGFyZ2V0ID09PSAndmlld3BvcnQnKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0ID0gZG9jdW1lbnQuYm9keTtcbiAgICAgICAgdGhpcy50YXJnZXRNb2RpZmllciA9ICd2aXNpYmxlJztcbiAgICAgIH0gZWxzZSBpZiAodGhpcy50YXJnZXQgPT09ICdzY3JvbGwtaGFuZGxlJykge1xuICAgICAgICB0aGlzLnRhcmdldCA9IGRvY3VtZW50LmJvZHk7XG4gICAgICAgIHRoaXMudGFyZ2V0TW9kaWZpZXIgPSAnc2Nyb2xsLWhhbmRsZSc7XG4gICAgICB9XG5cbiAgICAgIFsnZWxlbWVudCcsICd0YXJnZXQnXS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBfdGhpczJba2V5XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RldGhlciBFcnJvcjogQm90aCBlbGVtZW50IGFuZCB0YXJnZXQgbXVzdCBiZSBkZWZpbmVkJyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIF90aGlzMltrZXldLmpxdWVyeSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICBfdGhpczJba2V5XSA9IF90aGlzMltrZXldWzBdO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBfdGhpczJba2V5XSA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICBfdGhpczJba2V5XSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoX3RoaXMyW2tleV0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgYWRkQ2xhc3ModGhpcy5lbGVtZW50LCB0aGlzLmdldENsYXNzKCdlbGVtZW50JykpO1xuICAgICAgaWYgKCEodGhpcy5vcHRpb25zLmFkZFRhcmdldENsYXNzZXMgPT09IGZhbHNlKSkge1xuICAgICAgICBhZGRDbGFzcyh0aGlzLnRhcmdldCwgdGhpcy5nZXRDbGFzcygndGFyZ2V0JykpO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMub3B0aW9ucy5hdHRhY2htZW50KSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGV0aGVyIEVycm9yOiBZb3UgbXVzdCBwcm92aWRlIGFuIGF0dGFjaG1lbnQnKTtcbiAgICAgIH1cblxuICAgICAgdGhpcy50YXJnZXRBdHRhY2htZW50ID0gcGFyc2VBdHRhY2htZW50KHRoaXMub3B0aW9ucy50YXJnZXRBdHRhY2htZW50KTtcbiAgICAgIHRoaXMuYXR0YWNobWVudCA9IHBhcnNlQXR0YWNobWVudCh0aGlzLm9wdGlvbnMuYXR0YWNobWVudCk7XG4gICAgICB0aGlzLm9mZnNldCA9IHBhcnNlT2Zmc2V0KHRoaXMub3B0aW9ucy5vZmZzZXQpO1xuICAgICAgdGhpcy50YXJnZXRPZmZzZXQgPSBwYXJzZU9mZnNldCh0aGlzLm9wdGlvbnMudGFyZ2V0T2Zmc2V0KTtcblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLnNjcm9sbFBhcmVudHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuZGlzYWJsZSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy50YXJnZXRNb2RpZmllciA9PT0gJ3Njcm9sbC1oYW5kbGUnKSB7XG4gICAgICAgIHRoaXMuc2Nyb2xsUGFyZW50cyA9IFt0aGlzLnRhcmdldF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnNjcm9sbFBhcmVudHMgPSBnZXRTY3JvbGxQYXJlbnRzKHRoaXMudGFyZ2V0KTtcbiAgICAgIH1cblxuICAgICAgaWYgKCEodGhpcy5vcHRpb25zLmVuYWJsZWQgPT09IGZhbHNlKSkge1xuICAgICAgICB0aGlzLmVuYWJsZShwb3MpO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2dldFRhcmdldEJvdW5kcycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldFRhcmdldEJvdW5kcygpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy50YXJnZXRNb2RpZmllciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0TW9kaWZpZXIgPT09ICd2aXNpYmxlJykge1xuICAgICAgICAgIGlmICh0aGlzLnRhcmdldCA9PT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICAgICAgcmV0dXJuIHsgdG9wOiBwYWdlWU9mZnNldCwgbGVmdDogcGFnZVhPZmZzZXQsIGhlaWdodDogaW5uZXJIZWlnaHQsIHdpZHRoOiBpbm5lcldpZHRoIH07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBib3VuZHMgPSBnZXRCb3VuZHModGhpcy50YXJnZXQpO1xuXG4gICAgICAgICAgICB2YXIgb3V0ID0ge1xuICAgICAgICAgICAgICBoZWlnaHQ6IGJvdW5kcy5oZWlnaHQsXG4gICAgICAgICAgICAgIHdpZHRoOiBib3VuZHMud2lkdGgsXG4gICAgICAgICAgICAgIHRvcDogYm91bmRzLnRvcCxcbiAgICAgICAgICAgICAgbGVmdDogYm91bmRzLmxlZnRcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIG91dC5oZWlnaHQgPSBNYXRoLm1pbihvdXQuaGVpZ2h0LCBib3VuZHMuaGVpZ2h0IC0gKHBhZ2VZT2Zmc2V0IC0gYm91bmRzLnRvcCkpO1xuICAgICAgICAgICAgb3V0LmhlaWdodCA9IE1hdGgubWluKG91dC5oZWlnaHQsIGJvdW5kcy5oZWlnaHQgLSAoYm91bmRzLnRvcCArIGJvdW5kcy5oZWlnaHQgLSAocGFnZVlPZmZzZXQgKyBpbm5lckhlaWdodCkpKTtcbiAgICAgICAgICAgIG91dC5oZWlnaHQgPSBNYXRoLm1pbihpbm5lckhlaWdodCwgb3V0LmhlaWdodCk7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0IC09IDI7XG5cbiAgICAgICAgICAgIG91dC53aWR0aCA9IE1hdGgubWluKG91dC53aWR0aCwgYm91bmRzLndpZHRoIC0gKHBhZ2VYT2Zmc2V0IC0gYm91bmRzLmxlZnQpKTtcbiAgICAgICAgICAgIG91dC53aWR0aCA9IE1hdGgubWluKG91dC53aWR0aCwgYm91bmRzLndpZHRoIC0gKGJvdW5kcy5sZWZ0ICsgYm91bmRzLndpZHRoIC0gKHBhZ2VYT2Zmc2V0ICsgaW5uZXJXaWR0aCkpKTtcbiAgICAgICAgICAgIG91dC53aWR0aCA9IE1hdGgubWluKGlubmVyV2lkdGgsIG91dC53aWR0aCk7XG4gICAgICAgICAgICBvdXQud2lkdGggLT0gMjtcblxuICAgICAgICAgICAgaWYgKG91dC50b3AgPCBwYWdlWU9mZnNldCkge1xuICAgICAgICAgICAgICBvdXQudG9wID0gcGFnZVlPZmZzZXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAob3V0LmxlZnQgPCBwYWdlWE9mZnNldCkge1xuICAgICAgICAgICAgICBvdXQubGVmdCA9IHBhZ2VYT2Zmc2V0O1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnRhcmdldE1vZGlmaWVyID09PSAnc2Nyb2xsLWhhbmRsZScpIHtcbiAgICAgICAgICB2YXIgYm91bmRzID0gdW5kZWZpbmVkO1xuICAgICAgICAgIHZhciB0YXJnZXQgPSB0aGlzLnRhcmdldDtcbiAgICAgICAgICBpZiAodGFyZ2V0ID09PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICB0YXJnZXQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbiAgICAgICAgICAgIGJvdW5kcyA9IHtcbiAgICAgICAgICAgICAgbGVmdDogcGFnZVhPZmZzZXQsXG4gICAgICAgICAgICAgIHRvcDogcGFnZVlPZmZzZXQsXG4gICAgICAgICAgICAgIGhlaWdodDogaW5uZXJIZWlnaHQsXG4gICAgICAgICAgICAgIHdpZHRoOiBpbm5lcldpZHRoXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBib3VuZHMgPSBnZXRCb3VuZHModGFyZ2V0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKHRhcmdldCk7XG5cbiAgICAgICAgICB2YXIgaGFzQm90dG9tU2Nyb2xsID0gdGFyZ2V0LnNjcm9sbFdpZHRoID4gdGFyZ2V0LmNsaWVudFdpZHRoIHx8IFtzdHlsZS5vdmVyZmxvdywgc3R5bGUub3ZlcmZsb3dYXS5pbmRleE9mKCdzY3JvbGwnKSA+PSAwIHx8IHRoaXMudGFyZ2V0ICE9PSBkb2N1bWVudC5ib2R5O1xuXG4gICAgICAgICAgdmFyIHNjcm9sbEJvdHRvbSA9IDA7XG4gICAgICAgICAgaWYgKGhhc0JvdHRvbVNjcm9sbCkge1xuICAgICAgICAgICAgc2Nyb2xsQm90dG9tID0gMTU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIGhlaWdodCA9IGJvdW5kcy5oZWlnaHQgLSBwYXJzZUZsb2F0KHN0eWxlLmJvcmRlclRvcFdpZHRoKSAtIHBhcnNlRmxvYXQoc3R5bGUuYm9yZGVyQm90dG9tV2lkdGgpIC0gc2Nyb2xsQm90dG9tO1xuXG4gICAgICAgICAgdmFyIG91dCA9IHtcbiAgICAgICAgICAgIHdpZHRoOiAxNSxcbiAgICAgICAgICAgIGhlaWdodDogaGVpZ2h0ICogMC45NzUgKiAoaGVpZ2h0IC8gdGFyZ2V0LnNjcm9sbEhlaWdodCksXG4gICAgICAgICAgICBsZWZ0OiBib3VuZHMubGVmdCArIGJvdW5kcy53aWR0aCAtIHBhcnNlRmxvYXQoc3R5bGUuYm9yZGVyTGVmdFdpZHRoKSAtIDE1XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIHZhciBmaXRBZGogPSAwO1xuICAgICAgICAgIGlmIChoZWlnaHQgPCA0MDggJiYgdGhpcy50YXJnZXQgPT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgICAgIGZpdEFkaiA9IC0wLjAwMDExICogTWF0aC5wb3coaGVpZ2h0LCAyKSAtIDAuMDA3MjcgKiBoZWlnaHQgKyAyMi41ODtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhpcy50YXJnZXQgIT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgICAgIG91dC5oZWlnaHQgPSBNYXRoLm1heChvdXQuaGVpZ2h0LCAyNCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdmFyIHNjcm9sbFBlcmNlbnRhZ2UgPSB0aGlzLnRhcmdldC5zY3JvbGxUb3AgLyAodGFyZ2V0LnNjcm9sbEhlaWdodCAtIGhlaWdodCk7XG4gICAgICAgICAgb3V0LnRvcCA9IHNjcm9sbFBlcmNlbnRhZ2UgKiAoaGVpZ2h0IC0gb3V0LmhlaWdodCAtIGZpdEFkaikgKyBib3VuZHMudG9wICsgcGFyc2VGbG9hdChzdHlsZS5ib3JkZXJUb3BXaWR0aCk7XG5cbiAgICAgICAgICBpZiAodGhpcy50YXJnZXQgPT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgICAgIG91dC5oZWlnaHQgPSBNYXRoLm1heChvdXQuaGVpZ2h0LCAyNCk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmV0dXJuIG91dDtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGdldEJvdW5kcyh0aGlzLnRhcmdldCk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnY2xlYXJDYWNoZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGNsZWFyQ2FjaGUoKSB7XG4gICAgICB0aGlzLl9jYWNoZSA9IHt9O1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2NhY2hlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gY2FjaGUoaywgZ2V0dGVyKSB7XG4gICAgICAvLyBNb3JlIHRoYW4gb25lIG1vZHVsZSB3aWxsIG9mdGVuIG5lZWQgdGhlIHNhbWUgRE9NIGluZm8sIHNvXG4gICAgICAvLyB3ZSBrZWVwIGEgY2FjaGUgd2hpY2ggaXMgY2xlYXJlZCBvbiBlYWNoIHBvc2l0aW9uIGNhbGxcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5fY2FjaGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuX2NhY2hlID0ge307XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5fY2FjaGVba10gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuX2NhY2hlW2tdID0gZ2V0dGVyLmNhbGwodGhpcyk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0aGlzLl9jYWNoZVtrXTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdlbmFibGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBlbmFibGUoKSB7XG4gICAgICB2YXIgX3RoaXMzID0gdGhpcztcblxuICAgICAgdmFyIHBvcyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHRydWUgOiBhcmd1bWVudHNbMF07XG5cbiAgICAgIGlmICghKHRoaXMub3B0aW9ucy5hZGRUYXJnZXRDbGFzc2VzID09PSBmYWxzZSkpIHtcbiAgICAgICAgYWRkQ2xhc3ModGhpcy50YXJnZXQsIHRoaXMuZ2V0Q2xhc3MoJ2VuYWJsZWQnKSk7XG4gICAgICB9XG4gICAgICBhZGRDbGFzcyh0aGlzLmVsZW1lbnQsIHRoaXMuZ2V0Q2xhc3MoJ2VuYWJsZWQnKSk7XG4gICAgICB0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXG4gICAgICB0aGlzLnNjcm9sbFBhcmVudHMuZm9yRWFjaChmdW5jdGlvbiAocGFyZW50KSB7XG4gICAgICAgIGlmIChwYXJlbnQgIT09IF90aGlzMy50YXJnZXQub3duZXJEb2N1bWVudCkge1xuICAgICAgICAgIHBhcmVudC5hZGRFdmVudExpc3RlbmVyKCdzY3JvbGwnLCBfdGhpczMucG9zaXRpb24pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKHBvcykge1xuICAgICAgICB0aGlzLnBvc2l0aW9uKCk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZGlzYWJsZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGRpc2FibGUoKSB7XG4gICAgICB2YXIgX3RoaXM0ID0gdGhpcztcblxuICAgICAgcmVtb3ZlQ2xhc3ModGhpcy50YXJnZXQsIHRoaXMuZ2V0Q2xhc3MoJ2VuYWJsZWQnKSk7XG4gICAgICByZW1vdmVDbGFzcyh0aGlzLmVsZW1lbnQsIHRoaXMuZ2V0Q2xhc3MoJ2VuYWJsZWQnKSk7XG4gICAgICB0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLnNjcm9sbFBhcmVudHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuc2Nyb2xsUGFyZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChwYXJlbnQpIHtcbiAgICAgICAgICBwYXJlbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Nyb2xsJywgX3RoaXM0LnBvc2l0aW9uKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZGVzdHJveScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgICB2YXIgX3RoaXM1ID0gdGhpcztcblxuICAgICAgdGhpcy5kaXNhYmxlKCk7XG5cbiAgICAgIHRldGhlcnMuZm9yRWFjaChmdW5jdGlvbiAodGV0aGVyLCBpKSB7XG4gICAgICAgIGlmICh0ZXRoZXIgPT09IF90aGlzNSkge1xuICAgICAgICAgIHRldGhlcnMuc3BsaWNlKGksIDEpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8gUmVtb3ZlIGFueSBlbGVtZW50cyB3ZSB3ZXJlIHVzaW5nIGZvciBjb252ZW5pZW5jZSBmcm9tIHRoZSBET01cbiAgICAgIGlmICh0ZXRoZXJzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZW1vdmVVdGlsRWxlbWVudHMoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd1cGRhdGVBdHRhY2hDbGFzc2VzJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gdXBkYXRlQXR0YWNoQ2xhc3NlcyhlbGVtZW50QXR0YWNoLCB0YXJnZXRBdHRhY2gpIHtcbiAgICAgIHZhciBfdGhpczYgPSB0aGlzO1xuXG4gICAgICBlbGVtZW50QXR0YWNoID0gZWxlbWVudEF0dGFjaCB8fCB0aGlzLmF0dGFjaG1lbnQ7XG4gICAgICB0YXJnZXRBdHRhY2ggPSB0YXJnZXRBdHRhY2ggfHwgdGhpcy50YXJnZXRBdHRhY2htZW50O1xuICAgICAgdmFyIHNpZGVzID0gWydsZWZ0JywgJ3RvcCcsICdib3R0b20nLCAncmlnaHQnLCAnbWlkZGxlJywgJ2NlbnRlciddO1xuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuX2FkZEF0dGFjaENsYXNzZXMgIT09ICd1bmRlZmluZWQnICYmIHRoaXMuX2FkZEF0dGFjaENsYXNzZXMubGVuZ3RoKSB7XG4gICAgICAgIC8vIHVwZGF0ZUF0dGFjaENsYXNzZXMgY2FuIGJlIGNhbGxlZCBtb3JlIHRoYW4gb25jZSBpbiBhIHBvc2l0aW9uIGNhbGwsIHNvXG4gICAgICAgIC8vIHdlIG5lZWQgdG8gY2xlYW4gdXAgYWZ0ZXIgb3Vyc2VsdmVzIHN1Y2ggdGhhdCB3aGVuIHRoZSBsYXN0IGRlZmVyIGdldHNcbiAgICAgICAgLy8gcmFuIGl0IGRvZXNuJ3QgYWRkIGFueSBleHRyYSBjbGFzc2VzIGZyb20gcHJldmlvdXMgY2FsbHMuXG4gICAgICAgIHRoaXMuX2FkZEF0dGFjaENsYXNzZXMuc3BsaWNlKDAsIHRoaXMuX2FkZEF0dGFjaENsYXNzZXMubGVuZ3RoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzID0gW107XG4gICAgICB9XG4gICAgICB2YXIgYWRkID0gdGhpcy5fYWRkQXR0YWNoQ2xhc3NlcztcblxuICAgICAgaWYgKGVsZW1lbnRBdHRhY2gudG9wKSB7XG4gICAgICAgIGFkZC5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ2VsZW1lbnQtYXR0YWNoZWQnKSArICctJyArIGVsZW1lbnRBdHRhY2gudG9wKTtcbiAgICAgIH1cbiAgICAgIGlmIChlbGVtZW50QXR0YWNoLmxlZnQpIHtcbiAgICAgICAgYWRkLnB1c2godGhpcy5nZXRDbGFzcygnZWxlbWVudC1hdHRhY2hlZCcpICsgJy0nICsgZWxlbWVudEF0dGFjaC5sZWZ0KTtcbiAgICAgIH1cbiAgICAgIGlmICh0YXJnZXRBdHRhY2gudG9wKSB7XG4gICAgICAgIGFkZC5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ3RhcmdldC1hdHRhY2hlZCcpICsgJy0nICsgdGFyZ2V0QXR0YWNoLnRvcCk7XG4gICAgICB9XG4gICAgICBpZiAodGFyZ2V0QXR0YWNoLmxlZnQpIHtcbiAgICAgICAgYWRkLnB1c2godGhpcy5nZXRDbGFzcygndGFyZ2V0LWF0dGFjaGVkJykgKyAnLScgKyB0YXJnZXRBdHRhY2gubGVmdCk7XG4gICAgICB9XG5cbiAgICAgIHZhciBhbGwgPSBbXTtcbiAgICAgIHNpZGVzLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgICAgYWxsLnB1c2goX3RoaXM2LmdldENsYXNzKCdlbGVtZW50LWF0dGFjaGVkJykgKyAnLScgKyBzaWRlKTtcbiAgICAgICAgYWxsLnB1c2goX3RoaXM2LmdldENsYXNzKCd0YXJnZXQtYXR0YWNoZWQnKSArICctJyArIHNpZGUpO1xuICAgICAgfSk7XG5cbiAgICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKCEodHlwZW9mIF90aGlzNi5fYWRkQXR0YWNoQ2xhc3NlcyAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpczYuZWxlbWVudCwgX3RoaXM2Ll9hZGRBdHRhY2hDbGFzc2VzLCBhbGwpO1xuICAgICAgICBpZiAoIShfdGhpczYub3B0aW9ucy5hZGRUYXJnZXRDbGFzc2VzID09PSBmYWxzZSkpIHtcbiAgICAgICAgICB1cGRhdGVDbGFzc2VzKF90aGlzNi50YXJnZXQsIF90aGlzNi5fYWRkQXR0YWNoQ2xhc3NlcywgYWxsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGRlbGV0ZSBfdGhpczYuX2FkZEF0dGFjaENsYXNzZXM7XG4gICAgICB9KTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdwb3NpdGlvbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHBvc2l0aW9uKCkge1xuICAgICAgdmFyIF90aGlzNyA9IHRoaXM7XG5cbiAgICAgIHZhciBmbHVzaENoYW5nZXMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyB0cnVlIDogYXJndW1lbnRzWzBdO1xuXG4gICAgICAvLyBmbHVzaENoYW5nZXMgY29tbWl0cyB0aGUgY2hhbmdlcyBpbW1lZGlhdGVseSwgbGVhdmUgdHJ1ZSB1bmxlc3MgeW91IGFyZSBwb3NpdGlvbmluZyBtdWx0aXBsZVxuICAgICAgLy8gdGV0aGVycyAoaW4gd2hpY2ggY2FzZSBjYWxsIFRldGhlci5VdGlscy5mbHVzaCB5b3Vyc2VsZiB3aGVuIHlvdSdyZSBkb25lKVxuXG4gICAgICBpZiAoIXRoaXMuZW5hYmxlZCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHRoaXMuY2xlYXJDYWNoZSgpO1xuXG4gICAgICAvLyBUdXJuICdhdXRvJyBhdHRhY2htZW50cyBpbnRvIHRoZSBhcHByb3ByaWF0ZSBjb3JuZXIgb3IgZWRnZVxuICAgICAgdmFyIHRhcmdldEF0dGFjaG1lbnQgPSBhdXRvVG9GaXhlZEF0dGFjaG1lbnQodGhpcy50YXJnZXRBdHRhY2htZW50LCB0aGlzLmF0dGFjaG1lbnQpO1xuXG4gICAgICB0aGlzLnVwZGF0ZUF0dGFjaENsYXNzZXModGhpcy5hdHRhY2htZW50LCB0YXJnZXRBdHRhY2htZW50KTtcblxuICAgICAgdmFyIGVsZW1lbnRQb3MgPSB0aGlzLmNhY2hlKCdlbGVtZW50LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGdldEJvdW5kcyhfdGhpczcuZWxlbWVudCk7XG4gICAgICB9KTtcblxuICAgICAgdmFyIHdpZHRoID0gZWxlbWVudFBvcy53aWR0aDtcbiAgICAgIHZhciBoZWlnaHQgPSBlbGVtZW50UG9zLmhlaWdodDtcblxuICAgICAgaWYgKHdpZHRoID09PSAwICYmIGhlaWdodCA9PT0gMCAmJiB0eXBlb2YgdGhpcy5sYXN0U2l6ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdmFyIF9sYXN0U2l6ZSA9IHRoaXMubGFzdFNpemU7XG5cbiAgICAgICAgLy8gV2UgY2FjaGUgdGhlIGhlaWdodCBhbmQgd2lkdGggdG8gbWFrZSBpdCBwb3NzaWJsZSB0byBwb3NpdGlvbiBlbGVtZW50cyB0aGF0IGFyZVxuICAgICAgICAvLyBnZXR0aW5nIGhpZGRlbi5cbiAgICAgICAgd2lkdGggPSBfbGFzdFNpemUud2lkdGg7XG4gICAgICAgIGhlaWdodCA9IF9sYXN0U2l6ZS5oZWlnaHQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxhc3RTaXplID0geyB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH07XG4gICAgICB9XG5cbiAgICAgIHZhciB0YXJnZXRQb3MgPSB0aGlzLmNhY2hlKCd0YXJnZXQtYm91bmRzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gX3RoaXM3LmdldFRhcmdldEJvdW5kcygpO1xuICAgICAgfSk7XG4gICAgICB2YXIgdGFyZ2V0U2l6ZSA9IHRhcmdldFBvcztcblxuICAgICAgLy8gR2V0IGFuIGFjdHVhbCBweCBvZmZzZXQgZnJvbSB0aGUgYXR0YWNobWVudFxuICAgICAgdmFyIG9mZnNldCA9IG9mZnNldFRvUHgoYXR0YWNobWVudFRvT2Zmc2V0KHRoaXMuYXR0YWNobWVudCksIHsgd2lkdGg6IHdpZHRoLCBoZWlnaHQ6IGhlaWdodCB9KTtcbiAgICAgIHZhciB0YXJnZXRPZmZzZXQgPSBvZmZzZXRUb1B4KGF0dGFjaG1lbnRUb09mZnNldCh0YXJnZXRBdHRhY2htZW50KSwgdGFyZ2V0U2l6ZSk7XG5cbiAgICAgIHZhciBtYW51YWxPZmZzZXQgPSBvZmZzZXRUb1B4KHRoaXMub2Zmc2V0LCB7IHdpZHRoOiB3aWR0aCwgaGVpZ2h0OiBoZWlnaHQgfSk7XG4gICAgICB2YXIgbWFudWFsVGFyZ2V0T2Zmc2V0ID0gb2Zmc2V0VG9QeCh0aGlzLnRhcmdldE9mZnNldCwgdGFyZ2V0U2l6ZSk7XG5cbiAgICAgIC8vIEFkZCB0aGUgbWFudWFsbHkgcHJvdmlkZWQgb2Zmc2V0XG4gICAgICBvZmZzZXQgPSBhZGRPZmZzZXQob2Zmc2V0LCBtYW51YWxPZmZzZXQpO1xuICAgICAgdGFyZ2V0T2Zmc2V0ID0gYWRkT2Zmc2V0KHRhcmdldE9mZnNldCwgbWFudWFsVGFyZ2V0T2Zmc2V0KTtcblxuICAgICAgLy8gSXQncyBub3cgb3VyIGdvYWwgdG8gbWFrZSAoZWxlbWVudCBwb3NpdGlvbiArIG9mZnNldCkgPT0gKHRhcmdldCBwb3NpdGlvbiArIHRhcmdldCBvZmZzZXQpXG4gICAgICB2YXIgbGVmdCA9IHRhcmdldFBvcy5sZWZ0ICsgdGFyZ2V0T2Zmc2V0LmxlZnQgLSBvZmZzZXQubGVmdDtcbiAgICAgIHZhciB0b3AgPSB0YXJnZXRQb3MudG9wICsgdGFyZ2V0T2Zmc2V0LnRvcCAtIG9mZnNldC50b3A7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgVGV0aGVyQmFzZS5tb2R1bGVzLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZhciBfbW9kdWxlMiA9IFRldGhlckJhc2UubW9kdWxlc1tpXTtcbiAgICAgICAgdmFyIHJldCA9IF9tb2R1bGUyLnBvc2l0aW9uLmNhbGwodGhpcywge1xuICAgICAgICAgIGxlZnQ6IGxlZnQsXG4gICAgICAgICAgdG9wOiB0b3AsXG4gICAgICAgICAgdGFyZ2V0QXR0YWNobWVudDogdGFyZ2V0QXR0YWNobWVudCxcbiAgICAgICAgICB0YXJnZXRQb3M6IHRhcmdldFBvcyxcbiAgICAgICAgICBlbGVtZW50UG9zOiBlbGVtZW50UG9zLFxuICAgICAgICAgIG9mZnNldDogb2Zmc2V0LFxuICAgICAgICAgIHRhcmdldE9mZnNldDogdGFyZ2V0T2Zmc2V0LFxuICAgICAgICAgIG1hbnVhbE9mZnNldDogbWFudWFsT2Zmc2V0LFxuICAgICAgICAgIG1hbnVhbFRhcmdldE9mZnNldDogbWFudWFsVGFyZ2V0T2Zmc2V0LFxuICAgICAgICAgIHNjcm9sbGJhclNpemU6IHNjcm9sbGJhclNpemUsXG4gICAgICAgICAgYXR0YWNobWVudDogdGhpcy5hdHRhY2htZW50XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmIChyZXQgPT09IGZhbHNlKSB7XG4gICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiByZXQgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiByZXQgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdG9wID0gcmV0LnRvcDtcbiAgICAgICAgICBsZWZ0ID0gcmV0LmxlZnQ7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8gV2UgZGVzY3JpYmUgdGhlIHBvc2l0aW9uIHRocmVlIGRpZmZlcmVudCB3YXlzIHRvIGdpdmUgdGhlIG9wdGltaXplclxuICAgICAgLy8gYSBjaGFuY2UgdG8gZGVjaWRlIHRoZSBiZXN0IHBvc3NpYmxlIHdheSB0byBwb3NpdGlvbiB0aGUgZWxlbWVudFxuICAgICAgLy8gd2l0aCB0aGUgZmV3ZXN0IHJlcGFpbnRzLlxuICAgICAgdmFyIG5leHQgPSB7XG4gICAgICAgIC8vIEl0J3MgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIHBhZ2UgKGFic29sdXRlIHBvc2l0aW9uaW5nIHdoZW5cbiAgICAgICAgLy8gdGhlIGVsZW1lbnQgaXMgYSBjaGlsZCBvZiB0aGUgYm9keSlcbiAgICAgICAgcGFnZToge1xuICAgICAgICAgIHRvcDogdG9wLFxuICAgICAgICAgIGxlZnQ6IGxlZnRcbiAgICAgICAgfSxcblxuICAgICAgICAvLyBJdCdzIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSB2aWV3cG9ydCAoZml4ZWQgcG9zaXRpb25pbmcpXG4gICAgICAgIHZpZXdwb3J0OiB7XG4gICAgICAgICAgdG9wOiB0b3AgLSBwYWdlWU9mZnNldCxcbiAgICAgICAgICBib3R0b206IHBhZ2VZT2Zmc2V0IC0gdG9wIC0gaGVpZ2h0ICsgaW5uZXJIZWlnaHQsXG4gICAgICAgICAgbGVmdDogbGVmdCAtIHBhZ2VYT2Zmc2V0LFxuICAgICAgICAgIHJpZ2h0OiBwYWdlWE9mZnNldCAtIGxlZnQgLSB3aWR0aCArIGlubmVyV2lkdGhcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgdmFyIGRvYyA9IHRoaXMudGFyZ2V0Lm93bmVyRG9jdW1lbnQ7XG4gICAgICB2YXIgd2luID0gZG9jLmRlZmF1bHRWaWV3O1xuXG4gICAgICB2YXIgc2Nyb2xsYmFyU2l6ZSA9IHVuZGVmaW5lZDtcbiAgICAgIGlmICh3aW4uaW5uZXJIZWlnaHQgPiBkb2MuZG9jdW1lbnRFbGVtZW50LmNsaWVudEhlaWdodCkge1xuICAgICAgICBzY3JvbGxiYXJTaXplID0gdGhpcy5jYWNoZSgnc2Nyb2xsYmFyLXNpemUnLCBnZXRTY3JvbGxCYXJTaXplKTtcbiAgICAgICAgbmV4dC52aWV3cG9ydC5ib3R0b20gLT0gc2Nyb2xsYmFyU2l6ZS5oZWlnaHQ7XG4gICAgICB9XG5cbiAgICAgIGlmICh3aW4uaW5uZXJXaWR0aCA+IGRvYy5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGgpIHtcbiAgICAgICAgc2Nyb2xsYmFyU2l6ZSA9IHRoaXMuY2FjaGUoJ3Njcm9sbGJhci1zaXplJywgZ2V0U2Nyb2xsQmFyU2l6ZSk7XG4gICAgICAgIG5leHQudmlld3BvcnQucmlnaHQgLT0gc2Nyb2xsYmFyU2l6ZS53aWR0aDtcbiAgICAgIH1cblxuICAgICAgaWYgKFsnJywgJ3N0YXRpYyddLmluZGV4T2YoZG9jLmJvZHkuc3R5bGUucG9zaXRpb24pID09PSAtMSB8fCBbJycsICdzdGF0aWMnXS5pbmRleE9mKGRvYy5ib2R5LnBhcmVudEVsZW1lbnQuc3R5bGUucG9zaXRpb24pID09PSAtMSkge1xuICAgICAgICAvLyBBYnNvbHV0ZSBwb3NpdGlvbmluZyBpbiB0aGUgYm9keSB3aWxsIGJlIHJlbGF0aXZlIHRvIHRoZSBwYWdlLCBub3QgdGhlICdpbml0aWFsIGNvbnRhaW5pbmcgYmxvY2snXG4gICAgICAgIG5leHQucGFnZS5ib3R0b20gPSBkb2MuYm9keS5zY3JvbGxIZWlnaHQgLSB0b3AgLSBoZWlnaHQ7XG4gICAgICAgIG5leHQucGFnZS5yaWdodCA9IGRvYy5ib2R5LnNjcm9sbFdpZHRoIC0gbGVmdCAtIHdpZHRoO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5vcHRpbWl6YXRpb25zICE9PSAndW5kZWZpbmVkJyAmJiB0aGlzLm9wdGlvbnMub3B0aW1pemF0aW9ucy5tb3ZlRWxlbWVudCAhPT0gZmFsc2UgJiYgISh0eXBlb2YgdGhpcy50YXJnZXRNb2RpZmllciAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIG9mZnNldFBhcmVudCA9IF90aGlzNy5jYWNoZSgndGFyZ2V0LW9mZnNldHBhcmVudCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRPZmZzZXRQYXJlbnQoX3RoaXM3LnRhcmdldCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgdmFyIG9mZnNldFBvc2l0aW9uID0gX3RoaXM3LmNhY2hlKCd0YXJnZXQtb2Zmc2V0cGFyZW50LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRCb3VuZHMob2Zmc2V0UGFyZW50KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB2YXIgb2Zmc2V0UGFyZW50U3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKG9mZnNldFBhcmVudCk7XG4gICAgICAgICAgdmFyIG9mZnNldFBhcmVudFNpemUgPSBvZmZzZXRQb3NpdGlvbjtcblxuICAgICAgICAgIHZhciBvZmZzZXRCb3JkZXIgPSB7fTtcbiAgICAgICAgICBbJ1RvcCcsICdMZWZ0JywgJ0JvdHRvbScsICdSaWdodCddLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgICAgICAgIG9mZnNldEJvcmRlcltzaWRlLnRvTG93ZXJDYXNlKCldID0gcGFyc2VGbG9hdChvZmZzZXRQYXJlbnRTdHlsZVsnYm9yZGVyJyArIHNpZGUgKyAnV2lkdGgnXSk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBvZmZzZXRQb3NpdGlvbi5yaWdodCA9IGRvYy5ib2R5LnNjcm9sbFdpZHRoIC0gb2Zmc2V0UG9zaXRpb24ubGVmdCAtIG9mZnNldFBhcmVudFNpemUud2lkdGggKyBvZmZzZXRCb3JkZXIucmlnaHQ7XG4gICAgICAgICAgb2Zmc2V0UG9zaXRpb24uYm90dG9tID0gZG9jLmJvZHkuc2Nyb2xsSGVpZ2h0IC0gb2Zmc2V0UG9zaXRpb24udG9wIC0gb2Zmc2V0UGFyZW50U2l6ZS5oZWlnaHQgKyBvZmZzZXRCb3JkZXIuYm90dG9tO1xuXG4gICAgICAgICAgaWYgKG5leHQucGFnZS50b3AgPj0gb2Zmc2V0UG9zaXRpb24udG9wICsgb2Zmc2V0Qm9yZGVyLnRvcCAmJiBuZXh0LnBhZ2UuYm90dG9tID49IG9mZnNldFBvc2l0aW9uLmJvdHRvbSkge1xuICAgICAgICAgICAgaWYgKG5leHQucGFnZS5sZWZ0ID49IG9mZnNldFBvc2l0aW9uLmxlZnQgKyBvZmZzZXRCb3JkZXIubGVmdCAmJiBuZXh0LnBhZ2UucmlnaHQgPj0gb2Zmc2V0UG9zaXRpb24ucmlnaHQpIHtcbiAgICAgICAgICAgICAgLy8gV2UncmUgd2l0aGluIHRoZSB2aXNpYmxlIHBhcnQgb2YgdGhlIHRhcmdldCdzIHNjcm9sbCBwYXJlbnRcbiAgICAgICAgICAgICAgdmFyIHNjcm9sbFRvcCA9IG9mZnNldFBhcmVudC5zY3JvbGxUb3A7XG4gICAgICAgICAgICAgIHZhciBzY3JvbGxMZWZ0ID0gb2Zmc2V0UGFyZW50LnNjcm9sbExlZnQ7XG5cbiAgICAgICAgICAgICAgLy8gSXQncyBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgdGFyZ2V0J3Mgb2Zmc2V0IHBhcmVudCAoYWJzb2x1dGUgcG9zaXRpb25pbmcgd2hlblxuICAgICAgICAgICAgICAvLyB0aGUgZWxlbWVudCBpcyBtb3ZlZCB0byBiZSBhIGNoaWxkIG9mIHRoZSB0YXJnZXQncyBvZmZzZXQgcGFyZW50KS5cbiAgICAgICAgICAgICAgbmV4dC5vZmZzZXQgPSB7XG4gICAgICAgICAgICAgICAgdG9wOiBuZXh0LnBhZ2UudG9wIC0gb2Zmc2V0UG9zaXRpb24udG9wICsgc2Nyb2xsVG9wIC0gb2Zmc2V0Qm9yZGVyLnRvcCxcbiAgICAgICAgICAgICAgICBsZWZ0OiBuZXh0LnBhZ2UubGVmdCAtIG9mZnNldFBvc2l0aW9uLmxlZnQgKyBzY3JvbGxMZWZ0IC0gb2Zmc2V0Qm9yZGVyLmxlZnRcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlIGNvdWxkIGFsc28gdHJhdmVsIHVwIHRoZSBET00gYW5kIHRyeSBlYWNoIGNvbnRhaW5pbmcgY29udGV4dCwgcmF0aGVyIHRoYW4gb25seVxuICAgICAgLy8gbG9va2luZyBhdCB0aGUgYm9keSwgYnV0IHdlJ3JlIGdvbm5hIGdldCBkaW1pbmlzaGluZyByZXR1cm5zLlxuXG4gICAgICB0aGlzLm1vdmUobmV4dCk7XG5cbiAgICAgIHRoaXMuaGlzdG9yeS51bnNoaWZ0KG5leHQpO1xuXG4gICAgICBpZiAodGhpcy5oaXN0b3J5Lmxlbmd0aCA+IDMpIHtcbiAgICAgICAgdGhpcy5oaXN0b3J5LnBvcCgpO1xuICAgICAgfVxuXG4gICAgICBpZiAoZmx1c2hDaGFuZ2VzKSB7XG4gICAgICAgIGZsdXNoKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIFRIRSBJU1NVRVxuICB9LCB7XG4gICAga2V5OiAnbW92ZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIG1vdmUocG9zKSB7XG4gICAgICB2YXIgX3RoaXM4ID0gdGhpcztcblxuICAgICAgaWYgKCEodHlwZW9mIHRoaXMuZWxlbWVudC5wYXJlbnROb2RlICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICB2YXIgc2FtZSA9IHt9O1xuXG4gICAgICBmb3IgKHZhciB0eXBlIGluIHBvcykge1xuICAgICAgICBzYW1lW3R5cGVdID0ge307XG5cbiAgICAgICAgZm9yICh2YXIga2V5IGluIHBvc1t0eXBlXSkge1xuICAgICAgICAgIHZhciBmb3VuZCA9IGZhbHNlO1xuXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmhpc3RvcnkubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgIHZhciBwb2ludCA9IHRoaXMuaGlzdG9yeVtpXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgcG9pbnRbdHlwZV0gIT09ICd1bmRlZmluZWQnICYmICF3aXRoaW4ocG9pbnRbdHlwZV1ba2V5XSwgcG9zW3R5cGVdW2tleV0pKSB7XG4gICAgICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFmb3VuZCkge1xuICAgICAgICAgICAgc2FtZVt0eXBlXVtrZXldID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdmFyIGNzcyA9IHsgdG9wOiAnJywgbGVmdDogJycsIHJpZ2h0OiAnJywgYm90dG9tOiAnJyB9O1xuXG4gICAgICB2YXIgdHJhbnNjcmliZSA9IGZ1bmN0aW9uIHRyYW5zY3JpYmUoX3NhbWUsIF9wb3MpIHtcbiAgICAgICAgdmFyIGhhc09wdGltaXphdGlvbnMgPSB0eXBlb2YgX3RoaXM4Lm9wdGlvbnMub3B0aW1pemF0aW9ucyAhPT0gJ3VuZGVmaW5lZCc7XG4gICAgICAgIHZhciBncHUgPSBoYXNPcHRpbWl6YXRpb25zID8gX3RoaXM4Lm9wdGlvbnMub3B0aW1pemF0aW9ucy5ncHUgOiBudWxsO1xuICAgICAgICBpZiAoZ3B1ICE9PSBmYWxzZSkge1xuICAgICAgICAgIHZhciB5UG9zID0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICB4UG9zID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGlmIChfc2FtZS50b3ApIHtcbiAgICAgICAgICAgIGNzcy50b3AgPSAwO1xuICAgICAgICAgICAgeVBvcyA9IF9wb3MudG9wO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjc3MuYm90dG9tID0gMDtcbiAgICAgICAgICAgIHlQb3MgPSAtX3Bvcy5ib3R0b207XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKF9zYW1lLmxlZnQpIHtcbiAgICAgICAgICAgIGNzcy5sZWZ0ID0gMDtcbiAgICAgICAgICAgIHhQb3MgPSBfcG9zLmxlZnQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNzcy5yaWdodCA9IDA7XG4gICAgICAgICAgICB4UG9zID0gLV9wb3MucmlnaHQ7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHdpbmRvdy5tYXRjaE1lZGlhKSB7XG4gICAgICAgICAgICAvLyBIdWJTcG90L3RldGhlciMyMDdcbiAgICAgICAgICAgIHZhciByZXRpbmEgPSB3aW5kb3cubWF0Y2hNZWRpYSgnb25seSBzY3JlZW4gYW5kIChtaW4tcmVzb2x1dGlvbjogMS4zZHBweCknKS5tYXRjaGVzIHx8IHdpbmRvdy5tYXRjaE1lZGlhKCdvbmx5IHNjcmVlbiBhbmQgKC13ZWJraXQtbWluLWRldmljZS1waXhlbC1yYXRpbzogMS4zKScpLm1hdGNoZXM7XG4gICAgICAgICAgICBpZiAoIXJldGluYSkge1xuICAgICAgICAgICAgICB4UG9zID0gTWF0aC5yb3VuZCh4UG9zKTtcbiAgICAgICAgICAgICAgeVBvcyA9IE1hdGgucm91bmQoeVBvcyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY3NzW3RyYW5zZm9ybUtleV0gPSAndHJhbnNsYXRlWCgnICsgeFBvcyArICdweCkgdHJhbnNsYXRlWSgnICsgeVBvcyArICdweCknO1xuXG4gICAgICAgICAgaWYgKHRyYW5zZm9ybUtleSAhPT0gJ21zVHJhbnNmb3JtJykge1xuICAgICAgICAgICAgLy8gVGhlIFogdHJhbnNmb3JtIHdpbGwga2VlcCB0aGlzIGluIHRoZSBHUFUgKGZhc3RlciwgYW5kIHByZXZlbnRzIGFydGlmYWN0cyksXG4gICAgICAgICAgICAvLyBidXQgSUU5IGRvZXNuJ3Qgc3VwcG9ydCAzZCB0cmFuc2Zvcm1zIGFuZCB3aWxsIGNob2tlLlxuICAgICAgICAgICAgY3NzW3RyYW5zZm9ybUtleV0gKz0gXCIgdHJhbnNsYXRlWigwKVwiO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoX3NhbWUudG9wKSB7XG4gICAgICAgICAgICBjc3MudG9wID0gX3Bvcy50b3AgKyAncHgnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjc3MuYm90dG9tID0gX3Bvcy5ib3R0b20gKyAncHgnO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChfc2FtZS5sZWZ0KSB7XG4gICAgICAgICAgICBjc3MubGVmdCA9IF9wb3MubGVmdCArICdweCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNzcy5yaWdodCA9IF9wb3MucmlnaHQgKyAncHgnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgICAgdmFyIG1vdmVkID0gZmFsc2U7XG4gICAgICBpZiAoKHNhbWUucGFnZS50b3AgfHwgc2FtZS5wYWdlLmJvdHRvbSkgJiYgKHNhbWUucGFnZS5sZWZ0IHx8IHNhbWUucGFnZS5yaWdodCkpIHtcbiAgICAgICAgY3NzLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgdHJhbnNjcmliZShzYW1lLnBhZ2UsIHBvcy5wYWdlKTtcbiAgICAgIH0gZWxzZSBpZiAoKHNhbWUudmlld3BvcnQudG9wIHx8IHNhbWUudmlld3BvcnQuYm90dG9tKSAmJiAoc2FtZS52aWV3cG9ydC5sZWZ0IHx8IHNhbWUudmlld3BvcnQucmlnaHQpKSB7XG4gICAgICAgIGNzcy5wb3NpdGlvbiA9ICdmaXhlZCc7XG4gICAgICAgIHRyYW5zY3JpYmUoc2FtZS52aWV3cG9ydCwgcG9zLnZpZXdwb3J0KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHNhbWUub2Zmc2V0ICE9PSAndW5kZWZpbmVkJyAmJiBzYW1lLm9mZnNldC50b3AgJiYgc2FtZS5vZmZzZXQubGVmdCkge1xuICAgICAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNzcy5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgICAgdmFyIG9mZnNldFBhcmVudCA9IF90aGlzOC5jYWNoZSgndGFyZ2V0LW9mZnNldHBhcmVudCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRPZmZzZXRQYXJlbnQoX3RoaXM4LnRhcmdldCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBpZiAoZ2V0T2Zmc2V0UGFyZW50KF90aGlzOC5lbGVtZW50KSAhPT0gb2Zmc2V0UGFyZW50KSB7XG4gICAgICAgICAgICBkZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgIF90aGlzOC5lbGVtZW50LnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoX3RoaXM4LmVsZW1lbnQpO1xuICAgICAgICAgICAgICBvZmZzZXRQYXJlbnQuYXBwZW5kQ2hpbGQoX3RoaXM4LmVsZW1lbnQpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdHJhbnNjcmliZShzYW1lLm9mZnNldCwgcG9zLm9mZnNldCk7XG4gICAgICAgICAgbW92ZWQgPSB0cnVlO1xuICAgICAgICB9KSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3NzLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgdHJhbnNjcmliZSh7IHRvcDogdHJ1ZSwgbGVmdDogdHJ1ZSB9LCBwb3MucGFnZSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghbW92ZWQpIHtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5ib2R5RWxlbWVudCkge1xuICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnQucGFyZW50Tm9kZSAhPT0gdGhpcy5vcHRpb25zLmJvZHlFbGVtZW50KSB7XG4gICAgICAgICAgICB0aGlzLm9wdGlvbnMuYm9keUVsZW1lbnQuYXBwZW5kQ2hpbGQodGhpcy5lbGVtZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFyIGlzRnVsbHNjcmVlbkVsZW1lbnQgPSBmdW5jdGlvbiBpc0Z1bGxzY3JlZW5FbGVtZW50KGUpIHtcbiAgICAgICAgICAgIHZhciBkID0gZS5vd25lckRvY3VtZW50O1xuICAgICAgICAgICAgdmFyIGZlID0gZC5mdWxsc2NyZWVuRWxlbWVudCB8fCBkLndlYmtpdEZ1bGxzY3JlZW5FbGVtZW50IHx8IGQubW96RnVsbFNjcmVlbkVsZW1lbnQgfHwgZC5tc0Z1bGxzY3JlZW5FbGVtZW50O1xuICAgICAgICAgICAgcmV0dXJuIGZlID09PSBlO1xuICAgICAgICAgIH07XG5cbiAgICAgICAgICB2YXIgb2Zmc2V0UGFyZW50SXNCb2R5ID0gdHJ1ZTtcblxuICAgICAgICAgIHZhciBjdXJyZW50Tm9kZSA9IHRoaXMuZWxlbWVudC5wYXJlbnROb2RlO1xuICAgICAgICAgIHdoaWxlIChjdXJyZW50Tm9kZSAmJiBjdXJyZW50Tm9kZS5ub2RlVHlwZSA9PT0gMSAmJiBjdXJyZW50Tm9kZS50YWdOYW1lICE9PSAnQk9EWScgJiYgIWlzRnVsbHNjcmVlbkVsZW1lbnQoY3VycmVudE5vZGUpKSB7XG4gICAgICAgICAgICBpZiAoZ2V0Q29tcHV0ZWRTdHlsZShjdXJyZW50Tm9kZSkucG9zaXRpb24gIT09ICdzdGF0aWMnKSB7XG4gICAgICAgICAgICAgIG9mZnNldFBhcmVudElzQm9keSA9IGZhbHNlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY3VycmVudE5vZGUgPSBjdXJyZW50Tm9kZS5wYXJlbnROb2RlO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICghb2Zmc2V0UGFyZW50SXNCb2R5KSB7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmVsZW1lbnQpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBBbnkgY3NzIGNoYW5nZSB3aWxsIHRyaWdnZXIgYSByZXBhaW50LCBzbyBsZXQncyBhdm9pZCBvbmUgaWYgbm90aGluZyBjaGFuZ2VkXG4gICAgICB2YXIgd3JpdGVDU1MgPSB7fTtcbiAgICAgIHZhciB3cml0ZSA9IGZhbHNlO1xuICAgICAgZm9yICh2YXIga2V5IGluIGNzcykge1xuICAgICAgICB2YXIgdmFsID0gY3NzW2tleV07XG4gICAgICAgIHZhciBlbFZhbCA9IHRoaXMuZWxlbWVudC5zdHlsZVtrZXldO1xuXG4gICAgICAgIGlmIChlbFZhbCAhPT0gdmFsKSB7XG4gICAgICAgICAgd3JpdGUgPSB0cnVlO1xuICAgICAgICAgIHdyaXRlQ1NTW2tleV0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHdyaXRlKSB7XG4gICAgICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBleHRlbmQoX3RoaXM4LmVsZW1lbnQuc3R5bGUsIHdyaXRlQ1NTKTtcbiAgICAgICAgICBfdGhpczgudHJpZ2dlcigncmVwb3NpdGlvbmVkJyk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBUZXRoZXJDbGFzcztcbn0pKEV2ZW50ZWQpO1xuXG5UZXRoZXJDbGFzcy5tb2R1bGVzID0gW107XG5cblRldGhlckJhc2UucG9zaXRpb24gPSBwb3NpdGlvbjtcblxudmFyIFRldGhlciA9IGV4dGVuZChUZXRoZXJDbGFzcywgVGV0aGVyQmFzZSk7XG4vKiBnbG9iYWxzIFRldGhlckJhc2UgKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3NsaWNlZFRvQXJyYXkgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBzbGljZUl0ZXJhdG9yKGFyciwgaSkgeyB2YXIgX2FyciA9IFtdOyB2YXIgX24gPSB0cnVlOyB2YXIgX2QgPSBmYWxzZTsgdmFyIF9lID0gdW5kZWZpbmVkOyB0cnkgeyBmb3IgKHZhciBfaSA9IGFycltTeW1ib2wuaXRlcmF0b3JdKCksIF9zOyAhKF9uID0gKF9zID0gX2kubmV4dCgpKS5kb25lKTsgX24gPSB0cnVlKSB7IF9hcnIucHVzaChfcy52YWx1ZSk7IGlmIChpICYmIF9hcnIubGVuZ3RoID09PSBpKSBicmVhazsgfSB9IGNhdGNoIChlcnIpIHsgX2QgPSB0cnVlOyBfZSA9IGVycjsgfSBmaW5hbGx5IHsgdHJ5IHsgaWYgKCFfbiAmJiBfaVsncmV0dXJuJ10pIF9pWydyZXR1cm4nXSgpOyB9IGZpbmFsbHkgeyBpZiAoX2QpIHRocm93IF9lOyB9IH0gcmV0dXJuIF9hcnI7IH0gcmV0dXJuIGZ1bmN0aW9uIChhcnIsIGkpIHsgaWYgKEFycmF5LmlzQXJyYXkoYXJyKSkgeyByZXR1cm4gYXJyOyB9IGVsc2UgaWYgKFN5bWJvbC5pdGVyYXRvciBpbiBPYmplY3QoYXJyKSkgeyByZXR1cm4gc2xpY2VJdGVyYXRvcihhcnIsIGkpOyB9IGVsc2UgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlJyk7IH0gfTsgfSkoKTtcblxudmFyIF9UZXRoZXJCYXNlJFV0aWxzID0gVGV0aGVyQmFzZS5VdGlscztcbnZhciBnZXRCb3VuZHMgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRCb3VuZHM7XG52YXIgZXh0ZW5kID0gX1RldGhlckJhc2UkVXRpbHMuZXh0ZW5kO1xudmFyIHVwZGF0ZUNsYXNzZXMgPSBfVGV0aGVyQmFzZSRVdGlscy51cGRhdGVDbGFzc2VzO1xudmFyIGRlZmVyID0gX1RldGhlckJhc2UkVXRpbHMuZGVmZXI7XG5cbnZhciBCT1VORFNfRk9STUFUID0gWydsZWZ0JywgJ3RvcCcsICdyaWdodCcsICdib3R0b20nXTtcblxuZnVuY3Rpb24gZ2V0Qm91bmRpbmdSZWN0KHRldGhlciwgdG8pIHtcbiAgaWYgKHRvID09PSAnc2Nyb2xsUGFyZW50Jykge1xuICAgIHRvID0gdGV0aGVyLnNjcm9sbFBhcmVudHNbMF07XG4gIH0gZWxzZSBpZiAodG8gPT09ICd3aW5kb3cnKSB7XG4gICAgdG8gPSBbcGFnZVhPZmZzZXQsIHBhZ2VZT2Zmc2V0LCBpbm5lcldpZHRoICsgcGFnZVhPZmZzZXQsIGlubmVySGVpZ2h0ICsgcGFnZVlPZmZzZXRdO1xuICB9XG5cbiAgaWYgKHRvID09PSBkb2N1bWVudCkge1xuICAgIHRvID0gdG8uZG9jdW1lbnRFbGVtZW50O1xuICB9XG5cbiAgaWYgKHR5cGVvZiB0by5ub2RlVHlwZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5vZGUgPSB0bztcbiAgICAgIHZhciBzaXplID0gZ2V0Qm91bmRzKHRvKTtcbiAgICAgIHZhciBwb3MgPSBzaXplO1xuICAgICAgdmFyIHN0eWxlID0gZ2V0Q29tcHV0ZWRTdHlsZSh0byk7XG5cbiAgICAgIHRvID0gW3Bvcy5sZWZ0LCBwb3MudG9wLCBzaXplLndpZHRoICsgcG9zLmxlZnQsIHNpemUuaGVpZ2h0ICsgcG9zLnRvcF07XG5cbiAgICAgIC8vIEFjY291bnQgYW55IHBhcmVudCBGcmFtZXMgc2Nyb2xsIG9mZnNldFxuICAgICAgaWYgKG5vZGUub3duZXJEb2N1bWVudCAhPT0gZG9jdW1lbnQpIHtcbiAgICAgICAgdmFyIHdpbiA9IG5vZGUub3duZXJEb2N1bWVudC5kZWZhdWx0VmlldztcbiAgICAgICAgdG9bMF0gKz0gd2luLnBhZ2VYT2Zmc2V0O1xuICAgICAgICB0b1sxXSArPSB3aW4ucGFnZVlPZmZzZXQ7XG4gICAgICAgIHRvWzJdICs9IHdpbi5wYWdlWE9mZnNldDtcbiAgICAgICAgdG9bM10gKz0gd2luLnBhZ2VZT2Zmc2V0O1xuICAgICAgfVxuXG4gICAgICBCT1VORFNfRk9STUFULmZvckVhY2goZnVuY3Rpb24gKHNpZGUsIGkpIHtcbiAgICAgICAgc2lkZSA9IHNpZGVbMF0udG9VcHBlckNhc2UoKSArIHNpZGUuc3Vic3RyKDEpO1xuICAgICAgICBpZiAoc2lkZSA9PT0gJ1RvcCcgfHwgc2lkZSA9PT0gJ0xlZnQnKSB7XG4gICAgICAgICAgdG9baV0gKz0gcGFyc2VGbG9hdChzdHlsZVsnYm9yZGVyJyArIHNpZGUgKyAnV2lkdGgnXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdG9baV0gLT0gcGFyc2VGbG9hdChzdHlsZVsnYm9yZGVyJyArIHNpZGUgKyAnV2lkdGgnXSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pKCk7XG4gIH1cblxuICByZXR1cm4gdG87XG59XG5cblRldGhlckJhc2UubW9kdWxlcy5wdXNoKHtcbiAgcG9zaXRpb246IGZ1bmN0aW9uIHBvc2l0aW9uKF9yZWYpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgdmFyIHRvcCA9IF9yZWYudG9wO1xuICAgIHZhciBsZWZ0ID0gX3JlZi5sZWZ0O1xuICAgIHZhciB0YXJnZXRBdHRhY2htZW50ID0gX3JlZi50YXJnZXRBdHRhY2htZW50O1xuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuY29uc3RyYWludHMpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHZhciBfY2FjaGUgPSB0aGlzLmNhY2hlKCdlbGVtZW50LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBnZXRCb3VuZHMoX3RoaXMuZWxlbWVudCk7XG4gICAgfSk7XG5cbiAgICB2YXIgaGVpZ2h0ID0gX2NhY2hlLmhlaWdodDtcbiAgICB2YXIgd2lkdGggPSBfY2FjaGUud2lkdGg7XG5cbiAgICBpZiAod2lkdGggPT09IDAgJiYgaGVpZ2h0ID09PSAwICYmIHR5cGVvZiB0aGlzLmxhc3RTaXplICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgdmFyIF9sYXN0U2l6ZSA9IHRoaXMubGFzdFNpemU7XG5cbiAgICAgIC8vIEhhbmRsZSB0aGUgaXRlbSBnZXR0aW5nIGhpZGRlbiBhcyBhIHJlc3VsdCBvZiBvdXIgcG9zaXRpb25pbmcgd2l0aG91dCBnbGl0Y2hpbmdcbiAgICAgIC8vIHRoZSBjbGFzc2VzIGluIGFuZCBvdXRcbiAgICAgIHdpZHRoID0gX2xhc3RTaXplLndpZHRoO1xuICAgICAgaGVpZ2h0ID0gX2xhc3RTaXplLmhlaWdodDtcbiAgICB9XG5cbiAgICB2YXIgdGFyZ2V0U2l6ZSA9IHRoaXMuY2FjaGUoJ3RhcmdldC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gX3RoaXMuZ2V0VGFyZ2V0Qm91bmRzKCk7XG4gICAgfSk7XG5cbiAgICB2YXIgdGFyZ2V0SGVpZ2h0ID0gdGFyZ2V0U2l6ZS5oZWlnaHQ7XG4gICAgdmFyIHRhcmdldFdpZHRoID0gdGFyZ2V0U2l6ZS53aWR0aDtcblxuICAgIHZhciBhbGxDbGFzc2VzID0gW3RoaXMuZ2V0Q2xhc3MoJ3Bpbm5lZCcpLCB0aGlzLmdldENsYXNzKCdvdXQtb2YtYm91bmRzJyldO1xuXG4gICAgdGhpcy5vcHRpb25zLmNvbnN0cmFpbnRzLmZvckVhY2goZnVuY3Rpb24gKGNvbnN0cmFpbnQpIHtcbiAgICAgIHZhciBvdXRPZkJvdW5kc0NsYXNzID0gY29uc3RyYWludC5vdXRPZkJvdW5kc0NsYXNzO1xuICAgICAgdmFyIHBpbm5lZENsYXNzID0gY29uc3RyYWludC5waW5uZWRDbGFzcztcblxuICAgICAgaWYgKG91dE9mQm91bmRzQ2xhc3MpIHtcbiAgICAgICAgYWxsQ2xhc3Nlcy5wdXNoKG91dE9mQm91bmRzQ2xhc3MpO1xuICAgICAgfVxuICAgICAgaWYgKHBpbm5lZENsYXNzKSB7XG4gICAgICAgIGFsbENsYXNzZXMucHVzaChwaW5uZWRDbGFzcyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBhbGxDbGFzc2VzLmZvckVhY2goZnVuY3Rpb24gKGNscykge1xuICAgICAgWydsZWZ0JywgJ3RvcCcsICdyaWdodCcsICdib3R0b20nXS5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgIGFsbENsYXNzZXMucHVzaChjbHMgKyAnLScgKyBzaWRlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgdmFyIGFkZENsYXNzZXMgPSBbXTtcblxuICAgIHZhciB0QXR0YWNobWVudCA9IGV4dGVuZCh7fSwgdGFyZ2V0QXR0YWNobWVudCk7XG4gICAgdmFyIGVBdHRhY2htZW50ID0gZXh0ZW5kKHt9LCB0aGlzLmF0dGFjaG1lbnQpO1xuXG4gICAgdGhpcy5vcHRpb25zLmNvbnN0cmFpbnRzLmZvckVhY2goZnVuY3Rpb24gKGNvbnN0cmFpbnQpIHtcbiAgICAgIHZhciB0byA9IGNvbnN0cmFpbnQudG87XG4gICAgICB2YXIgYXR0YWNobWVudCA9IGNvbnN0cmFpbnQuYXR0YWNobWVudDtcbiAgICAgIHZhciBwaW4gPSBjb25zdHJhaW50LnBpbjtcblxuICAgICAgaWYgKHR5cGVvZiBhdHRhY2htZW50ID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICBhdHRhY2htZW50ID0gJyc7XG4gICAgICB9XG5cbiAgICAgIHZhciBjaGFuZ2VBdHRhY2hYID0gdW5kZWZpbmVkLFxuICAgICAgICAgIGNoYW5nZUF0dGFjaFkgPSB1bmRlZmluZWQ7XG4gICAgICBpZiAoYXR0YWNobWVudC5pbmRleE9mKCcgJykgPj0gMCkge1xuICAgICAgICB2YXIgX2F0dGFjaG1lbnQkc3BsaXQgPSBhdHRhY2htZW50LnNwbGl0KCcgJyk7XG5cbiAgICAgICAgdmFyIF9hdHRhY2htZW50JHNwbGl0MiA9IF9zbGljZWRUb0FycmF5KF9hdHRhY2htZW50JHNwbGl0LCAyKTtcblxuICAgICAgICBjaGFuZ2VBdHRhY2hZID0gX2F0dGFjaG1lbnQkc3BsaXQyWzBdO1xuICAgICAgICBjaGFuZ2VBdHRhY2hYID0gX2F0dGFjaG1lbnQkc3BsaXQyWzFdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hhbmdlQXR0YWNoWCA9IGNoYW5nZUF0dGFjaFkgPSBhdHRhY2htZW50O1xuICAgICAgfVxuXG4gICAgICB2YXIgYm91bmRzID0gZ2V0Qm91bmRpbmdSZWN0KF90aGlzLCB0byk7XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hZID09PSAndGFyZ2V0JyB8fCBjaGFuZ2VBdHRhY2hZID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKHRvcCA8IGJvdW5kc1sxXSAmJiB0QXR0YWNobWVudC50b3AgPT09ICd0b3AnKSB7XG4gICAgICAgICAgdG9wICs9IHRhcmdldEhlaWdodDtcbiAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10gJiYgdEF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJykge1xuICAgICAgICAgIHRvcCAtPSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFkgPT09ICd0b2dldGhlcicpIHtcbiAgICAgICAgaWYgKHRBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcpIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJyAmJiB0b3AgPCBib3VuZHNbMV0pIHtcbiAgICAgICAgICAgIHRvcCArPSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcblxuICAgICAgICAgICAgdG9wICs9IGhlaWdodDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZUF0dGFjaG1lbnQudG9wID09PSAndG9wJyAmJiB0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10gJiYgdG9wIC0gKGhlaWdodCAtIHRhcmdldEhlaWdodCkgPj0gYm91bmRzWzFdKSB7XG4gICAgICAgICAgICB0b3AgLT0gaGVpZ2h0IC0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG5cbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0QXR0YWNobWVudC50b3AgPT09ICdib3R0b20nKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcgJiYgdG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdKSB7XG4gICAgICAgICAgICB0b3AgLT0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG5cbiAgICAgICAgICAgIHRvcCAtPSBoZWlnaHQ7XG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LnRvcCA9PT0gJ2JvdHRvbScgJiYgdG9wIDwgYm91bmRzWzFdICYmIHRvcCArIChoZWlnaHQgKiAyIC0gdGFyZ2V0SGVpZ2h0KSA8PSBib3VuZHNbM10pIHtcbiAgICAgICAgICAgIHRvcCArPSBoZWlnaHQgLSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAndG9wJztcblxuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRBdHRhY2htZW50LnRvcCA9PT0gJ21pZGRsZScpIHtcbiAgICAgICAgICBpZiAodG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdICYmIGVBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcpIHtcbiAgICAgICAgICAgIHRvcCAtPSBoZWlnaHQ7XG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgICB9IGVsc2UgaWYgKHRvcCA8IGJvdW5kc1sxXSAmJiBlQXR0YWNobWVudC50b3AgPT09ICdib3R0b20nKSB7XG4gICAgICAgICAgICB0b3AgKz0gaGVpZ2h0O1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hYID09PSAndGFyZ2V0JyB8fCBjaGFuZ2VBdHRhY2hYID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKGxlZnQgPCBib3VuZHNbMF0gJiYgdEF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgbGVmdCArPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsZWZ0ICsgd2lkdGggPiBib3VuZHNbMl0gJiYgdEF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgIGxlZnQgLT0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgdEF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY2hhbmdlQXR0YWNoWCA9PT0gJ3RvZ2V0aGVyJykge1xuICAgICAgICBpZiAobGVmdCA8IGJvdW5kc1swXSAmJiB0QXR0YWNobWVudC5sZWZ0ID09PSAnbGVmdCcpIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgICAgbGVmdCArPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuXG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgbGVmdCArPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuXG4gICAgICAgICAgICBsZWZ0IC09IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGxlZnQgKyB3aWR0aCA+IGJvdW5kc1syXSAmJiB0QXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgbGVmdCAtPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG5cbiAgICAgICAgICAgIGxlZnQgLT0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICAgIGxlZnQgLT0gdGFyZ2V0V2lkdGg7XG4gICAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuXG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAodEF0dGFjaG1lbnQubGVmdCA9PT0gJ2NlbnRlcicpIHtcbiAgICAgICAgICBpZiAobGVmdCArIHdpZHRoID4gYm91bmRzWzJdICYmIGVBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgICAgbGVmdCAtPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAobGVmdCA8IGJvdW5kc1swXSAmJiBlQXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFkgPT09ICdlbGVtZW50JyB8fCBjaGFuZ2VBdHRhY2hZID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKHRvcCA8IGJvdW5kc1sxXSAmJiBlQXR0YWNobWVudC50b3AgPT09ICdib3R0b20nKSB7XG4gICAgICAgICAgdG9wICs9IGhlaWdodDtcbiAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAndG9wJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10gJiYgZUF0dGFjaG1lbnQudG9wID09PSAndG9wJykge1xuICAgICAgICAgIHRvcCAtPSBoZWlnaHQ7XG4gICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFggPT09ICdlbGVtZW50JyB8fCBjaGFuZ2VBdHRhY2hYID09PSAnYm90aCcpIHtcbiAgICAgICAgaWYgKGxlZnQgPCBib3VuZHNbMF0pIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgICAgbGVmdCArPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAnY2VudGVyJykge1xuICAgICAgICAgICAgbGVmdCArPSB3aWR0aCAvIDI7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsZWZ0ICsgd2lkdGggPiBib3VuZHNbMl0pIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgICBsZWZ0IC09IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAnY2VudGVyJykge1xuICAgICAgICAgICAgbGVmdCAtPSB3aWR0aCAvIDI7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBwaW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHBpbiA9IHBpbi5zcGxpdCgnLCcpLm1hcChmdW5jdGlvbiAocCkge1xuICAgICAgICAgIHJldHVybiBwLnRyaW0oKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHBpbiA9PT0gdHJ1ZSkge1xuICAgICAgICBwaW4gPSBbJ3RvcCcsICdsZWZ0JywgJ3JpZ2h0JywgJ2JvdHRvbSddO1xuICAgICAgfVxuXG4gICAgICBwaW4gPSBwaW4gfHwgW107XG5cbiAgICAgIHZhciBwaW5uZWQgPSBbXTtcbiAgICAgIHZhciBvb2IgPSBbXTtcblxuICAgICAgaWYgKHRvcCA8IGJvdW5kc1sxXSkge1xuICAgICAgICBpZiAocGluLmluZGV4T2YoJ3RvcCcpID49IDApIHtcbiAgICAgICAgICB0b3AgPSBib3VuZHNbMV07XG4gICAgICAgICAgcGlubmVkLnB1c2goJ3RvcCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9vYi5wdXNoKCd0b3AnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodG9wICsgaGVpZ2h0ID4gYm91bmRzWzNdKSB7XG4gICAgICAgIGlmIChwaW4uaW5kZXhPZignYm90dG9tJykgPj0gMCkge1xuICAgICAgICAgIHRvcCA9IGJvdW5kc1szXSAtIGhlaWdodDtcbiAgICAgICAgICBwaW5uZWQucHVzaCgnYm90dG9tJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb29iLnB1c2goJ2JvdHRvbScpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChsZWZ0IDwgYm91bmRzWzBdKSB7XG4gICAgICAgIGlmIChwaW4uaW5kZXhPZignbGVmdCcpID49IDApIHtcbiAgICAgICAgICBsZWZ0ID0gYm91bmRzWzBdO1xuICAgICAgICAgIHBpbm5lZC5wdXNoKCdsZWZ0Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb29iLnB1c2goJ2xlZnQnKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAobGVmdCArIHdpZHRoID4gYm91bmRzWzJdKSB7XG4gICAgICAgIGlmIChwaW4uaW5kZXhPZigncmlnaHQnKSA+PSAwKSB7XG4gICAgICAgICAgbGVmdCA9IGJvdW5kc1syXSAtIHdpZHRoO1xuICAgICAgICAgIHBpbm5lZC5wdXNoKCdyaWdodCcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG9vYi5wdXNoKCdyaWdodCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChwaW5uZWQubGVuZ3RoKSB7XG4gICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIHBpbm5lZENsYXNzID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGlmICh0eXBlb2YgX3RoaXMub3B0aW9ucy5waW5uZWRDbGFzcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHBpbm5lZENsYXNzID0gX3RoaXMub3B0aW9ucy5waW5uZWRDbGFzcztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcGlubmVkQ2xhc3MgPSBfdGhpcy5nZXRDbGFzcygncGlubmVkJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYWRkQ2xhc3Nlcy5wdXNoKHBpbm5lZENsYXNzKTtcbiAgICAgICAgICBwaW5uZWQuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICAgICAgYWRkQ2xhc3Nlcy5wdXNoKHBpbm5lZENsYXNzICsgJy0nICsgc2lkZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChvb2IubGVuZ3RoKSB7XG4gICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdmFyIG9vYkNsYXNzID0gdW5kZWZpbmVkO1xuICAgICAgICAgIGlmICh0eXBlb2YgX3RoaXMub3B0aW9ucy5vdXRPZkJvdW5kc0NsYXNzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgb29iQ2xhc3MgPSBfdGhpcy5vcHRpb25zLm91dE9mQm91bmRzQ2xhc3M7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIG9vYkNsYXNzID0gX3RoaXMuZ2V0Q2xhc3MoJ291dC1vZi1ib3VuZHMnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhZGRDbGFzc2VzLnB1c2gob29iQ2xhc3MpO1xuICAgICAgICAgIG9vYi5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgICAgICBhZGRDbGFzc2VzLnB1c2gob29iQ2xhc3MgKyAnLScgKyBzaWRlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHBpbm5lZC5pbmRleE9mKCdsZWZ0JykgPj0gMCB8fCBwaW5uZWQuaW5kZXhPZigncmlnaHQnKSA+PSAwKSB7XG4gICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSB0QXR0YWNobWVudC5sZWZ0ID0gZmFsc2U7XG4gICAgICB9XG4gICAgICBpZiAocGlubmVkLmluZGV4T2YoJ3RvcCcpID49IDAgfHwgcGlubmVkLmluZGV4T2YoJ2JvdHRvbScpID49IDApIHtcbiAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gdEF0dGFjaG1lbnQudG9wID0gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGlmICh0QXR0YWNobWVudC50b3AgIT09IHRhcmdldEF0dGFjaG1lbnQudG9wIHx8IHRBdHRhY2htZW50LmxlZnQgIT09IHRhcmdldEF0dGFjaG1lbnQubGVmdCB8fCBlQXR0YWNobWVudC50b3AgIT09IF90aGlzLmF0dGFjaG1lbnQudG9wIHx8IGVBdHRhY2htZW50LmxlZnQgIT09IF90aGlzLmF0dGFjaG1lbnQubGVmdCkge1xuICAgICAgICBfdGhpcy51cGRhdGVBdHRhY2hDbGFzc2VzKGVBdHRhY2htZW50LCB0QXR0YWNobWVudCk7XG4gICAgICAgIF90aGlzLnRyaWdnZXIoJ3VwZGF0ZScsIHtcbiAgICAgICAgICBhdHRhY2htZW50OiBlQXR0YWNobWVudCxcbiAgICAgICAgICB0YXJnZXRBdHRhY2htZW50OiB0QXR0YWNobWVudFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghKF90aGlzLm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXMudGFyZ2V0LCBhZGRDbGFzc2VzLCBhbGxDbGFzc2VzKTtcbiAgICAgIH1cbiAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXMuZWxlbWVudCwgYWRkQ2xhc3NlcywgYWxsQ2xhc3Nlcyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4geyB0b3A6IHRvcCwgbGVmdDogbGVmdCB9O1xuICB9XG59KTtcbi8qIGdsb2JhbHMgVGV0aGVyQmFzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfVGV0aGVyQmFzZSRVdGlscyA9IFRldGhlckJhc2UuVXRpbHM7XG52YXIgZ2V0Qm91bmRzID0gX1RldGhlckJhc2UkVXRpbHMuZ2V0Qm91bmRzO1xudmFyIHVwZGF0ZUNsYXNzZXMgPSBfVGV0aGVyQmFzZSRVdGlscy51cGRhdGVDbGFzc2VzO1xudmFyIGRlZmVyID0gX1RldGhlckJhc2UkVXRpbHMuZGVmZXI7XG5cblRldGhlckJhc2UubW9kdWxlcy5wdXNoKHtcbiAgcG9zaXRpb246IGZ1bmN0aW9uIHBvc2l0aW9uKF9yZWYpIHtcbiAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgdmFyIHRvcCA9IF9yZWYudG9wO1xuICAgIHZhciBsZWZ0ID0gX3JlZi5sZWZ0O1xuXG4gICAgdmFyIF9jYWNoZSA9IHRoaXMuY2FjaGUoJ2VsZW1lbnQtYm91bmRzJywgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGdldEJvdW5kcyhfdGhpcy5lbGVtZW50KTtcbiAgICB9KTtcblxuICAgIHZhciBoZWlnaHQgPSBfY2FjaGUuaGVpZ2h0O1xuICAgIHZhciB3aWR0aCA9IF9jYWNoZS53aWR0aDtcblxuICAgIHZhciB0YXJnZXRQb3MgPSB0aGlzLmdldFRhcmdldEJvdW5kcygpO1xuXG4gICAgdmFyIGJvdHRvbSA9IHRvcCArIGhlaWdodDtcbiAgICB2YXIgcmlnaHQgPSBsZWZ0ICsgd2lkdGg7XG5cbiAgICB2YXIgYWJ1dHRlZCA9IFtdO1xuICAgIGlmICh0b3AgPD0gdGFyZ2V0UG9zLmJvdHRvbSAmJiBib3R0b20gPj0gdGFyZ2V0UG9zLnRvcCkge1xuICAgICAgWydsZWZ0JywgJ3JpZ2h0J10uZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICB2YXIgdGFyZ2V0UG9zU2lkZSA9IHRhcmdldFBvc1tzaWRlXTtcbiAgICAgICAgaWYgKHRhcmdldFBvc1NpZGUgPT09IGxlZnQgfHwgdGFyZ2V0UG9zU2lkZSA9PT0gcmlnaHQpIHtcbiAgICAgICAgICBhYnV0dGVkLnB1c2goc2lkZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGlmIChsZWZ0IDw9IHRhcmdldFBvcy5yaWdodCAmJiByaWdodCA+PSB0YXJnZXRQb3MubGVmdCkge1xuICAgICAgWyd0b3AnLCAnYm90dG9tJ10uZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICB2YXIgdGFyZ2V0UG9zU2lkZSA9IHRhcmdldFBvc1tzaWRlXTtcbiAgICAgICAgaWYgKHRhcmdldFBvc1NpZGUgPT09IHRvcCB8fCB0YXJnZXRQb3NTaWRlID09PSBib3R0b20pIHtcbiAgICAgICAgICBhYnV0dGVkLnB1c2goc2lkZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHZhciBhbGxDbGFzc2VzID0gW107XG4gICAgdmFyIGFkZENsYXNzZXMgPSBbXTtcblxuICAgIHZhciBzaWRlcyA9IFsnbGVmdCcsICd0b3AnLCAncmlnaHQnLCAnYm90dG9tJ107XG4gICAgYWxsQ2xhc3Nlcy5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ2FidXR0ZWQnKSk7XG4gICAgc2lkZXMuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgYWxsQ2xhc3Nlcy5wdXNoKF90aGlzLmdldENsYXNzKCdhYnV0dGVkJykgKyAnLScgKyBzaWRlKTtcbiAgICB9KTtcblxuICAgIGlmIChhYnV0dGVkLmxlbmd0aCkge1xuICAgICAgYWRkQ2xhc3Nlcy5wdXNoKHRoaXMuZ2V0Q2xhc3MoJ2FidXR0ZWQnKSk7XG4gICAgfVxuXG4gICAgYWJ1dHRlZC5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICBhZGRDbGFzc2VzLnB1c2goX3RoaXMuZ2V0Q2xhc3MoJ2FidXR0ZWQnKSArICctJyArIHNpZGUpO1xuICAgIH0pO1xuXG4gICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCEoX3RoaXMub3B0aW9ucy5hZGRUYXJnZXRDbGFzc2VzID09PSBmYWxzZSkpIHtcbiAgICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpcy50YXJnZXQsIGFkZENsYXNzZXMsIGFsbENsYXNzZXMpO1xuICAgICAgfVxuICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpcy5lbGVtZW50LCBhZGRDbGFzc2VzLCBhbGxDbGFzc2VzKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG59KTtcbi8qIGdsb2JhbHMgVGV0aGVyQmFzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfc2xpY2VkVG9BcnJheSA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIHNsaWNlSXRlcmF0b3IoYXJyLCBpKSB7IHZhciBfYXJyID0gW107IHZhciBfbiA9IHRydWU7IHZhciBfZCA9IGZhbHNlOyB2YXIgX2UgPSB1bmRlZmluZWQ7IHRyeSB7IGZvciAodmFyIF9pID0gYXJyW1N5bWJvbC5pdGVyYXRvcl0oKSwgX3M7ICEoX24gPSAoX3MgPSBfaS5uZXh0KCkpLmRvbmUpOyBfbiA9IHRydWUpIHsgX2Fyci5wdXNoKF9zLnZhbHVlKTsgaWYgKGkgJiYgX2Fyci5sZW5ndGggPT09IGkpIGJyZWFrOyB9IH0gY2F0Y2ggKGVycikgeyBfZCA9IHRydWU7IF9lID0gZXJyOyB9IGZpbmFsbHkgeyB0cnkgeyBpZiAoIV9uICYmIF9pWydyZXR1cm4nXSkgX2lbJ3JldHVybiddKCk7IH0gZmluYWxseSB7IGlmIChfZCkgdGhyb3cgX2U7IH0gfSByZXR1cm4gX2FycjsgfSByZXR1cm4gZnVuY3Rpb24gKGFyciwgaSkgeyBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7IHJldHVybiBhcnI7IH0gZWxzZSBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChhcnIpKSB7IHJldHVybiBzbGljZUl0ZXJhdG9yKGFyciwgaSk7IH0gZWxzZSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2UnKTsgfSB9OyB9KSgpO1xuXG5UZXRoZXJCYXNlLm1vZHVsZXMucHVzaCh7XG4gIHBvc2l0aW9uOiBmdW5jdGlvbiBwb3NpdGlvbihfcmVmKSB7XG4gICAgdmFyIHRvcCA9IF9yZWYudG9wO1xuICAgIHZhciBsZWZ0ID0gX3JlZi5sZWZ0O1xuXG4gICAgaWYgKCF0aGlzLm9wdGlvbnMuc2hpZnQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgc2hpZnQgPSB0aGlzLm9wdGlvbnMuc2hpZnQ7XG4gICAgaWYgKHR5cGVvZiB0aGlzLm9wdGlvbnMuc2hpZnQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHNoaWZ0ID0gdGhpcy5vcHRpb25zLnNoaWZ0LmNhbGwodGhpcywgeyB0b3A6IHRvcCwgbGVmdDogbGVmdCB9KTtcbiAgICB9XG5cbiAgICB2YXIgc2hpZnRUb3AgPSB1bmRlZmluZWQsXG4gICAgICAgIHNoaWZ0TGVmdCA9IHVuZGVmaW5lZDtcbiAgICBpZiAodHlwZW9mIHNoaWZ0ID09PSAnc3RyaW5nJykge1xuICAgICAgc2hpZnQgPSBzaGlmdC5zcGxpdCgnICcpO1xuICAgICAgc2hpZnRbMV0gPSBzaGlmdFsxXSB8fCBzaGlmdFswXTtcblxuICAgICAgdmFyIF9zaGlmdCA9IHNoaWZ0O1xuXG4gICAgICB2YXIgX3NoaWZ0MiA9IF9zbGljZWRUb0FycmF5KF9zaGlmdCwgMik7XG5cbiAgICAgIHNoaWZ0VG9wID0gX3NoaWZ0MlswXTtcbiAgICAgIHNoaWZ0TGVmdCA9IF9zaGlmdDJbMV07XG5cbiAgICAgIHNoaWZ0VG9wID0gcGFyc2VGbG9hdChzaGlmdFRvcCwgMTApO1xuICAgICAgc2hpZnRMZWZ0ID0gcGFyc2VGbG9hdChzaGlmdExlZnQsIDEwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2hpZnRUb3AgPSBzaGlmdC50b3A7XG4gICAgICBzaGlmdExlZnQgPSBzaGlmdC5sZWZ0O1xuICAgIH1cblxuICAgIHRvcCArPSBzaGlmdFRvcDtcbiAgICBsZWZ0ICs9IHNoaWZ0TGVmdDtcblxuICAgIHJldHVybiB7IHRvcDogdG9wLCBsZWZ0OiBsZWZ0IH07XG4gIH1cbn0pO1xucmV0dXJuIFRldGhlcjtcblxufSkpO1xuIiwiY29uc3QgcGFuZWwgPSAnRW1vamlQYW5lbCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAgIHBhbmVsLFxuICAgIG9wZW46IHBhbmVsICsgJy0tb3BlbicsXG4gICAgdHJpZ2dlcjogcGFuZWwgKyAnLS10cmlnZ2VyJyxcbiAgICBcbiAgICBpY29uczogXCJpY29uX3BhY2tcIixcbiAgICBpY29ucGljazogXCJpY29uX3BpY2tlclwiLFxuICAgIGVtb2ppcGljazogXCJlbW9qaV9waWNrZXJcIixcbiAgICBlbW9qaTogJ2Vtb2ppJyxcbiAgICBzdmc6IHBhbmVsICsgJ19fc3ZnJyxcblxuICAgIHRvb2x0aXA6IHBhbmVsICsgJ19fdG9vbHRpcCcsXG5cbiAgICBjb250ZW50OiBwYW5lbCArICdfX2NvbnRlbnQnLFxuICAgIGhlYWRlcjogcGFuZWwgKyAnX19oZWFkZXInLFxuICAgIHF1ZXJ5OiBwYW5lbCArICdfX3F1ZXJ5JyxcbiAgICBzZWFyY2hJbnB1dDogcGFuZWwgKyAnX19xdWVyeUlucHV0JyxcbiAgICBzZWFyY2hUaXRsZTogcGFuZWwgKyAnX19zZWFyY2hUaXRsZScsXG4gICAgZnJlcXVlbnRUaXRsZTogcGFuZWwgKyAnX19mcmVxdWVudFRpdGxlJyxcblxuICAgIHJlc3VsdHM6IHBhbmVsICsgJ19fcmVzdWx0cycsXG4gICAgbm9SZXN1bHRzOiBwYW5lbCArICdfX25vUmVzdWx0cycsXG4gICAgY2F0ZWdvcnk6IHBhbmVsICsgJ19fY2F0ZWdvcnknLFxuICAgIGNhdGVnb3JpZXM6IHBhbmVsICsgJ19fY2F0ZWdvcmllcycsXG5cbiAgICBmb290ZXI6IHBhbmVsICsgJ19fZm9vdGVyJyxcbiAgICBicmFuZDogcGFuZWwgKyAnX19icmFuZCcsXG4gICAgYnRuTW9kaWZpZXI6IHBhbmVsICsgJ19fYnRuTW9kaWZpZXInLFxuICAgIGJ0bk1vZGlmaWVyVG9nZ2xlOiBwYW5lbCArICdfX2J0bk1vZGlmaWVyVG9nZ2xlJyxcbiAgICBtb2RpZmllckRyb3Bkb3duOiBwYW5lbCArICdfX21vZGlmaWVyRHJvcGRvd24nLFxufTtcbiIsImNvbnN0IFRldGhlciA9IHJlcXVpcmUoJ3RldGhlcicpO1xuXG5jb25zdCBFbW9qaXMgPSByZXF1aXJlKCcuL2Vtb2ppcycpO1xuXG5jb25zdCBDcmVhdGUgPSAob3B0aW9ucywgZW1pdCwgdG9nZ2xlKSA9PiB7XG4gICAgaWYob3B0aW9ucy5lZGl0YWJsZSkge1xuICAgICAgICAvLyBTZXQgdGhlIGNhcmV0IG9mZnNldCBvbiB0aGUgaW5wdXRcbiAgICAgICAgY29uc3QgaGFuZGxlQ2hhbmdlID0gZSA9PiB7XG4gICAgICAgICAgICBvcHRpb25zLmVkaXRhYmxlLmRhdGFzZXQub2Zmc2V0ID0gZ2V0Q2FyZXRQb3NpdGlvbihvcHRpb25zLmVkaXRhYmxlKTtcbiAgICAgICAgfTtcbiAgICAgICAgb3B0aW9ucy5lZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGhhbmRsZUNoYW5nZSk7XG4gICAgICAgIG9wdGlvbnMuZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgaGFuZGxlQ2hhbmdlKTtcbiAgICAgICAgb3B0aW9ucy5lZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGhhbmRsZUNoYW5nZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHRoZSBkcm9wZG93biBwYW5lbFxuICAgIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIilcbiAgICB7XG4gICAgICAgIHBhbmVsLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnBhbmVsKTtcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuZW1vamlwaWNrKTsgXG4gICAgfVxuICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMucGFuZWwpOyBcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuaWNvbnBpY2spOyBcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnRlbnQuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY29udGVudCk7XG4gICAgcGFuZWwuYXBwZW5kQ2hpbGQoY29udGVudCk7XG5cbiAgICBsZXQgc2VhcmNoSW5wdXQ7XG4gICAgbGV0IHJlc3VsdHM7XG4gICAgbGV0IGVtcHR5U3RhdGU7XG4gICAgbGV0IGZyZXF1ZW50VGl0bGU7XG5cbiAgICBpZihvcHRpb25zLnRyaWdnZXIpIHtcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMudHJpZ2dlcik7XG4gICAgICAgIC8vIExpc3RlbiBmb3IgdGhlIHRyaWdnZXJcbiAgICAgICAgb3B0aW9ucy50cmlnZ2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdG9nZ2xlKCkpO1xuXG4gICAgICAgIC8vIENyZWF0ZSB0aGUgdG9vbHRpcFxuICAgICAgICBvcHRpb25zLnRyaWdnZXIuc2V0QXR0cmlidXRlKCd0aXRsZScsIG9wdGlvbnMubG9jYWxlLmFkZCk7XG4gICAgICAgIGNvbnN0IHRvb2x0aXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIHRvb2x0aXAuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMudG9vbHRpcCk7XG4gICAgICAgIHRvb2x0aXAuaW5uZXJIVE1MID0gb3B0aW9ucy5sb2NhbGUuYWRkO1xuICAgICAgICBvcHRpb25zLnRyaWdnZXIuYXBwZW5kQ2hpbGQodG9vbHRpcCk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHRoZSBjYXRlZ29yeSBsaW5rc1xuICAgIGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2hlYWRlcicpO1xuICAgIGhlYWRlci5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5oZWFkZXIpO1xuICAgIGNvbnRlbnQuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcblxuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjYXRlZ29yaWVzLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3JpZXMpO1xuICAgIGhlYWRlci5hcHBlbmRDaGlsZChjYXRlZ29yaWVzKTtcblxuICAgIGZvcihsZXQgaSA9IDA7IGkgPCA5OyBpKyspIHtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnlMaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIGNhdGVnb3J5TGluay5jbGFzc0xpc3QuYWRkKCd0ZW1wJyk7XG4gICAgICAgIGNhdGVnb3JpZXMuYXBwZW5kQ2hpbGQoY2F0ZWdvcnlMaW5rKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSBsaXN0XG4gICAgcmVzdWx0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHJlc3VsdHMuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMucmVzdWx0cyk7XG4gICAgY29udGVudC5hcHBlbmRDaGlsZChyZXN1bHRzKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgc2VhcmNoIGlucHV0XG4gICAgaWYob3B0aW9ucy5zZWFyY2ggPT0gdHJ1ZSkge1xuICAgICAgICBjb25zdCBxdWVyeSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBxdWVyeS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5xdWVyeSk7XG4gICAgICAgIGhlYWRlci5hcHBlbmRDaGlsZChxdWVyeSk7XG5cbiAgICAgICAgc2VhcmNoSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgICAgICBzZWFyY2hJbnB1dC5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5zZWFyY2hJbnB1dCk7XG4gICAgICAgIHNlYXJjaElucHV0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0Jyk7XG4gICAgICAgIHNlYXJjaElucHV0LnNldEF0dHJpYnV0ZSgnYXV0b0NvbXBsZXRlJywgJ29mZicpO1xuICAgICAgICBzZWFyY2hJbnB1dC5zZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJywgb3B0aW9ucy5sb2NhbGUuc2VhcmNoKTtcbiAgICAgICAgcXVlcnkuYXBwZW5kQ2hpbGQoc2VhcmNoSW5wdXQpO1xuXG4gICAgICAgIGNvbnN0IGljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgaWNvbi5pbm5lckhUTUwgPSBvcHRpb25zLmljb25zLnNlYXJjaDtcbiAgICAgICAgcXVlcnkuYXBwZW5kQ2hpbGQoaWNvbik7XG5cbiAgICAgICAgY29uc3Qgc2VhcmNoVGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gICAgICAgIHNlYXJjaFRpdGxlLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3J5LCBvcHRpb25zLmNsYXNzbmFtZXMuc2VhcmNoVGl0bGUpO1xuICAgICAgICBzZWFyY2hUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBzZWFyY2hUaXRsZS5pbm5lckhUTUwgPSBvcHRpb25zLmxvY2FsZS5zZWFyY2hfcmVzdWx0cztcbiAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChzZWFyY2hUaXRsZSk7XG5cbiAgICAgICAgZW1wdHlTdGF0ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgZW1wdHlTdGF0ZS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5ub1Jlc3VsdHMpO1xuICAgICAgICBlbXB0eVN0YXRlLmlubmVySFRNTCA9IG9wdGlvbnMubG9jYWxlLm5vX3Jlc3VsdHM7XG4gICAgICAgIHJlc3VsdHMuYXBwZW5kQ2hpbGQoZW1wdHlTdGF0ZSk7XG4gICAgfVxuXG4gICAgaWYob3B0aW9ucy5mcmVxdWVudCA9PSB0cnVlKSB7XG4gICAgICAgIGxldCBmcmVxdWVudExpc3QgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnRW1vamlQYW5lbC1mcmVxdWVudCcpO1xuICAgICAgICBpZihmcmVxdWVudExpc3QpIHtcbiAgICAgICAgICAgIGZyZXF1ZW50TGlzdCA9IEpTT04ucGFyc2UoZnJlcXVlbnRMaXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyZXF1ZW50TGlzdCA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGZyZXF1ZW50VGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gICAgICAgIGZyZXF1ZW50VGl0bGUuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY2F0ZWdvcnksIG9wdGlvbnMuY2xhc3NuYW1lcy5mcmVxdWVudFRpdGxlKTtcbiAgICAgICAgZnJlcXVlbnRUaXRsZS5pbm5lckhUTUwgPSBvcHRpb25zLmxvY2FsZS5mcmVxdWVudDtcbiAgICAgICAgaWYoZnJlcXVlbnRMaXN0Lmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICBmcmVxdWVudFRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChmcmVxdWVudFRpdGxlKTtcblxuICAgICAgICBjb25zdCBmcmVxdWVudFJlc3VsdHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZnJlcXVlbnRSZXN1bHRzLmNsYXNzTGlzdC5hZGQoJ0Vtb2ppUGFuZWwtZnJlcXVlbnQnKTtcblxuICAgICAgICBmcmVxdWVudExpc3QuZm9yRWFjaChlbW9qaSA9PiB7XG4gICAgICAgICAgICBmcmVxdWVudFJlc3VsdHMuYXBwZW5kQ2hpbGQoRW1vamlzLmNyZWF0ZUJ1dHRvbihlbW9qaSwgb3B0aW9ucywgZW1pdCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChmcmVxdWVudFJlc3VsdHMpO1xuICAgIH1cblxuICAgIGNvbnN0IGxvYWRpbmdUaXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgICBsb2FkaW5nVGl0bGUuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY2F0ZWdvcnkpO1xuICAgIGxvYWRpbmdUaXRsZS50ZXh0Q29udGVudCA9IG9wdGlvbnMubG9jYWxlLmxvYWRpbmc7XG4gICAgcmVzdWx0cy5hcHBlbmRDaGlsZChsb2FkaW5nVGl0bGUpO1xuICAgIGZvcihsZXQgaSA9IDA7IGkgPCA5ICogODsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHRlbXBFbW9qaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgICB0ZW1wRW1vamkuY2xhc3NMaXN0LmFkZCgndGVtcCcpO1xuICAgICAgICByZXN1bHRzLmFwcGVuZENoaWxkKHRlbXBFbW9qaSk7XG4gICAgfVxuXG4gICAgY29uc3QgZm9vdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZm9vdGVyJyk7XG4gICAgZm9vdGVyLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmZvb3Rlcik7XG4gICAgcGFuZWwuYXBwZW5kQ2hpbGQoZm9vdGVyKTtcblxuICAgIGlmKG9wdGlvbnMubG9jYWxlLmJyYW5kKSB7XG4gICAgICAgIGNvbnN0IGJyYW5kID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBicmFuZC5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5icmFuZCk7XG4gICAgICAgIGJyYW5kLnNldEF0dHJpYnV0ZSgnaHJlZicsICdodHRwczovL2Vtb2ppcGFuZWwuanMub3JnJyk7XG4gICAgICAgIGJyYW5kLnRleHRDb250ZW50ID0gb3B0aW9ucy5sb2NhbGUuYnJhbmQ7XG4gICAgICAgIGZvb3Rlci5hcHBlbmRDaGlsZChicmFuZCk7XG4gICAgfVxuXG4gICAgLy8gQXBwZW5kIHRoZSBkcm9wZG93biBtZW51IHRvIHRoZSBjb250YWluZXJcbiAgICBvcHRpb25zLmNvbnRhaW5lci5hcHBlbmRDaGlsZChwYW5lbCk7XG5cbiAgICAvLyBUZXRoZXIgdGhlIGRyb3Bkb3duIHRvIHRoZSB0cmlnZ2VyXG4gICAgbGV0IHRldGhlcjtcbiAgICBpZihvcHRpb25zLnRyaWdnZXIgJiYgb3B0aW9ucy50ZXRoZXIpIHtcbiAgICAgICAgY29uc3QgcGxhY2VtZW50cyA9IFsndG9wJywgJ3JpZ2h0JywgJ2JvdHRvbScsICdsZWZ0J107XG4gICAgICAgIGlmKHBsYWNlbWVudHMuaW5kZXhPZihvcHRpb25zLnBsYWNlbWVudCkgPT0gLTEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBhdHRhY2htZW50ICcke29wdGlvbnMucGxhY2VtZW50fScuIFZhbGlkIHBsYWNlbWVudHMgYXJlICcke3BsYWNlbWVudHMuam9pbihgJywgJ2ApfScuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgYXR0YWNobWVudDtcbiAgICAgICAgbGV0IHRhcmdldEF0dGFjaG1lbnQ7XG4gICAgICAgIHN3aXRjaChvcHRpb25zLnBsYWNlbWVudCkge1xuICAgICAgICAgICAgY2FzZSBwbGFjZW1lbnRzWzBdOiBjYXNlIHBsYWNlbWVudHNbMl06XG4gICAgICAgICAgICAgICAgYXR0YWNobWVudCA9IChvcHRpb25zLnBsYWNlbWVudCA9PSBwbGFjZW1lbnRzWzBdID8gcGxhY2VtZW50c1syXSA6IHBsYWNlbWVudHNbMF0pICsgJyBjZW50ZXInO1xuICAgICAgICAgICAgICAgIHRhcmdldEF0dGFjaG1lbnQgPSAob3B0aW9ucy5wbGFjZW1lbnQgPT0gcGxhY2VtZW50c1swXSA/IHBsYWNlbWVudHNbMF0gOiBwbGFjZW1lbnRzWzJdKSArICcgY2VudGVyJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgcGxhY2VtZW50c1sxXTogY2FzZSBwbGFjZW1lbnRzWzNdOlxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnQgPSAndG9wICcgKyAob3B0aW9ucy5wbGFjZW1lbnQgPT0gcGxhY2VtZW50c1sxXSA/IHBsYWNlbWVudHNbM10gOiBwbGFjZW1lbnRzWzFdKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRBdHRhY2htZW50ID0gJ3RvcCAnICsgKG9wdGlvbnMucGxhY2VtZW50ID09IHBsYWNlbWVudHNbMV0gPyBwbGFjZW1lbnRzWzFdIDogcGxhY2VtZW50c1szXSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXRoZXIgPSBuZXcgVGV0aGVyKHtcbiAgICAgICAgICAgIGVsZW1lbnQ6IHBhbmVsLFxuICAgICAgICAgICAgdGFyZ2V0OiBvcHRpb25zLnRyaWdnZXIsXG4gICAgICAgICAgICBhdHRhY2htZW50LFxuICAgICAgICAgICAgdGFyZ2V0QXR0YWNobWVudFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIHBhbmVsIGVsZW1lbnQgc28gd2UgY2FuIHVwZGF0ZSBpdCBsYXRlclxuICAgIHJldHVybiB7XG4gICAgICAgIHBhbmVsLFxuICAgICAgICB0ZXRoZXJcbiAgICB9O1xufTtcblxuY29uc3QgZ2V0Q2FyZXRQb3NpdGlvbiA9IGVsID0+IHtcbiAgICBsZXQgY2FyZXRPZmZzZXQgPSAwO1xuICAgIGNvbnN0IGRvYyA9IGVsLm93bmVyRG9jdW1lbnQgfHwgZWwuZG9jdW1lbnQ7XG4gICAgY29uc3Qgd2luID0gZG9jLmRlZmF1bHRWaWV3IHx8IGRvYy5wYXJlbnRXaW5kb3c7XG4gICAgbGV0IHNlbDtcbiAgICBpZih0eXBlb2Ygd2luLmdldFNlbGVjdGlvbiAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICBzZWwgPSB3aW4uZ2V0U2VsZWN0aW9uKCk7XG4gICAgICAgIGlmKHNlbC5yYW5nZUNvdW50ID4gMCkge1xuICAgICAgICAgICAgY29uc3QgcmFuZ2UgPSB3aW4uZ2V0U2VsZWN0aW9uKCkuZ2V0UmFuZ2VBdCgwKTtcbiAgICAgICAgICAgIGNvbnN0IHByZUNhcmV0UmFuZ2UgPSByYW5nZS5jbG9uZVJhbmdlKCk7XG4gICAgICAgICAgICBwcmVDYXJldFJhbmdlLnNlbGVjdE5vZGVDb250ZW50cyhlbCk7XG4gICAgICAgICAgICBwcmVDYXJldFJhbmdlLnNldEVuZChyYW5nZS5lbmRDb250YWluZXIsIHJhbmdlLmVuZE9mZnNldCk7XG4gICAgICAgICAgICBjYXJldE9mZnNldCA9IHByZUNhcmV0UmFuZ2UudG9TdHJpbmcoKS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYoKHNlbCA9IGRvYy5zZWxlY3Rpb24pICYmIHNlbC50eXBlICE9ICdDb250cm9sJykge1xuICAgICAgICBjb25zdCB0ZXh0UmFuZ2UgPSBzZWwuY3JlYXRlUmFuZ2UoKTtcbiAgICAgICAgY29uc3QgcHJlQ2FyZXRUZXh0UmFuZ2UgPSBkb2MuYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgICAgICAgcHJlQ2FyZXRUZXh0UmFuZ2UubW92ZVRvRWxlbWVudFRleHQoZWwpO1xuICAgICAgICBwcmVDYXJldFRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCB0ZXh0UmFuZ2UpO1xuICAgICAgICBjYXJldE9mZnNldCA9IHByZUNhcmV0VGV4dFJhbmdlLnRleHQubGVuZ3RoO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gY2FyZXRPZmZzZXQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENyZWF0ZTtcbiIsImNvbnN0IG1vZGlmaWVycyA9IHJlcXVpcmUoJy4vbW9kaWZpZXJzJyk7XG5cbmNvbnN0IEVtb2ppcyA9IHtcbiAgICBsb2FkOiBvcHRpb25zID0+IHtcbiAgICAgICAgLy8gTG9hZCBhbmQgaW5qZWN0IHRoZSBTVkcgc3ByaXRlIGludG8gdGhlIERPTVxuICAgICAgICBsZXQgc3ZnUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICBpZihvcHRpb25zLnBhY2tfdXJsICYmICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKG9wdGlvbnMuY2xhc3NuYW1lcy5zdmcpKSB7XG4gICAgICAgICAgICBzdmdQcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3ZnWGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgc3ZnWGhyLm9wZW4oJ0dFVCcsIG9wdGlvbnMucGFja191cmwsIHRydWUpO1xuICAgICAgICAgICAgICAgIHN2Z1hoci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgICAgICBjb250YWluZXIuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuc3ZnKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBzdmdYaHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHN2Z1hoci5zZW5kKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBqc29uUHJvbWlzZTtcbiAgICAgICAgLy8gTG9hZCB0aGUgZW1vamlzIGpzb25cbiAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIilcbiAgICAgICAge1xuICAgICAgICAgICAgY29uc3QganNvbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdFbW9qaVBhbmVsLWpzb24nKTtcbiAgICAgICAgICAgIGpzb25Qcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGpzb24pXG4gICAgICAgICAgICBpZihqc29uID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbW9qaVhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgICAgICAgICBlbW9qaVhoci5vcGVuKCdHRVQnLCBvcHRpb25zLmpzb25fdXJsLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZW1vamlYaHIucmVhZHlTdGF0ZSA9PSBYTUxIdHRwUmVxdWVzdC5ET05FICYmIGVtb2ppWGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShlbW9qaVhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdFbW9qaVBhbmVsLWpzb24nLGVtb2ppWGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIuc2VuZCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnRW1vamlQYW5lbC1qc29uJykpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGpzb24pO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpe1xuICAgICAgICAgICAgLy8gY29uc3QganNvbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdJY29uUGFuZWwtanNvbicpO1xuICAgICAgICAgICAgLy8ganNvblByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoanNvbilcbiAgICAgICAgICAgIC8vIGlmKGpzb24gPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGpzb25Qcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtb2ppWGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgICAgIGVtb2ppWGhyLm9wZW4oJ0dFVCcsIG9wdGlvbnMuanNvbl91cmwsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBlbW9qaVhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihlbW9qaVhoci5yZWFkeVN0YXRlID09IFhNTEh0dHBSZXF1ZXN0LkRPTkUgJiYgZW1vamlYaHIuc3RhdHVzID09IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGVtb2ppWGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnSWNvblBhbmVsLWpzb24nLGVtb2ppWGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIuc2VuZCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgLy8gZWxzZXtcbiAgICAgICAgICAgIC8vICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgLy8gICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnSWNvblBhbmVsLWpzb24nKSk7XG4gICAgICAgICAgICAvLyAgICAgICAgIHJlc29sdmUoanNvbik7XG4gICAgICAgICAgICAvLyAgICAgfSlcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbIHN2Z1Byb21pc2UsIGpzb25Qcm9taXNlIF0pO1xuICAgIH0sXG4gICAgY3JlYXRlRWw6IChpbnB1dEVsZW1lbnQsIG9wdGlvbnMsIGJhc2VVcmwsIG1lZGlhVHlwZSApID0+IHtcbiAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIil7XG5cbiAgICAgICAgICAgIGlmKG9wdGlvbnMucGFja191cmwpIHtcbiAgICAgICAgICAgICAgICBpZihkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGAuJHtvcHRpb25zLmNsYXNzbmFtZXMuc3ZnfSBbaWQ9XCIke2lucHV0RWxlbWVudC51bmljb2RlfVwiYCkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjAgMjBcIj48dXNlIHhsaW5rOmhyZWY9XCIjJHtpbnB1dEVsZW1lbnQudW5pY29kZX1cIj48L3VzZT48L3N2Zz5gO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnB1dEVsZW1lbnQuY2hhcjtcbiAgICAgICAgICAgIC8vIEZhbGxiYWNrIHRvIHRoZSBlbW9qaSBjaGFyIGlmIHRoZSBwYWNrIGRvZXMgbm90IGhhdmUgdGhlIHNwcml0ZSwgb3Igbm8gcGFja1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKVxuICAgICAgICB7XG4gICAgICAgICAgICBpZihtZWRpYVR5cGUgPT0gXCJpbWFnZVwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiPGltZyBzcmM9XCIrYmFzZVVybCtpbnB1dEVsZW1lbnQuaWNvbl91cmwrXCI+XCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiPGkgY2xhc3M9J2ZhIFwiK2lucHV0RWxlbWVudC5pY29uX3VybCtcIic+PC9pPlwiO1xuICAgICAgICAgICAgfVxuXG5cbiAgICAgICAgfVxuICAgIH0sXG4gICAgY3JlYXRlQnV0dG9uOiAoaW5wdXRFbGVtZW50LCBvcHRpb25zLCBlbWl0ICwgYmFzZVVybCwgbWVkaWFUeXBlKSA9PiB7XG5cbiAgICAgICAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAnYnV0dG9uJyk7XG5cbiAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIil7XG5cbiAgICAgICAgICAgIGlmKGlucHV0RWxlbWVudC5maXR6cGF0cmljayAmJiBvcHRpb25zLmZpdHpwYXRyaWNrKSB7XG4gICAgICAgICAgICAgICAgLy8gUmVtb3ZlIGV4aXN0aW5nIG1vZGlmaWVyc1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGlmaWVycykuZm9yRWFjaChpID0+IGlucHV0RWxlbWVudC51bmljb2RlID0gaW5wdXRFbGVtZW50LnVuaWNvZGUucmVwbGFjZShtb2RpZmllcnNbaV0udW5pY29kZSwgJycpKTtcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RpZmllcnMpLmZvckVhY2goaSA9PiBpbnB1dEVsZW1lbnQuY2hhciA9IGlucHV0RWxlbWVudC5jaGFyLnJlcGxhY2UobW9kaWZpZXJzW2ldLmNoYXIsICcnKSk7XG5cbiAgICAgICAgICAgICAgICAvLyBBcHBlbmQgZml0enBhdHJpY2sgbW9kaWZpZXJcbiAgICAgICAgICAgICAgICBpbnB1dEVsZW1lbnQudW5pY29kZSArPSBtb2RpZmllcnNbb3B0aW9ucy5maXR6cGF0cmlja10udW5pY29kZTtcbiAgICAgICAgICAgICAgICBpbnB1dEVsZW1lbnQuY2hhciArPSBtb2RpZmllcnNbb3B0aW9ucy5maXR6cGF0cmlja10uY2hhcjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYnV0dG9uLmlubmVySFRNTCA9IEVtb2ppcy5jcmVhdGVFbChpbnB1dEVsZW1lbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2Vtb2ppJyk7XG4gICAgICAgICAgICBidXR0b24uZGF0YXNldC51bmljb2RlID0gaW5wdXRFbGVtZW50LnVuaWNvZGU7XG4gICAgICAgICAgICBidXR0b24uZGF0YXNldC5jaGFyID0gaW5wdXRFbGVtZW50LmNoYXI7XG4gICAgICAgICAgICBidXR0b24uZGF0YXNldC5jYXRlZ29yeSA9IGlucHV0RWxlbWVudC5jYXRlZ29yeTtcbiAgICAgICAgICAgIGJ1dHRvbi5kYXRhc2V0Lm5hbWUgPSBpbnB1dEVsZW1lbnQubmFtZTtcbiAgICAgICAgICAgIGJ1dHRvbi50aXRsZSA9IGlucHV0RWxlbWVudC5uYW1lO1xuICAgICAgICAgICAgaWYoaW5wdXRFbGVtZW50LmZpdHpwYXRyaWNrKSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLmRhdGFzZXQuZml0enBhdHJpY2sgPSBpbnB1dEVsZW1lbnQuZml0enBhdHJpY2s7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZihlbWl0KSB7XG4gICAgICAgICAgICAgICAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBlbWl0KCdzZWxlY3QnLCBpbnB1dEVsZW1lbnQpO1xuXG4gICAgICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMuZWRpdGFibGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIEVtb2ppcy53cml0ZShpbnB1dEVsZW1lbnQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpe1xuXG4gICAgICAgICAgICBidXR0b24uaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKGlucHV0RWxlbWVudCwgb3B0aW9ucywgYmFzZVVybCwgbWVkaWFUeXBlKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdpY29uX3BhY2snKTtcbiAgICAgICAgICAgIGJ1dHRvbi5kYXRhc2V0Lm5hbWUgPSBpbnB1dEVsZW1lbnQubmFtZTtcblxuICAgICAgICAgICAgaWYoZW1pdCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdCgnc2VsZWN0JywgaW5wdXRFbGVtZW50KTtcblxuICAgICAgICAgICAgICAgICAgICBpZihvcHRpb25zLmVkaXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBFbW9qaXMud3JpdGUoaW5wdXRFbGVtZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBidXR0b247XG4gICAgfSxcbiAgICB3cml0ZTogKGlucHV0RWxlbWVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBjb25zdCBpbnB1dCA9IG9wdGlvbnMuZWRpdGFibGU7XG4gICAgICAgIGlmKCFpbnB1dCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpe1xuXG4gICAgICAgICAgICAvLyBJbnNlcnQgdGhlIGVtb2ppIGF0IHRoZSBlbmQgb2YgdGhlIHRleHQgYnkgZGVmYXVsdFxuICAgICAgICAgICAgbGV0IG9mZnNldCA9IGlucHV0LnRleHRDb250ZW50Lmxlbmd0aDtcbiAgICAgICAgICAgIGlmKGlucHV0LmRhdGFzZXQub2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zZXJ0IHRoZSBlbW9qaSB3aGVyZSB0aGUgcmljaCBlZGl0b3IgY2FyZXQgd2FzXG4gICAgICAgICAgICAgICAgb2Zmc2V0ID0gaW5wdXQuZGF0YXNldC5vZmZzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEluc2VydCB0aGUgcGljdG9ncmFwaEltYWdlXG4gICAgICAgICAgICBjb25zdCBwaWN0b2dyYXBocyA9IGlucHV0LnBhcmVudE5vZGUucXVlcnlTZWxlY3RvcignLkVtb2ppUGFuZWxfX3BpY3RvZ3JhcGhzJyk7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hYnMudHdpbWcuY29tL2Vtb2ppL3YyLzcyeDcyLycgKyBlbW9qaS51bmljb2RlICsgJy5wbmcnO1xuICAgICAgICAgICAgY29uc3QgaW1hZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICAgIGltYWdlLmNsYXNzTGlzdC5hZGQoJ1JpY2hFZGl0b3ItcGljdG9ncmFwaEltYWdlJyk7XG4gICAgICAgICAgICBpbWFnZS5zZXRBdHRyaWJ1dGUoJ3NyYycsIHVybCk7XG4gICAgICAgICAgICBpbWFnZS5zZXRBdHRyaWJ1dGUoJ2RyYWdnYWJsZScsIGZhbHNlKTtcbiAgICAgICAgICAgIHBpY3RvZ3JhcGhzLmFwcGVuZENoaWxkKGltYWdlKTtcblxuICAgICAgICAgICAgY29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgIHNwYW4uY2xhc3NMaXN0LmFkZCgnRW1vamlQYW5lbF9fcGljdG9ncmFwaFRleHQnKTtcbiAgICAgICAgICAgIHNwYW4uc2V0QXR0cmlidXRlKCd0aXRsZScsIGVtb2ppLm5hbWUpO1xuICAgICAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBlbW9qaS5uYW1lKTtcbiAgICAgICAgICAgIHNwYW4uZGF0YXNldC5waWN0b2dyYXBoVGV4dCA9IGVtb2ppLmNoYXI7XG4gICAgICAgICAgICBzcGFuLmRhdGFzZXQucGljdG9ncmFwaEltYWdlID0gdXJsO1xuICAgICAgICAgICAgc3Bhbi5pbm5lckhUTUwgPSAnJmVtc3A7JztcblxuICAgICAgICAgICAgLy8gSWYgaXQncyBlbXB0eSwgcmVtb3ZlIHRoZSBkZWZhdWx0IGNvbnRlbnQgb2YgdGhlIGlucHV0XG4gICAgICAgICAgICBjb25zdCBkaXYgPSBpbnB1dC5xdWVyeVNlbGVjdG9yKCdkaXYnKTtcbiAgICAgICAgICAgIGlmKGRpdi5pbm5lckhUTUwgPT0gJzxicj4nKSB7XG4gICAgICAgICAgICAgICAgZGl2LmlubmVySFRNTCA9ICcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXBsYWNlIGVhY2ggcGljdG9ncmFwaCBzcGFuIHdpdGggaXQncyBuYXRpdmUgY2hhcmFjdGVyXG4gICAgICAgICAgICBjb25zdCBwaWN0cyA9IGRpdi5xdWVyeVNlbGVjdG9yQWxsKCcuRW1vamlQYW5lbF9fcGljdG9ncmFwaFRleHQnKTtcbiAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChwaWN0cywgcGljdCA9PiB7XG4gICAgICAgICAgICAgICAgZGl2LnJlcGxhY2VDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShwaWN0LmRhdGFzZXQucGljdG9ncmFwaFRleHQpLCBwaWN0KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBTcGxpdCBjb250ZW50IGludG8gYXJyYXksIGluc2VydCBlbW9qaSBhdCBvZmZzZXQgaW5kZXhcbiAgICAgICAgICAgIGxldCBjb250ZW50ID0gZW1vamlBd2FyZS5zcGxpdChkaXYudGV4dENvbnRlbnQpO1xuICAgICAgICAgICAgY29udGVudC5zcGxpY2Uob2Zmc2V0LCAwLCBlbW9qaS5jaGFyKTtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LmpvaW4oJycpO1xuXG4gICAgICAgICAgICBkaXYudGV4dENvbnRlbnQgPSBjb250ZW50O1xuXG4gICAgICAgICAgICAvLyBUcmlnZ2VyIGEgcmVmcmVzaCBvZiB0aGUgaW5wdXRcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0hUTUxFdmVudHMnKTtcbiAgICAgICAgICAgIGV2ZW50LmluaXRFdmVudCgnbW91c2Vkb3duJywgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgaW5wdXQuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgb2Zmc2V0IHRvIGFmdGVyIHRoZSBpbnNlcnRlZCBlbW9qaVxuICAgICAgICAgICAgaW5wdXQuZGF0YXNldC5vZmZzZXQgPSBwYXJzZUludChpbnB1dC5kYXRhc2V0Lm9mZnNldCwgMTApICsgMTtcblxuICAgICAgICAgICAgaWYob3B0aW9ucy5mcmVxdWVudCA9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgRnJlcXVlbnQuYWRkKGVtb2ppLCBFbW9qaXMuY3JlYXRlQnV0dG9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIil7XG5cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRW1vamlzO1xuIiwiY29uc3QgeyBFdmVudEVtaXR0ZXIgfSA9IHJlcXVpcmUoJ2ZiZW1pdHRlcicpO1xuXG5jb25zdCBDcmVhdGUgPSByZXF1aXJlKCcuL2NyZWF0ZScpO1xuY29uc3QgRW1vamlzID0gcmVxdWlyZSgnLi9lbW9qaXMnKTtcbmNvbnN0IExpc3QgPSByZXF1aXJlKCcuL2xpc3QnKTtcbmNvbnN0IGNsYXNzbmFtZXMgPSByZXF1aXJlKCcuL2NsYXNzbmFtZXMnKTtcblxuY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgc2VhcmNoOiB0cnVlLFxuICAgIGZyZXF1ZW50OiB0cnVlLFxuICAgIGZpdHpwYXRyaWNrOiAnYScsXG4gICAgaGlkZGVuX2NhdGVnb3JpZXM6IFtdLFxuICAgIHBhY2tfdXJsOiBudWxsLFxuICAgIC8vIHBhbmVsX3R5cGU6ICdlbW9qaScsXG4gICAgLy8ganNvbl91cmw6ICcvZW1vamlzLmpzb24nLFxuICAgIHBhbmVsX3R5cGU6ICdpY29uJyxcbiAgICBqc29uX3VybDogJy9pY29uU2V0Lmpzb24nLFxuICAgIHRldGhlcjogdHJ1ZSxcbiAgICBwbGFjZW1lbnQ6ICdib3R0b20nLFxuXG4gICAgbG9jYWxlOiB7XG4gICAgICAgIGFkZDogJ0FkZCBlbW9qaScsXG4gICAgICAgIGJyYW5kOiAnRW1vamlQYW5lbCcsXG4gICAgICAgIGZyZXF1ZW50OiAnRnJlcXVlbnRseSB1c2VkJyxcbiAgICAgICAgbG9hZGluZzogJ0xvYWRpbmcuLi4nLFxuICAgICAgICBub19yZXN1bHRzOiAnTm8gcmVzdWx0cycsXG4gICAgICAgIHNlYXJjaDogJ1NlYXJjaCcsXG4gICAgICAgIHNlYXJjaF9yZXN1bHRzOiAnU2VhcmNoIHJlc3VsdHMnXG4gICAgfSxcbiAgICBpY29uczoge1xuICAgICAgICBzZWFyY2g6ICc8c3BhbiBjbGFzcz1cImZhIGZhLXNlYXJjaFwiPjwvc3Bhbj4nXG4gICAgfSxcbiAgICBjbGFzc25hbWVzXG59O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBFbW9qaVBhbmVsIGV4dGVuZHMgRXZlbnRFbWl0dGVyIHtcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKSB7XG4gICAgICAgIHN1cGVyKCk7XG5cbiAgICAgICAgdGhpcy5vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdHMsIG9wdGlvbnMpO1xuXG4gICAgICAgIGNvbnN0IGVscyA9IFsnY29udGFpbmVyJywgJ3RyaWdnZXInLCAnZWRpdGFibGUnXTtcbiAgICAgICAgZWxzLmZvckVhY2goZWwgPT4ge1xuICAgICAgICAgICAgaWYodHlwZW9mIHRoaXMub3B0aW9uc1tlbF0gPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB0aGlzLm9wdGlvbnNbZWxdID0gZG9jdW1lbnQucXVlcnlTZWxlY3Rvcih0aGlzLm9wdGlvbnNbZWxdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgY3JlYXRlID0gQ3JlYXRlKHRoaXMub3B0aW9ucywgdGhpcy5lbWl0LmJpbmQodGhpcyksIHRoaXMudG9nZ2xlLmJpbmQodGhpcykpO1xuICAgICAgICB0aGlzLnBhbmVsID0gY3JlYXRlLnBhbmVsO1xuICAgICAgICB0aGlzLnRldGhlciA9IGNyZWF0ZS50ZXRoZXI7XG5cbiAgICAgICAgRW1vamlzLmxvYWQodGhpcy5vcHRpb25zKVxuICAgICAgICAgICAgLnRoZW4ocmVzID0+IHtcbiAgICAgICAgICAgICAgICBMaXN0KHRoaXMub3B0aW9ucywgdGhpcy5wYW5lbCwgcmVzWzFdLCB0aGlzLmVtaXQuYmluZCh0aGlzKSk7XG4gICAgICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB0b2dnbGUoKSB7XG4gICAgICAgIGNvbnN0IG9wZW4gPSB0aGlzLnBhbmVsLmNsYXNzTGlzdC50b2dnbGUodGhpcy5vcHRpb25zLmNsYXNzbmFtZXMub3Blbik7XG4gICAgICAgIGNvbnN0IHNlYXJjaElucHV0ID0gdGhpcy5wYW5lbC5xdWVyeVNlbGVjdG9yKCcuJyArIHRoaXMub3B0aW9ucy5jbGFzc25hbWVzLnNlYXJjaElucHV0KTtcblxuICAgICAgICB0aGlzLmVtaXQoJ3RvZ2dsZScsIG9wZW4pO1xuICAgICAgICBpZihvcGVuICYmIHRoaXMub3B0aW9ucy5zZWFyY2ggJiYgc2VhcmNoSW5wdXQpIHtcbiAgICAgICAgICAgIHNlYXJjaElucHV0LmZvY3VzKCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXBvc2l0aW9uKCkge1xuICAgICAgICBpZih0aGlzLnRldGhlcikge1xuICAgICAgICAgICAgdGhpcy50ZXRoZXIucG9zaXRpb24oKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuaWYodHlwZW9mIHdpbmRvdyAhPSAndW5kZWZpbmVkJykge1xuICAgIHdpbmRvdy5FbW9qaVBhbmVsID0gRW1vamlQYW5lbDtcbn1cbiIsImNvbnN0IEVtb2ppcyA9IHJlcXVpcmUoJy4vZW1vamlzJyk7XG5jb25zdCBtb2RpZmllcnMgPSByZXF1aXJlKCcuL21vZGlmaWVycycpO1xuXG5jb25zdCBsaXN0ID0gKG9wdGlvbnMsIHBhbmVsLCBqc29uLCBlbWl0KSA9PiB7XG4gICAgY29uc3QgY2F0ZWdvcmllcyA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3JpZXMpO1xuICAgIGNvbnN0IHNlYXJjaElucHV0ID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuc2VhcmNoSW5wdXQpO1xuICAgIGNvbnN0IHNlYXJjaFRpdGxlID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuc2VhcmNoVGl0bGUpO1xuICAgIGNvbnN0IGZyZXF1ZW50VGl0bGUgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5mcmVxdWVudFRpdGxlKTtcbiAgICBjb25zdCByZXN1bHRzID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMucmVzdWx0cyk7XG4gICAgY29uc3QgZW1wdHlTdGF0ZSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLm5vUmVzdWx0cyk7XG4gICAgY29uc3QgZm9vdGVyID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuZm9vdGVyKTtcblxuICAgIC8vIFVwZGF0ZSB0aGUgY2F0ZWdvcnkgbGlua3NcbiAgICB3aGlsZSAoY2F0ZWdvcmllcy5maXJzdENoaWxkKSB7XG4gICAgICAgIGNhdGVnb3JpZXMucmVtb3ZlQ2hpbGQoY2F0ZWdvcmllcy5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgT2JqZWN0LmtleXMoanNvbikuZm9yRWFjaChpID0+IHtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBqc29uW2ldO1xuXG4gICAgICAgIC8vIERvbid0IHNob3cgdGhlIGxpbmsgdG8gYSBoaWRkZW4gY2F0ZWdvcnlcbiAgICAgICAgaWYob3B0aW9ucy5oaWRkZW5fY2F0ZWdvcmllcy5pbmRleE9mKGNhdGVnb3J5Lm5hbWUpID4gLTEpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGNhdGVnb3J5TGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuXG4gICAgICAgIGNhdGVnb3J5TGluay5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgY2F0ZWdvcnkubmFtZSk7XG4gICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGNhdGVnb3J5TGluay5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5lbW9qaSk7XG4gICAgICAgICAgICBjYXRlZ29yeUxpbmsuaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKGNhdGVnb3J5Lmljb24sIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKVxuICAgICAgICB7XG4gICAgICAgICAgICBjYXRlZ29yeUxpbmsuY2xhc3NMaXN0LmFkZChcImhlYWRlcl9pY29uc1wiKTtcbiAgICAgICAgICAgIGNhdGVnb3J5TGluay5pbm5lckhUTUwgPSBFbW9qaXMuY3JlYXRlRWwoY2F0ZWdvcnkuaWNvbl9wYWNrLCBvcHRpb25zLCBjYXRlZ29yeS5iYXNlX3VybCwgY2F0ZWdvcnkubWVkaWFfdHlwZSk7XG4gICAgICAgIH1cblxuICAgICAgICBjYXRlZ29yeUxpbmsuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgICAgICAgICAgIGxldCBzdHJpcHBlZFNwYWNlID0gIGNhdGVnb3J5Lm5hbWUucmVwbGFjZSgvXFxzL2csXCJfXCIpO1xuICAgICAgICAgICAgY29uc3QgdGl0bGUgPSBvcHRpb25zLmNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCcjJyArIHN0cmlwcGVkU3BhY2UpO1xuICAgICAgICAgICAgc2Nyb2xsVG8ocmVzdWx0cyAsIHRpdGxlLm9mZnNldFRvcCAtIHJlc3VsdHMub2Zmc2V0VG9wICwgNTAwKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNhdGVnb3JpZXMuYXBwZW5kQ2hpbGQoY2F0ZWdvcnlMaW5rKTtcbiAgICB9KTtcblxuICAgIC8vIGNyZWRpdHMgZm9yIHRoaXMgcGllY2Ugb2YgY29kZShzY3JvbGxUbyBwdXJlIGpzKSB0byBhZG5Kb3NoIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2FuZGpvc2hcbiAgICBmdW5jdGlvbiBzY3JvbGxUbyhlbGVtZW50LCB0bywgZHVyYXRpb24pIHtcbiAgICAgICAgdmFyIHN0YXJ0ID0gZWxlbWVudC5zY3JvbGxUb3AsXG4gICAgICAgICAgICBjaGFuZ2UgPSB0byAtIHN0YXJ0LFxuICAgICAgICAgICAgY3VycmVudFRpbWUgPSAwLFxuICAgICAgICAgICAgaW5jcmVtZW50ID0gMjA7XG5cbiAgICAgICAgdmFyIGFuaW1hdGVTY3JvbGwgPSBmdW5jdGlvbigpe1xuICAgICAgICAgICAgY3VycmVudFRpbWUgKz0gaW5jcmVtZW50O1xuICAgICAgICAgICAgdmFyIHZhbCA9IE1hdGguZWFzZUluT3V0UXVhZChjdXJyZW50VGltZSwgc3RhcnQsIGNoYW5nZSwgZHVyYXRpb24pO1xuICAgICAgICAgICAgZWxlbWVudC5zY3JvbGxUb3AgPSB2YWw7XG4gICAgICAgICAgICBpZihjdXJyZW50VGltZSA8IGR1cmF0aW9uKSB7XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChhbmltYXRlU2Nyb2xsLCBpbmNyZW1lbnQpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICBhbmltYXRlU2Nyb2xsKCk7XG4gICAgfVxuXG4gICAgLy90ID0gY3VycmVudCB0aW1lXG4gICAgLy9iID0gc3RhcnQgdmFsdWVcbiAgICAvL2MgPSBjaGFuZ2UgaW4gdmFsdWVcbiAgICAvL2QgPSBkdXJhdGlvblxuICAgIE1hdGguZWFzZUluT3V0UXVhZCA9IGZ1bmN0aW9uICh0LCBiLCBjLCBkKSB7XG4gICAgICB0IC89IGQvMjtcbiAgICAgICAgaWYgKHQgPCAxKSByZXR1cm4gYy8yKnQqdCArIGI7XG4gICAgICAgIHQtLTtcbiAgICAgICAgcmV0dXJuIC1jLzIgKiAodCoodC0yKSAtIDEpICsgYjtcbiAgICB9O1xuXG4gICAgLy8gSGFuZGxlIHRoZSBzZWFyY2ggaW5wdXRcbiAgICBpZihvcHRpb25zLnNlYXJjaCA9PSB0cnVlKSB7XG5cbiAgICAgICAgc2VhcmNoSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBlID0+IHtcbiAgICAgICAgICAgIGxldCBlbW9qaXMgLCAgaWNvbnMgO1xuICAgICAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBlbW9qaXMgPSByZXN1bHRzLnF1ZXJ5U2VsZWN0b3JBbGwoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmVtb2ppKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGljb25zID0gcmVzdWx0cy5xdWVyeVNlbGVjdG9yQWxsKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5pY29ucyk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHRpdGxlcyA9IHJlc3VsdHMucXVlcnlTZWxlY3RvckFsbCgnLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuY2F0ZWdvcnkpO1xuXG4gICAgICAgICAgICBsZXQgZnJlcXVlbnRMaXN0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oJ0Vtb2ppUGFuZWwtZnJlcXVlbnQnKTtcbiAgICAgICAgICAgIGlmKGZyZXF1ZW50TGlzdCkge1xuICAgICAgICAgICAgICAgIGZyZXF1ZW50TGlzdCA9IEpTT04ucGFyc2UoZnJlcXVlbnRMaXN0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZnJlcXVlbnRMaXN0ID0gW107XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHZhbHVlID0gZS50YXJnZXQudmFsdWUucmVwbGFjZSgvLS9nLCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgIGlmKHZhbHVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjb25zdCBtYXRjaGVkID0gW107XG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoanNvbikuZm9yRWFjaChpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBqc29uW2ldO1xuICAgICAgICAgICAgICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeS5lbW9qaXMuZm9yRWFjaChlbW9qaSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qga2V5d29yZE1hdGNoID0gZW1vamkua2V5d29yZHMuZmluZChrZXl3b3JkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5d29yZCA9IGtleXdvcmQucmVwbGFjZSgvLS9nLCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleXdvcmQuaW5kZXhPZih2YWx1ZSkgPiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihrZXl3b3JkTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZC5wdXNoKGVtb2ppLnVuaWNvZGUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKVxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeS5pY29ucy5mb3JFYWNoKGljb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleXdvcmRNYXRjaCA9IGljb24ua2V5d29yZHMuZmluZChrZXl3b3JkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAga2V5d29yZCA9IGtleXdvcmQucmVwbGFjZSgvLS9nLCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGtleXdvcmQuaW5kZXhPZih2YWx1ZSkgPiAtMTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZihrZXl3b3JkTWF0Y2gpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbWF0Y2hlZC5wdXNoKGljb24ubmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZihtYXRjaGVkLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGVtcHR5U3RhdGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZW1wdHlTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGVtaXQoJ3NlYXJjaCcsIHsgdmFsdWUsIG1hdGNoZWQgfSk7XG5cbiAgICAgICAgICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKXtcbiAgICAgICAgICAgICAgICAgICAgW10uZm9yRWFjaC5jYWxsKGVtb2ppcywgZW1vamkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYobWF0Y2hlZC5pbmRleE9mKGVtb2ppLmRhdGFzZXQudW5pY29kZSkgPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbW9qaS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbW9qaS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIil7XG4gICAgICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChpY29ucywgaWNvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihtYXRjaGVkLmluZGV4T2YoaWNvbi5kYXRhc2V0Lm5hbWUpID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgW10uZm9yRWFjaC5jYWxsKHRpdGxlcywgdGl0bGUgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aXRsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHNlYXJjaFRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuXG4gICAgICAgICAgICAgICAgaWYob3B0aW9ucy5mcmVxdWVudCA9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGZyZXF1ZW50VGl0bGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGxldCBlbW9qaXMgPSByZXN1bHRzLnF1ZXJ5U2VsZWN0b3JBbGwoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmVtb2ppKTtcbiAgICAgICAgICAgICAgICBsZXQgaWNvbnMgPSByZXN1bHRzLnF1ZXJ5U2VsZWN0b3JBbGwoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmljb25zKTtcblxuICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpe1xuICAgICAgICAgICAgICAgICAgICBbXS5mb3JFYWNoLmNhbGwoZW1vamlzLCBlbW9qaSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlbW9qaS5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIil7XG4gICAgICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChpY29ucywgaWNvbiA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpY29uLnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lLWJsb2NrJztcbiAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbCh0aXRsZXMsIHRpdGxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGl0bGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgc2VhcmNoVGl0bGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICBlbXB0eVN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cbiAgICAgICAgICAgICAgICBpZihvcHRpb25zLmZyZXF1ZW50ID09IHRydWUpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYoZnJlcXVlbnRMaXN0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZyZXF1ZW50VGl0bGUuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcmVxdWVudFRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEZpbGwgdGhlIHJlc3VsdHMgd2l0aCBlbW9qaXNcbiAgICB3aGlsZSAocmVzdWx0cy5maXJzdENoaWxkKSB7XG4gICAgICAgIHJlc3VsdHMucmVtb3ZlQ2hpbGQocmVzdWx0cy5maXJzdENoaWxkKTtcbiAgICB9XG4gICAgT2JqZWN0LmtleXMoanNvbikuZm9yRWFjaChpID0+IHtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBqc29uW2ldO1xuXG4gICAgICAgIC8vIERvbid0IHNob3cgYW55IGhpZGRlbiBjYXRlZ29yaWVzXG4gICAgICAgIGlmKG9wdGlvbnMuaGlkZGVuX2NhdGVnb3JpZXMuaW5kZXhPZihjYXRlZ29yeS5uYW1lKSA+IC0xIHx8IGNhdGVnb3J5Lm5hbWUgPT0gJ21vZGlmaWVyJykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gQ3JlYXRlIHRoZSBjYXRlZ29yeSB0aXRsZVxuICAgICAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgICAgICAgdGl0bGUuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY2F0ZWdvcnkpO1xuICAgICAgICBsZXQgc3RyaXBwZWRTcGFjZSA9ICBjYXRlZ29yeS5uYW1lLnJlcGxhY2UoL1xccy9nLFwiX1wiKTtcbiAgICAgICAgdGl0bGUuaWQgPSBzdHJpcHBlZFNwYWNlO1xuICAgICAgICBsZXQgY2F0ZWdvcnlOYW1lID0gY2F0ZWdvcnkubmFtZS5yZXBsYWNlKC9fL2csICcgJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHdcXFMqL2csIChuYW1lKSA9PiBuYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbmFtZS5zdWJzdHIoMSkudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICAgIC5yZXBsYWNlKCdBbmQnLCAnJmFtcDsnKTtcbiAgICAgICAgdGl0bGUuaW5uZXJIVE1MID0gY2F0ZWdvcnlOYW1lO1xuICAgICAgICByZXN1bHRzLmFwcGVuZENoaWxkKHRpdGxlKTtcblxuICAgICAgICAvLyBDcmVhdGUgdGhlIGVtb2ppIGJ1dHRvbnNcbiAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIil7XG4gICAgICAgICAgICBjYXRlZ29yeS5lbW9qaXMuZm9yRWFjaChmdW5jdGlvbihlbW9qaSl7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChFbW9qaXMuY3JlYXRlQnV0dG9uKGVtb2ppLCBvcHRpb25zLCBlbWl0KSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcbiAgICAgICAgICAgIGNhdGVnb3J5Lmljb25zLmZvckVhY2goZnVuY3Rpb24oaWNvbil7XG4gICAgICAgICAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChFbW9qaXMuY3JlYXRlQnV0dG9uKGljb24sIG9wdGlvbnMsIGVtaXQsIGNhdGVnb3J5LmJhc2VfdXJsLCBjYXRlZ29yeS5tZWRpYV90eXBlKSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZigob3B0aW9ucy5maXR6cGF0cmljaykmJihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKSl7XG4gICAgICAgIC8vIENyZWF0ZSB0aGUgZml0enBhdHJpY2sgbW9kaWZpZXIgYnV0dG9uXG4gICAgICAgIGNvbnN0IGhhbmQgPSB7IC8vIOKci1xuICAgICAgICAgICAgdW5pY29kZTogJzI3MGInICsgbW9kaWZpZXJzW29wdGlvbnMuZml0enBhdHJpY2tdLnVuaWNvZGUsXG4gICAgICAgICAgICBjaGFyOiAn4pyLJ1xuICAgICAgICB9O1xuICAgICAgICBsZXQgbW9kaWZpZXJEcm9wZG93bjtcbiAgICAgICAgY29uc3QgbW9kaWZpZXJUb2dnbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgICAgbW9kaWZpZXJUb2dnbGUuc2V0QXR0cmlidXRlKCd0eXBlJywgJ2J1dHRvbicpO1xuICAgICAgICBtb2RpZmllclRvZ2dsZS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5idG5Nb2RpZmllciwgb3B0aW9ucy5jbGFzc25hbWVzLmJ0bk1vZGlmaWVyVG9nZ2xlLCBvcHRpb25zLmNsYXNzbmFtZXMuZW1vamkpO1xuICAgICAgICBtb2RpZmllclRvZ2dsZS5pbm5lckhUTUwgPSBFbW9qaXMuY3JlYXRlRWwoaGFuZCwgb3B0aW9ucyk7XG4gICAgICAgIG1vZGlmaWVyVG9nZ2xlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgbW9kaWZpZXJEcm9wZG93bi5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmUnKTtcbiAgICAgICAgICAgIG1vZGlmaWVyVG9nZ2xlLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScpO1xuICAgICAgICB9KTtcbiAgICAgICAgZm9vdGVyLmFwcGVuZENoaWxkKG1vZGlmaWVyVG9nZ2xlKTtcblxuICAgICAgICBtb2RpZmllckRyb3Bkb3duID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIG1vZGlmaWVyRHJvcGRvd24uY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMubW9kaWZpZXJEcm9wZG93bik7XG4gICAgICAgIE9iamVjdC5rZXlzKG1vZGlmaWVycykuZm9yRWFjaChtID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1vZGlmaWVyID0gT2JqZWN0LmFzc2lnbih7fSwgbW9kaWZpZXJzW21dKTtcbiAgICAgICAgICAgIG1vZGlmaWVyLnVuaWNvZGUgPSAnMjcwYicgKyBtb2RpZmllci51bmljb2RlO1xuICAgICAgICAgICAgbW9kaWZpZXIuY2hhciA9ICfinIsnICsgbW9kaWZpZXIuY2hhcjtcbiAgICAgICAgICAgIGNvbnN0IG1vZGlmaWVyQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBtb2RpZmllckJ0bi5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAnYnV0dG9uJyk7XG4gICAgICAgICAgICBtb2RpZmllckJ0bi5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5idG5Nb2RpZmllciwgb3B0aW9ucy5jbGFzc25hbWVzLmVtb2ppKTtcbiAgICAgICAgICAgIG1vZGlmaWVyQnRuLmRhdGFzZXQubW9kaWZpZXIgPSBtO1xuICAgICAgICAgICAgbW9kaWZpZXJCdG4uaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKG1vZGlmaWVyLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgbW9kaWZpZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgICAgIG1vZGlmaWVyVG9nZ2xlLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVyVG9nZ2xlLmlubmVySFRNTCA9IEVtb2ppcy5jcmVhdGVFbChtb2RpZmllciwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmZpdHpwYXRyaWNrID0gbW9kaWZpZXJCdG4uZGF0YXNldC5tb2RpZmllcjtcbiAgICAgICAgICAgICAgICBtb2RpZmllckRyb3Bkb3duLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuXG4gICAgICAgICAgICAgICAgLy8gUmVmcmVzaCBldmVyeSBlbW9qaSBpbiBhbnkgbGlzdCB3aXRoIG5ldyBza2luIHRvbmVcbiAgICAgICAgICAgICAgICBjb25zdCBlbW9qaXMgPSBbXS5mb3JFYWNoLmNhbGwob3B0aW9ucy5jb250YWluZXIucXVlcnlTZWxlY3RvckFsbChgLiR7b3B0aW9ucy5jbGFzc25hbWVzLnJlc3VsdHN9ICAuJHtvcHRpb25zLmNsYXNzbmFtZXMuZW1vaml9YCksIGVtb2ppID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYoZW1vamkuZGF0YXNldC5maXR6cGF0cmljaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW1vamlPYmogPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5pY29kZTogZW1vamkuZGF0YXNldC51bmljb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXI6IGVtb2ppLmRhdGFzZXQuY2hhcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXR6cGF0cmljazogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeTogZW1vamkuZGF0YXNldC5jYXRlZ29yeSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBlbW9qaS5kYXRhc2V0Lm5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKEVtb2ppcy5jcmVhdGVCdXR0b24oZW1vamlPYmosIG9wdGlvbnMsIGVtaXQpLCBlbW9qaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBtb2RpZmllckRyb3Bkb3duLmFwcGVuZENoaWxkKG1vZGlmaWVyQnRuKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGZvb3Rlci5hcHBlbmRDaGlsZChtb2RpZmllckRyb3Bkb3duKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGxpc3Q7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBhOiB7XG4gICAgICAgIHVuaWNvZGU6ICcnLFxuICAgICAgICBjaGFyOiAnJ1xuICAgIH0sXG4gICAgYjoge1xuICAgICAgICB1bmljb2RlOiAnLTFmM2ZiJyxcbiAgICAgICAgY2hhcjogJ/Cfj7snXG4gICAgfSxcbiAgICBjOiB7XG4gICAgICAgIHVuaWNvZGU6ICctMWYzZmMnLFxuICAgICAgICBjaGFyOiAn8J+PvCdcbiAgICB9LFxuICAgIGQ6IHtcbiAgICAgICAgdW5pY29kZTogJy0xZjNmZCcsXG4gICAgICAgIGNoYXI6ICfwn4+9J1xuICAgIH0sXG4gICAgZToge1xuICAgICAgICB1bmljb2RlOiAnLTFmM2ZlJyxcbiAgICAgICAgY2hhcjogJ/Cfj74nXG4gICAgfSxcbiAgICBmOiB7XG4gICAgICAgIHVuaWNvZGU6ICctMWYzZmYnLFxuICAgICAgICBjaGFyOiAn8J+PvydcbiAgICB9XG59O1xuIl19
