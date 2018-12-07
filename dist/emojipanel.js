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
    tab: panel + '__tab',
    tabWrapper: panel + '__tabWrapper',
    tabActive: panel + '__tabActive',

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
    createEl: function createEl(inputElement, options, baseUrl, mediaType, baseClass) {
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
                return "<i class='" + baseClass + " " + inputElement.icon_class + "'></i>";
            }
        }
    },
    createButton: function createButton(inputElement, options, emit, baseUrl, mediaType, baseClass) {

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

            button.innerHTML = Emojis.createEl(inputElement, options, baseUrl, mediaType, baseClass);
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
    layout_type: 'tab',

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
            categoryLink.innerHTML = Emojis.createEl(category.icon_pack, options, category.base_url, category.media_type, category.base_class);
        }

        categoryLink.addEventListener('click', function (e) {
            var strippedSpace = category.name.replace(/\s/g, "_");
            var title = options.container.querySelector('#' + strippedSpace);
            if (options.layout_type == "tab") {
                changeTab(strippedSpace);
            } else {
                scrollTo(results, title.offsetTop - results.offsetTop, 500);
            }
        });
        categories.appendChild(categoryLink);
    });

    function changeTab(tabPostfix) {
        var tabActive = panel.querySelector('.' + options.classnames.tabActive);
        tabActive.classList.remove(options.classnames.tabActive);
        var targetTab = panel.querySelector('.tab__' + tabPostfix);
        console.log('.tab__' + tabPostfix);
        targetTab.classList.add(options.classnames.tabActive);
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
        var tab = document.createElement('div');
        tab.classList.add(options.classnames.tab);
        var categoryClass = "tab__" + category.name.replace(/\s/g, "_");
        tab.classList.add(categoryClass);

        var title = document.createElement('p');
        title.classList.add(options.classnames.category);
        var strippedSpace = category.name.replace(/\s/g, "_");
        title.id = strippedSpace;
        var categoryName = category.name.replace(/_/g, ' ').replace(/\w\S*/g, function (name) {
            return name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();
        }).replace('And', '&amp;');
        title.innerHTML = categoryName;
        tab.appendChild(title);
        results.appendChild(tab);

        if (options.layout_type == "tab") {
            if (i == 0) {
                tab.classList.add(options.classnames.tabActive);
            }
        } else {
            tab.classList.add(options.classnames.tabActive);
        }

        // Create the emoji buttons
        if (options.panel_type == "emoji") {
            category.emojis.forEach(function (emoji) {
                tab.appendChild(Emojis.createButton(emoji, options, emit));
            });
        } else if (options.panel_type == "icon") {
            category.icons.forEach(function (icon) {
                tab.appendChild(Emojis.createButton(icon, options, emit, category.base_url, category.media_type, category.base_class));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZmJlbWl0dGVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2ZiZW1pdHRlci9saWIvQmFzZUV2ZW50RW1pdHRlci5qcyIsIm5vZGVfbW9kdWxlcy9mYmVtaXR0ZXIvbGliL0VtaXR0ZXJTdWJzY3JpcHRpb24uanMiLCJub2RlX21vZHVsZXMvZmJlbWl0dGVyL2xpYi9FdmVudFN1YnNjcmlwdGlvbi5qcyIsIm5vZGVfbW9kdWxlcy9mYmVtaXR0ZXIvbGliL0V2ZW50U3Vic2NyaXB0aW9uVmVuZG9yLmpzIiwibm9kZV9tb2R1bGVzL2ZianMvbGliL2VtcHR5RnVuY3Rpb24uanMiLCJub2RlX21vZHVsZXMvZmJqcy9saWIvaW52YXJpYW50LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy90ZXRoZXIvZGlzdC9qcy90ZXRoZXIuanMiLCJzcmMvY2xhc3NuYW1lcy5qcyIsInNyYy9jcmVhdGUuanMiLCJzcmMvZW1vamlzLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL2xpc3QuanMiLCJzcmMvbW9kaWZpZXJzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM5TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDdEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDbkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDNXhEQSxJQUFNLFFBQVEsWUFBZDs7QUFFQSxPQUFPLE9BQVAsR0FBaUI7QUFDYixnQkFEYTtBQUViLFVBQU0sUUFBUSxRQUZEO0FBR2IsYUFBUyxRQUFRLFdBSEo7QUFJYixTQUFLLFFBQU0sT0FKRTtBQUtiLGdCQUFZLFFBQU0sY0FMTDtBQU1iLGVBQVcsUUFBTSxhQU5KOztBQVFiLFdBQU8sV0FSTTtBQVNiLGNBQVUsYUFURztBQVViLGVBQVcsY0FWRTtBQVdiLFdBQU8sT0FYTTtBQVliLFNBQUssUUFBUSxPQVpBOztBQWNiLGFBQVMsUUFBUSxXQWRKOztBQWdCYixhQUFTLFFBQVEsV0FoQko7QUFpQmIsWUFBUSxRQUFRLFVBakJIO0FBa0JiLFdBQU8sUUFBUSxTQWxCRjtBQW1CYixpQkFBYSxRQUFRLGNBbkJSO0FBb0JiLGlCQUFhLFFBQVEsZUFwQlI7QUFxQmIsbUJBQWUsUUFBUSxpQkFyQlY7O0FBdUJiLGFBQVMsUUFBUSxXQXZCSjtBQXdCYixlQUFXLFFBQVEsYUF4Qk47QUF5QmIsY0FBVSxRQUFRLFlBekJMO0FBMEJiLGdCQUFZLFFBQVEsY0ExQlA7O0FBNEJiLFlBQVEsUUFBUSxVQTVCSDtBQTZCYixXQUFPLFFBQVEsU0E3QkY7QUE4QmIsaUJBQWEsUUFBUSxlQTlCUjtBQStCYix1QkFBbUIsUUFBUSxxQkEvQmQ7QUFnQ2Isc0JBQWtCLFFBQVE7QUFoQ2IsQ0FBakI7Ozs7O0FDRkEsSUFBTSxTQUFTLFFBQVEsUUFBUixDQUFmOztBQUVBLElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBZjs7QUFFQSxJQUFNLFNBQVMsU0FBVCxNQUFTLENBQUMsT0FBRCxFQUFVLElBQVYsRUFBZ0IsTUFBaEIsRUFBMkI7QUFDdEMsUUFBRyxRQUFRLFFBQVgsRUFBcUI7QUFDakI7QUFDQSxZQUFNLGVBQWUsU0FBZixZQUFlLElBQUs7QUFDdEIsb0JBQVEsUUFBUixDQUFpQixPQUFqQixDQUF5QixNQUF6QixHQUFrQyxpQkFBaUIsUUFBUSxRQUF6QixDQUFsQztBQUNILFNBRkQ7QUFHQSxnQkFBUSxRQUFSLENBQWlCLGdCQUFqQixDQUFrQyxPQUFsQyxFQUEyQyxZQUEzQztBQUNBLGdCQUFRLFFBQVIsQ0FBaUIsZ0JBQWpCLENBQWtDLFFBQWxDLEVBQTRDLFlBQTVDO0FBQ0EsZ0JBQVEsUUFBUixDQUFpQixnQkFBakIsQ0FBa0MsT0FBbEMsRUFBMkMsWUFBM0M7QUFDSDs7QUFFRDtBQUNBLFFBQU0sUUFBUSxTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBZDtBQUNBLFFBQUcsUUFBUSxVQUFSLElBQXNCLE9BQXpCLEVBQ0E7QUFDSSxjQUFNLFNBQU4sQ0FBZ0IsR0FBaEIsQ0FBb0IsUUFBUSxVQUFSLENBQW1CLEtBQXZDO0FBQ0EsY0FBTSxTQUFOLENBQWdCLEdBQWhCLENBQW9CLFFBQVEsVUFBUixDQUFtQixTQUF2QztBQUNILEtBSkQsTUFLSyxJQUFHLFFBQVEsVUFBUixJQUFzQixNQUF6QixFQUFnQztBQUNqQyxjQUFNLFNBQU4sQ0FBZ0IsR0FBaEIsQ0FBb0IsUUFBUSxVQUFSLENBQW1CLEtBQXZDO0FBQ0EsY0FBTSxTQUFOLENBQWdCLEdBQWhCLENBQW9CLFFBQVEsVUFBUixDQUFtQixRQUF2QztBQUNIOztBQUVELFFBQU0sVUFBVSxTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBaEI7QUFDQSxZQUFRLFNBQVIsQ0FBa0IsR0FBbEIsQ0FBc0IsUUFBUSxVQUFSLENBQW1CLE9BQXpDO0FBQ0EsVUFBTSxXQUFOLENBQWtCLE9BQWxCOztBQUVBLFFBQUksb0JBQUo7QUFDQSxRQUFJLGdCQUFKO0FBQ0EsUUFBSSxtQkFBSjtBQUNBLFFBQUksc0JBQUo7O0FBRUEsUUFBRyxRQUFRLE9BQVgsRUFBb0I7QUFDaEIsY0FBTSxTQUFOLENBQWdCLEdBQWhCLENBQW9CLFFBQVEsVUFBUixDQUFtQixPQUF2QztBQUNBO0FBQ0EsZ0JBQVEsT0FBUixDQUFnQixnQkFBaEIsQ0FBaUMsT0FBakMsRUFBMEM7QUFBQSxtQkFBTSxRQUFOO0FBQUEsU0FBMUM7O0FBRUE7QUFDQSxnQkFBUSxPQUFSLENBQWdCLFlBQWhCLENBQTZCLE9BQTdCLEVBQXNDLFFBQVEsTUFBUixDQUFlLEdBQXJEO0FBQ0EsWUFBTSxVQUFVLFNBQVMsYUFBVCxDQUF1QixNQUF2QixDQUFoQjtBQUNBLGdCQUFRLFNBQVIsQ0FBa0IsR0FBbEIsQ0FBc0IsUUFBUSxVQUFSLENBQW1CLE9BQXpDO0FBQ0EsZ0JBQVEsU0FBUixHQUFvQixRQUFRLE1BQVIsQ0FBZSxHQUFuQztBQUNBLGdCQUFRLE9BQVIsQ0FBZ0IsV0FBaEIsQ0FBNEIsT0FBNUI7QUFDSDs7QUFFRDtBQUNBLFFBQU0sU0FBUyxTQUFTLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBZjtBQUNBLFdBQU8sU0FBUCxDQUFpQixHQUFqQixDQUFxQixRQUFRLFVBQVIsQ0FBbUIsTUFBeEM7QUFDQSxZQUFRLFdBQVIsQ0FBb0IsTUFBcEI7O0FBRUEsUUFBTSxhQUFhLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFuQjtBQUNBLGVBQVcsU0FBWCxDQUFxQixHQUFyQixDQUF5QixRQUFRLFVBQVIsQ0FBbUIsVUFBNUM7QUFDQSxXQUFPLFdBQVAsQ0FBbUIsVUFBbkI7O0FBRUEsU0FBSSxJQUFJLElBQUksQ0FBWixFQUFlLElBQUksQ0FBbkIsRUFBc0IsR0FBdEIsRUFBMkI7QUFDdkIsWUFBTSxlQUFlLFNBQVMsYUFBVCxDQUF1QixRQUF2QixDQUFyQjtBQUNBLHFCQUFhLFNBQWIsQ0FBdUIsR0FBdkIsQ0FBMkIsTUFBM0I7QUFDQSxtQkFBVyxXQUFYLENBQXVCLFlBQXZCO0FBQ0g7O0FBRUQ7QUFDQSxjQUFVLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFWO0FBQ0EsWUFBUSxTQUFSLENBQWtCLEdBQWxCLENBQXNCLFFBQVEsVUFBUixDQUFtQixPQUF6QztBQUNBLFlBQVEsV0FBUixDQUFvQixPQUFwQjs7QUFFQTtBQUNBLFFBQUcsUUFBUSxNQUFSLElBQWtCLElBQXJCLEVBQTJCO0FBQ3ZCLFlBQU0sUUFBUSxTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBZDtBQUNBLGNBQU0sU0FBTixDQUFnQixHQUFoQixDQUFvQixRQUFRLFVBQVIsQ0FBbUIsS0FBdkM7QUFDQSxlQUFPLFdBQVAsQ0FBbUIsS0FBbkI7O0FBRUEsc0JBQWMsU0FBUyxhQUFULENBQXVCLE9BQXZCLENBQWQ7QUFDQSxvQkFBWSxTQUFaLENBQXNCLEdBQXRCLENBQTBCLFFBQVEsVUFBUixDQUFtQixXQUE3QztBQUNBLG9CQUFZLFlBQVosQ0FBeUIsTUFBekIsRUFBaUMsTUFBakM7QUFDQSxvQkFBWSxZQUFaLENBQXlCLGNBQXpCLEVBQXlDLEtBQXpDO0FBQ0Esb0JBQVksWUFBWixDQUF5QixhQUF6QixFQUF3QyxRQUFRLE1BQVIsQ0FBZSxNQUF2RDtBQUNBLGNBQU0sV0FBTixDQUFrQixXQUFsQjs7QUFFQSxZQUFNLE9BQU8sU0FBUyxhQUFULENBQXVCLEtBQXZCLENBQWI7QUFDQSxhQUFLLFNBQUwsR0FBaUIsUUFBUSxLQUFSLENBQWMsTUFBL0I7QUFDQSxjQUFNLFdBQU4sQ0FBa0IsSUFBbEI7O0FBRUEsWUFBTSxjQUFjLFNBQVMsYUFBVCxDQUF1QixHQUF2QixDQUFwQjtBQUNBLG9CQUFZLFNBQVosQ0FBc0IsR0FBdEIsQ0FBMEIsUUFBUSxVQUFSLENBQW1CLFFBQTdDLEVBQXVELFFBQVEsVUFBUixDQUFtQixXQUExRTtBQUNBLG9CQUFZLEtBQVosQ0FBa0IsT0FBbEIsR0FBNEIsTUFBNUI7QUFDQSxvQkFBWSxTQUFaLEdBQXdCLFFBQVEsTUFBUixDQUFlLGNBQXZDO0FBQ0EsZ0JBQVEsV0FBUixDQUFvQixXQUFwQjs7QUFFQSxxQkFBYSxTQUFTLGFBQVQsQ0FBdUIsTUFBdkIsQ0FBYjtBQUNBLG1CQUFXLFNBQVgsQ0FBcUIsR0FBckIsQ0FBeUIsUUFBUSxVQUFSLENBQW1CLFNBQTVDO0FBQ0EsbUJBQVcsU0FBWCxHQUF1QixRQUFRLE1BQVIsQ0FBZSxVQUF0QztBQUNBLGdCQUFRLFdBQVIsQ0FBb0IsVUFBcEI7QUFDSDs7QUFFRCxRQUFHLFFBQVEsUUFBUixJQUFvQixJQUF2QixFQUE2QjtBQUN6QixZQUFJLGVBQWUsYUFBYSxPQUFiLENBQXFCLHFCQUFyQixDQUFuQjtBQUNBLFlBQUcsWUFBSCxFQUFpQjtBQUNiLDJCQUFlLEtBQUssS0FBTCxDQUFXLFlBQVgsQ0FBZjtBQUNILFNBRkQsTUFFTztBQUNILDJCQUFlLEVBQWY7QUFDSDtBQUNELHdCQUFnQixTQUFTLGFBQVQsQ0FBdUIsR0FBdkIsQ0FBaEI7QUFDQSxzQkFBYyxTQUFkLENBQXdCLEdBQXhCLENBQTRCLFFBQVEsVUFBUixDQUFtQixRQUEvQyxFQUF5RCxRQUFRLFVBQVIsQ0FBbUIsYUFBNUU7QUFDQSxzQkFBYyxTQUFkLEdBQTBCLFFBQVEsTUFBUixDQUFlLFFBQXpDO0FBQ0EsWUFBRyxhQUFhLE1BQWIsSUFBdUIsQ0FBMUIsRUFBNkI7QUFDekIsMEJBQWMsS0FBZCxDQUFvQixPQUFwQixHQUE4QixNQUE5QjtBQUNIO0FBQ0QsZ0JBQVEsV0FBUixDQUFvQixhQUFwQjs7QUFFQSxZQUFNLGtCQUFrQixTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBeEI7QUFDQSx3QkFBZ0IsU0FBaEIsQ0FBMEIsR0FBMUIsQ0FBOEIscUJBQTlCOztBQUVBLHFCQUFhLE9BQWIsQ0FBcUIsaUJBQVM7QUFDMUIsNEJBQWdCLFdBQWhCLENBQTRCLE9BQU8sWUFBUCxDQUFvQixLQUFwQixFQUEyQixPQUEzQixFQUFvQyxJQUFwQyxDQUE1QjtBQUNILFNBRkQ7QUFHQSxnQkFBUSxXQUFSLENBQW9CLGVBQXBCO0FBQ0g7O0FBRUQsUUFBTSxlQUFlLFNBQVMsYUFBVCxDQUF1QixHQUF2QixDQUFyQjtBQUNBLGlCQUFhLFNBQWIsQ0FBdUIsR0FBdkIsQ0FBMkIsUUFBUSxVQUFSLENBQW1CLFFBQTlDO0FBQ0EsaUJBQWEsV0FBYixHQUEyQixRQUFRLE1BQVIsQ0FBZSxPQUExQztBQUNBLFlBQVEsV0FBUixDQUFvQixZQUFwQjtBQUNBLFNBQUksSUFBSSxLQUFJLENBQVosRUFBZSxLQUFJLElBQUksQ0FBdkIsRUFBMEIsSUFBMUIsRUFBK0I7QUFDM0IsWUFBTSxZQUFZLFNBQVMsYUFBVCxDQUF1QixRQUF2QixDQUFsQjtBQUNBLGtCQUFVLFNBQVYsQ0FBb0IsR0FBcEIsQ0FBd0IsTUFBeEI7QUFDQSxnQkFBUSxXQUFSLENBQW9CLFNBQXBCO0FBQ0g7O0FBRUQsUUFBTSxTQUFTLFNBQVMsYUFBVCxDQUF1QixRQUF2QixDQUFmO0FBQ0EsV0FBTyxTQUFQLENBQWlCLEdBQWpCLENBQXFCLFFBQVEsVUFBUixDQUFtQixNQUF4QztBQUNBLFVBQU0sV0FBTixDQUFrQixNQUFsQjs7QUFFQSxRQUFHLFFBQVEsTUFBUixDQUFlLEtBQWxCLEVBQXlCO0FBQ3JCLFlBQU0sUUFBUSxTQUFTLGFBQVQsQ0FBdUIsR0FBdkIsQ0FBZDtBQUNBLGNBQU0sU0FBTixDQUFnQixHQUFoQixDQUFvQixRQUFRLFVBQVIsQ0FBbUIsS0FBdkM7QUFDQSxjQUFNLFlBQU4sQ0FBbUIsTUFBbkIsRUFBMkIsMkJBQTNCO0FBQ0EsY0FBTSxXQUFOLEdBQW9CLFFBQVEsTUFBUixDQUFlLEtBQW5DO0FBQ0EsZUFBTyxXQUFQLENBQW1CLEtBQW5CO0FBQ0g7O0FBRUQ7QUFDQSxZQUFRLFNBQVIsQ0FBa0IsV0FBbEIsQ0FBOEIsS0FBOUI7O0FBRUE7QUFDQSxRQUFJLGVBQUo7QUFDQSxRQUFHLFFBQVEsT0FBUixJQUFtQixRQUFRLE1BQTlCLEVBQXNDO0FBQ2xDLFlBQU0sYUFBYSxDQUFDLEtBQUQsRUFBUSxPQUFSLEVBQWlCLFFBQWpCLEVBQTJCLE1BQTNCLENBQW5CO0FBQ0EsWUFBRyxXQUFXLE9BQVgsQ0FBbUIsUUFBUSxTQUEzQixLQUF5QyxDQUFDLENBQTdDLEVBQWdEO0FBQzVDLGtCQUFNLElBQUksS0FBSiwyQkFBaUMsUUFBUSxTQUF6QyxtQ0FBOEUsV0FBVyxJQUFYLFVBQTlFLFNBQU47QUFDSDs7QUFFRCxZQUFJLG1CQUFKO0FBQ0EsWUFBSSx5QkFBSjtBQUNBLGdCQUFPLFFBQVEsU0FBZjtBQUNJLGlCQUFLLFdBQVcsQ0FBWCxDQUFMLENBQW9CLEtBQUssV0FBVyxDQUFYLENBQUw7QUFDaEIsNkJBQWEsQ0FBQyxRQUFRLFNBQVIsSUFBcUIsV0FBVyxDQUFYLENBQXJCLEdBQXFDLFdBQVcsQ0FBWCxDQUFyQyxHQUFxRCxXQUFXLENBQVgsQ0FBdEQsSUFBdUUsU0FBcEY7QUFDQSxtQ0FBbUIsQ0FBQyxRQUFRLFNBQVIsSUFBcUIsV0FBVyxDQUFYLENBQXJCLEdBQXFDLFdBQVcsQ0FBWCxDQUFyQyxHQUFxRCxXQUFXLENBQVgsQ0FBdEQsSUFBdUUsU0FBMUY7QUFDQTtBQUNKLGlCQUFLLFdBQVcsQ0FBWCxDQUFMLENBQW9CLEtBQUssV0FBVyxDQUFYLENBQUw7QUFDaEIsNkJBQWEsVUFBVSxRQUFRLFNBQVIsSUFBcUIsV0FBVyxDQUFYLENBQXJCLEdBQXFDLFdBQVcsQ0FBWCxDQUFyQyxHQUFxRCxXQUFXLENBQVgsQ0FBL0QsQ0FBYjtBQUNBLG1DQUFtQixVQUFVLFFBQVEsU0FBUixJQUFxQixXQUFXLENBQVgsQ0FBckIsR0FBcUMsV0FBVyxDQUFYLENBQXJDLEdBQXFELFdBQVcsQ0FBWCxDQUEvRCxDQUFuQjtBQUNBO0FBUlI7O0FBV0EsaUJBQVMsSUFBSSxNQUFKLENBQVc7QUFDaEIscUJBQVMsS0FETztBQUVoQixvQkFBUSxRQUFRLE9BRkE7QUFHaEIsa0NBSGdCO0FBSWhCO0FBSmdCLFNBQVgsQ0FBVDtBQU1IOztBQUVEO0FBQ0EsV0FBTztBQUNILG9CQURHO0FBRUg7QUFGRyxLQUFQO0FBSUgsQ0FqTEQ7O0FBbUxBLElBQU0sbUJBQW1CLFNBQW5CLGdCQUFtQixLQUFNO0FBQzNCLFFBQUksY0FBYyxDQUFsQjtBQUNBLFFBQU0sTUFBTSxHQUFHLGFBQUgsSUFBb0IsR0FBRyxRQUFuQztBQUNBLFFBQU0sTUFBTSxJQUFJLFdBQUosSUFBbUIsSUFBSSxZQUFuQztBQUNBLFFBQUksWUFBSjtBQUNBLFFBQUcsT0FBTyxJQUFJLFlBQVgsSUFBMkIsV0FBOUIsRUFBMkM7QUFDdkMsY0FBTSxJQUFJLFlBQUosRUFBTjtBQUNBLFlBQUcsSUFBSSxVQUFKLEdBQWlCLENBQXBCLEVBQXVCO0FBQ25CLGdCQUFNLFFBQVEsSUFBSSxZQUFKLEdBQW1CLFVBQW5CLENBQThCLENBQTlCLENBQWQ7QUFDQSxnQkFBTSxnQkFBZ0IsTUFBTSxVQUFOLEVBQXRCO0FBQ0EsMEJBQWMsa0JBQWQsQ0FBaUMsRUFBakM7QUFDQSwwQkFBYyxNQUFkLENBQXFCLE1BQU0sWUFBM0IsRUFBeUMsTUFBTSxTQUEvQztBQUNBLDBCQUFjLGNBQWMsUUFBZCxHQUF5QixNQUF2QztBQUNIO0FBQ0osS0FURCxNQVNPLElBQUcsQ0FBQyxNQUFNLElBQUksU0FBWCxLQUF5QixJQUFJLElBQUosSUFBWSxTQUF4QyxFQUFtRDtBQUN0RCxZQUFNLFlBQVksSUFBSSxXQUFKLEVBQWxCO0FBQ0EsWUFBTSxvQkFBb0IsSUFBSSxJQUFKLENBQVMsZUFBVCxFQUExQjtBQUNBLDBCQUFrQixpQkFBbEIsQ0FBb0MsRUFBcEM7QUFDQSwwQkFBa0IsV0FBbEIsQ0FBOEIsVUFBOUIsRUFBMEMsU0FBMUM7QUFDQSxzQkFBYyxrQkFBa0IsSUFBbEIsQ0FBdUIsTUFBckM7QUFDSDs7QUFFRCxXQUFPLFdBQVA7QUFDSCxDQXZCRDs7QUF5QkEsT0FBTyxPQUFQLEdBQWlCLE1BQWpCOzs7OztBQ2hOQSxJQUFNLFlBQVksUUFBUSxhQUFSLENBQWxCOztBQUVBLElBQU0sU0FBUztBQUNYLFVBQU0sdUJBQVc7QUFDYjtBQUNBLFlBQUksYUFBYSxRQUFRLE9BQVIsRUFBakI7QUFDQSxZQUFHLFFBQVEsUUFBUixJQUFvQixDQUFDLFNBQVMsYUFBVCxDQUF1QixRQUFRLFVBQVIsQ0FBbUIsR0FBMUMsQ0FBeEIsRUFBd0U7QUFDcEUseUJBQWEsSUFBSSxPQUFKLENBQVksbUJBQVc7QUFDaEMsb0JBQU0sU0FBUyxJQUFJLGNBQUosRUFBZjtBQUNBLHVCQUFPLElBQVAsQ0FBWSxLQUFaLEVBQW1CLFFBQVEsUUFBM0IsRUFBcUMsSUFBckM7QUFDQSx1QkFBTyxNQUFQLEdBQWdCLFlBQU07QUFDbEIsd0JBQU0sWUFBWSxTQUFTLGFBQVQsQ0FBdUIsS0FBdkIsQ0FBbEI7QUFDQSw4QkFBVSxTQUFWLENBQW9CLEdBQXBCLENBQXdCLFFBQVEsVUFBUixDQUFtQixHQUEzQztBQUNBLDhCQUFVLEtBQVYsQ0FBZ0IsT0FBaEIsR0FBMEIsTUFBMUI7QUFDQSw4QkFBVSxTQUFWLEdBQXNCLE9BQU8sWUFBN0I7QUFDQSw2QkFBUyxJQUFULENBQWMsV0FBZCxDQUEwQixTQUExQjtBQUNBO0FBQ0gsaUJBUEQ7QUFRQSx1QkFBTyxJQUFQO0FBQ0gsYUFaWSxDQUFiO0FBYUg7O0FBRUQsWUFBSSxvQkFBSjtBQUNBO0FBQ0EsWUFBRyxRQUFRLFVBQVIsSUFBc0IsT0FBekIsRUFDQTtBQUNJLGdCQUFNLE9BQU8sYUFBYSxPQUFiLENBQXFCLGlCQUFyQixDQUFiO0FBQ0EsMEJBQWMsUUFBUSxPQUFSLENBQWdCLElBQWhCLENBQWQ7QUFDQSxnQkFBRyxRQUFRLElBQVgsRUFBaUI7QUFDYiw4QkFBYyxJQUFJLE9BQUosQ0FBWSxtQkFBVztBQUNqQyx3QkFBTSxXQUFXLElBQUksY0FBSixFQUFqQjtBQUNBLDZCQUFTLElBQVQsQ0FBYyxLQUFkLEVBQXFCLFFBQVEsUUFBN0IsRUFBdUMsSUFBdkM7QUFDQSw2QkFBUyxrQkFBVCxHQUE4QixZQUFNO0FBQ2hDLDRCQUFHLFNBQVMsVUFBVCxJQUF1QixlQUFlLElBQXRDLElBQThDLFNBQVMsTUFBVCxJQUFtQixHQUFwRSxFQUF5RTtBQUNyRSxnQ0FBTSxRQUFPLEtBQUssS0FBTCxDQUFXLFNBQVMsWUFBcEIsQ0FBYjtBQUNBLHlDQUFhLE9BQWIsQ0FBcUIsaUJBQXJCLEVBQXVDLFNBQVMsWUFBaEQ7QUFDQSxvQ0FBUSxLQUFSO0FBQ0g7QUFDSixxQkFORDtBQU9BLDZCQUFTLElBQVQ7QUFDSCxpQkFYYSxDQUFkO0FBWUgsYUFiRCxNQWNJO0FBQ0EsOEJBQWMsSUFBSSxPQUFKLENBQVksbUJBQVc7QUFDakMsd0JBQU0sT0FBTyxLQUFLLEtBQUwsQ0FBVyxhQUFhLE9BQWIsQ0FBcUIsaUJBQXJCLENBQVgsQ0FBYjtBQUNBLDRCQUFRLElBQVI7QUFDSCxpQkFIYSxDQUFkO0FBSUg7QUFDSixTQXhCRCxNQXlCSyxJQUFHLFFBQVEsVUFBUixJQUFzQixNQUF6QixFQUFnQztBQUNqQztBQUNBO0FBQ0E7QUFDSSwwQkFBYyxJQUFJLE9BQUosQ0FBWSxtQkFBVztBQUNqQyxvQkFBTSxXQUFXLElBQUksY0FBSixFQUFqQjtBQUNBLHlCQUFTLElBQVQsQ0FBYyxLQUFkLEVBQXFCLFFBQVEsUUFBN0IsRUFBdUMsSUFBdkM7QUFDQSx5QkFBUyxrQkFBVCxHQUE4QixZQUFNO0FBQ2hDLHdCQUFHLFNBQVMsVUFBVCxJQUF1QixlQUFlLElBQXRDLElBQThDLFNBQVMsTUFBVCxJQUFtQixHQUFwRSxFQUF5RTtBQUNyRSw0QkFBTSxTQUFPLEtBQUssS0FBTCxDQUFXLFNBQVMsWUFBcEIsQ0FBYjtBQUNBO0FBQ0EsZ0NBQVEsTUFBUjtBQUNIO0FBQ0osaUJBTkQ7QUFPQSx5QkFBUyxJQUFUO0FBQ0gsYUFYYSxDQUFkO0FBWUo7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDSDs7QUFFRCxlQUFPLFFBQVEsR0FBUixDQUFZLENBQUUsVUFBRixFQUFjLFdBQWQsQ0FBWixDQUFQO0FBQ0gsS0F6RVU7QUEwRVgsY0FBVSxrQkFBQyxZQUFELEVBQWUsT0FBZixFQUF3QixPQUF4QixFQUFpQyxTQUFqQyxFQUE0QyxTQUE1QyxFQUEyRDtBQUNqRSxZQUFHLFFBQVEsVUFBUixJQUFzQixPQUF6QixFQUFpQzs7QUFFN0IsZ0JBQUcsUUFBUSxRQUFYLEVBQXFCO0FBQ2pCLG9CQUFHLFNBQVMsYUFBVCxPQUEyQixRQUFRLFVBQVIsQ0FBbUIsR0FBOUMsY0FBMEQsYUFBYSxPQUF2RSxPQUFILEVBQXVGO0FBQ25GLDJFQUFxRCxhQUFhLE9BQWxFO0FBQ0g7QUFDSjtBQUNELG1CQUFPLGFBQWEsSUFBcEI7QUFDQTtBQUNILFNBVEQsTUFVSyxJQUFHLFFBQVEsVUFBUixJQUFzQixNQUF6QixFQUNMO0FBQ0ksZ0JBQUcsYUFBYSxPQUFoQixFQUF5QjtBQUNyQix1QkFBTyxjQUFZLE9BQVosR0FBb0IsYUFBYSxRQUFqQyxHQUEwQyxHQUFqRDtBQUNILGFBRkQsTUFJQTtBQUNJLHVCQUFPLGVBQWEsU0FBYixHQUF1QixHQUF2QixHQUEyQixhQUFhLFVBQXhDLEdBQW1ELFFBQTFEO0FBQ0g7QUFHSjtBQUNKLEtBakdVO0FBa0dYLGtCQUFjLHNCQUFDLFlBQUQsRUFBZSxPQUFmLEVBQXdCLElBQXhCLEVBQStCLE9BQS9CLEVBQXdDLFNBQXhDLEVBQW1ELFNBQW5ELEVBQWlFOztBQUUzRSxZQUFNLFNBQVMsU0FBUyxhQUFULENBQXVCLFFBQXZCLENBQWY7QUFDQSxlQUFPLFlBQVAsQ0FBb0IsTUFBcEIsRUFBNEIsUUFBNUI7O0FBRUEsWUFBRyxRQUFRLFVBQVIsSUFBc0IsT0FBekIsRUFBaUM7O0FBRTdCLGdCQUFHLGFBQWEsV0FBYixJQUE0QixRQUFRLFdBQXZDLEVBQW9EO0FBQ2hEO0FBQ0EsdUJBQU8sSUFBUCxDQUFZLFNBQVosRUFBdUIsT0FBdkIsQ0FBK0I7QUFBQSwyQkFBSyxhQUFhLE9BQWIsR0FBdUIsYUFBYSxPQUFiLENBQXFCLE9BQXJCLENBQTZCLFVBQVUsQ0FBVixFQUFhLE9BQTFDLEVBQW1ELEVBQW5ELENBQTVCO0FBQUEsaUJBQS9CO0FBQ0EsdUJBQU8sSUFBUCxDQUFZLFNBQVosRUFBdUIsT0FBdkIsQ0FBK0I7QUFBQSwyQkFBSyxhQUFhLElBQWIsR0FBb0IsYUFBYSxJQUFiLENBQWtCLE9BQWxCLENBQTBCLFVBQVUsQ0FBVixFQUFhLElBQXZDLEVBQTZDLEVBQTdDLENBQXpCO0FBQUEsaUJBQS9COztBQUVBO0FBQ0EsNkJBQWEsT0FBYixJQUF3QixVQUFVLFFBQVEsV0FBbEIsRUFBK0IsT0FBdkQ7QUFDQSw2QkFBYSxJQUFiLElBQXFCLFVBQVUsUUFBUSxXQUFsQixFQUErQixJQUFwRDtBQUNIOztBQUVELG1CQUFPLFNBQVAsR0FBbUIsT0FBTyxRQUFQLENBQWdCLFlBQWhCLEVBQThCLE9BQTlCLENBQW5CO0FBQ0EsbUJBQU8sU0FBUCxDQUFpQixHQUFqQixDQUFxQixPQUFyQjtBQUNBLG1CQUFPLE9BQVAsQ0FBZSxPQUFmLEdBQXlCLGFBQWEsT0FBdEM7QUFDQSxtQkFBTyxPQUFQLENBQWUsSUFBZixHQUFzQixhQUFhLElBQW5DO0FBQ0EsbUJBQU8sT0FBUCxDQUFlLFFBQWYsR0FBMEIsYUFBYSxRQUF2QztBQUNBLG1CQUFPLE9BQVAsQ0FBZSxJQUFmLEdBQXNCLGFBQWEsSUFBbkM7QUFDQSxtQkFBTyxLQUFQLEdBQWUsYUFBYSxJQUE1QjtBQUNBLGdCQUFHLGFBQWEsV0FBaEIsRUFBNkI7QUFDekIsdUJBQU8sT0FBUCxDQUFlLFdBQWYsR0FBNkIsYUFBYSxXQUExQztBQUNIO0FBQ0QsZ0JBQUcsSUFBSCxFQUFTO0FBQ0wsdUJBQU8sZ0JBQVAsQ0FBd0IsT0FBeEIsRUFBaUMsWUFBTTtBQUNuQyx5QkFBSyxRQUFMLEVBQWUsWUFBZjs7QUFFQSx3QkFBRyxRQUFRLFFBQVgsRUFBcUI7QUFDakIsK0JBQU8sS0FBUCxDQUFhLFlBQWIsRUFBMkIsT0FBM0I7QUFDSDtBQUNKLGlCQU5EO0FBT0g7QUFDSixTQS9CRCxNQWdDSyxJQUFHLFFBQVEsVUFBUixJQUFzQixNQUF6QixFQUFnQzs7QUFFakMsbUJBQU8sU0FBUCxHQUFtQixPQUFPLFFBQVAsQ0FBZ0IsWUFBaEIsRUFBOEIsT0FBOUIsRUFBdUMsT0FBdkMsRUFBZ0QsU0FBaEQsRUFBMkQsU0FBM0QsQ0FBbkI7QUFDQSxtQkFBTyxTQUFQLENBQWlCLEdBQWpCLENBQXFCLFdBQXJCO0FBQ0EsbUJBQU8sT0FBUCxDQUFlLElBQWYsR0FBc0IsYUFBYSxJQUFuQzs7QUFFQSxnQkFBRyxJQUFILEVBQVM7QUFDTCx1QkFBTyxnQkFBUCxDQUF3QixPQUF4QixFQUFpQyxZQUFNO0FBQ25DLHlCQUFLLFFBQUwsRUFBZSxZQUFmOztBQUVBLHdCQUFHLFFBQVEsUUFBWCxFQUFxQjtBQUNqQiwrQkFBTyxLQUFQLENBQWEsWUFBYixFQUEyQixPQUEzQjtBQUNIO0FBQ0osaUJBTkQ7QUFPSDtBQUNKO0FBQ0QsZUFBTyxNQUFQO0FBQ0gsS0F4SlU7QUF5SlgsV0FBTyxlQUFDLFlBQUQsRUFBZSxPQUFmLEVBQTJCO0FBQzlCLFlBQU0sUUFBUSxRQUFRLFFBQXRCO0FBQ0EsWUFBRyxDQUFDLEtBQUosRUFBVztBQUNQO0FBQ0g7QUFDRCxZQUFHLFFBQVEsVUFBUixJQUFzQixPQUF6QixFQUFpQzs7QUFFN0I7QUFDQSxnQkFBSSxTQUFTLE1BQU0sV0FBTixDQUFrQixNQUEvQjtBQUNBLGdCQUFHLE1BQU0sT0FBTixDQUFjLE1BQWpCLEVBQXlCO0FBQ3JCO0FBQ0EseUJBQVMsTUFBTSxPQUFOLENBQWMsTUFBdkI7QUFDSDs7QUFFRDtBQUNBLGdCQUFNLGNBQWMsTUFBTSxVQUFOLENBQWlCLGFBQWpCLENBQStCLDBCQUEvQixDQUFwQjtBQUNBLGdCQUFNLE1BQU0sMENBQTBDLE1BQU0sT0FBaEQsR0FBMEQsTUFBdEU7QUFDQSxnQkFBTSxRQUFRLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFkO0FBQ0Esa0JBQU0sU0FBTixDQUFnQixHQUFoQixDQUFvQiw0QkFBcEI7QUFDQSxrQkFBTSxZQUFOLENBQW1CLEtBQW5CLEVBQTBCLEdBQTFCO0FBQ0Esa0JBQU0sWUFBTixDQUFtQixXQUFuQixFQUFnQyxLQUFoQztBQUNBLHdCQUFZLFdBQVosQ0FBd0IsS0FBeEI7O0FBRUEsZ0JBQU0sT0FBTyxTQUFTLGFBQVQsQ0FBdUIsTUFBdkIsQ0FBYjtBQUNBLGlCQUFLLFNBQUwsQ0FBZSxHQUFmLENBQW1CLDRCQUFuQjtBQUNBLGlCQUFLLFlBQUwsQ0FBa0IsT0FBbEIsRUFBMkIsTUFBTSxJQUFqQztBQUNBLGlCQUFLLFlBQUwsQ0FBa0IsWUFBbEIsRUFBZ0MsTUFBTSxJQUF0QztBQUNBLGlCQUFLLE9BQUwsQ0FBYSxjQUFiLEdBQThCLE1BQU0sSUFBcEM7QUFDQSxpQkFBSyxPQUFMLENBQWEsZUFBYixHQUErQixHQUEvQjtBQUNBLGlCQUFLLFNBQUwsR0FBaUIsUUFBakI7O0FBRUE7QUFDQSxnQkFBTSxNQUFNLE1BQU0sYUFBTixDQUFvQixLQUFwQixDQUFaO0FBQ0EsZ0JBQUcsSUFBSSxTQUFKLElBQWlCLE1BQXBCLEVBQTRCO0FBQ3hCLG9CQUFJLFNBQUosR0FBZ0IsRUFBaEI7QUFDSDs7QUFFRDtBQUNBLGdCQUFNLFFBQVEsSUFBSSxnQkFBSixDQUFxQiw2QkFBckIsQ0FBZDtBQUNBLGVBQUcsT0FBSCxDQUFXLElBQVgsQ0FBZ0IsS0FBaEIsRUFBdUIsZ0JBQVE7QUFDM0Isb0JBQUksWUFBSixDQUFpQixTQUFTLGNBQVQsQ0FBd0IsS0FBSyxPQUFMLENBQWEsY0FBckMsQ0FBakIsRUFBdUUsSUFBdkU7QUFDSCxhQUZEOztBQUlBO0FBQ0EsZ0JBQUksVUFBVSxXQUFXLEtBQVgsQ0FBaUIsSUFBSSxXQUFyQixDQUFkO0FBQ0Esb0JBQVEsTUFBUixDQUFlLE1BQWYsRUFBdUIsQ0FBdkIsRUFBMEIsTUFBTSxJQUFoQztBQUNBLHNCQUFVLFFBQVEsSUFBUixDQUFhLEVBQWIsQ0FBVjs7QUFFQSxnQkFBSSxXQUFKLEdBQWtCLE9BQWxCOztBQUVBO0FBQ0EsZ0JBQU0sUUFBUSxTQUFTLFdBQVQsQ0FBcUIsWUFBckIsQ0FBZDtBQUNBLGtCQUFNLFNBQU4sQ0FBZ0IsV0FBaEIsRUFBNkIsS0FBN0IsRUFBb0MsSUFBcEM7QUFDQSxrQkFBTSxhQUFOLENBQW9CLEtBQXBCOztBQUVBO0FBQ0Esa0JBQU0sT0FBTixDQUFjLE1BQWQsR0FBdUIsU0FBUyxNQUFNLE9BQU4sQ0FBYyxNQUF2QixFQUErQixFQUEvQixJQUFxQyxDQUE1RDs7QUFFQSxnQkFBRyxRQUFRLFFBQVIsSUFBb0IsSUFBdkIsRUFBNkI7QUFDekIseUJBQVMsR0FBVCxDQUFhLEtBQWIsRUFBb0IsT0FBTyxZQUEzQjtBQUNIO0FBQ0osU0F4REQsTUF5REssSUFBRyxRQUFRLFVBQVIsSUFBc0IsTUFBekIsRUFBZ0MsQ0FFcEM7QUFDSjtBQTFOVSxDQUFmOztBQTZOQSxPQUFPLE9BQVAsR0FBaUIsTUFBakI7Ozs7Ozs7Ozs7Ozs7Ozs7O2VDL055QixRQUFRLFdBQVIsQztJQUFqQixZLFlBQUEsWTs7QUFFUixJQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7QUFDQSxJQUFNLFNBQVMsUUFBUSxVQUFSLENBQWY7QUFDQSxJQUFNLE9BQU8sUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNLGFBQWEsUUFBUSxjQUFSLENBQW5COztBQUVBLElBQU0sV0FBVztBQUNiLFlBQVEsSUFESztBQUViLGNBQVUsSUFGRztBQUdiLGlCQUFhLEdBSEE7QUFJYix1QkFBbUIsRUFKTjtBQUtiLGNBQVUsSUFMRztBQU1iO0FBQ0E7QUFDQSxnQkFBWSxNQVJDO0FBU2IsY0FBVSxlQVRHO0FBVWIsWUFBUSxJQVZLO0FBV2IsZUFBVyxRQVhFO0FBWWIsaUJBQWEsS0FaQTs7QUFjYixZQUFRO0FBQ0osYUFBSyxXQUREO0FBRUosZUFBTyxZQUZIO0FBR0osa0JBQVUsaUJBSE47QUFJSixpQkFBUyxZQUpMO0FBS0osb0JBQVksWUFMUjtBQU1KLGdCQUFRLFFBTko7QUFPSix3QkFBZ0I7QUFQWixLQWRLO0FBdUJiLFdBQU87QUFDSCxnQkFBUTtBQURMLEtBdkJNO0FBMEJiO0FBMUJhLENBQWpCOztJQTZCcUIsVTs7O0FBQ2pCLHdCQUFZLE9BQVosRUFBcUI7QUFBQTs7QUFBQTs7QUFHakIsY0FBSyxPQUFMLEdBQWUsT0FBTyxNQUFQLENBQWMsRUFBZCxFQUFrQixRQUFsQixFQUE0QixPQUE1QixDQUFmOztBQUVBLFlBQU0sTUFBTSxDQUFDLFdBQUQsRUFBYyxTQUFkLEVBQXlCLFVBQXpCLENBQVo7QUFDQSxZQUFJLE9BQUosQ0FBWSxjQUFNO0FBQ2QsZ0JBQUcsT0FBTyxNQUFLLE9BQUwsQ0FBYSxFQUFiLENBQVAsSUFBMkIsUUFBOUIsRUFBd0M7QUFDcEMsc0JBQUssT0FBTCxDQUFhLEVBQWIsSUFBbUIsU0FBUyxhQUFULENBQXVCLE1BQUssT0FBTCxDQUFhLEVBQWIsQ0FBdkIsQ0FBbkI7QUFDSDtBQUNKLFNBSkQ7O0FBTUEsWUFBTSxTQUFTLE9BQU8sTUFBSyxPQUFaLEVBQXFCLE1BQUssSUFBTCxDQUFVLElBQVYsT0FBckIsRUFBMkMsTUFBSyxNQUFMLENBQVksSUFBWixPQUEzQyxDQUFmO0FBQ0EsY0FBSyxLQUFMLEdBQWEsT0FBTyxLQUFwQjtBQUNBLGNBQUssTUFBTCxHQUFjLE9BQU8sTUFBckI7O0FBRUEsZUFBTyxJQUFQLENBQVksTUFBSyxPQUFqQixFQUNLLElBREwsQ0FDVSxlQUFPO0FBQ1QsaUJBQUssTUFBSyxPQUFWLEVBQW1CLE1BQUssS0FBeEIsRUFBK0IsSUFBSSxDQUFKLENBQS9CLEVBQXVDLE1BQUssSUFBTCxDQUFVLElBQVYsT0FBdkM7QUFDSCxTQUhMO0FBaEJpQjtBQW9CcEI7Ozs7aUNBRVE7QUFDTCxnQkFBTSxPQUFPLEtBQUssS0FBTCxDQUFXLFNBQVgsQ0FBcUIsTUFBckIsQ0FBNEIsS0FBSyxPQUFMLENBQWEsVUFBYixDQUF3QixJQUFwRCxDQUFiO0FBQ0EsZ0JBQU0sY0FBYyxLQUFLLEtBQUwsQ0FBVyxhQUFYLENBQXlCLE1BQU0sS0FBSyxPQUFMLENBQWEsVUFBYixDQUF3QixXQUF2RCxDQUFwQjs7QUFFQSxpQkFBSyxJQUFMLENBQVUsUUFBVixFQUFvQixJQUFwQjtBQUNBLGdCQUFHLFFBQVEsS0FBSyxPQUFMLENBQWEsTUFBckIsSUFBK0IsV0FBbEMsRUFBK0M7QUFDM0MsNEJBQVksS0FBWjtBQUNIO0FBQ0o7OztxQ0FFWTtBQUNULGdCQUFHLEtBQUssTUFBUixFQUFnQjtBQUNaLHFCQUFLLE1BQUwsQ0FBWSxRQUFaO0FBQ0g7QUFDSjs7OztFQXJDbUMsWTs7a0JBQW5CLFU7OztBQXdDckIsSUFBRyxPQUFPLE1BQVAsSUFBaUIsV0FBcEIsRUFBaUM7QUFDN0IsV0FBTyxVQUFQLEdBQW9CLFVBQXBCO0FBQ0g7Ozs7O0FDOUVELElBQU0sU0FBUyxRQUFRLFVBQVIsQ0FBZjtBQUNBLElBQU0sWUFBWSxRQUFRLGFBQVIsQ0FBbEI7O0FBRUEsSUFBTSxPQUFPLFNBQVAsSUFBTyxDQUFDLE9BQUQsRUFBVSxLQUFWLEVBQWlCLElBQWpCLEVBQXVCLElBQXZCLEVBQWdDO0FBQ3pDLFFBQU0sYUFBYSxNQUFNLGFBQU4sQ0FBb0IsTUFBTSxRQUFRLFVBQVIsQ0FBbUIsVUFBN0MsQ0FBbkI7QUFDQSxRQUFNLGNBQWMsTUFBTSxhQUFOLENBQW9CLE1BQU0sUUFBUSxVQUFSLENBQW1CLFdBQTdDLENBQXBCO0FBQ0EsUUFBTSxjQUFjLE1BQU0sYUFBTixDQUFvQixNQUFNLFFBQVEsVUFBUixDQUFtQixXQUE3QyxDQUFwQjtBQUNBLFFBQU0sZ0JBQWdCLE1BQU0sYUFBTixDQUFvQixNQUFNLFFBQVEsVUFBUixDQUFtQixhQUE3QyxDQUF0QjtBQUNBLFFBQU0sVUFBVSxNQUFNLGFBQU4sQ0FBb0IsTUFBTSxRQUFRLFVBQVIsQ0FBbUIsT0FBN0MsQ0FBaEI7QUFDQSxRQUFNLGFBQWEsTUFBTSxhQUFOLENBQW9CLE1BQU0sUUFBUSxVQUFSLENBQW1CLFNBQTdDLENBQW5CO0FBQ0EsUUFBTSxTQUFTLE1BQU0sYUFBTixDQUFvQixNQUFNLFFBQVEsVUFBUixDQUFtQixNQUE3QyxDQUFmOztBQUVBO0FBQ0EsV0FBTyxXQUFXLFVBQWxCLEVBQThCO0FBQzFCLG1CQUFXLFdBQVgsQ0FBdUIsV0FBVyxVQUFsQztBQUNIO0FBQ0QsV0FBTyxJQUFQLENBQVksSUFBWixFQUFrQixPQUFsQixDQUEwQixhQUFLO0FBQzNCLFlBQU0sV0FBVyxLQUFLLENBQUwsQ0FBakI7O0FBRUE7QUFDQSxZQUFHLFFBQVEsaUJBQVIsQ0FBMEIsT0FBMUIsQ0FBa0MsU0FBUyxJQUEzQyxJQUFtRCxDQUFDLENBQXZELEVBQTBEO0FBQ3REO0FBQ0g7O0FBRUQsWUFBTSxlQUFlLFNBQVMsYUFBVCxDQUF1QixRQUF2QixDQUFyQjs7QUFFQSxxQkFBYSxZQUFiLENBQTBCLE9BQTFCLEVBQW1DLFNBQVMsSUFBNUM7QUFDQSxZQUFHLFFBQVEsVUFBUixJQUFzQixPQUF6QixFQUNBO0FBQ0kseUJBQWEsU0FBYixDQUF1QixHQUF2QixDQUEyQixRQUFRLFVBQVIsQ0FBbUIsS0FBOUM7QUFDQSx5QkFBYSxTQUFiLEdBQXlCLE9BQU8sUUFBUCxDQUFnQixTQUFTLElBQXpCLEVBQStCLE9BQS9CLENBQXpCO0FBQ0gsU0FKRCxNQUtLLElBQUcsUUFBUSxVQUFSLElBQXNCLE1BQXpCLEVBQ0w7QUFDSSx5QkFBYSxTQUFiLENBQXVCLEdBQXZCLENBQTJCLGNBQTNCO0FBQ0EseUJBQWEsU0FBYixHQUF5QixPQUFPLFFBQVAsQ0FBZ0IsU0FBUyxTQUF6QixFQUFvQyxPQUFwQyxFQUE2QyxTQUFTLFFBQXRELEVBQWdFLFNBQVMsVUFBekUsRUFBc0YsU0FBUyxVQUEvRixDQUF6QjtBQUNIOztBQUVELHFCQUFhLGdCQUFiLENBQThCLE9BQTlCLEVBQXVDLGFBQUs7QUFDeEMsZ0JBQUksZ0JBQWlCLFNBQVMsSUFBVCxDQUFjLE9BQWQsQ0FBc0IsS0FBdEIsRUFBNEIsR0FBNUIsQ0FBckI7QUFDQSxnQkFBTSxRQUFRLFFBQVEsU0FBUixDQUFrQixhQUFsQixDQUFnQyxNQUFNLGFBQXRDLENBQWQ7QUFDQSxnQkFBRyxRQUFRLFdBQVIsSUFBdUIsS0FBMUIsRUFBaUM7QUFDN0IsMEJBQVUsYUFBVjtBQUNILGFBRkQsTUFHSztBQUNELHlCQUFTLE9BQVQsRUFBbUIsTUFBTSxTQUFOLEdBQWtCLFFBQVEsU0FBN0MsRUFBeUQsR0FBekQ7QUFDSDtBQUVKLFNBVkQ7QUFXQSxtQkFBVyxXQUFYLENBQXVCLFlBQXZCO0FBQ0gsS0FsQ0Q7O0FBb0NBLGFBQVMsU0FBVCxDQUFtQixVQUFuQixFQUNBO0FBQ0ksWUFBSSxZQUFZLE1BQU0sYUFBTixDQUFvQixNQUFNLFFBQVEsVUFBUixDQUFtQixTQUE3QyxDQUFoQjtBQUNBLGtCQUFVLFNBQVYsQ0FBb0IsTUFBcEIsQ0FBMkIsUUFBUSxVQUFSLENBQW1CLFNBQTlDO0FBQ0EsWUFBSSxZQUFZLE1BQU0sYUFBTixDQUFvQixXQUFXLFVBQS9CLENBQWhCO0FBQ0EsZ0JBQVEsR0FBUixDQUFZLFdBQVcsVUFBdkI7QUFDQSxrQkFBVSxTQUFWLENBQW9CLEdBQXBCLENBQXdCLFFBQVEsVUFBUixDQUFtQixTQUEzQztBQUNIO0FBQ0Q7QUFDQSxhQUFTLFFBQVQsQ0FBa0IsT0FBbEIsRUFBMkIsRUFBM0IsRUFBK0IsUUFBL0IsRUFBeUM7QUFDckMsWUFBSSxRQUFRLFFBQVEsU0FBcEI7QUFBQSxZQUNJLFNBQVMsS0FBSyxLQURsQjtBQUFBLFlBRUksY0FBYyxDQUZsQjtBQUFBLFlBR0ksWUFBWSxFQUhoQjs7QUFLQSxZQUFJLGdCQUFnQixTQUFoQixhQUFnQixHQUFVO0FBQzFCLDJCQUFlLFNBQWY7QUFDQSxnQkFBSSxNQUFNLEtBQUssYUFBTCxDQUFtQixXQUFuQixFQUFnQyxLQUFoQyxFQUF1QyxNQUF2QyxFQUErQyxRQUEvQyxDQUFWO0FBQ0Esb0JBQVEsU0FBUixHQUFvQixHQUFwQjtBQUNBLGdCQUFHLGNBQWMsUUFBakIsRUFBMkI7QUFDdkIsMkJBQVcsYUFBWCxFQUEwQixTQUExQjtBQUNIO0FBQ0osU0FQRDtBQVFBO0FBQ0g7O0FBRUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFLLGFBQUwsR0FBcUIsVUFBVSxDQUFWLEVBQWEsQ0FBYixFQUFnQixDQUFoQixFQUFtQixDQUFuQixFQUFzQjtBQUN6QyxhQUFLLElBQUUsQ0FBUDtBQUNFLFlBQUksSUFBSSxDQUFSLEVBQVcsT0FBTyxJQUFFLENBQUYsR0FBSSxDQUFKLEdBQU0sQ0FBTixHQUFVLENBQWpCO0FBQ1g7QUFDQSxlQUFPLENBQUMsQ0FBRCxHQUFHLENBQUgsSUFBUSxLQUFHLElBQUUsQ0FBTCxJQUFVLENBQWxCLElBQXVCLENBQTlCO0FBQ0gsS0FMRDs7QUFPQTtBQUNBLFFBQUcsUUFBUSxNQUFSLElBQWtCLElBQXJCLEVBQTJCOztBQUV2QixvQkFBWSxnQkFBWixDQUE2QixPQUE3QixFQUFzQyxhQUFLO0FBQ3ZDLGdCQUFJLGVBQUo7QUFBQSxnQkFBYyxjQUFkO0FBQ0EsZ0JBQUcsUUFBUSxVQUFSLElBQXNCLE9BQXpCLEVBQ0E7QUFDSSx5QkFBUyxRQUFRLGdCQUFSLENBQXlCLE1BQU0sUUFBUSxVQUFSLENBQW1CLEtBQWxELENBQVQ7QUFDSCxhQUhELE1BSUssSUFBRyxRQUFRLFVBQVIsSUFBc0IsTUFBekIsRUFDTDtBQUNJLHdCQUFRLFFBQVEsZ0JBQVIsQ0FBeUIsTUFBTSxRQUFRLFVBQVIsQ0FBbUIsS0FBbEQsQ0FBUjtBQUNIOztBQUVELGdCQUFNLFNBQVMsUUFBUSxnQkFBUixDQUF5QixNQUFNLFFBQVEsVUFBUixDQUFtQixRQUFsRCxDQUFmOztBQUVBLGdCQUFJLGVBQWUsYUFBYSxPQUFiLENBQXFCLHFCQUFyQixDQUFuQjtBQUNBLGdCQUFHLFlBQUgsRUFBaUI7QUFDYiwrQkFBZSxLQUFLLEtBQUwsQ0FBVyxZQUFYLENBQWY7QUFDSCxhQUZELE1BRU87QUFDSCwrQkFBZSxFQUFmO0FBQ0g7O0FBRUQsZ0JBQU0sUUFBUSxFQUFFLE1BQUYsQ0FBUyxLQUFULENBQWUsT0FBZixDQUF1QixJQUF2QixFQUE2QixFQUE3QixFQUFpQyxXQUFqQyxFQUFkO0FBQ0EsZ0JBQUcsTUFBTSxNQUFOLEdBQWUsQ0FBbEIsRUFBcUI7QUFDakIsb0JBQU0sVUFBVSxFQUFoQjtBQUNBLHVCQUFPLElBQVAsQ0FBWSxJQUFaLEVBQWtCLE9BQWxCLENBQTBCLGFBQUs7QUFDM0Isd0JBQU0sV0FBVyxLQUFLLENBQUwsQ0FBakI7QUFDQSx3QkFBRyxRQUFRLFVBQVIsSUFBc0IsT0FBekIsRUFDQTtBQUNJLGlDQUFTLE1BQVQsQ0FBZ0IsT0FBaEIsQ0FBd0IsaUJBQVM7QUFDN0IsZ0NBQU0sZUFBZSxNQUFNLFFBQU4sQ0FBZSxJQUFmLENBQW9CLG1CQUFXO0FBQ2hELDBDQUFVLFFBQVEsT0FBUixDQUFnQixJQUFoQixFQUFzQixFQUF0QixFQUEwQixXQUExQixFQUFWO0FBQ0EsdUNBQU8sUUFBUSxPQUFSLENBQWdCLEtBQWhCLElBQXlCLENBQUMsQ0FBakM7QUFDSCw2QkFIb0IsQ0FBckI7QUFJQSxnQ0FBRyxZQUFILEVBQWlCO0FBQ2Isd0NBQVEsSUFBUixDQUFhLE1BQU0sT0FBbkI7QUFDSDtBQUNKLHlCQVJEO0FBU0gscUJBWEQsTUFZSyxJQUFHLFFBQVEsVUFBUixJQUFzQixNQUF6QixFQUNMO0FBQ0ksaUNBQVMsS0FBVCxDQUFlLE9BQWYsQ0FBdUIsZ0JBQVE7QUFDM0IsZ0NBQU0sZUFBZSxLQUFLLFFBQUwsQ0FBYyxJQUFkLENBQW1CLG1CQUFXO0FBQy9DLDBDQUFVLFFBQVEsT0FBUixDQUFnQixJQUFoQixFQUFzQixFQUF0QixFQUEwQixXQUExQixFQUFWO0FBQ0EsdUNBQU8sUUFBUSxPQUFSLENBQWdCLEtBQWhCLElBQXlCLENBQUMsQ0FBakM7QUFDSCw2QkFIb0IsQ0FBckI7QUFJQSxnQ0FBRyxZQUFILEVBQWlCO0FBQ2Isd0NBQVEsSUFBUixDQUFhLEtBQUssSUFBbEI7QUFDSDtBQUNKLHlCQVJEO0FBU0g7QUFDSixpQkExQkQ7QUEyQkEsb0JBQUcsUUFBUSxNQUFSLElBQWtCLENBQXJCLEVBQXdCO0FBQ3BCLCtCQUFXLEtBQVgsQ0FBaUIsT0FBakIsR0FBMkIsT0FBM0I7QUFDSCxpQkFGRCxNQUVPO0FBQ0gsK0JBQVcsS0FBWCxDQUFpQixPQUFqQixHQUEyQixNQUEzQjtBQUNIOztBQUVELHFCQUFLLFFBQUwsRUFBZSxFQUFFLFlBQUYsRUFBUyxnQkFBVCxFQUFmOztBQUVBLG9CQUFHLFFBQVEsVUFBUixJQUFzQixPQUF6QixFQUFpQztBQUM3Qix1QkFBRyxPQUFILENBQVcsSUFBWCxDQUFnQixNQUFoQixFQUF3QixpQkFBUztBQUM3Qiw0QkFBRyxRQUFRLE9BQVIsQ0FBZ0IsTUFBTSxPQUFOLENBQWMsT0FBOUIsS0FBMEMsQ0FBQyxDQUE5QyxFQUFpRDtBQUM3QyxrQ0FBTSxLQUFOLENBQVksT0FBWixHQUFzQixNQUF0QjtBQUNILHlCQUZELE1BRU87QUFDSCxrQ0FBTSxLQUFOLENBQVksT0FBWixHQUFzQixjQUF0QjtBQUNIO0FBQ0oscUJBTkQ7QUFPSCxpQkFSRCxNQVNLLElBQUcsUUFBUSxVQUFSLElBQXNCLE1BQXpCLEVBQWdDO0FBQ2pDLHVCQUFHLE9BQUgsQ0FBVyxJQUFYLENBQWdCLEtBQWhCLEVBQXVCLGdCQUFRO0FBQzNCLDRCQUFHLFFBQVEsT0FBUixDQUFnQixLQUFLLE9BQUwsQ0FBYSxJQUE3QixLQUFzQyxDQUFDLENBQTFDLEVBQTZDO0FBQ3pDLGlDQUFLLEtBQUwsQ0FBVyxPQUFYLEdBQXFCLE1BQXJCO0FBQ0gseUJBRkQsTUFFTztBQUNILGlDQUFLLEtBQUwsQ0FBVyxPQUFYLEdBQXFCLGNBQXJCO0FBQ0g7QUFDSixxQkFORDtBQU9IOztBQUVELG1CQUFHLE9BQUgsQ0FBVyxJQUFYLENBQWdCLE1BQWhCLEVBQXdCLGlCQUFTO0FBQzdCLDBCQUFNLEtBQU4sQ0FBWSxPQUFaLEdBQXNCLE1BQXRCO0FBQ0gsaUJBRkQ7QUFHQSw0QkFBWSxLQUFaLENBQWtCLE9BQWxCLEdBQTRCLE9BQTVCOztBQUVBLG9CQUFHLFFBQVEsUUFBUixJQUFvQixJQUF2QixFQUE2QjtBQUN6QixrQ0FBYyxLQUFkLENBQW9CLE9BQXBCLEdBQThCLE1BQTlCO0FBQ0g7QUFDSixhQWhFRCxNQWdFTztBQUNILG9CQUFJLFVBQVMsUUFBUSxnQkFBUixDQUF5QixNQUFNLFFBQVEsVUFBUixDQUFtQixLQUFsRCxDQUFiO0FBQ0Esb0JBQUksU0FBUSxRQUFRLGdCQUFSLENBQXlCLE1BQU0sUUFBUSxVQUFSLENBQW1CLEtBQWxELENBQVo7O0FBRUEsb0JBQUcsUUFBUSxVQUFSLElBQXNCLE9BQXpCLEVBQWlDO0FBQzdCLHVCQUFHLE9BQUgsQ0FBVyxJQUFYLENBQWdCLE9BQWhCLEVBQXdCLGlCQUFTO0FBQzdCLDhCQUFNLEtBQU4sQ0FBWSxPQUFaLEdBQXNCLGNBQXRCO0FBQ0gscUJBRkQ7QUFHSCxpQkFKRCxNQUtLLElBQUcsUUFBUSxVQUFSLElBQXNCLE1BQXpCLEVBQWdDO0FBQ2pDLHVCQUFHLE9BQUgsQ0FBVyxJQUFYLENBQWdCLE1BQWhCLEVBQXVCLGdCQUFRO0FBQzNCLDZCQUFLLEtBQUwsQ0FBVyxPQUFYLEdBQXFCLGNBQXJCO0FBQ0gscUJBRkQ7QUFHSDtBQUNELG1CQUFHLE9BQUgsQ0FBVyxJQUFYLENBQWdCLE1BQWhCLEVBQXdCLGlCQUFTO0FBQzdCLDBCQUFNLEtBQU4sQ0FBWSxPQUFaLEdBQXNCLE9BQXRCO0FBQ0gsaUJBRkQ7QUFHQSw0QkFBWSxLQUFaLENBQWtCLE9BQWxCLEdBQTRCLE1BQTVCO0FBQ0EsMkJBQVcsS0FBWCxDQUFpQixPQUFqQixHQUEyQixNQUEzQjs7QUFFQSxvQkFBRyxRQUFRLFFBQVIsSUFBb0IsSUFBdkIsRUFBNkI7QUFDekIsd0JBQUcsYUFBYSxNQUFiLEdBQXNCLENBQXpCLEVBQTRCO0FBQ3hCLHNDQUFjLEtBQWQsQ0FBb0IsT0FBcEIsR0FBOEIsT0FBOUI7QUFDSCxxQkFGRCxNQUVPO0FBQ0gsc0NBQWMsS0FBZCxDQUFvQixPQUFwQixHQUE4QixNQUE5QjtBQUNIO0FBQ0o7QUFDSjtBQUNKLFNBakhEO0FBa0hIOztBQUVEO0FBQ0EsV0FBTyxRQUFRLFVBQWYsRUFBMkI7QUFDdkIsZ0JBQVEsV0FBUixDQUFvQixRQUFRLFVBQTVCO0FBQ0g7QUFDRCxXQUFPLElBQVAsQ0FBWSxJQUFaLEVBQWtCLE9BQWxCLENBQTBCLGFBQUs7QUFDM0IsWUFBTSxXQUFXLEtBQUssQ0FBTCxDQUFqQjs7QUFFQTtBQUNBLFlBQUcsUUFBUSxpQkFBUixDQUEwQixPQUExQixDQUFrQyxTQUFTLElBQTNDLElBQW1ELENBQUMsQ0FBcEQsSUFBeUQsU0FBUyxJQUFULElBQWlCLFVBQTdFLEVBQXlGO0FBQ3JGO0FBQ0g7O0FBRUQ7QUFDQSxZQUFNLE1BQU0sU0FBUyxhQUFULENBQXVCLEtBQXZCLENBQVo7QUFDQSxZQUFJLFNBQUosQ0FBYyxHQUFkLENBQWtCLFFBQVEsVUFBUixDQUFtQixHQUFyQztBQUNBLFlBQUksZ0JBQWdCLFVBQVUsU0FBUyxJQUFULENBQWMsT0FBZCxDQUFzQixLQUF0QixFQUE0QixHQUE1QixDQUE5QjtBQUNBLFlBQUksU0FBSixDQUFjLEdBQWQsQ0FBa0IsYUFBbEI7O0FBRUEsWUFBTSxRQUFRLFNBQVMsYUFBVCxDQUF1QixHQUF2QixDQUFkO0FBQ0EsY0FBTSxTQUFOLENBQWdCLEdBQWhCLENBQW9CLFFBQVEsVUFBUixDQUFtQixRQUF2QztBQUNBLFlBQUksZ0JBQWlCLFNBQVMsSUFBVCxDQUFjLE9BQWQsQ0FBc0IsS0FBdEIsRUFBNEIsR0FBNUIsQ0FBckI7QUFDQSxjQUFNLEVBQU4sR0FBVyxhQUFYO0FBQ0EsWUFBSSxlQUFlLFNBQVMsSUFBVCxDQUFjLE9BQWQsQ0FBc0IsSUFBdEIsRUFBNEIsR0FBNUIsRUFDZCxPQURjLENBQ04sUUFETSxFQUNJLFVBQUMsSUFBRDtBQUFBLG1CQUFVLEtBQUssTUFBTCxDQUFZLENBQVosRUFBZSxXQUFmLEtBQStCLEtBQUssTUFBTCxDQUFZLENBQVosRUFBZSxXQUFmLEVBQXpDO0FBQUEsU0FESixFQUVkLE9BRmMsQ0FFTixLQUZNLEVBRUMsT0FGRCxDQUFuQjtBQUdBLGNBQU0sU0FBTixHQUFrQixZQUFsQjtBQUNBLFlBQUksV0FBSixDQUFnQixLQUFoQjtBQUNBLGdCQUFRLFdBQVIsQ0FBb0IsR0FBcEI7O0FBRUEsWUFBRyxRQUFRLFdBQVIsSUFBdUIsS0FBMUIsRUFBaUM7QUFDN0IsZ0JBQUcsS0FBSyxDQUFSLEVBQ0E7QUFDSSxvQkFBSSxTQUFKLENBQWMsR0FBZCxDQUFrQixRQUFRLFVBQVIsQ0FBbUIsU0FBckM7QUFDSDtBQUNKLFNBTEQsTUFNSztBQUNELGdCQUFJLFNBQUosQ0FBYyxHQUFkLENBQWtCLFFBQVEsVUFBUixDQUFtQixTQUFyQztBQUNIOztBQUVEO0FBQ0EsWUFBRyxRQUFRLFVBQVIsSUFBc0IsT0FBekIsRUFBaUM7QUFDN0IscUJBQVMsTUFBVCxDQUFnQixPQUFoQixDQUF3QixVQUFTLEtBQVQsRUFBZTtBQUNuQyxvQkFBSSxXQUFKLENBQWdCLE9BQU8sWUFBUCxDQUFvQixLQUFwQixFQUEyQixPQUEzQixFQUFvQyxJQUFwQyxDQUFoQjtBQUNILGFBRkQ7QUFHSCxTQUpELE1BS0ssSUFBRyxRQUFRLFVBQVIsSUFBc0IsTUFBekIsRUFBZ0M7QUFDakMscUJBQVMsS0FBVCxDQUFlLE9BQWYsQ0FBdUIsVUFBUyxJQUFULEVBQWM7QUFDakMsb0JBQUksV0FBSixDQUFnQixPQUFPLFlBQVAsQ0FBb0IsSUFBcEIsRUFBMEIsT0FBMUIsRUFBbUMsSUFBbkMsRUFBeUMsU0FBUyxRQUFsRCxFQUE0RCxTQUFTLFVBQXJFLEVBQWlGLFNBQVMsVUFBMUYsQ0FBaEI7QUFDSCxhQUZEO0FBR0g7QUFDSixLQTlDRDs7QUFnREEsUUFBSSxRQUFRLFdBQVQsSUFBd0IsUUFBUSxVQUFSLElBQXNCLE9BQWpELEVBQTBEO0FBQ3REO0FBQ0EsWUFBTSxPQUFPLEVBQUU7QUFDWCxxQkFBUyxTQUFTLFVBQVUsUUFBUSxXQUFsQixFQUErQixPQUR4QztBQUVULGtCQUFNO0FBRkcsU0FBYjtBQUlBLFlBQUkseUJBQUo7QUFDQSxZQUFNLGlCQUFpQixTQUFTLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBdkI7QUFDQSx1QkFBZSxZQUFmLENBQTRCLE1BQTVCLEVBQW9DLFFBQXBDO0FBQ0EsdUJBQWUsU0FBZixDQUF5QixHQUF6QixDQUE2QixRQUFRLFVBQVIsQ0FBbUIsV0FBaEQsRUFBNkQsUUFBUSxVQUFSLENBQW1CLGlCQUFoRixFQUFtRyxRQUFRLFVBQVIsQ0FBbUIsS0FBdEg7QUFDQSx1QkFBZSxTQUFmLEdBQTJCLE9BQU8sUUFBUCxDQUFnQixJQUFoQixFQUFzQixPQUF0QixDQUEzQjtBQUNBLHVCQUFlLGdCQUFmLENBQWdDLE9BQWhDLEVBQXlDLFlBQU07QUFDM0MsNkJBQWlCLFNBQWpCLENBQTJCLE1BQTNCLENBQWtDLFFBQWxDO0FBQ0EsMkJBQWUsU0FBZixDQUF5QixNQUF6QixDQUFnQyxRQUFoQztBQUNILFNBSEQ7QUFJQSxlQUFPLFdBQVAsQ0FBbUIsY0FBbkI7O0FBRUEsMkJBQW1CLFNBQVMsYUFBVCxDQUF1QixLQUF2QixDQUFuQjtBQUNBLHlCQUFpQixTQUFqQixDQUEyQixHQUEzQixDQUErQixRQUFRLFVBQVIsQ0FBbUIsZ0JBQWxEO0FBQ0EsZUFBTyxJQUFQLENBQVksU0FBWixFQUF1QixPQUF2QixDQUErQixhQUFLO0FBQ2hDLGdCQUFNLFdBQVcsT0FBTyxNQUFQLENBQWMsRUFBZCxFQUFrQixVQUFVLENBQVYsQ0FBbEIsQ0FBakI7QUFDQSxxQkFBUyxPQUFULEdBQW1CLFNBQVMsU0FBUyxPQUFyQztBQUNBLHFCQUFTLElBQVQsR0FBZ0IsTUFBTSxTQUFTLElBQS9CO0FBQ0EsZ0JBQU0sY0FBYyxTQUFTLGFBQVQsQ0FBdUIsUUFBdkIsQ0FBcEI7QUFDQSx3QkFBWSxZQUFaLENBQXlCLE1BQXpCLEVBQWlDLFFBQWpDO0FBQ0Esd0JBQVksU0FBWixDQUFzQixHQUF0QixDQUEwQixRQUFRLFVBQVIsQ0FBbUIsV0FBN0MsRUFBMEQsUUFBUSxVQUFSLENBQW1CLEtBQTdFO0FBQ0Esd0JBQVksT0FBWixDQUFvQixRQUFwQixHQUErQixDQUEvQjtBQUNBLHdCQUFZLFNBQVosR0FBd0IsT0FBTyxRQUFQLENBQWdCLFFBQWhCLEVBQTBCLE9BQTFCLENBQXhCOztBQUVBLHdCQUFZLGdCQUFaLENBQTZCLE9BQTdCLEVBQXNDLGFBQUs7QUFDdkMsa0JBQUUsZUFBRjtBQUNBLGtCQUFFLGNBQUY7O0FBRUEsK0JBQWUsU0FBZixDQUF5QixNQUF6QixDQUFnQyxRQUFoQztBQUNBLCtCQUFlLFNBQWYsR0FBMkIsT0FBTyxRQUFQLENBQWdCLFFBQWhCLEVBQTBCLE9BQTFCLENBQTNCOztBQUVBLHdCQUFRLFdBQVIsR0FBc0IsWUFBWSxPQUFaLENBQW9CLFFBQTFDO0FBQ0EsaUNBQWlCLFNBQWpCLENBQTJCLE1BQTNCLENBQWtDLFFBQWxDOztBQUVBO0FBQ0Esb0JBQU0sU0FBUyxHQUFHLE9BQUgsQ0FBVyxJQUFYLENBQWdCLFFBQVEsU0FBUixDQUFrQixnQkFBbEIsT0FBdUMsUUFBUSxVQUFSLENBQW1CLE9BQTFELFdBQXVFLFFBQVEsVUFBUixDQUFtQixLQUExRixDQUFoQixFQUFvSCxpQkFBUztBQUN4SSx3QkFBRyxNQUFNLE9BQU4sQ0FBYyxXQUFqQixFQUE4QjtBQUMxQiw0QkFBTSxXQUFXO0FBQ2IscUNBQVMsTUFBTSxPQUFOLENBQWMsT0FEVjtBQUViLGtDQUFNLE1BQU0sT0FBTixDQUFjLElBRlA7QUFHYix5Q0FBYSxJQUhBO0FBSWIsc0NBQVUsTUFBTSxPQUFOLENBQWMsUUFKWDtBQUtiLGtDQUFNLE1BQU0sT0FBTixDQUFjO0FBTFAseUJBQWpCO0FBT0EsOEJBQU0sVUFBTixDQUFpQixZQUFqQixDQUE4QixPQUFPLFlBQVAsQ0FBb0IsUUFBcEIsRUFBOEIsT0FBOUIsRUFBdUMsSUFBdkMsQ0FBOUIsRUFBNEUsS0FBNUU7QUFDSDtBQUNKLGlCQVhjLENBQWY7QUFZSCxhQXZCRDs7QUF5QkEsNkJBQWlCLFdBQWpCLENBQTZCLFdBQTdCO0FBQ0gsU0FwQ0Q7QUFxQ0EsZUFBTyxXQUFQLENBQW1CLGdCQUFuQjtBQUNIO0FBQ0osQ0EzVEQ7O0FBNlRBLE9BQU8sT0FBUCxHQUFpQixJQUFqQjs7Ozs7QUNoVUEsT0FBTyxPQUFQLEdBQWlCO0FBQ2IsT0FBRztBQUNDLGlCQUFTLEVBRFY7QUFFQyxjQUFNO0FBRlAsS0FEVTtBQUtiLE9BQUc7QUFDQyxpQkFBUyxRQURWO0FBRUMsY0FBTTtBQUZQLEtBTFU7QUFTYixPQUFHO0FBQ0MsaUJBQVMsUUFEVjtBQUVDLGNBQU07QUFGUCxLQVRVO0FBYWIsT0FBRztBQUNDLGlCQUFTLFFBRFY7QUFFQyxjQUFNO0FBRlAsS0FiVTtBQWlCYixPQUFHO0FBQ0MsaUJBQVMsUUFEVjtBQUVDLGNBQU07QUFGUCxLQWpCVTtBQXFCYixPQUFHO0FBQ0MsaUJBQVMsUUFEVjtBQUVDLGNBQU07QUFGUDtBQXJCVSxDQUFqQiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqL1xuXG52YXIgZmJlbWl0dGVyID0ge1xuICBFdmVudEVtaXR0ZXI6IHJlcXVpcmUoJy4vbGliL0Jhc2VFdmVudEVtaXR0ZXInKSxcbiAgRW1pdHRlclN1YnNjcmlwdGlvbiA6IHJlcXVpcmUoJy4vbGliL0VtaXR0ZXJTdWJzY3JpcHRpb24nKVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmYmVtaXR0ZXI7XG4iLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKlxuICogQHByb3ZpZGVzTW9kdWxlIEJhc2VFdmVudEVtaXR0ZXJcbiAqIEB0eXBlY2hlY2tzXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIEVtaXR0ZXJTdWJzY3JpcHRpb24gPSByZXF1aXJlKCcuL0VtaXR0ZXJTdWJzY3JpcHRpb24nKTtcbnZhciBFdmVudFN1YnNjcmlwdGlvblZlbmRvciA9IHJlcXVpcmUoJy4vRXZlbnRTdWJzY3JpcHRpb25WZW5kb3InKTtcblxudmFyIGVtcHR5RnVuY3Rpb24gPSByZXF1aXJlKCdmYmpzL2xpYi9lbXB0eUZ1bmN0aW9uJyk7XG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG5cbi8qKlxuICogQGNsYXNzIEJhc2VFdmVudEVtaXR0ZXJcbiAqIEBkZXNjcmlwdGlvblxuICogQW4gRXZlbnRFbWl0dGVyIGlzIHJlc3BvbnNpYmxlIGZvciBtYW5hZ2luZyBhIHNldCBvZiBsaXN0ZW5lcnMgYW5kIHB1Ymxpc2hpbmdcbiAqIGV2ZW50cyB0byB0aGVtIHdoZW4gaXQgaXMgdG9sZCB0aGF0IHN1Y2ggZXZlbnRzIGhhcHBlbmVkLiBJbiBhZGRpdGlvbiB0byB0aGVcbiAqIGRhdGEgZm9yIHRoZSBnaXZlbiBldmVudCBpdCBhbHNvIHNlbmRzIGEgZXZlbnQgY29udHJvbCBvYmplY3Qgd2hpY2ggYWxsb3dzXG4gKiB0aGUgbGlzdGVuZXJzL2hhbmRsZXJzIHRvIHByZXZlbnQgdGhlIGRlZmF1bHQgYmVoYXZpb3Igb2YgdGhlIGdpdmVuIGV2ZW50LlxuICpcbiAqIFRoZSBlbWl0dGVyIGlzIGRlc2lnbmVkIHRvIGJlIGdlbmVyaWMgZW5vdWdoIHRvIHN1cHBvcnQgYWxsIHRoZSBkaWZmZXJlbnRcbiAqIGNvbnRleHRzIGluIHdoaWNoIG9uZSBtaWdodCB3YW50IHRvIGVtaXQgZXZlbnRzLiBJdCBpcyBhIHNpbXBsZSBtdWx0aWNhc3RcbiAqIG1lY2hhbmlzbSBvbiB0b3Agb2Ygd2hpY2ggZXh0cmEgZnVuY3Rpb25hbGl0eSBjYW4gYmUgY29tcG9zZWQuIEZvciBleGFtcGxlLCBhXG4gKiBtb3JlIGFkdmFuY2VkIGVtaXR0ZXIgbWF5IHVzZSBhbiBFdmVudEhvbGRlciBhbmQgRXZlbnRGYWN0b3J5LlxuICovXG5cbnZhciBCYXNlRXZlbnRFbWl0dGVyID0gKGZ1bmN0aW9uICgpIHtcbiAgLyoqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKi9cblxuICBmdW5jdGlvbiBCYXNlRXZlbnRFbWl0dGVyKCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBCYXNlRXZlbnRFbWl0dGVyKTtcblxuICAgIHRoaXMuX3N1YnNjcmliZXIgPSBuZXcgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IoKTtcbiAgICB0aGlzLl9jdXJyZW50U3Vic2NyaXB0aW9uID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgbGlzdGVuZXIgdG8gYmUgaW52b2tlZCB3aGVuIGV2ZW50cyBvZiB0aGUgc3BlY2lmaWVkIHR5cGUgYXJlXG4gICAqIGVtaXR0ZWQuIEFuIG9wdGlvbmFsIGNhbGxpbmcgY29udGV4dCBtYXkgYmUgcHJvdmlkZWQuIFRoZSBkYXRhIGFyZ3VtZW50c1xuICAgKiBlbWl0dGVkIHdpbGwgYmUgcGFzc2VkIHRvIHRoZSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAgICpcbiAgICogVE9ETzogQW5ub3RhdGUgdGhlIGxpc3RlbmVyIGFyZydzIHR5cGUuIFRoaXMgaXMgdHJpY2t5IGJlY2F1c2UgbGlzdGVuZXJzXG4gICAqICAgICAgIGNhbiBiZSBpbnZva2VkIHdpdGggdmFyYXJncy5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZSAtIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlbiB0b1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIEZ1bmN0aW9uIHRvIGludm9rZSB3aGVuIHRoZSBzcGVjaWZpZWQgZXZlbnQgaXNcbiAgICogICBlbWl0dGVkXG4gICAqIEBwYXJhbSB7Kn0gY29udGV4dCAtIE9wdGlvbmFsIGNvbnRleHQgb2JqZWN0IHRvIHVzZSB3aGVuIGludm9raW5nIHRoZVxuICAgKiAgIGxpc3RlbmVyXG4gICAqL1xuXG4gIEJhc2VFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24gYWRkTGlzdGVuZXIoZXZlbnRUeXBlLCBsaXN0ZW5lciwgY29udGV4dCkge1xuICAgIHJldHVybiB0aGlzLl9zdWJzY3JpYmVyLmFkZFN1YnNjcmlwdGlvbihldmVudFR5cGUsIG5ldyBFbWl0dGVyU3Vic2NyaXB0aW9uKHRoaXMuX3N1YnNjcmliZXIsIGxpc3RlbmVyLCBjb250ZXh0KSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFNpbWlsYXIgdG8gYWRkTGlzdGVuZXIsIGV4Y2VwdCB0aGF0IHRoZSBsaXN0ZW5lciBpcyByZW1vdmVkIGFmdGVyIGl0IGlzXG4gICAqIGludm9rZWQgb25jZS5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IGV2ZW50VHlwZSAtIE5hbWUgb2YgdGhlIGV2ZW50IHRvIGxpc3RlbiB0b1xuICAgKiBAcGFyYW0ge2Z1bmN0aW9ufSBsaXN0ZW5lciAtIEZ1bmN0aW9uIHRvIGludm9rZSBvbmx5IG9uY2Ugd2hlbiB0aGVcbiAgICogICBzcGVjaWZpZWQgZXZlbnQgaXMgZW1pdHRlZFxuICAgKiBAcGFyYW0geyp9IGNvbnRleHQgLSBPcHRpb25hbCBjb250ZXh0IG9iamVjdCB0byB1c2Ugd2hlbiBpbnZva2luZyB0aGVcbiAgICogICBsaXN0ZW5lclxuICAgKi9cblxuICBCYXNlRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24gb25jZShldmVudFR5cGUsIGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgdmFyIGVtaXR0ZXIgPSB0aGlzO1xuICAgIHJldHVybiB0aGlzLmFkZExpc3RlbmVyKGV2ZW50VHlwZSwgZnVuY3Rpb24gKCkge1xuICAgICAgZW1pdHRlci5yZW1vdmVDdXJyZW50TGlzdGVuZXIoKTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KGNvbnRleHQsIGFyZ3VtZW50cyk7XG4gICAgfSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbW92ZXMgYWxsIG9mIHRoZSByZWdpc3RlcmVkIGxpc3RlbmVycywgaW5jbHVkaW5nIHRob3NlIHJlZ2lzdGVyZWQgYXNcbiAgICogbGlzdGVuZXIgbWFwcy5cbiAgICpcbiAgICogQHBhcmFtIHs/c3RyaW5nfSBldmVudFR5cGUgLSBPcHRpb25hbCBuYW1lIG9mIHRoZSBldmVudCB3aG9zZSByZWdpc3RlcmVkXG4gICAqICAgbGlzdGVuZXJzIHRvIHJlbW92ZVxuICAgKi9cblxuICBCYXNlRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBmdW5jdGlvbiByZW1vdmVBbGxMaXN0ZW5lcnMoZXZlbnRUeXBlKSB7XG4gICAgdGhpcy5fc3Vic2NyaWJlci5yZW1vdmVBbGxTdWJzY3JpcHRpb25zKGV2ZW50VHlwZSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFByb3ZpZGVzIGFuIEFQSSB0aGF0IGNhbiBiZSBjYWxsZWQgZHVyaW5nIGFuIGV2ZW50aW5nIGN5Y2xlIHRvIHJlbW92ZSB0aGVcbiAgICogbGFzdCBsaXN0ZW5lciB0aGF0IHdhcyBpbnZva2VkLiBUaGlzIGFsbG93cyBhIGRldmVsb3BlciB0byBwcm92aWRlIGFuIGV2ZW50XG4gICAqIG9iamVjdCB0aGF0IGNhbiByZW1vdmUgdGhlIGxpc3RlbmVyIChvciBsaXN0ZW5lciBtYXApIGR1cmluZyB0aGVcbiAgICogaW52b2NhdGlvbi5cbiAgICpcbiAgICogSWYgaXQgaXMgY2FsbGVkIHdoZW4gbm90IGluc2lkZSBvZiBhbiBlbWl0dGluZyBjeWNsZSBpdCB3aWxsIHRocm93LlxuICAgKlxuICAgKiBAdGhyb3dzIHtFcnJvcn0gV2hlbiBjYWxsZWQgbm90IGR1cmluZyBhbiBldmVudGluZyBjeWNsZVxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiAgIHZhciBzdWJzY3JpcHRpb24gPSBlbWl0dGVyLmFkZExpc3RlbmVyTWFwKHtcbiAgICogICAgIHNvbWVFdmVudDogZnVuY3Rpb24oZGF0YSwgZXZlbnQpIHtcbiAgICogICAgICAgY29uc29sZS5sb2coZGF0YSk7XG4gICAqICAgICAgIGVtaXR0ZXIucmVtb3ZlQ3VycmVudExpc3RlbmVyKCk7XG4gICAqICAgICB9XG4gICAqICAgfSk7XG4gICAqXG4gICAqICAgZW1pdHRlci5lbWl0KCdzb21lRXZlbnQnLCAnYWJjJyk7IC8vIGxvZ3MgJ2FiYydcbiAgICogICBlbWl0dGVyLmVtaXQoJ3NvbWVFdmVudCcsICdkZWYnKTsgLy8gZG9lcyBub3QgbG9nIGFueXRoaW5nXG4gICAqL1xuXG4gIEJhc2VFdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUN1cnJlbnRMaXN0ZW5lciA9IGZ1bmN0aW9uIHJlbW92ZUN1cnJlbnRMaXN0ZW5lcigpIHtcbiAgICAhISF0aGlzLl9jdXJyZW50U3Vic2NyaXB0aW9uID8gcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyA/IGludmFyaWFudChmYWxzZSwgJ05vdCBpbiBhbiBlbWl0dGluZyBjeWNsZTsgdGhlcmUgaXMgbm8gY3VycmVudCBzdWJzY3JpcHRpb24nKSA6IGludmFyaWFudChmYWxzZSkgOiB1bmRlZmluZWQ7XG4gICAgdGhpcy5fc3Vic2NyaWJlci5yZW1vdmVTdWJzY3JpcHRpb24odGhpcy5fY3VycmVudFN1YnNjcmlwdGlvbik7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJldHVybnMgYW4gYXJyYXkgb2YgbGlzdGVuZXJzIHRoYXQgYXJlIGN1cnJlbnRseSByZWdpc3RlcmVkIGZvciB0aGUgZ2l2ZW5cbiAgICogZXZlbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGUgLSBOYW1lIG9mIHRoZSBldmVudCB0byBxdWVyeVxuICAgKiBAcmV0dXJuIHthcnJheX1cbiAgICovXG5cbiAgQmFzZUV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24gbGlzdGVuZXJzKGV2ZW50VHlwZSkgLyogVE9ETzogQXJyYXk8RXZlbnRTdWJzY3JpcHRpb24+ICove1xuICAgIHZhciBzdWJzY3JpcHRpb25zID0gdGhpcy5fc3Vic2NyaWJlci5nZXRTdWJzY3JpcHRpb25zRm9yVHlwZShldmVudFR5cGUpO1xuICAgIHJldHVybiBzdWJzY3JpcHRpb25zID8gc3Vic2NyaXB0aW9ucy5maWx0ZXIoZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc1RydWUpLm1hcChmdW5jdGlvbiAoc3Vic2NyaXB0aW9uKSB7XG4gICAgICByZXR1cm4gc3Vic2NyaXB0aW9uLmxpc3RlbmVyO1xuICAgIH0pIDogW107XG4gIH07XG5cbiAgLyoqXG4gICAqIEVtaXRzIGFuIGV2ZW50IG9mIHRoZSBnaXZlbiB0eXBlIHdpdGggdGhlIGdpdmVuIGRhdGEuIEFsbCBoYW5kbGVycyBvZiB0aGF0XG4gICAqIHBhcnRpY3VsYXIgdHlwZSB3aWxsIGJlIG5vdGlmaWVkLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlIC0gTmFtZSBvZiB0aGUgZXZlbnQgdG8gZW1pdFxuICAgKiBAcGFyYW0geyp9IEFyYml0cmFyeSBhcmd1bWVudHMgdG8gYmUgcGFzc2VkIHRvIGVhY2ggcmVnaXN0ZXJlZCBsaXN0ZW5lclxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiAgIGVtaXR0ZXIuYWRkTGlzdGVuZXIoJ3NvbWVFdmVudCcsIGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgICogICAgIGNvbnNvbGUubG9nKG1lc3NhZ2UpO1xuICAgKiAgIH0pO1xuICAgKlxuICAgKiAgIGVtaXR0ZXIuZW1pdCgnc29tZUV2ZW50JywgJ2FiYycpOyAvLyBsb2dzICdhYmMnXG4gICAqL1xuXG4gIEJhc2VFdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbiBlbWl0KGV2ZW50VHlwZSkge1xuICAgIHZhciBzdWJzY3JpcHRpb25zID0gdGhpcy5fc3Vic2NyaWJlci5nZXRTdWJzY3JpcHRpb25zRm9yVHlwZShldmVudFR5cGUpO1xuICAgIGlmIChzdWJzY3JpcHRpb25zKSB7XG4gICAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKHN1YnNjcmlwdGlvbnMpO1xuICAgICAgZm9yICh2YXIgaWkgPSAwOyBpaSA8IGtleXMubGVuZ3RoOyBpaSsrKSB7XG4gICAgICAgIHZhciBrZXkgPSBrZXlzW2lpXTtcbiAgICAgICAgdmFyIHN1YnNjcmlwdGlvbiA9IHN1YnNjcmlwdGlvbnNba2V5XTtcbiAgICAgICAgLy8gVGhlIHN1YnNjcmlwdGlvbiBtYXkgaGF2ZSBiZWVuIHJlbW92ZWQgZHVyaW5nIHRoaXMgZXZlbnQgbG9vcC5cbiAgICAgICAgaWYgKHN1YnNjcmlwdGlvbikge1xuICAgICAgICAgIHRoaXMuX2N1cnJlbnRTdWJzY3JpcHRpb24gPSBzdWJzY3JpcHRpb247XG4gICAgICAgICAgdGhpcy5fX2VtaXRUb1N1YnNjcmlwdGlvbi5hcHBseSh0aGlzLCBbc3Vic2NyaXB0aW9uXS5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzKSkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9jdXJyZW50U3Vic2NyaXB0aW9uID0gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFByb3ZpZGVzIGEgaG9vayB0byBvdmVycmlkZSBob3cgdGhlIGVtaXR0ZXIgZW1pdHMgYW4gZXZlbnQgdG8gYSBzcGVjaWZpY1xuICAgKiBzdWJzY3JpcHRpb24uIFRoaXMgYWxsb3dzIHlvdSB0byBzZXQgdXAgbG9nZ2luZyBhbmQgZXJyb3IgYm91bmRhcmllc1xuICAgKiBzcGVjaWZpYyB0byB5b3VyIGVudmlyb25tZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge0VtaXR0ZXJTdWJzY3JpcHRpb259IHN1YnNjcmlwdGlvblxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlXG4gICAqIEBwYXJhbSB7Kn0gQXJiaXRyYXJ5IGFyZ3VtZW50cyB0byBiZSBwYXNzZWQgdG8gZWFjaCByZWdpc3RlcmVkIGxpc3RlbmVyXG4gICAqL1xuXG4gIEJhc2VFdmVudEVtaXR0ZXIucHJvdG90eXBlLl9fZW1pdFRvU3Vic2NyaXB0aW9uID0gZnVuY3Rpb24gX19lbWl0VG9TdWJzY3JpcHRpb24oc3Vic2NyaXB0aW9uLCBldmVudFR5cGUpIHtcbiAgICB2YXIgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG4gICAgc3Vic2NyaXB0aW9uLmxpc3RlbmVyLmFwcGx5KHN1YnNjcmlwdGlvbi5jb250ZXh0LCBhcmdzKTtcbiAgfTtcblxuICByZXR1cm4gQmFzZUV2ZW50RW1pdHRlcjtcbn0pKCk7XG5cbm1vZHVsZS5leHBvcnRzID0gQmFzZUV2ZW50RW1pdHRlcjsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKiBcbiAqIEBwcm92aWRlc01vZHVsZSBFbWl0dGVyU3Vic2NyaXB0aW9uXG4gKiBAdHlwZWNoZWNrc1xuICovXG5cbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbmZ1bmN0aW9uIF9pbmhlcml0cyhzdWJDbGFzcywgc3VwZXJDbGFzcykgeyBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09ICdmdW5jdGlvbicgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90ICcgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7IH0gc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7IGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBzdWJDbGFzcywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSB9KTsgaWYgKHN1cGVyQ2xhc3MpIE9iamVjdC5zZXRQcm90b3R5cGVPZiA/IE9iamVjdC5zZXRQcm90b3R5cGVPZihzdWJDbGFzcywgc3VwZXJDbGFzcykgOiBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzOyB9XG5cbnZhciBFdmVudFN1YnNjcmlwdGlvbiA9IHJlcXVpcmUoJy4vRXZlbnRTdWJzY3JpcHRpb24nKTtcblxuLyoqXG4gKiBFbWl0dGVyU3Vic2NyaXB0aW9uIHJlcHJlc2VudHMgYSBzdWJzY3JpcHRpb24gd2l0aCBsaXN0ZW5lciBhbmQgY29udGV4dCBkYXRhLlxuICovXG5cbnZhciBFbWl0dGVyU3Vic2NyaXB0aW9uID0gKGZ1bmN0aW9uIChfRXZlbnRTdWJzY3JpcHRpb24pIHtcbiAgX2luaGVyaXRzKEVtaXR0ZXJTdWJzY3JpcHRpb24sIF9FdmVudFN1YnNjcmlwdGlvbik7XG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7RXZlbnRTdWJzY3JpcHRpb25WZW5kb3J9IHN1YnNjcmliZXIgLSBUaGUgc3Vic2NyaWJlciB0aGF0IGNvbnRyb2xzXG4gICAqICAgdGhpcyBzdWJzY3JpcHRpb25cbiAgICogQHBhcmFtIHtmdW5jdGlvbn0gbGlzdGVuZXIgLSBGdW5jdGlvbiB0byBpbnZva2Ugd2hlbiB0aGUgc3BlY2lmaWVkIGV2ZW50IGlzXG4gICAqICAgZW1pdHRlZFxuICAgKiBAcGFyYW0geyp9IGNvbnRleHQgLSBPcHRpb25hbCBjb250ZXh0IG9iamVjdCB0byB1c2Ugd2hlbiBpbnZva2luZyB0aGVcbiAgICogICBsaXN0ZW5lclxuICAgKi9cblxuICBmdW5jdGlvbiBFbWl0dGVyU3Vic2NyaXB0aW9uKHN1YnNjcmliZXIsIGxpc3RlbmVyLCBjb250ZXh0KSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEVtaXR0ZXJTdWJzY3JpcHRpb24pO1xuXG4gICAgX0V2ZW50U3Vic2NyaXB0aW9uLmNhbGwodGhpcywgc3Vic2NyaWJlcik7XG4gICAgdGhpcy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICAgIHRoaXMuY29udGV4dCA9IGNvbnRleHQ7XG4gIH1cblxuICByZXR1cm4gRW1pdHRlclN1YnNjcmlwdGlvbjtcbn0pKEV2ZW50U3Vic2NyaXB0aW9uKTtcblxubW9kdWxlLmV4cG9ydHMgPSBFbWl0dGVyU3Vic2NyaXB0aW9uOyIsIi8qKlxuICogQ29weXJpZ2h0IChjKSAyMDE0LXByZXNlbnQsIEZhY2Vib29rLCBJbmMuXG4gKiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIEJTRC1zdHlsZSBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLiBBbiBhZGRpdGlvbmFsIGdyYW50XG4gKiBvZiBwYXRlbnQgcmlnaHRzIGNhbiBiZSBmb3VuZCBpbiB0aGUgUEFURU5UUyBmaWxlIGluIHRoZSBzYW1lIGRpcmVjdG9yeS5cbiAqXG4gKiBAcHJvdmlkZXNNb2R1bGUgRXZlbnRTdWJzY3JpcHRpb25cbiAqIEB0eXBlY2hlY2tzXG4gKi9cblxuJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIEV2ZW50U3Vic2NyaXB0aW9uIHJlcHJlc2VudHMgYSBzdWJzY3JpcHRpb24gdG8gYSBwYXJ0aWN1bGFyIGV2ZW50LiBJdCBjYW5cbiAqIHJlbW92ZSBpdHMgb3duIHN1YnNjcmlwdGlvbi5cbiAqL1xuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIEV2ZW50U3Vic2NyaXB0aW9uID0gKGZ1bmN0aW9uICgpIHtcblxuICAvKipcbiAgICogQHBhcmFtIHtFdmVudFN1YnNjcmlwdGlvblZlbmRvcn0gc3Vic2NyaWJlciB0aGUgc3Vic2NyaWJlciB0aGF0IGNvbnRyb2xzXG4gICAqICAgdGhpcyBzdWJzY3JpcHRpb24uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIEV2ZW50U3Vic2NyaXB0aW9uKHN1YnNjcmliZXIpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRXZlbnRTdWJzY3JpcHRpb24pO1xuXG4gICAgdGhpcy5zdWJzY3JpYmVyID0gc3Vic2NyaWJlcjtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmVzIHRoaXMgc3Vic2NyaXB0aW9uIGZyb20gdGhlIHN1YnNjcmliZXIgdGhhdCBjb250cm9scyBpdC5cbiAgICovXG5cbiAgRXZlbnRTdWJzY3JpcHRpb24ucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIHJlbW92ZSgpIHtcbiAgICBpZiAodGhpcy5zdWJzY3JpYmVyKSB7XG4gICAgICB0aGlzLnN1YnNjcmliZXIucmVtb3ZlU3Vic2NyaXB0aW9uKHRoaXMpO1xuICAgICAgdGhpcy5zdWJzY3JpYmVyID0gbnVsbDtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIEV2ZW50U3Vic2NyaXB0aW9uO1xufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudFN1YnNjcmlwdGlvbjsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxNC1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBCU0Qtc3R5bGUgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS4gQW4gYWRkaXRpb25hbCBncmFudFxuICogb2YgcGF0ZW50IHJpZ2h0cyBjYW4gYmUgZm91bmQgaW4gdGhlIFBBVEVOVFMgZmlsZSBpbiB0aGUgc2FtZSBkaXJlY3RvcnkuXG4gKiBcbiAqIEBwcm92aWRlc01vZHVsZSBFdmVudFN1YnNjcmlwdGlvblZlbmRvclxuICogQHR5cGVjaGVja3NcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG52YXIgaW52YXJpYW50ID0gcmVxdWlyZSgnZmJqcy9saWIvaW52YXJpYW50Jyk7XG5cbi8qKlxuICogRXZlbnRTdWJzY3JpcHRpb25WZW5kb3Igc3RvcmVzIGEgc2V0IG9mIEV2ZW50U3Vic2NyaXB0aW9ucyB0aGF0IGFyZVxuICogc3Vic2NyaWJlZCB0byBhIHBhcnRpY3VsYXIgZXZlbnQgdHlwZS5cbiAqL1xuXG52YXIgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBFdmVudFN1YnNjcmlwdGlvblZlbmRvcigpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IpO1xuXG4gICAgdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGUgPSB7fTtcbiAgICB0aGlzLl9jdXJyZW50U3Vic2NyaXB0aW9uID0gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBBZGRzIGEgc3Vic2NyaXB0aW9uIGtleWVkIGJ5IGFuIGV2ZW50IHR5cGUuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBldmVudFR5cGVcbiAgICogQHBhcmFtIHtFdmVudFN1YnNjcmlwdGlvbn0gc3Vic2NyaXB0aW9uXG4gICAqL1xuXG4gIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yLnByb3RvdHlwZS5hZGRTdWJzY3JpcHRpb24gPSBmdW5jdGlvbiBhZGRTdWJzY3JpcHRpb24oZXZlbnRUeXBlLCBzdWJzY3JpcHRpb24pIHtcbiAgICAhKHN1YnNjcmlwdGlvbi5zdWJzY3JpYmVyID09PSB0aGlzKSA/IHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgPyBpbnZhcmlhbnQoZmFsc2UsICdUaGUgc3Vic2NyaWJlciBvZiB0aGUgc3Vic2NyaXB0aW9uIGlzIGluY29ycmVjdGx5IHNldC4nKSA6IGludmFyaWFudChmYWxzZSkgOiB1bmRlZmluZWQ7XG4gICAgaWYgKCF0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZVtldmVudFR5cGVdKSB7XG4gICAgICB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZVtldmVudFR5cGVdID0gW107XG4gICAgfVxuICAgIHZhciBrZXkgPSB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZVtldmVudFR5cGVdLmxlbmd0aDtcbiAgICB0aGlzLl9zdWJzY3JpcHRpb25zRm9yVHlwZVtldmVudFR5cGVdLnB1c2goc3Vic2NyaXB0aW9uKTtcbiAgICBzdWJzY3JpcHRpb24uZXZlbnRUeXBlID0gZXZlbnRUeXBlO1xuICAgIHN1YnNjcmlwdGlvbi5rZXkgPSBrZXk7XG4gICAgcmV0dXJuIHN1YnNjcmlwdGlvbjtcbiAgfTtcblxuICAvKipcbiAgICogUmVtb3ZlcyBhIGJ1bGsgc2V0IG9mIHRoZSBzdWJzY3JpcHRpb25zLlxuICAgKlxuICAgKiBAcGFyYW0gez9zdHJpbmd9IGV2ZW50VHlwZSAtIE9wdGlvbmFsIG5hbWUgb2YgdGhlIGV2ZW50IHR5cGUgd2hvc2VcbiAgICogICByZWdpc3RlcmVkIHN1cHNjcmlwdGlvbnMgdG8gcmVtb3ZlLCBpZiBudWxsIHJlbW92ZSBhbGwgc3Vic2NyaXB0aW9ucy5cbiAgICovXG5cbiAgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IucHJvdG90eXBlLnJlbW92ZUFsbFN1YnNjcmlwdGlvbnMgPSBmdW5jdGlvbiByZW1vdmVBbGxTdWJzY3JpcHRpb25zKGV2ZW50VHlwZSkge1xuICAgIGlmIChldmVudFR5cGUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGUgPSB7fTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZXRlIHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlW2V2ZW50VHlwZV07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBSZW1vdmVzIGEgc3BlY2lmaWMgc3Vic2NyaXB0aW9uLiBJbnN0ZWFkIG9mIGNhbGxpbmcgdGhpcyBmdW5jdGlvbiwgY2FsbFxuICAgKiBgc3Vic2NyaXB0aW9uLnJlbW92ZSgpYCBkaXJlY3RseS5cbiAgICpcbiAgICogQHBhcmFtIHtvYmplY3R9IHN1YnNjcmlwdGlvblxuICAgKi9cblxuICBFdmVudFN1YnNjcmlwdGlvblZlbmRvci5wcm90b3R5cGUucmVtb3ZlU3Vic2NyaXB0aW9uID0gZnVuY3Rpb24gcmVtb3ZlU3Vic2NyaXB0aW9uKHN1YnNjcmlwdGlvbikge1xuICAgIHZhciBldmVudFR5cGUgPSBzdWJzY3JpcHRpb24uZXZlbnRUeXBlO1xuICAgIHZhciBrZXkgPSBzdWJzY3JpcHRpb24ua2V5O1xuXG4gICAgdmFyIHN1YnNjcmlwdGlvbnNGb3JUeXBlID0gdGhpcy5fc3Vic2NyaXB0aW9uc0ZvclR5cGVbZXZlbnRUeXBlXTtcbiAgICBpZiAoc3Vic2NyaXB0aW9uc0ZvclR5cGUpIHtcbiAgICAgIGRlbGV0ZSBzdWJzY3JpcHRpb25zRm9yVHlwZVtrZXldO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogUmV0dXJucyB0aGUgYXJyYXkgb2Ygc3Vic2NyaXB0aW9ucyB0aGF0IGFyZSBjdXJyZW50bHkgcmVnaXN0ZXJlZCBmb3IgdGhlXG4gICAqIGdpdmVuIGV2ZW50IHR5cGUuXG4gICAqXG4gICAqIE5vdGU6IFRoaXMgYXJyYXkgY2FuIGJlIHBvdGVudGlhbGx5IHNwYXJzZSBhcyBzdWJzY3JpcHRpb25zIGFyZSBkZWxldGVkXG4gICAqIGZyb20gaXQgd2hlbiB0aGV5IGFyZSByZW1vdmVkLlxuICAgKlxuICAgKiBUT0RPOiBUaGlzIHJldHVybnMgYSBudWxsYWJsZSBhcnJheS4gd2F0P1xuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gZXZlbnRUeXBlXG4gICAqIEByZXR1cm4gez9hcnJheX1cbiAgICovXG5cbiAgRXZlbnRTdWJzY3JpcHRpb25WZW5kb3IucHJvdG90eXBlLmdldFN1YnNjcmlwdGlvbnNGb3JUeXBlID0gZnVuY3Rpb24gZ2V0U3Vic2NyaXB0aW9uc0ZvclR5cGUoZXZlbnRUeXBlKSB7XG4gICAgcmV0dXJuIHRoaXMuX3N1YnNjcmlwdGlvbnNGb3JUeXBlW2V2ZW50VHlwZV07XG4gIH07XG5cbiAgcmV0dXJuIEV2ZW50U3Vic2NyaXB0aW9uVmVuZG9yO1xufSkoKTtcblxubW9kdWxlLmV4cG9ydHMgPSBFdmVudFN1YnNjcmlwdGlvblZlbmRvcjsiLCJcInVzZSBzdHJpY3RcIjtcblxuLyoqXG4gKiBDb3B5cmlnaHQgKGMpIDIwMTMtcHJlc2VudCwgRmFjZWJvb2ssIEluYy5cbiAqXG4gKiBUaGlzIHNvdXJjZSBjb2RlIGlzIGxpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZSBmb3VuZCBpbiB0aGVcbiAqIExJQ0VOU0UgZmlsZSBpbiB0aGUgcm9vdCBkaXJlY3Rvcnkgb2YgdGhpcyBzb3VyY2UgdHJlZS5cbiAqXG4gKiBcbiAqL1xuXG5mdW5jdGlvbiBtYWtlRW1wdHlGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gYXJnO1xuICB9O1xufVxuXG4vKipcbiAqIFRoaXMgZnVuY3Rpb24gYWNjZXB0cyBhbmQgZGlzY2FyZHMgaW5wdXRzOyBpdCBoYXMgbm8gc2lkZSBlZmZlY3RzLiBUaGlzIGlzXG4gKiBwcmltYXJpbHkgdXNlZnVsIGlkaW9tYXRpY2FsbHkgZm9yIG92ZXJyaWRhYmxlIGZ1bmN0aW9uIGVuZHBvaW50cyB3aGljaFxuICogYWx3YXlzIG5lZWQgdG8gYmUgY2FsbGFibGUsIHNpbmNlIEpTIGxhY2tzIGEgbnVsbC1jYWxsIGlkaW9tIGFsYSBDb2NvYS5cbiAqL1xudmFyIGVtcHR5RnVuY3Rpb24gPSBmdW5jdGlvbiBlbXB0eUZ1bmN0aW9uKCkge307XG5cbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnMgPSBtYWtlRW1wdHlGdW5jdGlvbjtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNGYWxzZSA9IG1ha2VFbXB0eUZ1bmN0aW9uKGZhbHNlKTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNUcnVlID0gbWFrZUVtcHR5RnVuY3Rpb24odHJ1ZSk7XG5lbXB0eUZ1bmN0aW9uLnRoYXRSZXR1cm5zTnVsbCA9IG1ha2VFbXB0eUZ1bmN0aW9uKG51bGwpO1xuZW1wdHlGdW5jdGlvbi50aGF0UmV0dXJuc1RoaXMgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzO1xufTtcbmVtcHR5RnVuY3Rpb24udGhhdFJldHVybnNBcmd1bWVudCA9IGZ1bmN0aW9uIChhcmcpIHtcbiAgcmV0dXJuIGFyZztcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gZW1wdHlGdW5jdGlvbjsiLCIvKipcbiAqIENvcHlyaWdodCAoYykgMjAxMy1wcmVzZW50LCBGYWNlYm9vaywgSW5jLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLlxuICpcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8qKlxuICogVXNlIGludmFyaWFudCgpIHRvIGFzc2VydCBzdGF0ZSB3aGljaCB5b3VyIHByb2dyYW0gYXNzdW1lcyB0byBiZSB0cnVlLlxuICpcbiAqIFByb3ZpZGUgc3ByaW50Zi1zdHlsZSBmb3JtYXQgKG9ubHkgJXMgaXMgc3VwcG9ydGVkKSBhbmQgYXJndW1lbnRzXG4gKiB0byBwcm92aWRlIGluZm9ybWF0aW9uIGFib3V0IHdoYXQgYnJva2UgYW5kIHdoYXQgeW91IHdlcmVcbiAqIGV4cGVjdGluZy5cbiAqXG4gKiBUaGUgaW52YXJpYW50IG1lc3NhZ2Ugd2lsbCBiZSBzdHJpcHBlZCBpbiBwcm9kdWN0aW9uLCBidXQgdGhlIGludmFyaWFudFxuICogd2lsbCByZW1haW4gdG8gZW5zdXJlIGxvZ2ljIGRvZXMgbm90IGRpZmZlciBpbiBwcm9kdWN0aW9uLlxuICovXG5cbnZhciB2YWxpZGF0ZUZvcm1hdCA9IGZ1bmN0aW9uIHZhbGlkYXRlRm9ybWF0KGZvcm1hdCkge307XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHZhbGlkYXRlRm9ybWF0ID0gZnVuY3Rpb24gdmFsaWRhdGVGb3JtYXQoZm9ybWF0KSB7XG4gICAgaWYgKGZvcm1hdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ2ludmFyaWFudCByZXF1aXJlcyBhbiBlcnJvciBtZXNzYWdlIGFyZ3VtZW50Jyk7XG4gICAgfVxuICB9O1xufVxuXG5mdW5jdGlvbiBpbnZhcmlhbnQoY29uZGl0aW9uLCBmb3JtYXQsIGEsIGIsIGMsIGQsIGUsIGYpIHtcbiAgdmFsaWRhdGVGb3JtYXQoZm9ybWF0KTtcblxuICBpZiAoIWNvbmRpdGlvbikge1xuICAgIHZhciBlcnJvcjtcbiAgICBpZiAoZm9ybWF0ID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKCdNaW5pZmllZCBleGNlcHRpb24gb2NjdXJyZWQ7IHVzZSB0aGUgbm9uLW1pbmlmaWVkIGRldiBlbnZpcm9ubWVudCAnICsgJ2ZvciB0aGUgZnVsbCBlcnJvciBtZXNzYWdlIGFuZCBhZGRpdGlvbmFsIGhlbHBmdWwgd2FybmluZ3MuJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBhcmdzID0gW2EsIGIsIGMsIGQsIGUsIGZdO1xuICAgICAgdmFyIGFyZ0luZGV4ID0gMDtcbiAgICAgIGVycm9yID0gbmV3IEVycm9yKGZvcm1hdC5yZXBsYWNlKC8lcy9nLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBhcmdzW2FyZ0luZGV4KytdO1xuICAgICAgfSkpO1xuICAgICAgZXJyb3IubmFtZSA9ICdJbnZhcmlhbnQgVmlvbGF0aW9uJztcbiAgICB9XG5cbiAgICBlcnJvci5mcmFtZXNUb1BvcCA9IDE7IC8vIHdlIGRvbid0IGNhcmUgYWJvdXQgaW52YXJpYW50J3Mgb3duIGZyYW1lXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpbnZhcmlhbnQ7IiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qISB0ZXRoZXIgMS40LjQgKi9cblxuKGZ1bmN0aW9uKHJvb3QsIGZhY3RvcnkpIHtcbiAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgIGRlZmluZShbXSwgZmFjdG9yeSk7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KCk7XG4gIH0gZWxzZSB7XG4gICAgcm9vdC5UZXRoZXIgPSBmYWN0b3J5KCk7XG4gIH1cbn0odGhpcywgZnVuY3Rpb24oKSB7XG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBUZXRoZXJCYXNlID0gdW5kZWZpbmVkO1xuaWYgKHR5cGVvZiBUZXRoZXJCYXNlID09PSAndW5kZWZpbmVkJykge1xuICBUZXRoZXJCYXNlID0geyBtb2R1bGVzOiBbXSB9O1xufVxuXG52YXIgemVyb0VsZW1lbnQgPSBudWxsO1xuXG4vLyBTYW1lIGFzIG5hdGl2ZSBnZXRCb3VuZGluZ0NsaWVudFJlY3QsIGV4Y2VwdCBpdCB0YWtlcyBpbnRvIGFjY291bnQgcGFyZW50IDxmcmFtZT4gb2Zmc2V0c1xuLy8gaWYgdGhlIGVsZW1lbnQgbGllcyB3aXRoaW4gYSBuZXN0ZWQgZG9jdW1lbnQgKDxmcmFtZT4gb3IgPGlmcmFtZT4tbGlrZSkuXG5mdW5jdGlvbiBnZXRBY3R1YWxCb3VuZGluZ0NsaWVudFJlY3Qobm9kZSkge1xuICB2YXIgYm91bmRpbmdSZWN0ID0gbm9kZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAvLyBUaGUgb3JpZ2luYWwgb2JqZWN0IHJldHVybmVkIGJ5IGdldEJvdW5kaW5nQ2xpZW50UmVjdCBpcyBpbW11dGFibGUsIHNvIHdlIGNsb25lIGl0XG4gIC8vIFdlIGNhbid0IHVzZSBleHRlbmQgYmVjYXVzZSB0aGUgcHJvcGVydGllcyBhcmUgbm90IGNvbnNpZGVyZWQgcGFydCBvZiB0aGUgb2JqZWN0IGJ5IGhhc093blByb3BlcnR5IGluIElFOVxuICB2YXIgcmVjdCA9IHt9O1xuICBmb3IgKHZhciBrIGluIGJvdW5kaW5nUmVjdCkge1xuICAgIHJlY3Rba10gPSBib3VuZGluZ1JlY3Rba107XG4gIH1cblxuICBpZiAobm9kZS5vd25lckRvY3VtZW50ICE9PSBkb2N1bWVudCkge1xuICAgIHZhciBfZnJhbWVFbGVtZW50ID0gbm9kZS5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3LmZyYW1lRWxlbWVudDtcbiAgICBpZiAoX2ZyYW1lRWxlbWVudCkge1xuICAgICAgdmFyIGZyYW1lUmVjdCA9IGdldEFjdHVhbEJvdW5kaW5nQ2xpZW50UmVjdChfZnJhbWVFbGVtZW50KTtcbiAgICAgIHJlY3QudG9wICs9IGZyYW1lUmVjdC50b3A7XG4gICAgICByZWN0LmJvdHRvbSArPSBmcmFtZVJlY3QudG9wO1xuICAgICAgcmVjdC5sZWZ0ICs9IGZyYW1lUmVjdC5sZWZ0O1xuICAgICAgcmVjdC5yaWdodCArPSBmcmFtZVJlY3QubGVmdDtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmVjdDtcbn1cblxuZnVuY3Rpb24gZ2V0U2Nyb2xsUGFyZW50cyhlbCkge1xuICAvLyBJbiBmaXJlZm94IGlmIHRoZSBlbCBpcyBpbnNpZGUgYW4gaWZyYW1lIHdpdGggZGlzcGxheTogbm9uZTsgd2luZG93LmdldENvbXB1dGVkU3R5bGUoKSB3aWxsIHJldHVybiBudWxsO1xuICAvLyBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD01NDgzOTdcbiAgdmFyIGNvbXB1dGVkU3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKGVsKSB8fCB7fTtcbiAgdmFyIHBvc2l0aW9uID0gY29tcHV0ZWRTdHlsZS5wb3NpdGlvbjtcbiAgdmFyIHBhcmVudHMgPSBbXTtcblxuICBpZiAocG9zaXRpb24gPT09ICdmaXhlZCcpIHtcbiAgICByZXR1cm4gW2VsXTtcbiAgfVxuXG4gIHZhciBwYXJlbnQgPSBlbDtcbiAgd2hpbGUgKChwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZSkgJiYgcGFyZW50ICYmIHBhcmVudC5ub2RlVHlwZSA9PT0gMSkge1xuICAgIHZhciBzdHlsZSA9IHVuZGVmaW5lZDtcbiAgICB0cnkge1xuICAgICAgc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKHBhcmVudCk7XG4gICAgfSBjYXRjaCAoZXJyKSB7fVxuXG4gICAgaWYgKHR5cGVvZiBzdHlsZSA9PT0gJ3VuZGVmaW5lZCcgfHwgc3R5bGUgPT09IG51bGwpIHtcbiAgICAgIHBhcmVudHMucHVzaChwYXJlbnQpO1xuICAgICAgcmV0dXJuIHBhcmVudHM7XG4gICAgfVxuXG4gICAgdmFyIF9zdHlsZSA9IHN0eWxlO1xuICAgIHZhciBvdmVyZmxvdyA9IF9zdHlsZS5vdmVyZmxvdztcbiAgICB2YXIgb3ZlcmZsb3dYID0gX3N0eWxlLm92ZXJmbG93WDtcbiAgICB2YXIgb3ZlcmZsb3dZID0gX3N0eWxlLm92ZXJmbG93WTtcblxuICAgIGlmICgvKGF1dG98c2Nyb2xsfG92ZXJsYXkpLy50ZXN0KG92ZXJmbG93ICsgb3ZlcmZsb3dZICsgb3ZlcmZsb3dYKSkge1xuICAgICAgaWYgKHBvc2l0aW9uICE9PSAnYWJzb2x1dGUnIHx8IFsncmVsYXRpdmUnLCAnYWJzb2x1dGUnLCAnZml4ZWQnXS5pbmRleE9mKHN0eWxlLnBvc2l0aW9uKSA+PSAwKSB7XG4gICAgICAgIHBhcmVudHMucHVzaChwYXJlbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHBhcmVudHMucHVzaChlbC5vd25lckRvY3VtZW50LmJvZHkpO1xuXG4gIC8vIElmIHRoZSBub2RlIGlzIHdpdGhpbiBhIGZyYW1lLCBhY2NvdW50IGZvciB0aGUgcGFyZW50IHdpbmRvdyBzY3JvbGxcbiAgaWYgKGVsLm93bmVyRG9jdW1lbnQgIT09IGRvY3VtZW50KSB7XG4gICAgcGFyZW50cy5wdXNoKGVsLm93bmVyRG9jdW1lbnQuZGVmYXVsdFZpZXcpO1xuICB9XG5cbiAgcmV0dXJuIHBhcmVudHM7XG59XG5cbnZhciB1bmlxdWVJZCA9IChmdW5jdGlvbiAoKSB7XG4gIHZhciBpZCA9IDA7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICsraWQ7XG4gIH07XG59KSgpO1xuXG52YXIgemVyb1Bvc0NhY2hlID0ge307XG52YXIgZ2V0T3JpZ2luID0gZnVuY3Rpb24gZ2V0T3JpZ2luKCkge1xuICAvLyBnZXRCb3VuZGluZ0NsaWVudFJlY3QgaXMgdW5mb3J0dW5hdGVseSB0b28gYWNjdXJhdGUuICBJdCBpbnRyb2R1Y2VzIGEgcGl4ZWwgb3IgdHdvIG9mXG4gIC8vIGppdHRlciBhcyB0aGUgdXNlciBzY3JvbGxzIHRoYXQgbWVzc2VzIHdpdGggb3VyIGFiaWxpdHkgdG8gZGV0ZWN0IGlmIHR3byBwb3NpdGlvbnNcbiAgLy8gYXJlIGVxdWl2aWxhbnQgb3Igbm90LiAgV2UgcGxhY2UgYW4gZWxlbWVudCBhdCB0aGUgdG9wIGxlZnQgb2YgdGhlIHBhZ2UgdGhhdCB3aWxsXG4gIC8vIGdldCB0aGUgc2FtZSBqaXR0ZXIsIHNvIHdlIGNhbiBjYW5jZWwgdGhlIHR3byBvdXQuXG4gIHZhciBub2RlID0gemVyb0VsZW1lbnQ7XG4gIGlmICghbm9kZSB8fCAhZG9jdW1lbnQuYm9keS5jb250YWlucyhub2RlKSkge1xuICAgIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBub2RlLnNldEF0dHJpYnV0ZSgnZGF0YS10ZXRoZXItaWQnLCB1bmlxdWVJZCgpKTtcbiAgICBleHRlbmQobm9kZS5zdHlsZSwge1xuICAgICAgdG9wOiAwLFxuICAgICAgbGVmdDogMCxcbiAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnXG4gICAgfSk7XG5cbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG5vZGUpO1xuXG4gICAgemVyb0VsZW1lbnQgPSBub2RlO1xuICB9XG5cbiAgdmFyIGlkID0gbm9kZS5nZXRBdHRyaWJ1dGUoJ2RhdGEtdGV0aGVyLWlkJyk7XG4gIGlmICh0eXBlb2YgemVyb1Bvc0NhY2hlW2lkXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB6ZXJvUG9zQ2FjaGVbaWRdID0gZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0KG5vZGUpO1xuXG4gICAgLy8gQ2xlYXIgdGhlIGNhY2hlIHdoZW4gdGhpcyBwb3NpdGlvbiBjYWxsIGlzIGRvbmVcbiAgICBkZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICBkZWxldGUgemVyb1Bvc0NhY2hlW2lkXTtcbiAgICB9KTtcbiAgfVxuXG4gIHJldHVybiB6ZXJvUG9zQ2FjaGVbaWRdO1xufTtcblxuZnVuY3Rpb24gcmVtb3ZlVXRpbEVsZW1lbnRzKCkge1xuICBpZiAoemVyb0VsZW1lbnQpIHtcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHplcm9FbGVtZW50KTtcbiAgfVxuICB6ZXJvRWxlbWVudCA9IG51bGw7XG59O1xuXG5mdW5jdGlvbiBnZXRCb3VuZHMoZWwpIHtcbiAgdmFyIGRvYyA9IHVuZGVmaW5lZDtcbiAgaWYgKGVsID09PSBkb2N1bWVudCkge1xuICAgIGRvYyA9IGRvY3VtZW50O1xuICAgIGVsID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuICB9IGVsc2Uge1xuICAgIGRvYyA9IGVsLm93bmVyRG9jdW1lbnQ7XG4gIH1cblxuICB2YXIgZG9jRWwgPSBkb2MuZG9jdW1lbnRFbGVtZW50O1xuXG4gIHZhciBib3ggPSBnZXRBY3R1YWxCb3VuZGluZ0NsaWVudFJlY3QoZWwpO1xuXG4gIHZhciBvcmlnaW4gPSBnZXRPcmlnaW4oKTtcblxuICBib3gudG9wIC09IG9yaWdpbi50b3A7XG4gIGJveC5sZWZ0IC09IG9yaWdpbi5sZWZ0O1xuXG4gIGlmICh0eXBlb2YgYm94LndpZHRoID09PSAndW5kZWZpbmVkJykge1xuICAgIGJveC53aWR0aCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsV2lkdGggLSBib3gubGVmdCAtIGJveC5yaWdodDtcbiAgfVxuICBpZiAodHlwZW9mIGJveC5oZWlnaHQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgYm94LmhlaWdodCA9IGRvY3VtZW50LmJvZHkuc2Nyb2xsSGVpZ2h0IC0gYm94LnRvcCAtIGJveC5ib3R0b207XG4gIH1cblxuICBib3gudG9wID0gYm94LnRvcCAtIGRvY0VsLmNsaWVudFRvcDtcbiAgYm94LmxlZnQgPSBib3gubGVmdCAtIGRvY0VsLmNsaWVudExlZnQ7XG4gIGJveC5yaWdodCA9IGRvYy5ib2R5LmNsaWVudFdpZHRoIC0gYm94LndpZHRoIC0gYm94LmxlZnQ7XG4gIGJveC5ib3R0b20gPSBkb2MuYm9keS5jbGllbnRIZWlnaHQgLSBib3guaGVpZ2h0IC0gYm94LnRvcDtcblxuICByZXR1cm4gYm94O1xufVxuXG5mdW5jdGlvbiBnZXRPZmZzZXRQYXJlbnQoZWwpIHtcbiAgcmV0dXJuIGVsLm9mZnNldFBhcmVudCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG59XG5cbnZhciBfc2Nyb2xsQmFyU2l6ZSA9IG51bGw7XG5mdW5jdGlvbiBnZXRTY3JvbGxCYXJTaXplKCkge1xuICBpZiAoX3Njcm9sbEJhclNpemUpIHtcbiAgICByZXR1cm4gX3Njcm9sbEJhclNpemU7XG4gIH1cbiAgdmFyIGlubmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGlubmVyLnN0eWxlLndpZHRoID0gJzEwMCUnO1xuICBpbm5lci5zdHlsZS5oZWlnaHQgPSAnMjAwcHgnO1xuXG4gIHZhciBvdXRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBleHRlbmQob3V0ZXIuc3R5bGUsIHtcbiAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcbiAgICB0b3A6IDAsXG4gICAgbGVmdDogMCxcbiAgICBwb2ludGVyRXZlbnRzOiAnbm9uZScsXG4gICAgdmlzaWJpbGl0eTogJ2hpZGRlbicsXG4gICAgd2lkdGg6ICcyMDBweCcsXG4gICAgaGVpZ2h0OiAnMTUwcHgnLFxuICAgIG92ZXJmbG93OiAnaGlkZGVuJ1xuICB9KTtcblxuICBvdXRlci5hcHBlbmRDaGlsZChpbm5lcik7XG5cbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChvdXRlcik7XG5cbiAgdmFyIHdpZHRoQ29udGFpbmVkID0gaW5uZXIub2Zmc2V0V2lkdGg7XG4gIG91dGVyLnN0eWxlLm92ZXJmbG93ID0gJ3Njcm9sbCc7XG4gIHZhciB3aWR0aFNjcm9sbCA9IGlubmVyLm9mZnNldFdpZHRoO1xuXG4gIGlmICh3aWR0aENvbnRhaW5lZCA9PT0gd2lkdGhTY3JvbGwpIHtcbiAgICB3aWR0aFNjcm9sbCA9IG91dGVyLmNsaWVudFdpZHRoO1xuICB9XG5cbiAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChvdXRlcik7XG5cbiAgdmFyIHdpZHRoID0gd2lkdGhDb250YWluZWQgLSB3aWR0aFNjcm9sbDtcblxuICBfc2Nyb2xsQmFyU2l6ZSA9IHsgd2lkdGg6IHdpZHRoLCBoZWlnaHQ6IHdpZHRoIH07XG4gIHJldHVybiBfc2Nyb2xsQmFyU2l6ZTtcbn1cblxuZnVuY3Rpb24gZXh0ZW5kKCkge1xuICB2YXIgb3V0ID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMF07XG5cbiAgdmFyIGFyZ3MgPSBbXTtcblxuICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShhcmdzLCBhcmd1bWVudHMpO1xuXG4gIGFyZ3Muc2xpY2UoMSkuZm9yRWFjaChmdW5jdGlvbiAob2JqKSB7XG4gICAgaWYgKG9iaikge1xuICAgICAgZm9yICh2YXIga2V5IGluIG9iaikge1xuICAgICAgICBpZiAoKHt9KS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkge1xuICAgICAgICAgIG91dFtrZXldID0gb2JqW2tleV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBvdXQ7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUNsYXNzKGVsLCBuYW1lKSB7XG4gIGlmICh0eXBlb2YgZWwuY2xhc3NMaXN0ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG5hbWUuc3BsaXQoJyAnKS5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICAgIGlmIChjbHMudHJpbSgpKSB7XG4gICAgICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoY2xzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgcmVnZXggPSBuZXcgUmVnRXhwKCcoXnwgKScgKyBuYW1lLnNwbGl0KCcgJykuam9pbignfCcpICsgJyggfCQpJywgJ2dpJyk7XG4gICAgdmFyIGNsYXNzTmFtZSA9IGdldENsYXNzTmFtZShlbCkucmVwbGFjZShyZWdleCwgJyAnKTtcbiAgICBzZXRDbGFzc05hbWUoZWwsIGNsYXNzTmFtZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkQ2xhc3MoZWwsIG5hbWUpIHtcbiAgaWYgKHR5cGVvZiBlbC5jbGFzc0xpc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgbmFtZS5zcGxpdCgnICcpLmZvckVhY2goZnVuY3Rpb24gKGNscykge1xuICAgICAgaWYgKGNscy50cmltKCkpIHtcbiAgICAgICAgZWwuY2xhc3NMaXN0LmFkZChjbHMpO1xuICAgICAgfVxuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJlbW92ZUNsYXNzKGVsLCBuYW1lKTtcbiAgICB2YXIgY2xzID0gZ2V0Q2xhc3NOYW1lKGVsKSArICgnICcgKyBuYW1lKTtcbiAgICBzZXRDbGFzc05hbWUoZWwsIGNscyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFzQ2xhc3MoZWwsIG5hbWUpIHtcbiAgaWYgKHR5cGVvZiBlbC5jbGFzc0xpc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuIGVsLmNsYXNzTGlzdC5jb250YWlucyhuYW1lKTtcbiAgfVxuICB2YXIgY2xhc3NOYW1lID0gZ2V0Q2xhc3NOYW1lKGVsKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAoJyhefCApJyArIG5hbWUgKyAnKCB8JCknLCAnZ2knKS50ZXN0KGNsYXNzTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGdldENsYXNzTmFtZShlbCkge1xuICAvLyBDYW4ndCB1c2UganVzdCBTVkdBbmltYXRlZFN0cmluZyBoZXJlIHNpbmNlIG5vZGVzIHdpdGhpbiBhIEZyYW1lIGluIElFIGhhdmVcbiAgLy8gY29tcGxldGVseSBzZXBhcmF0ZWx5IFNWR0FuaW1hdGVkU3RyaW5nIGJhc2UgY2xhc3Nlc1xuICBpZiAoZWwuY2xhc3NOYW1lIGluc3RhbmNlb2YgZWwub3duZXJEb2N1bWVudC5kZWZhdWx0Vmlldy5TVkdBbmltYXRlZFN0cmluZykge1xuICAgIHJldHVybiBlbC5jbGFzc05hbWUuYmFzZVZhbDtcbiAgfVxuICByZXR1cm4gZWwuY2xhc3NOYW1lO1xufVxuXG5mdW5jdGlvbiBzZXRDbGFzc05hbWUoZWwsIGNsYXNzTmFtZSkge1xuICBlbC5zZXRBdHRyaWJ1dGUoJ2NsYXNzJywgY2xhc3NOYW1lKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQ2xhc3NlcyhlbCwgYWRkLCBhbGwpIHtcbiAgLy8gT2YgdGhlIHNldCBvZiAnYWxsJyBjbGFzc2VzLCB3ZSBuZWVkIHRoZSAnYWRkJyBjbGFzc2VzLCBhbmQgb25seSB0aGVcbiAgLy8gJ2FkZCcgY2xhc3NlcyB0byBiZSBzZXQuXG4gIGFsbC5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICBpZiAoYWRkLmluZGV4T2YoY2xzKSA9PT0gLTEgJiYgaGFzQ2xhc3MoZWwsIGNscykpIHtcbiAgICAgIHJlbW92ZUNsYXNzKGVsLCBjbHMpO1xuICAgIH1cbiAgfSk7XG5cbiAgYWRkLmZvckVhY2goZnVuY3Rpb24gKGNscykge1xuICAgIGlmICghaGFzQ2xhc3MoZWwsIGNscykpIHtcbiAgICAgIGFkZENsYXNzKGVsLCBjbHMpO1xuICAgIH1cbiAgfSk7XG59XG5cbnZhciBkZWZlcnJlZCA9IFtdO1xuXG52YXIgZGVmZXIgPSBmdW5jdGlvbiBkZWZlcihmbikge1xuICBkZWZlcnJlZC5wdXNoKGZuKTtcbn07XG5cbnZhciBmbHVzaCA9IGZ1bmN0aW9uIGZsdXNoKCkge1xuICB2YXIgZm4gPSB1bmRlZmluZWQ7XG4gIHdoaWxlIChmbiA9IGRlZmVycmVkLnBvcCgpKSB7XG4gICAgZm4oKTtcbiAgfVxufTtcblxudmFyIEV2ZW50ZWQgPSAoZnVuY3Rpb24gKCkge1xuICBmdW5jdGlvbiBFdmVudGVkKCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBFdmVudGVkKTtcbiAgfVxuXG4gIF9jcmVhdGVDbGFzcyhFdmVudGVkLCBbe1xuICAgIGtleTogJ29uJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gb24oZXZlbnQsIGhhbmRsZXIsIGN0eCkge1xuICAgICAgdmFyIG9uY2UgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDMgfHwgYXJndW1lbnRzWzNdID09PSB1bmRlZmluZWQgPyBmYWxzZSA6IGFyZ3VtZW50c1szXTtcblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLmJpbmRpbmdzID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLmJpbmRpbmdzID0ge307XG4gICAgICB9XG4gICAgICBpZiAodHlwZW9mIHRoaXMuYmluZGluZ3NbZXZlbnRdID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICB0aGlzLmJpbmRpbmdzW2V2ZW50XSA9IFtdO1xuICAgICAgfVxuICAgICAgdGhpcy5iaW5kaW5nc1tldmVudF0ucHVzaCh7IGhhbmRsZXI6IGhhbmRsZXIsIGN0eDogY3R4LCBvbmNlOiBvbmNlIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ29uY2UnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBvbmNlKGV2ZW50LCBoYW5kbGVyLCBjdHgpIHtcbiAgICAgIHRoaXMub24oZXZlbnQsIGhhbmRsZXIsIGN0eCwgdHJ1ZSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnb2ZmJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gb2ZmKGV2ZW50LCBoYW5kbGVyKSB7XG4gICAgICBpZiAodHlwZW9mIHRoaXMuYmluZGluZ3MgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiB0aGlzLmJpbmRpbmdzW2V2ZW50XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGhhbmRsZXIgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLmJpbmRpbmdzW2V2ZW50XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgd2hpbGUgKGkgPCB0aGlzLmJpbmRpbmdzW2V2ZW50XS5sZW5ndGgpIHtcbiAgICAgICAgICBpZiAodGhpcy5iaW5kaW5nc1tldmVudF1baV0uaGFuZGxlciA9PT0gaGFuZGxlcikge1xuICAgICAgICAgICAgdGhpcy5iaW5kaW5nc1tldmVudF0uc3BsaWNlKGksIDEpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICArK2k7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAndHJpZ2dlcicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHRyaWdnZXIoZXZlbnQpIHtcbiAgICAgIGlmICh0eXBlb2YgdGhpcy5iaW5kaW5ncyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5iaW5kaW5nc1tldmVudF0pIHtcbiAgICAgICAgdmFyIGkgPSAwO1xuXG4gICAgICAgIGZvciAodmFyIF9sZW4gPSBhcmd1bWVudHMubGVuZ3RoLCBhcmdzID0gQXJyYXkoX2xlbiA+IDEgPyBfbGVuIC0gMSA6IDApLCBfa2V5ID0gMTsgX2tleSA8IF9sZW47IF9rZXkrKykge1xuICAgICAgICAgIGFyZ3NbX2tleSAtIDFdID0gYXJndW1lbnRzW19rZXldO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGkgPCB0aGlzLmJpbmRpbmdzW2V2ZW50XS5sZW5ndGgpIHtcbiAgICAgICAgICB2YXIgX2JpbmRpbmdzJGV2ZW50JGkgPSB0aGlzLmJpbmRpbmdzW2V2ZW50XVtpXTtcbiAgICAgICAgICB2YXIgaGFuZGxlciA9IF9iaW5kaW5ncyRldmVudCRpLmhhbmRsZXI7XG4gICAgICAgICAgdmFyIGN0eCA9IF9iaW5kaW5ncyRldmVudCRpLmN0eDtcbiAgICAgICAgICB2YXIgb25jZSA9IF9iaW5kaW5ncyRldmVudCRpLm9uY2U7XG5cbiAgICAgICAgICB2YXIgY29udGV4dCA9IGN0eDtcbiAgICAgICAgICBpZiAodHlwZW9mIGNvbnRleHQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBjb250ZXh0ID0gdGhpcztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBoYW5kbGVyLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuXG4gICAgICAgICAgaWYgKG9uY2UpIHtcbiAgICAgICAgICAgIHRoaXMuYmluZGluZ3NbZXZlbnRdLnNwbGljZShpLCAxKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgKytpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBFdmVudGVkO1xufSkoKTtcblxuVGV0aGVyQmFzZS5VdGlscyA9IHtcbiAgZ2V0QWN0dWFsQm91bmRpbmdDbGllbnRSZWN0OiBnZXRBY3R1YWxCb3VuZGluZ0NsaWVudFJlY3QsXG4gIGdldFNjcm9sbFBhcmVudHM6IGdldFNjcm9sbFBhcmVudHMsXG4gIGdldEJvdW5kczogZ2V0Qm91bmRzLFxuICBnZXRPZmZzZXRQYXJlbnQ6IGdldE9mZnNldFBhcmVudCxcbiAgZXh0ZW5kOiBleHRlbmQsXG4gIGFkZENsYXNzOiBhZGRDbGFzcyxcbiAgcmVtb3ZlQ2xhc3M6IHJlbW92ZUNsYXNzLFxuICBoYXNDbGFzczogaGFzQ2xhc3MsXG4gIHVwZGF0ZUNsYXNzZXM6IHVwZGF0ZUNsYXNzZXMsXG4gIGRlZmVyOiBkZWZlcixcbiAgZmx1c2g6IGZsdXNoLFxuICB1bmlxdWVJZDogdW5pcXVlSWQsXG4gIEV2ZW50ZWQ6IEV2ZW50ZWQsXG4gIGdldFNjcm9sbEJhclNpemU6IGdldFNjcm9sbEJhclNpemUsXG4gIHJlbW92ZVV0aWxFbGVtZW50czogcmVtb3ZlVXRpbEVsZW1lbnRzXG59O1xuLyogZ2xvYmFscyBUZXRoZXJCYXNlLCBwZXJmb3JtYW5jZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfc2xpY2VkVG9BcnJheSA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIHNsaWNlSXRlcmF0b3IoYXJyLCBpKSB7IHZhciBfYXJyID0gW107IHZhciBfbiA9IHRydWU7IHZhciBfZCA9IGZhbHNlOyB2YXIgX2UgPSB1bmRlZmluZWQ7IHRyeSB7IGZvciAodmFyIF9pID0gYXJyW1N5bWJvbC5pdGVyYXRvcl0oKSwgX3M7ICEoX24gPSAoX3MgPSBfaS5uZXh0KCkpLmRvbmUpOyBfbiA9IHRydWUpIHsgX2Fyci5wdXNoKF9zLnZhbHVlKTsgaWYgKGkgJiYgX2Fyci5sZW5ndGggPT09IGkpIGJyZWFrOyB9IH0gY2F0Y2ggKGVycikgeyBfZCA9IHRydWU7IF9lID0gZXJyOyB9IGZpbmFsbHkgeyB0cnkgeyBpZiAoIV9uICYmIF9pWydyZXR1cm4nXSkgX2lbJ3JldHVybiddKCk7IH0gZmluYWxseSB7IGlmIChfZCkgdGhyb3cgX2U7IH0gfSByZXR1cm4gX2FycjsgfSByZXR1cm4gZnVuY3Rpb24gKGFyciwgaSkgeyBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7IHJldHVybiBhcnI7IH0gZWxzZSBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChhcnIpKSB7IHJldHVybiBzbGljZUl0ZXJhdG9yKGFyciwgaSk7IH0gZWxzZSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2UnKTsgfSB9OyB9KSgpO1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpO1xuXG52YXIgX2dldCA9IGZ1bmN0aW9uIGdldChfeDYsIF94NywgX3g4KSB7IHZhciBfYWdhaW4gPSB0cnVlOyBfZnVuY3Rpb246IHdoaWxlIChfYWdhaW4pIHsgdmFyIG9iamVjdCA9IF94NiwgcHJvcGVydHkgPSBfeDcsIHJlY2VpdmVyID0gX3g4OyBfYWdhaW4gPSBmYWxzZTsgaWYgKG9iamVjdCA9PT0gbnVsbCkgb2JqZWN0ID0gRnVuY3Rpb24ucHJvdG90eXBlOyB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqZWN0LCBwcm9wZXJ0eSk7IGlmIChkZXNjID09PSB1bmRlZmluZWQpIHsgdmFyIHBhcmVudCA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmplY3QpOyBpZiAocGFyZW50ID09PSBudWxsKSB7IHJldHVybiB1bmRlZmluZWQ7IH0gZWxzZSB7IF94NiA9IHBhcmVudDsgX3g3ID0gcHJvcGVydHk7IF94OCA9IHJlY2VpdmVyOyBfYWdhaW4gPSB0cnVlOyBkZXNjID0gcGFyZW50ID0gdW5kZWZpbmVkOyBjb250aW51ZSBfZnVuY3Rpb247IH0gfSBlbHNlIGlmICgndmFsdWUnIGluIGRlc2MpIHsgcmV0dXJuIGRlc2MudmFsdWU7IH0gZWxzZSB7IHZhciBnZXR0ZXIgPSBkZXNjLmdldDsgaWYgKGdldHRlciA9PT0gdW5kZWZpbmVkKSB7IHJldHVybiB1bmRlZmluZWQ7IH0gcmV0dXJuIGdldHRlci5jYWxsKHJlY2VpdmVyKTsgfSB9IH07XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG5mdW5jdGlvbiBfaW5oZXJpdHMoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHsgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSAnZnVuY3Rpb24nICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCAnICsgdHlwZW9mIHN1cGVyQ2xhc3MpOyB9IHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwgeyBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogc3ViQ2xhc3MsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0gfSk7IGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzczsgfVxuXG5pZiAodHlwZW9mIFRldGhlckJhc2UgPT09ICd1bmRlZmluZWQnKSB7XG4gIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgaW5jbHVkZSB0aGUgdXRpbHMuanMgZmlsZSBiZWZvcmUgdGV0aGVyLmpzJyk7XG59XG5cbnZhciBfVGV0aGVyQmFzZSRVdGlscyA9IFRldGhlckJhc2UuVXRpbHM7XG52YXIgZ2V0U2Nyb2xsUGFyZW50cyA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldFNjcm9sbFBhcmVudHM7XG52YXIgZ2V0Qm91bmRzID0gX1RldGhlckJhc2UkVXRpbHMuZ2V0Qm91bmRzO1xudmFyIGdldE9mZnNldFBhcmVudCA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldE9mZnNldFBhcmVudDtcbnZhciBleHRlbmQgPSBfVGV0aGVyQmFzZSRVdGlscy5leHRlbmQ7XG52YXIgYWRkQ2xhc3MgPSBfVGV0aGVyQmFzZSRVdGlscy5hZGRDbGFzcztcbnZhciByZW1vdmVDbGFzcyA9IF9UZXRoZXJCYXNlJFV0aWxzLnJlbW92ZUNsYXNzO1xudmFyIHVwZGF0ZUNsYXNzZXMgPSBfVGV0aGVyQmFzZSRVdGlscy51cGRhdGVDbGFzc2VzO1xudmFyIGRlZmVyID0gX1RldGhlckJhc2UkVXRpbHMuZGVmZXI7XG52YXIgZmx1c2ggPSBfVGV0aGVyQmFzZSRVdGlscy5mbHVzaDtcbnZhciBnZXRTY3JvbGxCYXJTaXplID0gX1RldGhlckJhc2UkVXRpbHMuZ2V0U2Nyb2xsQmFyU2l6ZTtcbnZhciByZW1vdmVVdGlsRWxlbWVudHMgPSBfVGV0aGVyQmFzZSRVdGlscy5yZW1vdmVVdGlsRWxlbWVudHM7XG5cbmZ1bmN0aW9uIHdpdGhpbihhLCBiKSB7XG4gIHZhciBkaWZmID0gYXJndW1lbnRzLmxlbmd0aCA8PSAyIHx8IGFyZ3VtZW50c1syXSA9PT0gdW5kZWZpbmVkID8gMSA6IGFyZ3VtZW50c1syXTtcblxuICByZXR1cm4gYSArIGRpZmYgPj0gYiAmJiBiID49IGEgLSBkaWZmO1xufVxuXG52YXIgdHJhbnNmb3JtS2V5ID0gKGZ1bmN0aW9uICgpIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICByZXR1cm4gJyc7XG4gIH1cbiAgdmFyIGVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cbiAgdmFyIHRyYW5zZm9ybXMgPSBbJ3RyYW5zZm9ybScsICdXZWJraXRUcmFuc2Zvcm0nLCAnT1RyYW5zZm9ybScsICdNb3pUcmFuc2Zvcm0nLCAnbXNUcmFuc2Zvcm0nXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmFuc2Zvcm1zLmxlbmd0aDsgKytpKSB7XG4gICAgdmFyIGtleSA9IHRyYW5zZm9ybXNbaV07XG4gICAgaWYgKGVsLnN0eWxlW2tleV0gIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGtleTtcbiAgICB9XG4gIH1cbn0pKCk7XG5cbnZhciB0ZXRoZXJzID0gW107XG5cbnZhciBwb3NpdGlvbiA9IGZ1bmN0aW9uIHBvc2l0aW9uKCkge1xuICB0ZXRoZXJzLmZvckVhY2goZnVuY3Rpb24gKHRldGhlcikge1xuICAgIHRldGhlci5wb3NpdGlvbihmYWxzZSk7XG4gIH0pO1xuICBmbHVzaCgpO1xufTtcblxuZnVuY3Rpb24gbm93KCkge1xuICBpZiAodHlwZW9mIHBlcmZvcm1hbmNlID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgcGVyZm9ybWFuY2Uubm93ID09PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpO1xuICB9XG4gIHJldHVybiArbmV3IERhdGUoKTtcbn1cblxuKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGxhc3RDYWxsID0gbnVsbDtcbiAgdmFyIGxhc3REdXJhdGlvbiA9IG51bGw7XG4gIHZhciBwZW5kaW5nVGltZW91dCA9IG51bGw7XG5cbiAgdmFyIHRpY2sgPSBmdW5jdGlvbiB0aWNrKCkge1xuICAgIGlmICh0eXBlb2YgbGFzdER1cmF0aW9uICE9PSAndW5kZWZpbmVkJyAmJiBsYXN0RHVyYXRpb24gPiAxNikge1xuICAgICAgLy8gV2Ugdm9sdW50YXJpbHkgdGhyb3R0bGUgb3Vyc2VsdmVzIGlmIHdlIGNhbid0IG1hbmFnZSA2MGZwc1xuICAgICAgbGFzdER1cmF0aW9uID0gTWF0aC5taW4obGFzdER1cmF0aW9uIC0gMTYsIDI1MCk7XG5cbiAgICAgIC8vIEp1c3QgaW4gY2FzZSB0aGlzIGlzIHRoZSBsYXN0IGV2ZW50LCByZW1lbWJlciB0byBwb3NpdGlvbiBqdXN0IG9uY2UgbW9yZVxuICAgICAgcGVuZGluZ1RpbWVvdXQgPSBzZXRUaW1lb3V0KHRpY2ssIDI1MCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBsYXN0Q2FsbCAhPT0gJ3VuZGVmaW5lZCcgJiYgbm93KCkgLSBsYXN0Q2FsbCA8IDEwKSB7XG4gICAgICAvLyBTb21lIGJyb3dzZXJzIGNhbGwgZXZlbnRzIGEgbGl0dGxlIHRvbyBmcmVxdWVudGx5LCByZWZ1c2UgdG8gcnVuIG1vcmUgdGhhbiBpcyByZWFzb25hYmxlXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHBlbmRpbmdUaW1lb3V0ICE9IG51bGwpIHtcbiAgICAgIGNsZWFyVGltZW91dChwZW5kaW5nVGltZW91dCk7XG4gICAgICBwZW5kaW5nVGltZW91dCA9IG51bGw7XG4gICAgfVxuXG4gICAgbGFzdENhbGwgPSBub3coKTtcbiAgICBwb3NpdGlvbigpO1xuICAgIGxhc3REdXJhdGlvbiA9IG5vdygpIC0gbGFzdENhbGw7XG4gIH07XG5cbiAgaWYgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmIHR5cGVvZiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBbJ3Jlc2l6ZScsICdzY3JvbGwnLCAndG91Y2htb3ZlJ10uZm9yRWFjaChmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKGV2ZW50LCB0aWNrKTtcbiAgICB9KTtcbiAgfVxufSkoKTtcblxudmFyIE1JUlJPUl9MUiA9IHtcbiAgY2VudGVyOiAnY2VudGVyJyxcbiAgbGVmdDogJ3JpZ2h0JyxcbiAgcmlnaHQ6ICdsZWZ0J1xufTtcblxudmFyIE1JUlJPUl9UQiA9IHtcbiAgbWlkZGxlOiAnbWlkZGxlJyxcbiAgdG9wOiAnYm90dG9tJyxcbiAgYm90dG9tOiAndG9wJ1xufTtcblxudmFyIE9GRlNFVF9NQVAgPSB7XG4gIHRvcDogMCxcbiAgbGVmdDogMCxcbiAgbWlkZGxlOiAnNTAlJyxcbiAgY2VudGVyOiAnNTAlJyxcbiAgYm90dG9tOiAnMTAwJScsXG4gIHJpZ2h0OiAnMTAwJSdcbn07XG5cbnZhciBhdXRvVG9GaXhlZEF0dGFjaG1lbnQgPSBmdW5jdGlvbiBhdXRvVG9GaXhlZEF0dGFjaG1lbnQoYXR0YWNobWVudCwgcmVsYXRpdmVUb0F0dGFjaG1lbnQpIHtcbiAgdmFyIGxlZnQgPSBhdHRhY2htZW50LmxlZnQ7XG4gIHZhciB0b3AgPSBhdHRhY2htZW50LnRvcDtcblxuICBpZiAobGVmdCA9PT0gJ2F1dG8nKSB7XG4gICAgbGVmdCA9IE1JUlJPUl9MUltyZWxhdGl2ZVRvQXR0YWNobWVudC5sZWZ0XTtcbiAgfVxuXG4gIGlmICh0b3AgPT09ICdhdXRvJykge1xuICAgIHRvcCA9IE1JUlJPUl9UQltyZWxhdGl2ZVRvQXR0YWNobWVudC50b3BdO1xuICB9XG5cbiAgcmV0dXJuIHsgbGVmdDogbGVmdCwgdG9wOiB0b3AgfTtcbn07XG5cbnZhciBhdHRhY2htZW50VG9PZmZzZXQgPSBmdW5jdGlvbiBhdHRhY2htZW50VG9PZmZzZXQoYXR0YWNobWVudCkge1xuICB2YXIgbGVmdCA9IGF0dGFjaG1lbnQubGVmdDtcbiAgdmFyIHRvcCA9IGF0dGFjaG1lbnQudG9wO1xuXG4gIGlmICh0eXBlb2YgT0ZGU0VUX01BUFthdHRhY2htZW50LmxlZnRdICE9PSAndW5kZWZpbmVkJykge1xuICAgIGxlZnQgPSBPRkZTRVRfTUFQW2F0dGFjaG1lbnQubGVmdF07XG4gIH1cblxuICBpZiAodHlwZW9mIE9GRlNFVF9NQVBbYXR0YWNobWVudC50b3BdICE9PSAndW5kZWZpbmVkJykge1xuICAgIHRvcCA9IE9GRlNFVF9NQVBbYXR0YWNobWVudC50b3BdO1xuICB9XG5cbiAgcmV0dXJuIHsgbGVmdDogbGVmdCwgdG9wOiB0b3AgfTtcbn07XG5cbmZ1bmN0aW9uIGFkZE9mZnNldCgpIHtcbiAgdmFyIG91dCA9IHsgdG9wOiAwLCBsZWZ0OiAwIH07XG5cbiAgZm9yICh2YXIgX2xlbiA9IGFyZ3VtZW50cy5sZW5ndGgsIG9mZnNldHMgPSBBcnJheShfbGVuKSwgX2tleSA9IDA7IF9rZXkgPCBfbGVuOyBfa2V5KyspIHtcbiAgICBvZmZzZXRzW19rZXldID0gYXJndW1lbnRzW19rZXldO1xuICB9XG5cbiAgb2Zmc2V0cy5mb3JFYWNoKGZ1bmN0aW9uIChfcmVmKSB7XG4gICAgdmFyIHRvcCA9IF9yZWYudG9wO1xuICAgIHZhciBsZWZ0ID0gX3JlZi5sZWZ0O1xuXG4gICAgaWYgKHR5cGVvZiB0b3AgPT09ICdzdHJpbmcnKSB7XG4gICAgICB0b3AgPSBwYXJzZUZsb2F0KHRvcCwgMTApO1xuICAgIH1cbiAgICBpZiAodHlwZW9mIGxlZnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBsZWZ0ID0gcGFyc2VGbG9hdChsZWZ0LCAxMCk7XG4gICAgfVxuXG4gICAgb3V0LnRvcCArPSB0b3A7XG4gICAgb3V0LmxlZnQgKz0gbGVmdDtcbiAgfSk7XG5cbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gb2Zmc2V0VG9QeChvZmZzZXQsIHNpemUpIHtcbiAgaWYgKHR5cGVvZiBvZmZzZXQubGVmdCA9PT0gJ3N0cmluZycgJiYgb2Zmc2V0LmxlZnQuaW5kZXhPZignJScpICE9PSAtMSkge1xuICAgIG9mZnNldC5sZWZ0ID0gcGFyc2VGbG9hdChvZmZzZXQubGVmdCwgMTApIC8gMTAwICogc2l6ZS53aWR0aDtcbiAgfVxuICBpZiAodHlwZW9mIG9mZnNldC50b3AgPT09ICdzdHJpbmcnICYmIG9mZnNldC50b3AuaW5kZXhPZignJScpICE9PSAtMSkge1xuICAgIG9mZnNldC50b3AgPSBwYXJzZUZsb2F0KG9mZnNldC50b3AsIDEwKSAvIDEwMCAqIHNpemUuaGVpZ2h0O1xuICB9XG5cbiAgcmV0dXJuIG9mZnNldDtcbn1cblxudmFyIHBhcnNlT2Zmc2V0ID0gZnVuY3Rpb24gcGFyc2VPZmZzZXQodmFsdWUpIHtcbiAgdmFyIF92YWx1ZSRzcGxpdCA9IHZhbHVlLnNwbGl0KCcgJyk7XG5cbiAgdmFyIF92YWx1ZSRzcGxpdDIgPSBfc2xpY2VkVG9BcnJheShfdmFsdWUkc3BsaXQsIDIpO1xuXG4gIHZhciB0b3AgPSBfdmFsdWUkc3BsaXQyWzBdO1xuICB2YXIgbGVmdCA9IF92YWx1ZSRzcGxpdDJbMV07XG5cbiAgcmV0dXJuIHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQgfTtcbn07XG52YXIgcGFyc2VBdHRhY2htZW50ID0gcGFyc2VPZmZzZXQ7XG5cbnZhciBUZXRoZXJDbGFzcyA9IChmdW5jdGlvbiAoX0V2ZW50ZWQpIHtcbiAgX2luaGVyaXRzKFRldGhlckNsYXNzLCBfRXZlbnRlZCk7XG5cbiAgZnVuY3Rpb24gVGV0aGVyQ2xhc3Mob3B0aW9ucykge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgVGV0aGVyQ2xhc3MpO1xuXG4gICAgX2dldChPYmplY3QuZ2V0UHJvdG90eXBlT2YoVGV0aGVyQ2xhc3MucHJvdG90eXBlKSwgJ2NvbnN0cnVjdG9yJywgdGhpcykuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnBvc2l0aW9uID0gdGhpcy5wb3NpdGlvbi5iaW5kKHRoaXMpO1xuXG4gICAgdGV0aGVycy5wdXNoKHRoaXMpO1xuXG4gICAgdGhpcy5oaXN0b3J5ID0gW107XG5cbiAgICB0aGlzLnNldE9wdGlvbnMob3B0aW9ucywgZmFsc2UpO1xuXG4gICAgVGV0aGVyQmFzZS5tb2R1bGVzLmZvckVhY2goZnVuY3Rpb24gKG1vZHVsZSkge1xuICAgICAgaWYgKHR5cGVvZiBtb2R1bGUuaW5pdGlhbGl6ZSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgbW9kdWxlLmluaXRpYWxpemUuY2FsbChfdGhpcyk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICB0aGlzLnBvc2l0aW9uKCk7XG4gIH1cblxuICBfY3JlYXRlQ2xhc3MoVGV0aGVyQ2xhc3MsIFt7XG4gICAga2V5OiAnZ2V0Q2xhc3MnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRDbGFzcygpIHtcbiAgICAgIHZhciBrZXkgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyAnJyA6IGFyZ3VtZW50c1swXTtcbiAgICAgIHZhciBjbGFzc2VzID0gdGhpcy5vcHRpb25zLmNsYXNzZXM7XG5cbiAgICAgIGlmICh0eXBlb2YgY2xhc3NlcyAhPT0gJ3VuZGVmaW5lZCcgJiYgY2xhc3Nlc1trZXldKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnMuY2xhc3Nlc1trZXldO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuY2xhc3NQcmVmaXgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9ucy5jbGFzc1ByZWZpeCArICctJyArIGtleTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBrZXk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc2V0T3B0aW9ucycsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHNldE9wdGlvbnMob3B0aW9ucykge1xuICAgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgICAgIHZhciBwb3MgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDEgfHwgYXJndW1lbnRzWzFdID09PSB1bmRlZmluZWQgPyB0cnVlIDogYXJndW1lbnRzWzFdO1xuXG4gICAgICB2YXIgZGVmYXVsdHMgPSB7XG4gICAgICAgIG9mZnNldDogJzAgMCcsXG4gICAgICAgIHRhcmdldE9mZnNldDogJzAgMCcsXG4gICAgICAgIHRhcmdldEF0dGFjaG1lbnQ6ICdhdXRvIGF1dG8nLFxuICAgICAgICBjbGFzc1ByZWZpeDogJ3RldGhlcidcbiAgICAgIH07XG5cbiAgICAgIHRoaXMub3B0aW9ucyA9IGV4dGVuZChkZWZhdWx0cywgb3B0aW9ucyk7XG5cbiAgICAgIHZhciBfb3B0aW9ucyA9IHRoaXMub3B0aW9ucztcbiAgICAgIHZhciBlbGVtZW50ID0gX29wdGlvbnMuZWxlbWVudDtcbiAgICAgIHZhciB0YXJnZXQgPSBfb3B0aW9ucy50YXJnZXQ7XG4gICAgICB2YXIgdGFyZ2V0TW9kaWZpZXIgPSBfb3B0aW9ucy50YXJnZXRNb2RpZmllcjtcblxuICAgICAgdGhpcy5lbGVtZW50ID0gZWxlbWVudDtcbiAgICAgIHRoaXMudGFyZ2V0ID0gdGFyZ2V0O1xuICAgICAgdGhpcy50YXJnZXRNb2RpZmllciA9IHRhcmdldE1vZGlmaWVyO1xuXG4gICAgICBpZiAodGhpcy50YXJnZXQgPT09ICd2aWV3cG9ydCcpIHtcbiAgICAgICAgdGhpcy50YXJnZXQgPSBkb2N1bWVudC5ib2R5O1xuICAgICAgICB0aGlzLnRhcmdldE1vZGlmaWVyID0gJ3Zpc2libGUnO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnRhcmdldCA9PT0gJ3Njcm9sbC1oYW5kbGUnKSB7XG4gICAgICAgIHRoaXMudGFyZ2V0ID0gZG9jdW1lbnQuYm9keTtcbiAgICAgICAgdGhpcy50YXJnZXRNb2RpZmllciA9ICdzY3JvbGwtaGFuZGxlJztcbiAgICAgIH1cblxuICAgICAgWydlbGVtZW50JywgJ3RhcmdldCddLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICBpZiAodHlwZW9mIF90aGlzMltrZXldID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVGV0aGVyIEVycm9yOiBCb3RoIGVsZW1lbnQgYW5kIHRhcmdldCBtdXN0IGJlIGRlZmluZWQnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2YgX3RoaXMyW2tleV0uanF1ZXJ5ICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIF90aGlzMltrZXldID0gX3RoaXMyW2tleV1bMF07XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIF90aGlzMltrZXldID09PSAnc3RyaW5nJykge1xuICAgICAgICAgIF90aGlzMltrZXldID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihfdGhpczJba2V5XSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBhZGRDbGFzcyh0aGlzLmVsZW1lbnQsIHRoaXMuZ2V0Q2xhc3MoJ2VsZW1lbnQnKSk7XG4gICAgICBpZiAoISh0aGlzLm9wdGlvbnMuYWRkVGFyZ2V0Q2xhc3NlcyA9PT0gZmFsc2UpKSB7XG4gICAgICAgIGFkZENsYXNzKHRoaXMudGFyZ2V0LCB0aGlzLmdldENsYXNzKCd0YXJnZXQnKSk7XG4gICAgICB9XG5cbiAgICAgIGlmICghdGhpcy5vcHRpb25zLmF0dGFjaG1lbnQpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUZXRoZXIgRXJyb3I6IFlvdSBtdXN0IHByb3ZpZGUgYW4gYXR0YWNobWVudCcpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnRhcmdldEF0dGFjaG1lbnQgPSBwYXJzZUF0dGFjaG1lbnQodGhpcy5vcHRpb25zLnRhcmdldEF0dGFjaG1lbnQpO1xuICAgICAgdGhpcy5hdHRhY2htZW50ID0gcGFyc2VBdHRhY2htZW50KHRoaXMub3B0aW9ucy5hdHRhY2htZW50KTtcbiAgICAgIHRoaXMub2Zmc2V0ID0gcGFyc2VPZmZzZXQodGhpcy5vcHRpb25zLm9mZnNldCk7XG4gICAgICB0aGlzLnRhcmdldE9mZnNldCA9IHBhcnNlT2Zmc2V0KHRoaXMub3B0aW9ucy50YXJnZXRPZmZzZXQpO1xuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuc2Nyb2xsUGFyZW50cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5kaXNhYmxlKCk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLnRhcmdldE1vZGlmaWVyID09PSAnc2Nyb2xsLWhhbmRsZScpIHtcbiAgICAgICAgdGhpcy5zY3JvbGxQYXJlbnRzID0gW3RoaXMudGFyZ2V0XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuc2Nyb2xsUGFyZW50cyA9IGdldFNjcm9sbFBhcmVudHModGhpcy50YXJnZXQpO1xuICAgICAgfVxuXG4gICAgICBpZiAoISh0aGlzLm9wdGlvbnMuZW5hYmxlZCA9PT0gZmFsc2UpKSB7XG4gICAgICAgIHRoaXMuZW5hYmxlKHBvcyk7XG4gICAgICB9XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZ2V0VGFyZ2V0Qm91bmRzJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0VGFyZ2V0Qm91bmRzKCkge1xuICAgICAgaWYgKHR5cGVvZiB0aGlzLnRhcmdldE1vZGlmaWVyICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBpZiAodGhpcy50YXJnZXRNb2RpZmllciA9PT0gJ3Zpc2libGUnKSB7XG4gICAgICAgICAgaWYgKHRoaXMudGFyZ2V0ID09PSBkb2N1bWVudC5ib2R5KSB7XG4gICAgICAgICAgICByZXR1cm4geyB0b3A6IHBhZ2VZT2Zmc2V0LCBsZWZ0OiBwYWdlWE9mZnNldCwgaGVpZ2h0OiBpbm5lckhlaWdodCwgd2lkdGg6IGlubmVyV2lkdGggfTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGJvdW5kcyA9IGdldEJvdW5kcyh0aGlzLnRhcmdldCk7XG5cbiAgICAgICAgICAgIHZhciBvdXQgPSB7XG4gICAgICAgICAgICAgIGhlaWdodDogYm91bmRzLmhlaWdodCxcbiAgICAgICAgICAgICAgd2lkdGg6IGJvdW5kcy53aWR0aCxcbiAgICAgICAgICAgICAgdG9wOiBib3VuZHMudG9wLFxuICAgICAgICAgICAgICBsZWZ0OiBib3VuZHMubGVmdFxuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgb3V0LmhlaWdodCA9IE1hdGgubWluKG91dC5oZWlnaHQsIGJvdW5kcy5oZWlnaHQgLSAocGFnZVlPZmZzZXQgLSBib3VuZHMudG9wKSk7XG4gICAgICAgICAgICBvdXQuaGVpZ2h0ID0gTWF0aC5taW4ob3V0LmhlaWdodCwgYm91bmRzLmhlaWdodCAtIChib3VuZHMudG9wICsgYm91bmRzLmhlaWdodCAtIChwYWdlWU9mZnNldCArIGlubmVySGVpZ2h0KSkpO1xuICAgICAgICAgICAgb3V0LmhlaWdodCA9IE1hdGgubWluKGlubmVySGVpZ2h0LCBvdXQuaGVpZ2h0KTtcbiAgICAgICAgICAgIG91dC5oZWlnaHQgLT0gMjtcblxuICAgICAgICAgICAgb3V0LndpZHRoID0gTWF0aC5taW4ob3V0LndpZHRoLCBib3VuZHMud2lkdGggLSAocGFnZVhPZmZzZXQgLSBib3VuZHMubGVmdCkpO1xuICAgICAgICAgICAgb3V0LndpZHRoID0gTWF0aC5taW4ob3V0LndpZHRoLCBib3VuZHMud2lkdGggLSAoYm91bmRzLmxlZnQgKyBib3VuZHMud2lkdGggLSAocGFnZVhPZmZzZXQgKyBpbm5lcldpZHRoKSkpO1xuICAgICAgICAgICAgb3V0LndpZHRoID0gTWF0aC5taW4oaW5uZXJXaWR0aCwgb3V0LndpZHRoKTtcbiAgICAgICAgICAgIG91dC53aWR0aCAtPSAyO1xuXG4gICAgICAgICAgICBpZiAob3V0LnRvcCA8IHBhZ2VZT2Zmc2V0KSB7XG4gICAgICAgICAgICAgIG91dC50b3AgPSBwYWdlWU9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChvdXQubGVmdCA8IHBhZ2VYT2Zmc2V0KSB7XG4gICAgICAgICAgICAgIG91dC5sZWZ0ID0gcGFnZVhPZmZzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBvdXQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKHRoaXMudGFyZ2V0TW9kaWZpZXIgPT09ICdzY3JvbGwtaGFuZGxlJykge1xuICAgICAgICAgIHZhciBib3VuZHMgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgdmFyIHRhcmdldCA9IHRoaXMudGFyZ2V0O1xuICAgICAgICAgIGlmICh0YXJnZXQgPT09IGRvY3VtZW50LmJvZHkpIHtcbiAgICAgICAgICAgIHRhcmdldCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxuICAgICAgICAgICAgYm91bmRzID0ge1xuICAgICAgICAgICAgICBsZWZ0OiBwYWdlWE9mZnNldCxcbiAgICAgICAgICAgICAgdG9wOiBwYWdlWU9mZnNldCxcbiAgICAgICAgICAgICAgaGVpZ2h0OiBpbm5lckhlaWdodCxcbiAgICAgICAgICAgICAgd2lkdGg6IGlubmVyV2lkdGhcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJvdW5kcyA9IGdldEJvdW5kcyh0YXJnZXQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHZhciBzdHlsZSA9IGdldENvbXB1dGVkU3R5bGUodGFyZ2V0KTtcblxuICAgICAgICAgIHZhciBoYXNCb3R0b21TY3JvbGwgPSB0YXJnZXQuc2Nyb2xsV2lkdGggPiB0YXJnZXQuY2xpZW50V2lkdGggfHwgW3N0eWxlLm92ZXJmbG93LCBzdHlsZS5vdmVyZmxvd1hdLmluZGV4T2YoJ3Njcm9sbCcpID49IDAgfHwgdGhpcy50YXJnZXQgIT09IGRvY3VtZW50LmJvZHk7XG5cbiAgICAgICAgICB2YXIgc2Nyb2xsQm90dG9tID0gMDtcbiAgICAgICAgICBpZiAoaGFzQm90dG9tU2Nyb2xsKSB7XG4gICAgICAgICAgICBzY3JvbGxCb3R0b20gPSAxNTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgaGVpZ2h0ID0gYm91bmRzLmhlaWdodCAtIHBhcnNlRmxvYXQoc3R5bGUuYm9yZGVyVG9wV2lkdGgpIC0gcGFyc2VGbG9hdChzdHlsZS5ib3JkZXJCb3R0b21XaWR0aCkgLSBzY3JvbGxCb3R0b207XG5cbiAgICAgICAgICB2YXIgb3V0ID0ge1xuICAgICAgICAgICAgd2lkdGg6IDE1LFxuICAgICAgICAgICAgaGVpZ2h0OiBoZWlnaHQgKiAwLjk3NSAqIChoZWlnaHQgLyB0YXJnZXQuc2Nyb2xsSGVpZ2h0KSxcbiAgICAgICAgICAgIGxlZnQ6IGJvdW5kcy5sZWZ0ICsgYm91bmRzLndpZHRoIC0gcGFyc2VGbG9hdChzdHlsZS5ib3JkZXJMZWZ0V2lkdGgpIC0gMTVcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgdmFyIGZpdEFkaiA9IDA7XG4gICAgICAgICAgaWYgKGhlaWdodCA8IDQwOCAmJiB0aGlzLnRhcmdldCA9PT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICAgICAgZml0QWRqID0gLTAuMDAwMTEgKiBNYXRoLnBvdyhoZWlnaHQsIDIpIC0gMC4wMDcyNyAqIGhlaWdodCArIDIyLjU4O1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICh0aGlzLnRhcmdldCAhPT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICAgICAgb3V0LmhlaWdodCA9IE1hdGgubWF4KG91dC5oZWlnaHQsIDI0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB2YXIgc2Nyb2xsUGVyY2VudGFnZSA9IHRoaXMudGFyZ2V0LnNjcm9sbFRvcCAvICh0YXJnZXQuc2Nyb2xsSGVpZ2h0IC0gaGVpZ2h0KTtcbiAgICAgICAgICBvdXQudG9wID0gc2Nyb2xsUGVyY2VudGFnZSAqIChoZWlnaHQgLSBvdXQuaGVpZ2h0IC0gZml0QWRqKSArIGJvdW5kcy50b3AgKyBwYXJzZUZsb2F0KHN0eWxlLmJvcmRlclRvcFdpZHRoKTtcblxuICAgICAgICAgIGlmICh0aGlzLnRhcmdldCA9PT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICAgICAgb3V0LmhlaWdodCA9IE1hdGgubWF4KG91dC5oZWlnaHQsIDI0KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gb3V0O1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZ2V0Qm91bmRzKHRoaXMudGFyZ2V0KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdjbGVhckNhY2hlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gY2xlYXJDYWNoZSgpIHtcbiAgICAgIHRoaXMuX2NhY2hlID0ge307XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnY2FjaGUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBjYWNoZShrLCBnZXR0ZXIpIHtcbiAgICAgIC8vIE1vcmUgdGhhbiBvbmUgbW9kdWxlIHdpbGwgb2Z0ZW4gbmVlZCB0aGUgc2FtZSBET00gaW5mbywgc29cbiAgICAgIC8vIHdlIGtlZXAgYSBjYWNoZSB3aGljaCBpcyBjbGVhcmVkIG9uIGVhY2ggcG9zaXRpb24gY2FsbFxuICAgICAgaWYgKHR5cGVvZiB0aGlzLl9jYWNoZSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5fY2FjaGUgPSB7fTtcbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLl9jYWNoZVtrXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5fY2FjaGVba10gPSBnZXR0ZXIuY2FsbCh0aGlzKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXMuX2NhY2hlW2tdO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2VuYWJsZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGVuYWJsZSgpIHtcbiAgICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgICB2YXIgcG9zID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IGFyZ3VtZW50c1swXTtcblxuICAgICAgaWYgKCEodGhpcy5vcHRpb25zLmFkZFRhcmdldENsYXNzZXMgPT09IGZhbHNlKSkge1xuICAgICAgICBhZGRDbGFzcyh0aGlzLnRhcmdldCwgdGhpcy5nZXRDbGFzcygnZW5hYmxlZCcpKTtcbiAgICAgIH1cbiAgICAgIGFkZENsYXNzKHRoaXMuZWxlbWVudCwgdGhpcy5nZXRDbGFzcygnZW5hYmxlZCcpKTtcbiAgICAgIHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cbiAgICAgIHRoaXMuc2Nyb2xsUGFyZW50cy5mb3JFYWNoKGZ1bmN0aW9uIChwYXJlbnQpIHtcbiAgICAgICAgaWYgKHBhcmVudCAhPT0gX3RoaXMzLnRhcmdldC5vd25lckRvY3VtZW50KSB7XG4gICAgICAgICAgcGFyZW50LmFkZEV2ZW50TGlzdGVuZXIoJ3Njcm9sbCcsIF90aGlzMy5wb3NpdGlvbik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAocG9zKSB7XG4gICAgICAgIHRoaXMucG9zaXRpb24oKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdkaXNhYmxlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZGlzYWJsZSgpIHtcbiAgICAgIHZhciBfdGhpczQgPSB0aGlzO1xuXG4gICAgICByZW1vdmVDbGFzcyh0aGlzLnRhcmdldCwgdGhpcy5nZXRDbGFzcygnZW5hYmxlZCcpKTtcbiAgICAgIHJlbW92ZUNsYXNzKHRoaXMuZWxlbWVudCwgdGhpcy5nZXRDbGFzcygnZW5hYmxlZCcpKTtcbiAgICAgIHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuc2Nyb2xsUGFyZW50cyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgdGhpcy5zY3JvbGxQYXJlbnRzLmZvckVhY2goZnVuY3Rpb24gKHBhcmVudCkge1xuICAgICAgICAgIHBhcmVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdzY3JvbGwnLCBfdGhpczQucG9zaXRpb24pO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdkZXN0cm95JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZGVzdHJveSgpIHtcbiAgICAgIHZhciBfdGhpczUgPSB0aGlzO1xuXG4gICAgICB0aGlzLmRpc2FibGUoKTtcblxuICAgICAgdGV0aGVycy5mb3JFYWNoKGZ1bmN0aW9uICh0ZXRoZXIsIGkpIHtcbiAgICAgICAgaWYgKHRldGhlciA9PT0gX3RoaXM1KSB7XG4gICAgICAgICAgdGV0aGVycy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICAvLyBSZW1vdmUgYW55IGVsZW1lbnRzIHdlIHdlcmUgdXNpbmcgZm9yIGNvbnZlbmllbmNlIGZyb20gdGhlIERPTVxuICAgICAgaWYgKHRldGhlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJlbW92ZVV0aWxFbGVtZW50cygpO1xuICAgICAgfVxuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3VwZGF0ZUF0dGFjaENsYXNzZXMnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB1cGRhdGVBdHRhY2hDbGFzc2VzKGVsZW1lbnRBdHRhY2gsIHRhcmdldEF0dGFjaCkge1xuICAgICAgdmFyIF90aGlzNiA9IHRoaXM7XG5cbiAgICAgIGVsZW1lbnRBdHRhY2ggPSBlbGVtZW50QXR0YWNoIHx8IHRoaXMuYXR0YWNobWVudDtcbiAgICAgIHRhcmdldEF0dGFjaCA9IHRhcmdldEF0dGFjaCB8fCB0aGlzLnRhcmdldEF0dGFjaG1lbnQ7XG4gICAgICB2YXIgc2lkZXMgPSBbJ2xlZnQnLCAndG9wJywgJ2JvdHRvbScsICdyaWdodCcsICdtaWRkbGUnLCAnY2VudGVyJ107XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5fYWRkQXR0YWNoQ2xhc3NlcyAhPT0gJ3VuZGVmaW5lZCcgJiYgdGhpcy5fYWRkQXR0YWNoQ2xhc3Nlcy5sZW5ndGgpIHtcbiAgICAgICAgLy8gdXBkYXRlQXR0YWNoQ2xhc3NlcyBjYW4gYmUgY2FsbGVkIG1vcmUgdGhhbiBvbmNlIGluIGEgcG9zaXRpb24gY2FsbCwgc29cbiAgICAgICAgLy8gd2UgbmVlZCB0byBjbGVhbiB1cCBhZnRlciBvdXJzZWx2ZXMgc3VjaCB0aGF0IHdoZW4gdGhlIGxhc3QgZGVmZXIgZ2V0c1xuICAgICAgICAvLyByYW4gaXQgZG9lc24ndCBhZGQgYW55IGV4dHJhIGNsYXNzZXMgZnJvbSBwcmV2aW91cyBjYWxscy5cbiAgICAgICAgdGhpcy5fYWRkQXR0YWNoQ2xhc3Nlcy5zcGxpY2UoMCwgdGhpcy5fYWRkQXR0YWNoQ2xhc3Nlcy5sZW5ndGgpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIHRoaXMuX2FkZEF0dGFjaENsYXNzZXMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHRoaXMuX2FkZEF0dGFjaENsYXNzZXMgPSBbXTtcbiAgICAgIH1cbiAgICAgIHZhciBhZGQgPSB0aGlzLl9hZGRBdHRhY2hDbGFzc2VzO1xuXG4gICAgICBpZiAoZWxlbWVudEF0dGFjaC50b3ApIHtcbiAgICAgICAgYWRkLnB1c2godGhpcy5nZXRDbGFzcygnZWxlbWVudC1hdHRhY2hlZCcpICsgJy0nICsgZWxlbWVudEF0dGFjaC50b3ApO1xuICAgICAgfVxuICAgICAgaWYgKGVsZW1lbnRBdHRhY2gubGVmdCkge1xuICAgICAgICBhZGQucHVzaCh0aGlzLmdldENsYXNzKCdlbGVtZW50LWF0dGFjaGVkJykgKyAnLScgKyBlbGVtZW50QXR0YWNoLmxlZnQpO1xuICAgICAgfVxuICAgICAgaWYgKHRhcmdldEF0dGFjaC50b3ApIHtcbiAgICAgICAgYWRkLnB1c2godGhpcy5nZXRDbGFzcygndGFyZ2V0LWF0dGFjaGVkJykgKyAnLScgKyB0YXJnZXRBdHRhY2gudG9wKTtcbiAgICAgIH1cbiAgICAgIGlmICh0YXJnZXRBdHRhY2gubGVmdCkge1xuICAgICAgICBhZGQucHVzaCh0aGlzLmdldENsYXNzKCd0YXJnZXQtYXR0YWNoZWQnKSArICctJyArIHRhcmdldEF0dGFjaC5sZWZ0KTtcbiAgICAgIH1cblxuICAgICAgdmFyIGFsbCA9IFtdO1xuICAgICAgc2lkZXMuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICBhbGwucHVzaChfdGhpczYuZ2V0Q2xhc3MoJ2VsZW1lbnQtYXR0YWNoZWQnKSArICctJyArIHNpZGUpO1xuICAgICAgICBhbGwucHVzaChfdGhpczYuZ2V0Q2xhc3MoJ3RhcmdldC1hdHRhY2hlZCcpICsgJy0nICsgc2lkZSk7XG4gICAgICB9KTtcblxuICAgICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoISh0eXBlb2YgX3RoaXM2Ll9hZGRBdHRhY2hDbGFzc2VzICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB1cGRhdGVDbGFzc2VzKF90aGlzNi5lbGVtZW50LCBfdGhpczYuX2FkZEF0dGFjaENsYXNzZXMsIGFsbCk7XG4gICAgICAgIGlmICghKF90aGlzNi5vcHRpb25zLmFkZFRhcmdldENsYXNzZXMgPT09IGZhbHNlKSkge1xuICAgICAgICAgIHVwZGF0ZUNsYXNzZXMoX3RoaXM2LnRhcmdldCwgX3RoaXM2Ll9hZGRBdHRhY2hDbGFzc2VzLCBhbGwpO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZXRlIF90aGlzNi5fYWRkQXR0YWNoQ2xhc3NlcztcbiAgICAgIH0pO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3Bvc2l0aW9uJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcG9zaXRpb24oKSB7XG4gICAgICB2YXIgX3RoaXM3ID0gdGhpcztcblxuICAgICAgdmFyIGZsdXNoQ2hhbmdlcyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHRydWUgOiBhcmd1bWVudHNbMF07XG5cbiAgICAgIC8vIGZsdXNoQ2hhbmdlcyBjb21taXRzIHRoZSBjaGFuZ2VzIGltbWVkaWF0ZWx5LCBsZWF2ZSB0cnVlIHVubGVzcyB5b3UgYXJlIHBvc2l0aW9uaW5nIG11bHRpcGxlXG4gICAgICAvLyB0ZXRoZXJzIChpbiB3aGljaCBjYXNlIGNhbGwgVGV0aGVyLlV0aWxzLmZsdXNoIHlvdXJzZWxmIHdoZW4geW91J3JlIGRvbmUpXG5cbiAgICAgIGlmICghdGhpcy5lbmFibGVkKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgdGhpcy5jbGVhckNhY2hlKCk7XG5cbiAgICAgIC8vIFR1cm4gJ2F1dG8nIGF0dGFjaG1lbnRzIGludG8gdGhlIGFwcHJvcHJpYXRlIGNvcm5lciBvciBlZGdlXG4gICAgICB2YXIgdGFyZ2V0QXR0YWNobWVudCA9IGF1dG9Ub0ZpeGVkQXR0YWNobWVudCh0aGlzLnRhcmdldEF0dGFjaG1lbnQsIHRoaXMuYXR0YWNobWVudCk7XG5cbiAgICAgIHRoaXMudXBkYXRlQXR0YWNoQ2xhc3Nlcyh0aGlzLmF0dGFjaG1lbnQsIHRhcmdldEF0dGFjaG1lbnQpO1xuXG4gICAgICB2YXIgZWxlbWVudFBvcyA9IHRoaXMuY2FjaGUoJ2VsZW1lbnQtYm91bmRzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gZ2V0Qm91bmRzKF90aGlzNy5lbGVtZW50KTtcbiAgICAgIH0pO1xuXG4gICAgICB2YXIgd2lkdGggPSBlbGVtZW50UG9zLndpZHRoO1xuICAgICAgdmFyIGhlaWdodCA9IGVsZW1lbnRQb3MuaGVpZ2h0O1xuXG4gICAgICBpZiAod2lkdGggPT09IDAgJiYgaGVpZ2h0ID09PSAwICYmIHR5cGVvZiB0aGlzLmxhc3RTaXplICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICB2YXIgX2xhc3RTaXplID0gdGhpcy5sYXN0U2l6ZTtcblxuICAgICAgICAvLyBXZSBjYWNoZSB0aGUgaGVpZ2h0IGFuZCB3aWR0aCB0byBtYWtlIGl0IHBvc3NpYmxlIHRvIHBvc2l0aW9uIGVsZW1lbnRzIHRoYXQgYXJlXG4gICAgICAgIC8vIGdldHRpbmcgaGlkZGVuLlxuICAgICAgICB3aWR0aCA9IF9sYXN0U2l6ZS53aWR0aDtcbiAgICAgICAgaGVpZ2h0ID0gX2xhc3RTaXplLmhlaWdodDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGFzdFNpemUgPSB7IHdpZHRoOiB3aWR0aCwgaGVpZ2h0OiBoZWlnaHQgfTtcbiAgICAgIH1cblxuICAgICAgdmFyIHRhcmdldFBvcyA9IHRoaXMuY2FjaGUoJ3RhcmdldC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBfdGhpczcuZ2V0VGFyZ2V0Qm91bmRzKCk7XG4gICAgICB9KTtcbiAgICAgIHZhciB0YXJnZXRTaXplID0gdGFyZ2V0UG9zO1xuXG4gICAgICAvLyBHZXQgYW4gYWN0dWFsIHB4IG9mZnNldCBmcm9tIHRoZSBhdHRhY2htZW50XG4gICAgICB2YXIgb2Zmc2V0ID0gb2Zmc2V0VG9QeChhdHRhY2htZW50VG9PZmZzZXQodGhpcy5hdHRhY2htZW50KSwgeyB3aWR0aDogd2lkdGgsIGhlaWdodDogaGVpZ2h0IH0pO1xuICAgICAgdmFyIHRhcmdldE9mZnNldCA9IG9mZnNldFRvUHgoYXR0YWNobWVudFRvT2Zmc2V0KHRhcmdldEF0dGFjaG1lbnQpLCB0YXJnZXRTaXplKTtcblxuICAgICAgdmFyIG1hbnVhbE9mZnNldCA9IG9mZnNldFRvUHgodGhpcy5vZmZzZXQsIHsgd2lkdGg6IHdpZHRoLCBoZWlnaHQ6IGhlaWdodCB9KTtcbiAgICAgIHZhciBtYW51YWxUYXJnZXRPZmZzZXQgPSBvZmZzZXRUb1B4KHRoaXMudGFyZ2V0T2Zmc2V0LCB0YXJnZXRTaXplKTtcblxuICAgICAgLy8gQWRkIHRoZSBtYW51YWxseSBwcm92aWRlZCBvZmZzZXRcbiAgICAgIG9mZnNldCA9IGFkZE9mZnNldChvZmZzZXQsIG1hbnVhbE9mZnNldCk7XG4gICAgICB0YXJnZXRPZmZzZXQgPSBhZGRPZmZzZXQodGFyZ2V0T2Zmc2V0LCBtYW51YWxUYXJnZXRPZmZzZXQpO1xuXG4gICAgICAvLyBJdCdzIG5vdyBvdXIgZ29hbCB0byBtYWtlIChlbGVtZW50IHBvc2l0aW9uICsgb2Zmc2V0KSA9PSAodGFyZ2V0IHBvc2l0aW9uICsgdGFyZ2V0IG9mZnNldClcbiAgICAgIHZhciBsZWZ0ID0gdGFyZ2V0UG9zLmxlZnQgKyB0YXJnZXRPZmZzZXQubGVmdCAtIG9mZnNldC5sZWZ0O1xuICAgICAgdmFyIHRvcCA9IHRhcmdldFBvcy50b3AgKyB0YXJnZXRPZmZzZXQudG9wIC0gb2Zmc2V0LnRvcDtcblxuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBUZXRoZXJCYXNlLm1vZHVsZXMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIF9tb2R1bGUyID0gVGV0aGVyQmFzZS5tb2R1bGVzW2ldO1xuICAgICAgICB2YXIgcmV0ID0gX21vZHVsZTIucG9zaXRpb24uY2FsbCh0aGlzLCB7XG4gICAgICAgICAgbGVmdDogbGVmdCxcbiAgICAgICAgICB0b3A6IHRvcCxcbiAgICAgICAgICB0YXJnZXRBdHRhY2htZW50OiB0YXJnZXRBdHRhY2htZW50LFxuICAgICAgICAgIHRhcmdldFBvczogdGFyZ2V0UG9zLFxuICAgICAgICAgIGVsZW1lbnRQb3M6IGVsZW1lbnRQb3MsXG4gICAgICAgICAgb2Zmc2V0OiBvZmZzZXQsXG4gICAgICAgICAgdGFyZ2V0T2Zmc2V0OiB0YXJnZXRPZmZzZXQsXG4gICAgICAgICAgbWFudWFsT2Zmc2V0OiBtYW51YWxPZmZzZXQsXG4gICAgICAgICAgbWFudWFsVGFyZ2V0T2Zmc2V0OiBtYW51YWxUYXJnZXRPZmZzZXQsXG4gICAgICAgICAgc2Nyb2xsYmFyU2l6ZTogc2Nyb2xsYmFyU2l6ZSxcbiAgICAgICAgICBhdHRhY2htZW50OiB0aGlzLmF0dGFjaG1lbnRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHJldCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHJldCA9PT0gJ3VuZGVmaW5lZCcgfHwgdHlwZW9mIHJldCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0b3AgPSByZXQudG9wO1xuICAgICAgICAgIGxlZnQgPSByZXQubGVmdDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyBXZSBkZXNjcmliZSB0aGUgcG9zaXRpb24gdGhyZWUgZGlmZmVyZW50IHdheXMgdG8gZ2l2ZSB0aGUgb3B0aW1pemVyXG4gICAgICAvLyBhIGNoYW5jZSB0byBkZWNpZGUgdGhlIGJlc3QgcG9zc2libGUgd2F5IHRvIHBvc2l0aW9uIHRoZSBlbGVtZW50XG4gICAgICAvLyB3aXRoIHRoZSBmZXdlc3QgcmVwYWludHMuXG4gICAgICB2YXIgbmV4dCA9IHtcbiAgICAgICAgLy8gSXQncyBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgcGFnZSAoYWJzb2x1dGUgcG9zaXRpb25pbmcgd2hlblxuICAgICAgICAvLyB0aGUgZWxlbWVudCBpcyBhIGNoaWxkIG9mIHRoZSBib2R5KVxuICAgICAgICBwYWdlOiB7XG4gICAgICAgICAgdG9wOiB0b3AsXG4gICAgICAgICAgbGVmdDogbGVmdFxuICAgICAgICB9LFxuXG4gICAgICAgIC8vIEl0J3MgcG9zaXRpb24gcmVsYXRpdmUgdG8gdGhlIHZpZXdwb3J0IChmaXhlZCBwb3NpdGlvbmluZylcbiAgICAgICAgdmlld3BvcnQ6IHtcbiAgICAgICAgICB0b3A6IHRvcCAtIHBhZ2VZT2Zmc2V0LFxuICAgICAgICAgIGJvdHRvbTogcGFnZVlPZmZzZXQgLSB0b3AgLSBoZWlnaHQgKyBpbm5lckhlaWdodCxcbiAgICAgICAgICBsZWZ0OiBsZWZ0IC0gcGFnZVhPZmZzZXQsXG4gICAgICAgICAgcmlnaHQ6IHBhZ2VYT2Zmc2V0IC0gbGVmdCAtIHdpZHRoICsgaW5uZXJXaWR0aFxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB2YXIgZG9jID0gdGhpcy50YXJnZXQub3duZXJEb2N1bWVudDtcbiAgICAgIHZhciB3aW4gPSBkb2MuZGVmYXVsdFZpZXc7XG5cbiAgICAgIHZhciBzY3JvbGxiYXJTaXplID0gdW5kZWZpbmVkO1xuICAgICAgaWYgKHdpbi5pbm5lckhlaWdodCA+IGRvYy5kb2N1bWVudEVsZW1lbnQuY2xpZW50SGVpZ2h0KSB7XG4gICAgICAgIHNjcm9sbGJhclNpemUgPSB0aGlzLmNhY2hlKCdzY3JvbGxiYXItc2l6ZScsIGdldFNjcm9sbEJhclNpemUpO1xuICAgICAgICBuZXh0LnZpZXdwb3J0LmJvdHRvbSAtPSBzY3JvbGxiYXJTaXplLmhlaWdodDtcbiAgICAgIH1cblxuICAgICAgaWYgKHdpbi5pbm5lcldpZHRoID4gZG9jLmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aCkge1xuICAgICAgICBzY3JvbGxiYXJTaXplID0gdGhpcy5jYWNoZSgnc2Nyb2xsYmFyLXNpemUnLCBnZXRTY3JvbGxCYXJTaXplKTtcbiAgICAgICAgbmV4dC52aWV3cG9ydC5yaWdodCAtPSBzY3JvbGxiYXJTaXplLndpZHRoO1xuICAgICAgfVxuXG4gICAgICBpZiAoWycnLCAnc3RhdGljJ10uaW5kZXhPZihkb2MuYm9keS5zdHlsZS5wb3NpdGlvbikgPT09IC0xIHx8IFsnJywgJ3N0YXRpYyddLmluZGV4T2YoZG9jLmJvZHkucGFyZW50RWxlbWVudC5zdHlsZS5wb3NpdGlvbikgPT09IC0xKSB7XG4gICAgICAgIC8vIEFic29sdXRlIHBvc2l0aW9uaW5nIGluIHRoZSBib2R5IHdpbGwgYmUgcmVsYXRpdmUgdG8gdGhlIHBhZ2UsIG5vdCB0aGUgJ2luaXRpYWwgY29udGFpbmluZyBibG9jaydcbiAgICAgICAgbmV4dC5wYWdlLmJvdHRvbSA9IGRvYy5ib2R5LnNjcm9sbEhlaWdodCAtIHRvcCAtIGhlaWdodDtcbiAgICAgICAgbmV4dC5wYWdlLnJpZ2h0ID0gZG9jLmJvZHkuc2Nyb2xsV2lkdGggLSBsZWZ0IC0gd2lkdGg7XG4gICAgICB9XG5cbiAgICAgIGlmICh0eXBlb2YgdGhpcy5vcHRpb25zLm9wdGltaXphdGlvbnMgIT09ICd1bmRlZmluZWQnICYmIHRoaXMub3B0aW9ucy5vcHRpbWl6YXRpb25zLm1vdmVFbGVtZW50ICE9PSBmYWxzZSAmJiAhKHR5cGVvZiB0aGlzLnRhcmdldE1vZGlmaWVyICE9PSAndW5kZWZpbmVkJykpIHtcbiAgICAgICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgb2Zmc2V0UGFyZW50ID0gX3RoaXM3LmNhY2hlKCd0YXJnZXQtb2Zmc2V0cGFyZW50JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldE9mZnNldFBhcmVudChfdGhpczcudGFyZ2V0KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICB2YXIgb2Zmc2V0UG9zaXRpb24gPSBfdGhpczcuY2FjaGUoJ3RhcmdldC1vZmZzZXRwYXJlbnQtYm91bmRzJywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldEJvdW5kcyhvZmZzZXRQYXJlbnQpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnRTdHlsZSA9IGdldENvbXB1dGVkU3R5bGUob2Zmc2V0UGFyZW50KTtcbiAgICAgICAgICB2YXIgb2Zmc2V0UGFyZW50U2l6ZSA9IG9mZnNldFBvc2l0aW9uO1xuXG4gICAgICAgICAgdmFyIG9mZnNldEJvcmRlciA9IHt9O1xuICAgICAgICAgIFsnVG9wJywgJ0xlZnQnLCAnQm90dG9tJywgJ1JpZ2h0J10uZm9yRWFjaChmdW5jdGlvbiAoc2lkZSkge1xuICAgICAgICAgICAgb2Zmc2V0Qm9yZGVyW3NpZGUudG9Mb3dlckNhc2UoKV0gPSBwYXJzZUZsb2F0KG9mZnNldFBhcmVudFN0eWxlWydib3JkZXInICsgc2lkZSArICdXaWR0aCddKTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIG9mZnNldFBvc2l0aW9uLnJpZ2h0ID0gZG9jLmJvZHkuc2Nyb2xsV2lkdGggLSBvZmZzZXRQb3NpdGlvbi5sZWZ0IC0gb2Zmc2V0UGFyZW50U2l6ZS53aWR0aCArIG9mZnNldEJvcmRlci5yaWdodDtcbiAgICAgICAgICBvZmZzZXRQb3NpdGlvbi5ib3R0b20gPSBkb2MuYm9keS5zY3JvbGxIZWlnaHQgLSBvZmZzZXRQb3NpdGlvbi50b3AgLSBvZmZzZXRQYXJlbnRTaXplLmhlaWdodCArIG9mZnNldEJvcmRlci5ib3R0b207XG5cbiAgICAgICAgICBpZiAobmV4dC5wYWdlLnRvcCA+PSBvZmZzZXRQb3NpdGlvbi50b3AgKyBvZmZzZXRCb3JkZXIudG9wICYmIG5leHQucGFnZS5ib3R0b20gPj0gb2Zmc2V0UG9zaXRpb24uYm90dG9tKSB7XG4gICAgICAgICAgICBpZiAobmV4dC5wYWdlLmxlZnQgPj0gb2Zmc2V0UG9zaXRpb24ubGVmdCArIG9mZnNldEJvcmRlci5sZWZ0ICYmIG5leHQucGFnZS5yaWdodCA+PSBvZmZzZXRQb3NpdGlvbi5yaWdodCkge1xuICAgICAgICAgICAgICAvLyBXZSdyZSB3aXRoaW4gdGhlIHZpc2libGUgcGFydCBvZiB0aGUgdGFyZ2V0J3Mgc2Nyb2xsIHBhcmVudFxuICAgICAgICAgICAgICB2YXIgc2Nyb2xsVG9wID0gb2Zmc2V0UGFyZW50LnNjcm9sbFRvcDtcbiAgICAgICAgICAgICAgdmFyIHNjcm9sbExlZnQgPSBvZmZzZXRQYXJlbnQuc2Nyb2xsTGVmdDtcblxuICAgICAgICAgICAgICAvLyBJdCdzIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSB0YXJnZXQncyBvZmZzZXQgcGFyZW50IChhYnNvbHV0ZSBwb3NpdGlvbmluZyB3aGVuXG4gICAgICAgICAgICAgIC8vIHRoZSBlbGVtZW50IGlzIG1vdmVkIHRvIGJlIGEgY2hpbGQgb2YgdGhlIHRhcmdldCdzIG9mZnNldCBwYXJlbnQpLlxuICAgICAgICAgICAgICBuZXh0Lm9mZnNldCA9IHtcbiAgICAgICAgICAgICAgICB0b3A6IG5leHQucGFnZS50b3AgLSBvZmZzZXRQb3NpdGlvbi50b3AgKyBzY3JvbGxUb3AgLSBvZmZzZXRCb3JkZXIudG9wLFxuICAgICAgICAgICAgICAgIGxlZnQ6IG5leHQucGFnZS5sZWZ0IC0gb2Zmc2V0UG9zaXRpb24ubGVmdCArIHNjcm9sbExlZnQgLSBvZmZzZXRCb3JkZXIubGVmdFxuICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSkoKTtcbiAgICAgIH1cblxuICAgICAgLy8gV2UgY291bGQgYWxzbyB0cmF2ZWwgdXAgdGhlIERPTSBhbmQgdHJ5IGVhY2ggY29udGFpbmluZyBjb250ZXh0LCByYXRoZXIgdGhhbiBvbmx5XG4gICAgICAvLyBsb29raW5nIGF0IHRoZSBib2R5LCBidXQgd2UncmUgZ29ubmEgZ2V0IGRpbWluaXNoaW5nIHJldHVybnMuXG5cbiAgICAgIHRoaXMubW92ZShuZXh0KTtcblxuICAgICAgdGhpcy5oaXN0b3J5LnVuc2hpZnQobmV4dCk7XG5cbiAgICAgIGlmICh0aGlzLmhpc3RvcnkubGVuZ3RoID4gMykge1xuICAgICAgICB0aGlzLmhpc3RvcnkucG9wKCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChmbHVzaENoYW5nZXMpIHtcbiAgICAgICAgZmx1c2goKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gVEhFIElTU1VFXG4gIH0sIHtcbiAgICBrZXk6ICdtb3ZlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gbW92ZShwb3MpIHtcbiAgICAgIHZhciBfdGhpczggPSB0aGlzO1xuXG4gICAgICBpZiAoISh0eXBlb2YgdGhpcy5lbGVtZW50LnBhcmVudE5vZGUgIT09ICd1bmRlZmluZWQnKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIHZhciBzYW1lID0ge307XG5cbiAgICAgIGZvciAodmFyIHR5cGUgaW4gcG9zKSB7XG4gICAgICAgIHNhbWVbdHlwZV0gPSB7fTtcblxuICAgICAgICBmb3IgKHZhciBrZXkgaW4gcG9zW3R5cGVdKSB7XG4gICAgICAgICAgdmFyIGZvdW5kID0gZmFsc2U7XG5cbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuaGlzdG9yeS5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgdmFyIHBvaW50ID0gdGhpcy5oaXN0b3J5W2ldO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBwb2ludFt0eXBlXSAhPT0gJ3VuZGVmaW5lZCcgJiYgIXdpdGhpbihwb2ludFt0eXBlXVtrZXldLCBwb3NbdHlwZV1ba2V5XSkpIHtcbiAgICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoIWZvdW5kKSB7XG4gICAgICAgICAgICBzYW1lW3R5cGVdW2tleV0gPSB0cnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB2YXIgY3NzID0geyB0b3A6ICcnLCBsZWZ0OiAnJywgcmlnaHQ6ICcnLCBib3R0b206ICcnIH07XG5cbiAgICAgIHZhciB0cmFuc2NyaWJlID0gZnVuY3Rpb24gdHJhbnNjcmliZShfc2FtZSwgX3Bvcykge1xuICAgICAgICB2YXIgaGFzT3B0aW1pemF0aW9ucyA9IHR5cGVvZiBfdGhpczgub3B0aW9ucy5vcHRpbWl6YXRpb25zICE9PSAndW5kZWZpbmVkJztcbiAgICAgICAgdmFyIGdwdSA9IGhhc09wdGltaXphdGlvbnMgPyBfdGhpczgub3B0aW9ucy5vcHRpbWl6YXRpb25zLmdwdSA6IG51bGw7XG4gICAgICAgIGlmIChncHUgIT09IGZhbHNlKSB7XG4gICAgICAgICAgdmFyIHlQb3MgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICAgIHhQb3MgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgaWYgKF9zYW1lLnRvcCkge1xuICAgICAgICAgICAgY3NzLnRvcCA9IDA7XG4gICAgICAgICAgICB5UG9zID0gX3Bvcy50b3A7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNzcy5ib3R0b20gPSAwO1xuICAgICAgICAgICAgeVBvcyA9IC1fcG9zLmJvdHRvbTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoX3NhbWUubGVmdCkge1xuICAgICAgICAgICAgY3NzLmxlZnQgPSAwO1xuICAgICAgICAgICAgeFBvcyA9IF9wb3MubGVmdDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3NzLnJpZ2h0ID0gMDtcbiAgICAgICAgICAgIHhQb3MgPSAtX3Bvcy5yaWdodDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAod2luZG93Lm1hdGNoTWVkaWEpIHtcbiAgICAgICAgICAgIC8vIEh1YlNwb3QvdGV0aGVyIzIwN1xuICAgICAgICAgICAgdmFyIHJldGluYSA9IHdpbmRvdy5tYXRjaE1lZGlhKCdvbmx5IHNjcmVlbiBhbmQgKG1pbi1yZXNvbHV0aW9uOiAxLjNkcHB4KScpLm1hdGNoZXMgfHwgd2luZG93Lm1hdGNoTWVkaWEoJ29ubHkgc2NyZWVuIGFuZCAoLXdlYmtpdC1taW4tZGV2aWNlLXBpeGVsLXJhdGlvOiAxLjMpJykubWF0Y2hlcztcbiAgICAgICAgICAgIGlmICghcmV0aW5hKSB7XG4gICAgICAgICAgICAgIHhQb3MgPSBNYXRoLnJvdW5kKHhQb3MpO1xuICAgICAgICAgICAgICB5UG9zID0gTWF0aC5yb3VuZCh5UG9zKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjc3NbdHJhbnNmb3JtS2V5XSA9ICd0cmFuc2xhdGVYKCcgKyB4UG9zICsgJ3B4KSB0cmFuc2xhdGVZKCcgKyB5UG9zICsgJ3B4KSc7XG5cbiAgICAgICAgICBpZiAodHJhbnNmb3JtS2V5ICE9PSAnbXNUcmFuc2Zvcm0nKSB7XG4gICAgICAgICAgICAvLyBUaGUgWiB0cmFuc2Zvcm0gd2lsbCBrZWVwIHRoaXMgaW4gdGhlIEdQVSAoZmFzdGVyLCBhbmQgcHJldmVudHMgYXJ0aWZhY3RzKSxcbiAgICAgICAgICAgIC8vIGJ1dCBJRTkgZG9lc24ndCBzdXBwb3J0IDNkIHRyYW5zZm9ybXMgYW5kIHdpbGwgY2hva2UuXG4gICAgICAgICAgICBjc3NbdHJhbnNmb3JtS2V5XSArPSBcIiB0cmFuc2xhdGVaKDApXCI7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmIChfc2FtZS50b3ApIHtcbiAgICAgICAgICAgIGNzcy50b3AgPSBfcG9zLnRvcCArICdweCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNzcy5ib3R0b20gPSBfcG9zLmJvdHRvbSArICdweCc7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKF9zYW1lLmxlZnQpIHtcbiAgICAgICAgICAgIGNzcy5sZWZ0ID0gX3Bvcy5sZWZ0ICsgJ3B4JztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY3NzLnJpZ2h0ID0gX3Bvcy5yaWdodCArICdweCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9O1xuXG4gICAgICB2YXIgbW92ZWQgPSBmYWxzZTtcbiAgICAgIGlmICgoc2FtZS5wYWdlLnRvcCB8fCBzYW1lLnBhZ2UuYm90dG9tKSAmJiAoc2FtZS5wYWdlLmxlZnQgfHwgc2FtZS5wYWdlLnJpZ2h0KSkge1xuICAgICAgICBjc3MucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICB0cmFuc2NyaWJlKHNhbWUucGFnZSwgcG9zLnBhZ2UpO1xuICAgICAgfSBlbHNlIGlmICgoc2FtZS52aWV3cG9ydC50b3AgfHwgc2FtZS52aWV3cG9ydC5ib3R0b20pICYmIChzYW1lLnZpZXdwb3J0LmxlZnQgfHwgc2FtZS52aWV3cG9ydC5yaWdodCkpIHtcbiAgICAgICAgY3NzLnBvc2l0aW9uID0gJ2ZpeGVkJztcbiAgICAgICAgdHJhbnNjcmliZShzYW1lLnZpZXdwb3J0LCBwb3Mudmlld3BvcnQpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2FtZS5vZmZzZXQgIT09ICd1bmRlZmluZWQnICYmIHNhbWUub2Zmc2V0LnRvcCAmJiBzYW1lLm9mZnNldC5sZWZ0KSB7XG4gICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgY3NzLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgICB2YXIgb2Zmc2V0UGFyZW50ID0gX3RoaXM4LmNhY2hlKCd0YXJnZXQtb2Zmc2V0cGFyZW50JywgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIGdldE9mZnNldFBhcmVudChfdGhpczgudGFyZ2V0KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGlmIChnZXRPZmZzZXRQYXJlbnQoX3RoaXM4LmVsZW1lbnQpICE9PSBvZmZzZXRQYXJlbnQpIHtcbiAgICAgICAgICAgIGRlZmVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgX3RoaXM4LmVsZW1lbnQucGFyZW50Tm9kZS5yZW1vdmVDaGlsZChfdGhpczguZWxlbWVudCk7XG4gICAgICAgICAgICAgIG9mZnNldFBhcmVudC5hcHBlbmRDaGlsZChfdGhpczguZWxlbWVudCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0cmFuc2NyaWJlKHNhbWUub2Zmc2V0LCBwb3Mub2Zmc2V0KTtcbiAgICAgICAgICBtb3ZlZCA9IHRydWU7XG4gICAgICAgIH0pKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjc3MucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgICAgICB0cmFuc2NyaWJlKHsgdG9wOiB0cnVlLCBsZWZ0OiB0cnVlIH0sIHBvcy5wYWdlKTtcbiAgICAgIH1cblxuICAgICAgaWYgKCFtb3ZlZCkge1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmJvZHlFbGVtZW50KSB7XG4gICAgICAgICAgaWYgKHRoaXMuZWxlbWVudC5wYXJlbnROb2RlICE9PSB0aGlzLm9wdGlvbnMuYm9keUVsZW1lbnQpIHtcbiAgICAgICAgICAgIHRoaXMub3B0aW9ucy5ib2R5RWxlbWVudC5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgaXNGdWxsc2NyZWVuRWxlbWVudCA9IGZ1bmN0aW9uIGlzRnVsbHNjcmVlbkVsZW1lbnQoZSkge1xuICAgICAgICAgICAgdmFyIGQgPSBlLm93bmVyRG9jdW1lbnQ7XG4gICAgICAgICAgICB2YXIgZmUgPSBkLmZ1bGxzY3JlZW5FbGVtZW50IHx8IGQud2Via2l0RnVsbHNjcmVlbkVsZW1lbnQgfHwgZC5tb3pGdWxsU2NyZWVuRWxlbWVudCB8fCBkLm1zRnVsbHNjcmVlbkVsZW1lbnQ7XG4gICAgICAgICAgICByZXR1cm4gZmUgPT09IGU7XG4gICAgICAgICAgfTtcblxuICAgICAgICAgIHZhciBvZmZzZXRQYXJlbnRJc0JvZHkgPSB0cnVlO1xuXG4gICAgICAgICAgdmFyIGN1cnJlbnROb2RlID0gdGhpcy5lbGVtZW50LnBhcmVudE5vZGU7XG4gICAgICAgICAgd2hpbGUgKGN1cnJlbnROb2RlICYmIGN1cnJlbnROb2RlLm5vZGVUeXBlID09PSAxICYmIGN1cnJlbnROb2RlLnRhZ05hbWUgIT09ICdCT0RZJyAmJiAhaXNGdWxsc2NyZWVuRWxlbWVudChjdXJyZW50Tm9kZSkpIHtcbiAgICAgICAgICAgIGlmIChnZXRDb21wdXRlZFN0eWxlKGN1cnJlbnROb2RlKS5wb3NpdGlvbiAhPT0gJ3N0YXRpYycpIHtcbiAgICAgICAgICAgICAgb2Zmc2V0UGFyZW50SXNCb2R5ID0gZmFsc2U7XG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjdXJyZW50Tm9kZSA9IGN1cnJlbnROb2RlLnBhcmVudE5vZGU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKCFvZmZzZXRQYXJlbnRJc0JvZHkpIHtcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudC5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuZWxlbWVudCk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnQub3duZXJEb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRoaXMuZWxlbWVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIC8vIEFueSBjc3MgY2hhbmdlIHdpbGwgdHJpZ2dlciBhIHJlcGFpbnQsIHNvIGxldCdzIGF2b2lkIG9uZSBpZiBub3RoaW5nIGNoYW5nZWRcbiAgICAgIHZhciB3cml0ZUNTUyA9IHt9O1xuICAgICAgdmFyIHdyaXRlID0gZmFsc2U7XG4gICAgICBmb3IgKHZhciBrZXkgaW4gY3NzKSB7XG4gICAgICAgIHZhciB2YWwgPSBjc3Nba2V5XTtcbiAgICAgICAgdmFyIGVsVmFsID0gdGhpcy5lbGVtZW50LnN0eWxlW2tleV07XG5cbiAgICAgICAgaWYgKGVsVmFsICE9PSB2YWwpIHtcbiAgICAgICAgICB3cml0ZSA9IHRydWU7XG4gICAgICAgICAgd3JpdGVDU1Nba2V5XSA9IHZhbDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAod3JpdGUpIHtcbiAgICAgICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGV4dGVuZChfdGhpczguZWxlbWVudC5zdHlsZSwgd3JpdGVDU1MpO1xuICAgICAgICAgIF90aGlzOC50cmlnZ2VyKCdyZXBvc2l0aW9uZWQnKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIFRldGhlckNsYXNzO1xufSkoRXZlbnRlZCk7XG5cblRldGhlckNsYXNzLm1vZHVsZXMgPSBbXTtcblxuVGV0aGVyQmFzZS5wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXG52YXIgVGV0aGVyID0gZXh0ZW5kKFRldGhlckNsYXNzLCBUZXRoZXJCYXNlKTtcbi8qIGdsb2JhbHMgVGV0aGVyQmFzZSAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBfc2xpY2VkVG9BcnJheSA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIHNsaWNlSXRlcmF0b3IoYXJyLCBpKSB7IHZhciBfYXJyID0gW107IHZhciBfbiA9IHRydWU7IHZhciBfZCA9IGZhbHNlOyB2YXIgX2UgPSB1bmRlZmluZWQ7IHRyeSB7IGZvciAodmFyIF9pID0gYXJyW1N5bWJvbC5pdGVyYXRvcl0oKSwgX3M7ICEoX24gPSAoX3MgPSBfaS5uZXh0KCkpLmRvbmUpOyBfbiA9IHRydWUpIHsgX2Fyci5wdXNoKF9zLnZhbHVlKTsgaWYgKGkgJiYgX2Fyci5sZW5ndGggPT09IGkpIGJyZWFrOyB9IH0gY2F0Y2ggKGVycikgeyBfZCA9IHRydWU7IF9lID0gZXJyOyB9IGZpbmFsbHkgeyB0cnkgeyBpZiAoIV9uICYmIF9pWydyZXR1cm4nXSkgX2lbJ3JldHVybiddKCk7IH0gZmluYWxseSB7IGlmIChfZCkgdGhyb3cgX2U7IH0gfSByZXR1cm4gX2FycjsgfSByZXR1cm4gZnVuY3Rpb24gKGFyciwgaSkgeyBpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7IHJldHVybiBhcnI7IH0gZWxzZSBpZiAoU3ltYm9sLml0ZXJhdG9yIGluIE9iamVjdChhcnIpKSB7IHJldHVybiBzbGljZUl0ZXJhdG9yKGFyciwgaSk7IH0gZWxzZSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0ludmFsaWQgYXR0ZW1wdCB0byBkZXN0cnVjdHVyZSBub24taXRlcmFibGUgaW5zdGFuY2UnKTsgfSB9OyB9KSgpO1xuXG52YXIgX1RldGhlckJhc2UkVXRpbHMgPSBUZXRoZXJCYXNlLlV0aWxzO1xudmFyIGdldEJvdW5kcyA9IF9UZXRoZXJCYXNlJFV0aWxzLmdldEJvdW5kcztcbnZhciBleHRlbmQgPSBfVGV0aGVyQmFzZSRVdGlscy5leHRlbmQ7XG52YXIgdXBkYXRlQ2xhc3NlcyA9IF9UZXRoZXJCYXNlJFV0aWxzLnVwZGF0ZUNsYXNzZXM7XG52YXIgZGVmZXIgPSBfVGV0aGVyQmFzZSRVdGlscy5kZWZlcjtcblxudmFyIEJPVU5EU19GT1JNQVQgPSBbJ2xlZnQnLCAndG9wJywgJ3JpZ2h0JywgJ2JvdHRvbSddO1xuXG5mdW5jdGlvbiBnZXRCb3VuZGluZ1JlY3QodGV0aGVyLCB0bykge1xuICBpZiAodG8gPT09ICdzY3JvbGxQYXJlbnQnKSB7XG4gICAgdG8gPSB0ZXRoZXIuc2Nyb2xsUGFyZW50c1swXTtcbiAgfSBlbHNlIGlmICh0byA9PT0gJ3dpbmRvdycpIHtcbiAgICB0byA9IFtwYWdlWE9mZnNldCwgcGFnZVlPZmZzZXQsIGlubmVyV2lkdGggKyBwYWdlWE9mZnNldCwgaW5uZXJIZWlnaHQgKyBwYWdlWU9mZnNldF07XG4gIH1cblxuICBpZiAodG8gPT09IGRvY3VtZW50KSB7XG4gICAgdG8gPSB0by5kb2N1bWVudEVsZW1lbnQ7XG4gIH1cblxuICBpZiAodHlwZW9mIHRvLm5vZGVUeXBlICE9PSAndW5kZWZpbmVkJykge1xuICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgbm9kZSA9IHRvO1xuICAgICAgdmFyIHNpemUgPSBnZXRCb3VuZHModG8pO1xuICAgICAgdmFyIHBvcyA9IHNpemU7XG4gICAgICB2YXIgc3R5bGUgPSBnZXRDb21wdXRlZFN0eWxlKHRvKTtcblxuICAgICAgdG8gPSBbcG9zLmxlZnQsIHBvcy50b3AsIHNpemUud2lkdGggKyBwb3MubGVmdCwgc2l6ZS5oZWlnaHQgKyBwb3MudG9wXTtcblxuICAgICAgLy8gQWNjb3VudCBhbnkgcGFyZW50IEZyYW1lcyBzY3JvbGwgb2Zmc2V0XG4gICAgICBpZiAobm9kZS5vd25lckRvY3VtZW50ICE9PSBkb2N1bWVudCkge1xuICAgICAgICB2YXIgd2luID0gbm9kZS5vd25lckRvY3VtZW50LmRlZmF1bHRWaWV3O1xuICAgICAgICB0b1swXSArPSB3aW4ucGFnZVhPZmZzZXQ7XG4gICAgICAgIHRvWzFdICs9IHdpbi5wYWdlWU9mZnNldDtcbiAgICAgICAgdG9bMl0gKz0gd2luLnBhZ2VYT2Zmc2V0O1xuICAgICAgICB0b1szXSArPSB3aW4ucGFnZVlPZmZzZXQ7XG4gICAgICB9XG5cbiAgICAgIEJPVU5EU19GT1JNQVQuZm9yRWFjaChmdW5jdGlvbiAoc2lkZSwgaSkge1xuICAgICAgICBzaWRlID0gc2lkZVswXS50b1VwcGVyQ2FzZSgpICsgc2lkZS5zdWJzdHIoMSk7XG4gICAgICAgIGlmIChzaWRlID09PSAnVG9wJyB8fCBzaWRlID09PSAnTGVmdCcpIHtcbiAgICAgICAgICB0b1tpXSArPSBwYXJzZUZsb2F0KHN0eWxlWydib3JkZXInICsgc2lkZSArICdXaWR0aCddKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0b1tpXSAtPSBwYXJzZUZsb2F0KHN0eWxlWydib3JkZXInICsgc2lkZSArICdXaWR0aCddKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSkoKTtcbiAgfVxuXG4gIHJldHVybiB0bztcbn1cblxuVGV0aGVyQmFzZS5tb2R1bGVzLnB1c2goe1xuICBwb3NpdGlvbjogZnVuY3Rpb24gcG9zaXRpb24oX3JlZikge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICB2YXIgdG9wID0gX3JlZi50b3A7XG4gICAgdmFyIGxlZnQgPSBfcmVmLmxlZnQ7XG4gICAgdmFyIHRhcmdldEF0dGFjaG1lbnQgPSBfcmVmLnRhcmdldEF0dGFjaG1lbnQ7XG5cbiAgICBpZiAoIXRoaXMub3B0aW9ucy5jb25zdHJhaW50cykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgdmFyIF9jYWNoZSA9IHRoaXMuY2FjaGUoJ2VsZW1lbnQtYm91bmRzJywgZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIGdldEJvdW5kcyhfdGhpcy5lbGVtZW50KTtcbiAgICB9KTtcblxuICAgIHZhciBoZWlnaHQgPSBfY2FjaGUuaGVpZ2h0O1xuICAgIHZhciB3aWR0aCA9IF9jYWNoZS53aWR0aDtcblxuICAgIGlmICh3aWR0aCA9PT0gMCAmJiBoZWlnaHQgPT09IDAgJiYgdHlwZW9mIHRoaXMubGFzdFNpemUgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICB2YXIgX2xhc3RTaXplID0gdGhpcy5sYXN0U2l6ZTtcblxuICAgICAgLy8gSGFuZGxlIHRoZSBpdGVtIGdldHRpbmcgaGlkZGVuIGFzIGEgcmVzdWx0IG9mIG91ciBwb3NpdGlvbmluZyB3aXRob3V0IGdsaXRjaGluZ1xuICAgICAgLy8gdGhlIGNsYXNzZXMgaW4gYW5kIG91dFxuICAgICAgd2lkdGggPSBfbGFzdFNpemUud2lkdGg7XG4gICAgICBoZWlnaHQgPSBfbGFzdFNpemUuaGVpZ2h0O1xuICAgIH1cblxuICAgIHZhciB0YXJnZXRTaXplID0gdGhpcy5jYWNoZSgndGFyZ2V0LWJvdW5kcycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBfdGhpcy5nZXRUYXJnZXRCb3VuZHMoKTtcbiAgICB9KTtcblxuICAgIHZhciB0YXJnZXRIZWlnaHQgPSB0YXJnZXRTaXplLmhlaWdodDtcbiAgICB2YXIgdGFyZ2V0V2lkdGggPSB0YXJnZXRTaXplLndpZHRoO1xuXG4gICAgdmFyIGFsbENsYXNzZXMgPSBbdGhpcy5nZXRDbGFzcygncGlubmVkJyksIHRoaXMuZ2V0Q2xhc3MoJ291dC1vZi1ib3VuZHMnKV07XG5cbiAgICB0aGlzLm9wdGlvbnMuY29uc3RyYWludHMuZm9yRWFjaChmdW5jdGlvbiAoY29uc3RyYWludCkge1xuICAgICAgdmFyIG91dE9mQm91bmRzQ2xhc3MgPSBjb25zdHJhaW50Lm91dE9mQm91bmRzQ2xhc3M7XG4gICAgICB2YXIgcGlubmVkQ2xhc3MgPSBjb25zdHJhaW50LnBpbm5lZENsYXNzO1xuXG4gICAgICBpZiAob3V0T2ZCb3VuZHNDbGFzcykge1xuICAgICAgICBhbGxDbGFzc2VzLnB1c2gob3V0T2ZCb3VuZHNDbGFzcyk7XG4gICAgICB9XG4gICAgICBpZiAocGlubmVkQ2xhc3MpIHtcbiAgICAgICAgYWxsQ2xhc3Nlcy5wdXNoKHBpbm5lZENsYXNzKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIGFsbENsYXNzZXMuZm9yRWFjaChmdW5jdGlvbiAoY2xzKSB7XG4gICAgICBbJ2xlZnQnLCAndG9wJywgJ3JpZ2h0JywgJ2JvdHRvbSddLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgICAgYWxsQ2xhc3Nlcy5wdXNoKGNscyArICctJyArIHNpZGUpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICB2YXIgYWRkQ2xhc3NlcyA9IFtdO1xuXG4gICAgdmFyIHRBdHRhY2htZW50ID0gZXh0ZW5kKHt9LCB0YXJnZXRBdHRhY2htZW50KTtcbiAgICB2YXIgZUF0dGFjaG1lbnQgPSBleHRlbmQoe30sIHRoaXMuYXR0YWNobWVudCk7XG5cbiAgICB0aGlzLm9wdGlvbnMuY29uc3RyYWludHMuZm9yRWFjaChmdW5jdGlvbiAoY29uc3RyYWludCkge1xuICAgICAgdmFyIHRvID0gY29uc3RyYWludC50bztcbiAgICAgIHZhciBhdHRhY2htZW50ID0gY29uc3RyYWludC5hdHRhY2htZW50O1xuICAgICAgdmFyIHBpbiA9IGNvbnN0cmFpbnQucGluO1xuXG4gICAgICBpZiAodHlwZW9mIGF0dGFjaG1lbnQgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGF0dGFjaG1lbnQgPSAnJztcbiAgICAgIH1cblxuICAgICAgdmFyIGNoYW5nZUF0dGFjaFggPSB1bmRlZmluZWQsXG4gICAgICAgICAgY2hhbmdlQXR0YWNoWSA9IHVuZGVmaW5lZDtcbiAgICAgIGlmIChhdHRhY2htZW50LmluZGV4T2YoJyAnKSA+PSAwKSB7XG4gICAgICAgIHZhciBfYXR0YWNobWVudCRzcGxpdCA9IGF0dGFjaG1lbnQuc3BsaXQoJyAnKTtcblxuICAgICAgICB2YXIgX2F0dGFjaG1lbnQkc3BsaXQyID0gX3NsaWNlZFRvQXJyYXkoX2F0dGFjaG1lbnQkc3BsaXQsIDIpO1xuXG4gICAgICAgIGNoYW5nZUF0dGFjaFkgPSBfYXR0YWNobWVudCRzcGxpdDJbMF07XG4gICAgICAgIGNoYW5nZUF0dGFjaFggPSBfYXR0YWNobWVudCRzcGxpdDJbMV07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaGFuZ2VBdHRhY2hYID0gY2hhbmdlQXR0YWNoWSA9IGF0dGFjaG1lbnQ7XG4gICAgICB9XG5cbiAgICAgIHZhciBib3VuZHMgPSBnZXRCb3VuZGluZ1JlY3QoX3RoaXMsIHRvKTtcblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFkgPT09ICd0YXJnZXQnIHx8IGNoYW5nZUF0dGFjaFkgPT09ICdib3RoJykge1xuICAgICAgICBpZiAodG9wIDwgYm91bmRzWzFdICYmIHRBdHRhY2htZW50LnRvcCA9PT0gJ3RvcCcpIHtcbiAgICAgICAgICB0b3AgKz0gdGFyZ2V0SGVpZ2h0O1xuICAgICAgICAgIHRBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvcCArIGhlaWdodCA+IGJvdW5kc1szXSAmJiB0QXR0YWNobWVudC50b3AgPT09ICdib3R0b20nKSB7XG4gICAgICAgICAgdG9wIC09IHRhcmdldEhlaWdodDtcbiAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAndG9wJztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY2hhbmdlQXR0YWNoWSA9PT0gJ3RvZ2V0aGVyJykge1xuICAgICAgICBpZiAodEF0dGFjaG1lbnQudG9wID09PSAndG9wJykge1xuICAgICAgICAgIGlmIChlQXR0YWNobWVudC50b3AgPT09ICdib3R0b20nICYmIHRvcCA8IGJvdW5kc1sxXSkge1xuICAgICAgICAgICAgdG9wICs9IHRhcmdldEhlaWdodDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuXG4gICAgICAgICAgICB0b3AgKz0gaGVpZ2h0O1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ3RvcCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChlQXR0YWNobWVudC50b3AgPT09ICd0b3AnICYmIHRvcCArIGhlaWdodCA+IGJvdW5kc1szXSAmJiB0b3AgLSAoaGVpZ2h0IC0gdGFyZ2V0SGVpZ2h0KSA+PSBib3VuZHNbMV0pIHtcbiAgICAgICAgICAgIHRvcCAtPSBoZWlnaHQgLSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcblxuICAgICAgICAgICAgZUF0dGFjaG1lbnQudG9wID0gJ2JvdHRvbSc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRBdHRhY2htZW50LnRvcCA9PT0gJ2JvdHRvbScpIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQudG9wID09PSAndG9wJyAmJiB0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10pIHtcbiAgICAgICAgICAgIHRvcCAtPSB0YXJnZXRIZWlnaHQ7XG4gICAgICAgICAgICB0QXR0YWNobWVudC50b3AgPSAndG9wJztcblxuICAgICAgICAgICAgdG9wIC09IGhlaWdodDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZUF0dGFjaG1lbnQudG9wID09PSAnYm90dG9tJyAmJiB0b3AgPCBib3VuZHNbMV0gJiYgdG9wICsgKGhlaWdodCAqIDIgLSB0YXJnZXRIZWlnaHQpIDw9IGJvdW5kc1szXSkge1xuICAgICAgICAgICAgdG9wICs9IGhlaWdodCAtIHRhcmdldEhlaWdodDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuXG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAndG9wJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodEF0dGFjaG1lbnQudG9wID09PSAnbWlkZGxlJykge1xuICAgICAgICAgIGlmICh0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10gJiYgZUF0dGFjaG1lbnQudG9wID09PSAndG9wJykge1xuICAgICAgICAgICAgdG9wIC09IGhlaWdodDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICdib3R0b20nO1xuICAgICAgICAgIH0gZWxzZSBpZiAodG9wIDwgYm91bmRzWzFdICYmIGVBdHRhY2htZW50LnRvcCA9PT0gJ2JvdHRvbScpIHtcbiAgICAgICAgICAgIHRvcCArPSBoZWlnaHQ7XG4gICAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAndG9wJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGNoYW5nZUF0dGFjaFggPT09ICd0YXJnZXQnIHx8IGNoYW5nZUF0dGFjaFggPT09ICdib3RoJykge1xuICAgICAgICBpZiAobGVmdCA8IGJvdW5kc1swXSAmJiB0QXR0YWNobWVudC5sZWZ0ID09PSAnbGVmdCcpIHtcbiAgICAgICAgICBsZWZ0ICs9IHRhcmdldFdpZHRoO1xuICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxlZnQgKyB3aWR0aCA+IGJvdW5kc1syXSAmJiB0QXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgbGVmdCAtPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICB0QXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjaGFuZ2VBdHRhY2hYID09PSAndG9nZXRoZXInKSB7XG4gICAgICAgIGlmIChsZWZ0IDwgYm91bmRzWzBdICYmIHRBdHRhY2htZW50LmxlZnQgPT09ICdsZWZ0Jykge1xuICAgICAgICAgIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgICBsZWZ0ICs9IHRhcmdldFdpZHRoO1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG5cbiAgICAgICAgICAgIGxlZnQgKz0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgICBsZWZ0ICs9IHRhcmdldFdpZHRoO1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG5cbiAgICAgICAgICAgIGxlZnQgLT0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAobGVmdCArIHdpZHRoID4gYm91bmRzWzJdICYmIHRBdHRhY2htZW50LmxlZnQgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgICBsZWZ0IC09IHRhcmdldFdpZHRoO1xuICAgICAgICAgICAgdEF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcblxuICAgICAgICAgICAgbGVmdCAtPSB3aWR0aDtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuICAgICAgICAgIH0gZWxzZSBpZiAoZUF0dGFjaG1lbnQubGVmdCA9PT0gJ3JpZ2h0Jykge1xuICAgICAgICAgICAgbGVmdCAtPSB0YXJnZXRXaWR0aDtcbiAgICAgICAgICAgIHRBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG5cbiAgICAgICAgICAgIGxlZnQgKz0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0QXR0YWNobWVudC5sZWZ0ID09PSAnY2VudGVyJykge1xuICAgICAgICAgIGlmIChsZWZ0ICsgd2lkdGggPiBib3VuZHNbMl0gJiYgZUF0dGFjaG1lbnQubGVmdCA9PT0gJ2xlZnQnKSB7XG4gICAgICAgICAgICBsZWZ0IC09IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdyaWdodCc7XG4gICAgICAgICAgfSBlbHNlIGlmIChsZWZ0IDwgYm91bmRzWzBdICYmIGVBdHRhY2htZW50LmxlZnQgPT09ICdyaWdodCcpIHtcbiAgICAgICAgICAgIGxlZnQgKz0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ2xlZnQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY2hhbmdlQXR0YWNoWSA9PT0gJ2VsZW1lbnQnIHx8IGNoYW5nZUF0dGFjaFkgPT09ICdib3RoJykge1xuICAgICAgICBpZiAodG9wIDwgYm91bmRzWzFdICYmIGVBdHRhY2htZW50LnRvcCA9PT0gJ2JvdHRvbScpIHtcbiAgICAgICAgICB0b3AgKz0gaGVpZ2h0O1xuICAgICAgICAgIGVBdHRhY2htZW50LnRvcCA9ICd0b3AnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRvcCArIGhlaWdodCA+IGJvdW5kc1szXSAmJiBlQXR0YWNobWVudC50b3AgPT09ICd0b3AnKSB7XG4gICAgICAgICAgdG9wIC09IGhlaWdodDtcbiAgICAgICAgICBlQXR0YWNobWVudC50b3AgPSAnYm90dG9tJztcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY2hhbmdlQXR0YWNoWCA9PT0gJ2VsZW1lbnQnIHx8IGNoYW5nZUF0dGFjaFggPT09ICdib3RoJykge1xuICAgICAgICBpZiAobGVmdCA8IGJvdW5kc1swXSkge1xuICAgICAgICAgIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAncmlnaHQnKSB7XG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoO1xuICAgICAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9ICdsZWZ0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdjZW50ZXInKSB7XG4gICAgICAgICAgICBsZWZ0ICs9IHdpZHRoIC8gMjtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAnbGVmdCc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGxlZnQgKyB3aWR0aCA+IGJvdW5kc1syXSkge1xuICAgICAgICAgIGlmIChlQXR0YWNobWVudC5sZWZ0ID09PSAnbGVmdCcpIHtcbiAgICAgICAgICAgIGxlZnQgLT0gd2lkdGg7XG4gICAgICAgICAgICBlQXR0YWNobWVudC5sZWZ0ID0gJ3JpZ2h0JztcbiAgICAgICAgICB9IGVsc2UgaWYgKGVBdHRhY2htZW50LmxlZnQgPT09ICdjZW50ZXInKSB7XG4gICAgICAgICAgICBsZWZ0IC09IHdpZHRoIC8gMjtcbiAgICAgICAgICAgIGVBdHRhY2htZW50LmxlZnQgPSAncmlnaHQnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIHBpbiA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgcGluID0gcGluLnNwbGl0KCcsJykubWFwKGZ1bmN0aW9uIChwKSB7XG4gICAgICAgICAgcmV0dXJuIHAudHJpbSgpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSBpZiAocGluID09PSB0cnVlKSB7XG4gICAgICAgIHBpbiA9IFsndG9wJywgJ2xlZnQnLCAncmlnaHQnLCAnYm90dG9tJ107XG4gICAgICB9XG5cbiAgICAgIHBpbiA9IHBpbiB8fCBbXTtcblxuICAgICAgdmFyIHBpbm5lZCA9IFtdO1xuICAgICAgdmFyIG9vYiA9IFtdO1xuXG4gICAgICBpZiAodG9wIDwgYm91bmRzWzFdKSB7XG4gICAgICAgIGlmIChwaW4uaW5kZXhPZigndG9wJykgPj0gMCkge1xuICAgICAgICAgIHRvcCA9IGJvdW5kc1sxXTtcbiAgICAgICAgICBwaW5uZWQucHVzaCgndG9wJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb29iLnB1c2goJ3RvcCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICh0b3AgKyBoZWlnaHQgPiBib3VuZHNbM10pIHtcbiAgICAgICAgaWYgKHBpbi5pbmRleE9mKCdib3R0b20nKSA+PSAwKSB7XG4gICAgICAgICAgdG9wID0gYm91bmRzWzNdIC0gaGVpZ2h0O1xuICAgICAgICAgIHBpbm5lZC5wdXNoKCdib3R0b20nKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvb2IucHVzaCgnYm90dG9tJyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGxlZnQgPCBib3VuZHNbMF0pIHtcbiAgICAgICAgaWYgKHBpbi5pbmRleE9mKCdsZWZ0JykgPj0gMCkge1xuICAgICAgICAgIGxlZnQgPSBib3VuZHNbMF07XG4gICAgICAgICAgcGlubmVkLnB1c2goJ2xlZnQnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBvb2IucHVzaCgnbGVmdCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChsZWZ0ICsgd2lkdGggPiBib3VuZHNbMl0pIHtcbiAgICAgICAgaWYgKHBpbi5pbmRleE9mKCdyaWdodCcpID49IDApIHtcbiAgICAgICAgICBsZWZ0ID0gYm91bmRzWzJdIC0gd2lkdGg7XG4gICAgICAgICAgcGlubmVkLnB1c2goJ3JpZ2h0Jyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb29iLnB1c2goJ3JpZ2h0Jyk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHBpbm5lZC5sZW5ndGgpIHtcbiAgICAgICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgcGlubmVkQ2xhc3MgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgaWYgKHR5cGVvZiBfdGhpcy5vcHRpb25zLnBpbm5lZENsYXNzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgcGlubmVkQ2xhc3MgPSBfdGhpcy5vcHRpb25zLnBpbm5lZENsYXNzO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwaW5uZWRDbGFzcyA9IF90aGlzLmdldENsYXNzKCdwaW5uZWQnKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhZGRDbGFzc2VzLnB1c2gocGlubmVkQ2xhc3MpO1xuICAgICAgICAgIHBpbm5lZC5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgICAgICBhZGRDbGFzc2VzLnB1c2gocGlubmVkQ2xhc3MgKyAnLScgKyBzaWRlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH1cblxuICAgICAgaWYgKG9vYi5sZW5ndGgpIHtcbiAgICAgICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgb29iQ2xhc3MgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgaWYgKHR5cGVvZiBfdGhpcy5vcHRpb25zLm91dE9mQm91bmRzQ2xhc3MgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBvb2JDbGFzcyA9IF90aGlzLm9wdGlvbnMub3V0T2ZCb3VuZHNDbGFzcztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb29iQ2xhc3MgPSBfdGhpcy5nZXRDbGFzcygnb3V0LW9mLWJvdW5kcycpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGFkZENsYXNzZXMucHVzaChvb2JDbGFzcyk7XG4gICAgICAgICAgb29iLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgICAgICAgIGFkZENsYXNzZXMucHVzaChvb2JDbGFzcyArICctJyArIHNpZGUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KSgpO1xuICAgICAgfVxuXG4gICAgICBpZiAocGlubmVkLmluZGV4T2YoJ2xlZnQnKSA+PSAwIHx8IHBpbm5lZC5pbmRleE9mKCdyaWdodCcpID49IDApIHtcbiAgICAgICAgZUF0dGFjaG1lbnQubGVmdCA9IHRBdHRhY2htZW50LmxlZnQgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIGlmIChwaW5uZWQuaW5kZXhPZigndG9wJykgPj0gMCB8fCBwaW5uZWQuaW5kZXhPZignYm90dG9tJykgPj0gMCkge1xuICAgICAgICBlQXR0YWNobWVudC50b3AgPSB0QXR0YWNobWVudC50b3AgPSBmYWxzZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRBdHRhY2htZW50LnRvcCAhPT0gdGFyZ2V0QXR0YWNobWVudC50b3AgfHwgdEF0dGFjaG1lbnQubGVmdCAhPT0gdGFyZ2V0QXR0YWNobWVudC5sZWZ0IHx8IGVBdHRhY2htZW50LnRvcCAhPT0gX3RoaXMuYXR0YWNobWVudC50b3AgfHwgZUF0dGFjaG1lbnQubGVmdCAhPT0gX3RoaXMuYXR0YWNobWVudC5sZWZ0KSB7XG4gICAgICAgIF90aGlzLnVwZGF0ZUF0dGFjaENsYXNzZXMoZUF0dGFjaG1lbnQsIHRBdHRhY2htZW50KTtcbiAgICAgICAgX3RoaXMudHJpZ2dlcigndXBkYXRlJywge1xuICAgICAgICAgIGF0dGFjaG1lbnQ6IGVBdHRhY2htZW50LFxuICAgICAgICAgIHRhcmdldEF0dGFjaG1lbnQ6IHRBdHRhY2htZW50XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgZGVmZXIoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCEoX3RoaXMub3B0aW9ucy5hZGRUYXJnZXRDbGFzc2VzID09PSBmYWxzZSkpIHtcbiAgICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpcy50YXJnZXQsIGFkZENsYXNzZXMsIGFsbENsYXNzZXMpO1xuICAgICAgfVxuICAgICAgdXBkYXRlQ2xhc3NlcyhfdGhpcy5lbGVtZW50LCBhZGRDbGFzc2VzLCBhbGxDbGFzc2VzKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7IHRvcDogdG9wLCBsZWZ0OiBsZWZ0IH07XG4gIH1cbn0pO1xuLyogZ2xvYmFscyBUZXRoZXJCYXNlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9UZXRoZXJCYXNlJFV0aWxzID0gVGV0aGVyQmFzZS5VdGlscztcbnZhciBnZXRCb3VuZHMgPSBfVGV0aGVyQmFzZSRVdGlscy5nZXRCb3VuZHM7XG52YXIgdXBkYXRlQ2xhc3NlcyA9IF9UZXRoZXJCYXNlJFV0aWxzLnVwZGF0ZUNsYXNzZXM7XG52YXIgZGVmZXIgPSBfVGV0aGVyQmFzZSRVdGlscy5kZWZlcjtcblxuVGV0aGVyQmFzZS5tb2R1bGVzLnB1c2goe1xuICBwb3NpdGlvbjogZnVuY3Rpb24gcG9zaXRpb24oX3JlZikge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICB2YXIgdG9wID0gX3JlZi50b3A7XG4gICAgdmFyIGxlZnQgPSBfcmVmLmxlZnQ7XG5cbiAgICB2YXIgX2NhY2hlID0gdGhpcy5jYWNoZSgnZWxlbWVudC1ib3VuZHMnLCBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gZ2V0Qm91bmRzKF90aGlzLmVsZW1lbnQpO1xuICAgIH0pO1xuXG4gICAgdmFyIGhlaWdodCA9IF9jYWNoZS5oZWlnaHQ7XG4gICAgdmFyIHdpZHRoID0gX2NhY2hlLndpZHRoO1xuXG4gICAgdmFyIHRhcmdldFBvcyA9IHRoaXMuZ2V0VGFyZ2V0Qm91bmRzKCk7XG5cbiAgICB2YXIgYm90dG9tID0gdG9wICsgaGVpZ2h0O1xuICAgIHZhciByaWdodCA9IGxlZnQgKyB3aWR0aDtcblxuICAgIHZhciBhYnV0dGVkID0gW107XG4gICAgaWYgKHRvcCA8PSB0YXJnZXRQb3MuYm90dG9tICYmIGJvdHRvbSA+PSB0YXJnZXRQb3MudG9wKSB7XG4gICAgICBbJ2xlZnQnLCAncmlnaHQnXS5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgIHZhciB0YXJnZXRQb3NTaWRlID0gdGFyZ2V0UG9zW3NpZGVdO1xuICAgICAgICBpZiAodGFyZ2V0UG9zU2lkZSA9PT0gbGVmdCB8fCB0YXJnZXRQb3NTaWRlID09PSByaWdodCkge1xuICAgICAgICAgIGFidXR0ZWQucHVzaChzaWRlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgaWYgKGxlZnQgPD0gdGFyZ2V0UG9zLnJpZ2h0ICYmIHJpZ2h0ID49IHRhcmdldFBvcy5sZWZ0KSB7XG4gICAgICBbJ3RvcCcsICdib3R0b20nXS5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICAgIHZhciB0YXJnZXRQb3NTaWRlID0gdGFyZ2V0UG9zW3NpZGVdO1xuICAgICAgICBpZiAodGFyZ2V0UG9zU2lkZSA9PT0gdG9wIHx8IHRhcmdldFBvc1NpZGUgPT09IGJvdHRvbSkge1xuICAgICAgICAgIGFidXR0ZWQucHVzaChzaWRlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdmFyIGFsbENsYXNzZXMgPSBbXTtcbiAgICB2YXIgYWRkQ2xhc3NlcyA9IFtdO1xuXG4gICAgdmFyIHNpZGVzID0gWydsZWZ0JywgJ3RvcCcsICdyaWdodCcsICdib3R0b20nXTtcbiAgICBhbGxDbGFzc2VzLnB1c2godGhpcy5nZXRDbGFzcygnYWJ1dHRlZCcpKTtcbiAgICBzaWRlcy5mb3JFYWNoKGZ1bmN0aW9uIChzaWRlKSB7XG4gICAgICBhbGxDbGFzc2VzLnB1c2goX3RoaXMuZ2V0Q2xhc3MoJ2FidXR0ZWQnKSArICctJyArIHNpZGUpO1xuICAgIH0pO1xuXG4gICAgaWYgKGFidXR0ZWQubGVuZ3RoKSB7XG4gICAgICBhZGRDbGFzc2VzLnB1c2godGhpcy5nZXRDbGFzcygnYWJ1dHRlZCcpKTtcbiAgICB9XG5cbiAgICBhYnV0dGVkLmZvckVhY2goZnVuY3Rpb24gKHNpZGUpIHtcbiAgICAgIGFkZENsYXNzZXMucHVzaChfdGhpcy5nZXRDbGFzcygnYWJ1dHRlZCcpICsgJy0nICsgc2lkZSk7XG4gICAgfSk7XG5cbiAgICBkZWZlcihmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoIShfdGhpcy5vcHRpb25zLmFkZFRhcmdldENsYXNzZXMgPT09IGZhbHNlKSkge1xuICAgICAgICB1cGRhdGVDbGFzc2VzKF90aGlzLnRhcmdldCwgYWRkQ2xhc3NlcywgYWxsQ2xhc3Nlcyk7XG4gICAgICB9XG4gICAgICB1cGRhdGVDbGFzc2VzKF90aGlzLmVsZW1lbnQsIGFkZENsYXNzZXMsIGFsbENsYXNzZXMpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn0pO1xuLyogZ2xvYmFscyBUZXRoZXJCYXNlICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIF9zbGljZWRUb0FycmF5ID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gc2xpY2VJdGVyYXRvcihhcnIsIGkpIHsgdmFyIF9hcnIgPSBbXTsgdmFyIF9uID0gdHJ1ZTsgdmFyIF9kID0gZmFsc2U7IHZhciBfZSA9IHVuZGVmaW5lZDsgdHJ5IHsgZm9yICh2YXIgX2kgPSBhcnJbU3ltYm9sLml0ZXJhdG9yXSgpLCBfczsgIShfbiA9IChfcyA9IF9pLm5leHQoKSkuZG9uZSk7IF9uID0gdHJ1ZSkgeyBfYXJyLnB1c2goX3MudmFsdWUpOyBpZiAoaSAmJiBfYXJyLmxlbmd0aCA9PT0gaSkgYnJlYWs7IH0gfSBjYXRjaCAoZXJyKSB7IF9kID0gdHJ1ZTsgX2UgPSBlcnI7IH0gZmluYWxseSB7IHRyeSB7IGlmICghX24gJiYgX2lbJ3JldHVybiddKSBfaVsncmV0dXJuJ10oKTsgfSBmaW5hbGx5IHsgaWYgKF9kKSB0aHJvdyBfZTsgfSB9IHJldHVybiBfYXJyOyB9IHJldHVybiBmdW5jdGlvbiAoYXJyLCBpKSB7IGlmIChBcnJheS5pc0FycmF5KGFycikpIHsgcmV0dXJuIGFycjsgfSBlbHNlIGlmIChTeW1ib2wuaXRlcmF0b3IgaW4gT2JqZWN0KGFycikpIHsgcmV0dXJuIHNsaWNlSXRlcmF0b3IoYXJyLCBpKTsgfSBlbHNlIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignSW52YWxpZCBhdHRlbXB0IHRvIGRlc3RydWN0dXJlIG5vbi1pdGVyYWJsZSBpbnN0YW5jZScpOyB9IH07IH0pKCk7XG5cblRldGhlckJhc2UubW9kdWxlcy5wdXNoKHtcbiAgcG9zaXRpb246IGZ1bmN0aW9uIHBvc2l0aW9uKF9yZWYpIHtcbiAgICB2YXIgdG9wID0gX3JlZi50b3A7XG4gICAgdmFyIGxlZnQgPSBfcmVmLmxlZnQ7XG5cbiAgICBpZiAoIXRoaXMub3B0aW9ucy5zaGlmdCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzaGlmdCA9IHRoaXMub3B0aW9ucy5zaGlmdDtcbiAgICBpZiAodHlwZW9mIHRoaXMub3B0aW9ucy5zaGlmdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgc2hpZnQgPSB0aGlzLm9wdGlvbnMuc2hpZnQuY2FsbCh0aGlzLCB7IHRvcDogdG9wLCBsZWZ0OiBsZWZ0IH0pO1xuICAgIH1cblxuICAgIHZhciBzaGlmdFRvcCA9IHVuZGVmaW5lZCxcbiAgICAgICAgc2hpZnRMZWZ0ID0gdW5kZWZpbmVkO1xuICAgIGlmICh0eXBlb2Ygc2hpZnQgPT09ICdzdHJpbmcnKSB7XG4gICAgICBzaGlmdCA9IHNoaWZ0LnNwbGl0KCcgJyk7XG4gICAgICBzaGlmdFsxXSA9IHNoaWZ0WzFdIHx8IHNoaWZ0WzBdO1xuXG4gICAgICB2YXIgX3NoaWZ0ID0gc2hpZnQ7XG5cbiAgICAgIHZhciBfc2hpZnQyID0gX3NsaWNlZFRvQXJyYXkoX3NoaWZ0LCAyKTtcblxuICAgICAgc2hpZnRUb3AgPSBfc2hpZnQyWzBdO1xuICAgICAgc2hpZnRMZWZ0ID0gX3NoaWZ0MlsxXTtcblxuICAgICAgc2hpZnRUb3AgPSBwYXJzZUZsb2F0KHNoaWZ0VG9wLCAxMCk7XG4gICAgICBzaGlmdExlZnQgPSBwYXJzZUZsb2F0KHNoaWZ0TGVmdCwgMTApO1xuICAgIH0gZWxzZSB7XG4gICAgICBzaGlmdFRvcCA9IHNoaWZ0LnRvcDtcbiAgICAgIHNoaWZ0TGVmdCA9IHNoaWZ0LmxlZnQ7XG4gICAgfVxuXG4gICAgdG9wICs9IHNoaWZ0VG9wO1xuICAgIGxlZnQgKz0gc2hpZnRMZWZ0O1xuXG4gICAgcmV0dXJuIHsgdG9wOiB0b3AsIGxlZnQ6IGxlZnQgfTtcbiAgfVxufSk7XG5yZXR1cm4gVGV0aGVyO1xuXG59KSk7XG4iLCJjb25zdCBwYW5lbCA9ICdFbW9qaVBhbmVsJztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICAgcGFuZWwsXG4gICAgb3BlbjogcGFuZWwgKyAnLS1vcGVuJyxcbiAgICB0cmlnZ2VyOiBwYW5lbCArICctLXRyaWdnZXInLFxuICAgIHRhYjogcGFuZWwrJ19fdGFiJyxcbiAgICB0YWJXcmFwcGVyOiBwYW5lbCsnX190YWJXcmFwcGVyJyxcbiAgICB0YWJBY3RpdmU6IHBhbmVsKydfX3RhYkFjdGl2ZScsXG5cbiAgICBpY29uczogXCJpY29uX3BhY2tcIixcbiAgICBpY29ucGljazogXCJpY29uX3BpY2tlclwiLFxuICAgIGVtb2ppcGljazogXCJlbW9qaV9waWNrZXJcIixcbiAgICBlbW9qaTogJ2Vtb2ppJyxcbiAgICBzdmc6IHBhbmVsICsgJ19fc3ZnJyxcblxuICAgIHRvb2x0aXA6IHBhbmVsICsgJ19fdG9vbHRpcCcsXG5cbiAgICBjb250ZW50OiBwYW5lbCArICdfX2NvbnRlbnQnLFxuICAgIGhlYWRlcjogcGFuZWwgKyAnX19oZWFkZXInLFxuICAgIHF1ZXJ5OiBwYW5lbCArICdfX3F1ZXJ5JyxcbiAgICBzZWFyY2hJbnB1dDogcGFuZWwgKyAnX19xdWVyeUlucHV0JyxcbiAgICBzZWFyY2hUaXRsZTogcGFuZWwgKyAnX19zZWFyY2hUaXRsZScsXG4gICAgZnJlcXVlbnRUaXRsZTogcGFuZWwgKyAnX19mcmVxdWVudFRpdGxlJyxcblxuICAgIHJlc3VsdHM6IHBhbmVsICsgJ19fcmVzdWx0cycsXG4gICAgbm9SZXN1bHRzOiBwYW5lbCArICdfX25vUmVzdWx0cycsXG4gICAgY2F0ZWdvcnk6IHBhbmVsICsgJ19fY2F0ZWdvcnknLFxuICAgIGNhdGVnb3JpZXM6IHBhbmVsICsgJ19fY2F0ZWdvcmllcycsXG5cbiAgICBmb290ZXI6IHBhbmVsICsgJ19fZm9vdGVyJyxcbiAgICBicmFuZDogcGFuZWwgKyAnX19icmFuZCcsXG4gICAgYnRuTW9kaWZpZXI6IHBhbmVsICsgJ19fYnRuTW9kaWZpZXInLFxuICAgIGJ0bk1vZGlmaWVyVG9nZ2xlOiBwYW5lbCArICdfX2J0bk1vZGlmaWVyVG9nZ2xlJyxcbiAgICBtb2RpZmllckRyb3Bkb3duOiBwYW5lbCArICdfX21vZGlmaWVyRHJvcGRvd24nLFxufTtcbiIsImNvbnN0IFRldGhlciA9IHJlcXVpcmUoJ3RldGhlcicpO1xuXG5jb25zdCBFbW9qaXMgPSByZXF1aXJlKCcuL2Vtb2ppcycpO1xuXG5jb25zdCBDcmVhdGUgPSAob3B0aW9ucywgZW1pdCwgdG9nZ2xlKSA9PiB7XG4gICAgaWYob3B0aW9ucy5lZGl0YWJsZSkge1xuICAgICAgICAvLyBTZXQgdGhlIGNhcmV0IG9mZnNldCBvbiB0aGUgaW5wdXRcbiAgICAgICAgY29uc3QgaGFuZGxlQ2hhbmdlID0gZSA9PiB7XG4gICAgICAgICAgICBvcHRpb25zLmVkaXRhYmxlLmRhdGFzZXQub2Zmc2V0ID0gZ2V0Q2FyZXRQb3NpdGlvbihvcHRpb25zLmVkaXRhYmxlKTtcbiAgICAgICAgfTtcbiAgICAgICAgb3B0aW9ucy5lZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGhhbmRsZUNoYW5nZSk7XG4gICAgICAgIG9wdGlvbnMuZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgaGFuZGxlQ2hhbmdlKTtcbiAgICAgICAgb3B0aW9ucy5lZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGhhbmRsZUNoYW5nZSk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHRoZSBkcm9wZG93biBwYW5lbFxuICAgIGNvbnN0IHBhbmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIilcbiAgICB7XG4gICAgICAgIHBhbmVsLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnBhbmVsKTtcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuZW1vamlwaWNrKTsgXG4gICAgfVxuICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMucGFuZWwpOyBcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuaWNvbnBpY2spOyBcbiAgICB9XG4gICAgXG4gICAgY29uc3QgY29udGVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnRlbnQuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY29udGVudCk7XG4gICAgcGFuZWwuYXBwZW5kQ2hpbGQoY29udGVudCk7XG5cbiAgICBsZXQgc2VhcmNoSW5wdXQ7XG4gICAgbGV0IHJlc3VsdHM7XG4gICAgbGV0IGVtcHR5U3RhdGU7XG4gICAgbGV0IGZyZXF1ZW50VGl0bGU7XG5cbiAgICBpZihvcHRpb25zLnRyaWdnZXIpIHtcbiAgICAgICAgcGFuZWwuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMudHJpZ2dlcik7XG4gICAgICAgIC8vIExpc3RlbiBmb3IgdGhlIHRyaWdnZXJcbiAgICAgICAgb3B0aW9ucy50cmlnZ2VyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdG9nZ2xlKCkpO1xuXG4gICAgICAgIC8vIENyZWF0ZSB0aGUgdG9vbHRpcFxuICAgICAgICBvcHRpb25zLnRyaWdnZXIuc2V0QXR0cmlidXRlKCd0aXRsZScsIG9wdGlvbnMubG9jYWxlLmFkZCk7XG4gICAgICAgIGNvbnN0IHRvb2x0aXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gICAgICAgIHRvb2x0aXAuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMudG9vbHRpcCk7XG4gICAgICAgIHRvb2x0aXAuaW5uZXJIVE1MID0gb3B0aW9ucy5sb2NhbGUuYWRkO1xuICAgICAgICBvcHRpb25zLnRyaWdnZXIuYXBwZW5kQ2hpbGQodG9vbHRpcCk7XG4gICAgfVxuXG4gICAgLy8gQ3JlYXRlIHRoZSBjYXRlZ29yeSBsaW5rc1xuICAgIGNvbnN0IGhlYWRlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2hlYWRlcicpO1xuICAgIGhlYWRlci5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5oZWFkZXIpO1xuICAgIGNvbnRlbnQuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcblxuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjYXRlZ29yaWVzLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3JpZXMpO1xuICAgIGhlYWRlci5hcHBlbmRDaGlsZChjYXRlZ29yaWVzKTtcblxuICAgIGZvcihsZXQgaSA9IDA7IGkgPCA5OyBpKyspIHtcbiAgICAgICAgY29uc3QgY2F0ZWdvcnlMaW5rID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgIGNhdGVnb3J5TGluay5jbGFzc0xpc3QuYWRkKCd0ZW1wJyk7XG4gICAgICAgIGNhdGVnb3JpZXMuYXBwZW5kQ2hpbGQoY2F0ZWdvcnlMaW5rKTtcbiAgICB9XG4gICAgXG4gICAgLy8gQ3JlYXRlIHRoZSBsaXN0XG4gICAgcmVzdWx0cyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHJlc3VsdHMuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMucmVzdWx0cyk7XG4gICAgY29udGVudC5hcHBlbmRDaGlsZChyZXN1bHRzKTtcblxuICAgIC8vIENyZWF0ZSB0aGUgc2VhcmNoIGlucHV0XG4gICAgaWYob3B0aW9ucy5zZWFyY2ggPT0gdHJ1ZSkge1xuICAgICAgICBjb25zdCBxdWVyeSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICBxdWVyeS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5xdWVyeSk7XG4gICAgICAgIGhlYWRlci5hcHBlbmRDaGlsZChxdWVyeSk7XG5cbiAgICAgICAgc2VhcmNoSW5wdXQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbnB1dCcpO1xuICAgICAgICBzZWFyY2hJbnB1dC5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5zZWFyY2hJbnB1dCk7XG4gICAgICAgIHNlYXJjaElucHV0LnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0Jyk7XG4gICAgICAgIHNlYXJjaElucHV0LnNldEF0dHJpYnV0ZSgnYXV0b0NvbXBsZXRlJywgJ29mZicpO1xuICAgICAgICBzZWFyY2hJbnB1dC5zZXRBdHRyaWJ1dGUoJ3BsYWNlaG9sZGVyJywgb3B0aW9ucy5sb2NhbGUuc2VhcmNoKTtcbiAgICAgICAgcXVlcnkuYXBwZW5kQ2hpbGQoc2VhcmNoSW5wdXQpO1xuXG4gICAgICAgIGNvbnN0IGljb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgaWNvbi5pbm5lckhUTUwgPSBvcHRpb25zLmljb25zLnNlYXJjaDtcbiAgICAgICAgcXVlcnkuYXBwZW5kQ2hpbGQoaWNvbik7XG5cbiAgICAgICAgY29uc3Qgc2VhcmNoVGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gICAgICAgIHNlYXJjaFRpdGxlLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3J5LCBvcHRpb25zLmNsYXNzbmFtZXMuc2VhcmNoVGl0bGUpO1xuICAgICAgICBzZWFyY2hUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICBzZWFyY2hUaXRsZS5pbm5lckhUTUwgPSBvcHRpb25zLmxvY2FsZS5zZWFyY2hfcmVzdWx0cztcbiAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChzZWFyY2hUaXRsZSk7XG5cbiAgICAgICAgZW1wdHlTdGF0ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgZW1wdHlTdGF0ZS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5ub1Jlc3VsdHMpO1xuICAgICAgICBlbXB0eVN0YXRlLmlubmVySFRNTCA9IG9wdGlvbnMubG9jYWxlLm5vX3Jlc3VsdHM7XG4gICAgICAgIHJlc3VsdHMuYXBwZW5kQ2hpbGQoZW1wdHlTdGF0ZSk7XG4gICAgfVxuXG4gICAgaWYob3B0aW9ucy5mcmVxdWVudCA9PSB0cnVlKSB7XG4gICAgICAgIGxldCBmcmVxdWVudExpc3QgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnRW1vamlQYW5lbC1mcmVxdWVudCcpO1xuICAgICAgICBpZihmcmVxdWVudExpc3QpIHtcbiAgICAgICAgICAgIGZyZXF1ZW50TGlzdCA9IEpTT04ucGFyc2UoZnJlcXVlbnRMaXN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGZyZXF1ZW50TGlzdCA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIGZyZXF1ZW50VGl0bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdwJyk7XG4gICAgICAgIGZyZXF1ZW50VGl0bGUuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY2F0ZWdvcnksIG9wdGlvbnMuY2xhc3NuYW1lcy5mcmVxdWVudFRpdGxlKTtcbiAgICAgICAgZnJlcXVlbnRUaXRsZS5pbm5lckhUTUwgPSBvcHRpb25zLmxvY2FsZS5mcmVxdWVudDtcbiAgICAgICAgaWYoZnJlcXVlbnRMaXN0Lmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICBmcmVxdWVudFRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgIH1cbiAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChmcmVxdWVudFRpdGxlKTtcblxuICAgICAgICBjb25zdCBmcmVxdWVudFJlc3VsdHMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgZnJlcXVlbnRSZXN1bHRzLmNsYXNzTGlzdC5hZGQoJ0Vtb2ppUGFuZWwtZnJlcXVlbnQnKTtcblxuICAgICAgICBmcmVxdWVudExpc3QuZm9yRWFjaChlbW9qaSA9PiB7XG4gICAgICAgICAgICBmcmVxdWVudFJlc3VsdHMuYXBwZW5kQ2hpbGQoRW1vamlzLmNyZWF0ZUJ1dHRvbihlbW9qaSwgb3B0aW9ucywgZW1pdCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgcmVzdWx0cy5hcHBlbmRDaGlsZChmcmVxdWVudFJlc3VsdHMpO1xuICAgIH1cblxuICAgIGNvbnN0IGxvYWRpbmdUaXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgICBsb2FkaW5nVGl0bGUuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY2F0ZWdvcnkpO1xuICAgIGxvYWRpbmdUaXRsZS50ZXh0Q29udGVudCA9IG9wdGlvbnMubG9jYWxlLmxvYWRpbmc7XG4gICAgcmVzdWx0cy5hcHBlbmRDaGlsZChsb2FkaW5nVGl0bGUpO1xuICAgIGZvcihsZXQgaSA9IDA7IGkgPCA5ICogODsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHRlbXBFbW9qaSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgICB0ZW1wRW1vamkuY2xhc3NMaXN0LmFkZCgndGVtcCcpO1xuICAgICAgICByZXN1bHRzLmFwcGVuZENoaWxkKHRlbXBFbW9qaSk7XG4gICAgfVxuXG4gICAgY29uc3QgZm9vdGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZm9vdGVyJyk7XG4gICAgZm9vdGVyLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLmZvb3Rlcik7XG4gICAgcGFuZWwuYXBwZW5kQ2hpbGQoZm9vdGVyKTtcblxuICAgIGlmKG9wdGlvbnMubG9jYWxlLmJyYW5kKSB7XG4gICAgICAgIGNvbnN0IGJyYW5kID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYScpO1xuICAgICAgICBicmFuZC5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5icmFuZCk7XG4gICAgICAgIGJyYW5kLnNldEF0dHJpYnV0ZSgnaHJlZicsICdodHRwczovL2Vtb2ppcGFuZWwuanMub3JnJyk7XG4gICAgICAgIGJyYW5kLnRleHRDb250ZW50ID0gb3B0aW9ucy5sb2NhbGUuYnJhbmQ7XG4gICAgICAgIGZvb3Rlci5hcHBlbmRDaGlsZChicmFuZCk7XG4gICAgfVxuXG4gICAgLy8gQXBwZW5kIHRoZSBkcm9wZG93biBtZW51IHRvIHRoZSBjb250YWluZXJcbiAgICBvcHRpb25zLmNvbnRhaW5lci5hcHBlbmRDaGlsZChwYW5lbCk7XG5cbiAgICAvLyBUZXRoZXIgdGhlIGRyb3Bkb3duIHRvIHRoZSB0cmlnZ2VyXG4gICAgbGV0IHRldGhlcjtcbiAgICBpZihvcHRpb25zLnRyaWdnZXIgJiYgb3B0aW9ucy50ZXRoZXIpIHtcbiAgICAgICAgY29uc3QgcGxhY2VtZW50cyA9IFsndG9wJywgJ3JpZ2h0JywgJ2JvdHRvbScsICdsZWZ0J107XG4gICAgICAgIGlmKHBsYWNlbWVudHMuaW5kZXhPZihvcHRpb25zLnBsYWNlbWVudCkgPT0gLTEpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBhdHRhY2htZW50ICcke29wdGlvbnMucGxhY2VtZW50fScuIFZhbGlkIHBsYWNlbWVudHMgYXJlICcke3BsYWNlbWVudHMuam9pbihgJywgJ2ApfScuYCk7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgYXR0YWNobWVudDtcbiAgICAgICAgbGV0IHRhcmdldEF0dGFjaG1lbnQ7XG4gICAgICAgIHN3aXRjaChvcHRpb25zLnBsYWNlbWVudCkge1xuICAgICAgICAgICAgY2FzZSBwbGFjZW1lbnRzWzBdOiBjYXNlIHBsYWNlbWVudHNbMl06XG4gICAgICAgICAgICAgICAgYXR0YWNobWVudCA9IChvcHRpb25zLnBsYWNlbWVudCA9PSBwbGFjZW1lbnRzWzBdID8gcGxhY2VtZW50c1syXSA6IHBsYWNlbWVudHNbMF0pICsgJyBjZW50ZXInO1xuICAgICAgICAgICAgICAgIHRhcmdldEF0dGFjaG1lbnQgPSAob3B0aW9ucy5wbGFjZW1lbnQgPT0gcGxhY2VtZW50c1swXSA/IHBsYWNlbWVudHNbMF0gOiBwbGFjZW1lbnRzWzJdKSArICcgY2VudGVyJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgcGxhY2VtZW50c1sxXTogY2FzZSBwbGFjZW1lbnRzWzNdOlxuICAgICAgICAgICAgICAgIGF0dGFjaG1lbnQgPSAndG9wICcgKyAob3B0aW9ucy5wbGFjZW1lbnQgPT0gcGxhY2VtZW50c1sxXSA/IHBsYWNlbWVudHNbM10gOiBwbGFjZW1lbnRzWzFdKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRBdHRhY2htZW50ID0gJ3RvcCAnICsgKG9wdGlvbnMucGxhY2VtZW50ID09IHBsYWNlbWVudHNbMV0gPyBwbGFjZW1lbnRzWzFdIDogcGxhY2VtZW50c1szXSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cblxuICAgICAgICB0ZXRoZXIgPSBuZXcgVGV0aGVyKHtcbiAgICAgICAgICAgIGVsZW1lbnQ6IHBhbmVsLFxuICAgICAgICAgICAgdGFyZ2V0OiBvcHRpb25zLnRyaWdnZXIsXG4gICAgICAgICAgICBhdHRhY2htZW50LFxuICAgICAgICAgICAgdGFyZ2V0QXR0YWNobWVudFxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBSZXR1cm4gdGhlIHBhbmVsIGVsZW1lbnQgc28gd2UgY2FuIHVwZGF0ZSBpdCBsYXRlclxuICAgIHJldHVybiB7XG4gICAgICAgIHBhbmVsLFxuICAgICAgICB0ZXRoZXJcbiAgICB9O1xufTtcblxuY29uc3QgZ2V0Q2FyZXRQb3NpdGlvbiA9IGVsID0+IHtcbiAgICBsZXQgY2FyZXRPZmZzZXQgPSAwO1xuICAgIGNvbnN0IGRvYyA9IGVsLm93bmVyRG9jdW1lbnQgfHwgZWwuZG9jdW1lbnQ7XG4gICAgY29uc3Qgd2luID0gZG9jLmRlZmF1bHRWaWV3IHx8IGRvYy5wYXJlbnRXaW5kb3c7XG4gICAgbGV0IHNlbDtcbiAgICBpZih0eXBlb2Ygd2luLmdldFNlbGVjdGlvbiAhPSAndW5kZWZpbmVkJykge1xuICAgICAgICBzZWwgPSB3aW4uZ2V0U2VsZWN0aW9uKCk7XG4gICAgICAgIGlmKHNlbC5yYW5nZUNvdW50ID4gMCkge1xuICAgICAgICAgICAgY29uc3QgcmFuZ2UgPSB3aW4uZ2V0U2VsZWN0aW9uKCkuZ2V0UmFuZ2VBdCgwKTtcbiAgICAgICAgICAgIGNvbnN0IHByZUNhcmV0UmFuZ2UgPSByYW5nZS5jbG9uZVJhbmdlKCk7XG4gICAgICAgICAgICBwcmVDYXJldFJhbmdlLnNlbGVjdE5vZGVDb250ZW50cyhlbCk7XG4gICAgICAgICAgICBwcmVDYXJldFJhbmdlLnNldEVuZChyYW5nZS5lbmRDb250YWluZXIsIHJhbmdlLmVuZE9mZnNldCk7XG4gICAgICAgICAgICBjYXJldE9mZnNldCA9IHByZUNhcmV0UmFuZ2UudG9TdHJpbmcoKS5sZW5ndGg7XG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYoKHNlbCA9IGRvYy5zZWxlY3Rpb24pICYmIHNlbC50eXBlICE9ICdDb250cm9sJykge1xuICAgICAgICBjb25zdCB0ZXh0UmFuZ2UgPSBzZWwuY3JlYXRlUmFuZ2UoKTtcbiAgICAgICAgY29uc3QgcHJlQ2FyZXRUZXh0UmFuZ2UgPSBkb2MuYm9keS5jcmVhdGVUZXh0UmFuZ2UoKTtcbiAgICAgICAgcHJlQ2FyZXRUZXh0UmFuZ2UubW92ZVRvRWxlbWVudFRleHQoZWwpO1xuICAgICAgICBwcmVDYXJldFRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCB0ZXh0UmFuZ2UpO1xuICAgICAgICBjYXJldE9mZnNldCA9IHByZUNhcmV0VGV4dFJhbmdlLnRleHQubGVuZ3RoO1xuICAgIH1cbiAgICBcbiAgICByZXR1cm4gY2FyZXRPZmZzZXQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENyZWF0ZTtcbiIsImNvbnN0IG1vZGlmaWVycyA9IHJlcXVpcmUoJy4vbW9kaWZpZXJzJyk7XG5cbmNvbnN0IEVtb2ppcyA9IHtcbiAgICBsb2FkOiBvcHRpb25zID0+IHtcbiAgICAgICAgLy8gTG9hZCBhbmQgaW5qZWN0IHRoZSBTVkcgc3ByaXRlIGludG8gdGhlIERPTVxuICAgICAgICBsZXQgc3ZnUHJvbWlzZSA9IFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICBpZihvcHRpb25zLnBhY2tfdXJsICYmICFkb2N1bWVudC5xdWVyeVNlbGVjdG9yKG9wdGlvbnMuY2xhc3NuYW1lcy5zdmcpKSB7XG4gICAgICAgICAgICBzdmdQcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3Qgc3ZnWGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgc3ZnWGhyLm9wZW4oJ0dFVCcsIG9wdGlvbnMucGFja191cmwsIHRydWUpO1xuICAgICAgICAgICAgICAgIHN2Z1hoci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICAgICAgICBjb250YWluZXIuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuc3ZnKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSBzdmdYaHIucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGNvbnRhaW5lcik7XG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHN2Z1hoci5zZW5kKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBqc29uUHJvbWlzZTtcbiAgICAgICAgLy8gTG9hZCB0aGUgZW1vamlzIGpzb25cbiAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIilcbiAgICAgICAge1xuICAgICAgICAgICAgY29uc3QganNvbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdFbW9qaVBhbmVsLWpzb24nKTtcbiAgICAgICAgICAgIGpzb25Qcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKGpzb24pXG4gICAgICAgICAgICBpZihqc29uID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBlbW9qaVhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICAgICAgICAgICAgICAgICAgICBlbW9qaVhoci5vcGVuKCdHRVQnLCBvcHRpb25zLmpzb25fdXJsLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYoZW1vamlYaHIucmVhZHlTdGF0ZSA9PSBYTUxIdHRwUmVxdWVzdC5ET05FICYmIGVtb2ppWGhyLnN0YXR1cyA9PSAyMDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShlbW9qaVhoci5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKCdFbW9qaVBhbmVsLWpzb24nLGVtb2ppWGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIuc2VuZCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZWxzZXtcbiAgICAgICAgICAgICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnRW1vamlQYW5lbC1qc29uJykpO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGpzb24pO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpe1xuICAgICAgICAgICAgLy8gY29uc3QganNvbiA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdJY29uUGFuZWwtanNvbicpO1xuICAgICAgICAgICAgLy8ganNvblByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoanNvbilcbiAgICAgICAgICAgIC8vIGlmKGpzb24gPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGpzb25Qcm9taXNlID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVtb2ppWGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgICAgICAgICAgICAgICAgIGVtb2ppWGhyLm9wZW4oJ0dFVCcsIG9wdGlvbnMuanNvbl91cmwsIHRydWUpO1xuICAgICAgICAgICAgICAgICAgICBlbW9qaVhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZihlbW9qaVhoci5yZWFkeVN0YXRlID09IFhNTEh0dHBSZXF1ZXN0LkRPTkUgJiYgZW1vamlYaHIuc3RhdHVzID09IDIwMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGVtb2ppWGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy9sb2NhbFN0b3JhZ2Uuc2V0SXRlbSgnSWNvblBhbmVsLWpzb24nLGVtb2ppWGhyLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShqc29uKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICAgICAgZW1vamlYaHIuc2VuZCgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgICAgLy8gZWxzZXtcbiAgICAgICAgICAgIC8vICAgICBqc29uUHJvbWlzZSA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgLy8gICAgICAgICBjb25zdCBqc29uID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZ2V0SXRlbSgnSWNvblBhbmVsLWpzb24nKSk7XG4gICAgICAgICAgICAvLyAgICAgICAgIHJlc29sdmUoanNvbik7XG4gICAgICAgICAgICAvLyAgICAgfSlcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChbIHN2Z1Byb21pc2UsIGpzb25Qcm9taXNlIF0pO1xuICAgIH0sXG4gICAgY3JlYXRlRWw6IChpbnB1dEVsZW1lbnQsIG9wdGlvbnMsIGJhc2VVcmwsIG1lZGlhVHlwZSwgYmFzZUNsYXNzICkgPT4ge1xuICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKXtcblxuICAgICAgICAgICAgaWYob3B0aW9ucy5wYWNrX3VybCkge1xuICAgICAgICAgICAgICAgIGlmKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYC4ke29wdGlvbnMuY2xhc3NuYW1lcy5zdmd9IFtpZD1cIiR7aW5wdXRFbGVtZW50LnVuaWNvZGV9XCJgKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gYDxzdmcgdmlld0JveD1cIjAgMCAyMCAyMFwiPjx1c2UgeGxpbms6aHJlZj1cIiMke2lucHV0RWxlbWVudC51bmljb2RlfVwiPjwvdXNlPjwvc3ZnPmA7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIGlucHV0RWxlbWVudC5jaGFyO1xuICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gdGhlIGVtb2ppIGNoYXIgaWYgdGhlIHBhY2sgZG9lcyBub3QgaGF2ZSB0aGUgc3ByaXRlLCBvciBubyBwYWNrXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpXG4gICAgICAgIHtcbiAgICAgICAgICAgIGlmKG1lZGlhVHlwZSA9PSBcImltYWdlXCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCI8aW1nIHNyYz1cIitiYXNlVXJsK2lucHV0RWxlbWVudC5pY29uX3VybCtcIj5cIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCI8aSBjbGFzcz0nXCIrYmFzZUNsYXNzK1wiIFwiK2lucHV0RWxlbWVudC5pY29uX2NsYXNzK1wiJz48L2k+XCI7XG4gICAgICAgICAgICB9XG5cblxuICAgICAgICB9XG4gICAgfSxcbiAgICBjcmVhdGVCdXR0b246IChpbnB1dEVsZW1lbnQsIG9wdGlvbnMsIGVtaXQgLCBiYXNlVXJsLCBtZWRpYVR5cGUsIGJhc2VDbGFzcykgPT4ge1xuXG4gICAgICAgIGNvbnN0IGJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xuICAgICAgICBidXR0b24uc2V0QXR0cmlidXRlKCd0eXBlJywgJ2J1dHRvbicpO1xuXG4gICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpe1xuXG4gICAgICAgICAgICBpZihpbnB1dEVsZW1lbnQuZml0enBhdHJpY2sgJiYgb3B0aW9ucy5maXR6cGF0cmljaykge1xuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBleGlzdGluZyBtb2RpZmllcnNcbiAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhtb2RpZmllcnMpLmZvckVhY2goaSA9PiBpbnB1dEVsZW1lbnQudW5pY29kZSA9IGlucHV0RWxlbWVudC51bmljb2RlLnJlcGxhY2UobW9kaWZpZXJzW2ldLnVuaWNvZGUsICcnKSk7XG4gICAgICAgICAgICAgICAgT2JqZWN0LmtleXMobW9kaWZpZXJzKS5mb3JFYWNoKGkgPT4gaW5wdXRFbGVtZW50LmNoYXIgPSBpbnB1dEVsZW1lbnQuY2hhci5yZXBsYWNlKG1vZGlmaWVyc1tpXS5jaGFyLCAnJykpO1xuXG4gICAgICAgICAgICAgICAgLy8gQXBwZW5kIGZpdHpwYXRyaWNrIG1vZGlmaWVyXG4gICAgICAgICAgICAgICAgaW5wdXRFbGVtZW50LnVuaWNvZGUgKz0gbW9kaWZpZXJzW29wdGlvbnMuZml0enBhdHJpY2tdLnVuaWNvZGU7XG4gICAgICAgICAgICAgICAgaW5wdXRFbGVtZW50LmNoYXIgKz0gbW9kaWZpZXJzW29wdGlvbnMuZml0enBhdHJpY2tdLmNoYXI7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGJ1dHRvbi5pbm5lckhUTUwgPSBFbW9qaXMuY3JlYXRlRWwoaW5wdXRFbGVtZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdlbW9qaScpO1xuICAgICAgICAgICAgYnV0dG9uLmRhdGFzZXQudW5pY29kZSA9IGlucHV0RWxlbWVudC51bmljb2RlO1xuICAgICAgICAgICAgYnV0dG9uLmRhdGFzZXQuY2hhciA9IGlucHV0RWxlbWVudC5jaGFyO1xuICAgICAgICAgICAgYnV0dG9uLmRhdGFzZXQuY2F0ZWdvcnkgPSBpbnB1dEVsZW1lbnQuY2F0ZWdvcnk7XG4gICAgICAgICAgICBidXR0b24uZGF0YXNldC5uYW1lID0gaW5wdXRFbGVtZW50Lm5hbWU7XG4gICAgICAgICAgICBidXR0b24udGl0bGUgPSBpbnB1dEVsZW1lbnQubmFtZTtcbiAgICAgICAgICAgIGlmKGlucHV0RWxlbWVudC5maXR6cGF0cmljaykge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5kYXRhc2V0LmZpdHpwYXRyaWNrID0gaW5wdXRFbGVtZW50LmZpdHpwYXRyaWNrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoZW1pdCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdCgnc2VsZWN0JywgaW5wdXRFbGVtZW50KTtcblxuICAgICAgICAgICAgICAgICAgICBpZihvcHRpb25zLmVkaXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBFbW9qaXMud3JpdGUoaW5wdXRFbGVtZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiaWNvblwiKXtcblxuICAgICAgICAgICAgYnV0dG9uLmlubmVySFRNTCA9IEVtb2ppcy5jcmVhdGVFbChpbnB1dEVsZW1lbnQsIG9wdGlvbnMsIGJhc2VVcmwsIG1lZGlhVHlwZSwgYmFzZUNsYXNzKTtcbiAgICAgICAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdpY29uX3BhY2snKTtcbiAgICAgICAgICAgIGJ1dHRvbi5kYXRhc2V0Lm5hbWUgPSBpbnB1dEVsZW1lbnQubmFtZTtcblxuICAgICAgICAgICAgaWYoZW1pdCkge1xuICAgICAgICAgICAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgZW1pdCgnc2VsZWN0JywgaW5wdXRFbGVtZW50KTtcblxuICAgICAgICAgICAgICAgICAgICBpZihvcHRpb25zLmVkaXRhYmxlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBFbW9qaXMud3JpdGUoaW5wdXRFbGVtZW50LCBvcHRpb25zKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBidXR0b247XG4gICAgfSxcbiAgICB3cml0ZTogKGlucHV0RWxlbWVudCwgb3B0aW9ucykgPT4ge1xuICAgICAgICBjb25zdCBpbnB1dCA9IG9wdGlvbnMuZWRpdGFibGU7XG4gICAgICAgIGlmKCFpbnB1dCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpe1xuXG4gICAgICAgICAgICAvLyBJbnNlcnQgdGhlIGVtb2ppIGF0IHRoZSBlbmQgb2YgdGhlIHRleHQgYnkgZGVmYXVsdFxuICAgICAgICAgICAgbGV0IG9mZnNldCA9IGlucHV0LnRleHRDb250ZW50Lmxlbmd0aDtcbiAgICAgICAgICAgIGlmKGlucHV0LmRhdGFzZXQub2Zmc2V0KSB7XG4gICAgICAgICAgICAgICAgLy8gSW5zZXJ0IHRoZSBlbW9qaSB3aGVyZSB0aGUgcmljaCBlZGl0b3IgY2FyZXQgd2FzXG4gICAgICAgICAgICAgICAgb2Zmc2V0ID0gaW5wdXQuZGF0YXNldC5vZmZzZXQ7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIEluc2VydCB0aGUgcGljdG9ncmFwaEltYWdlXG4gICAgICAgICAgICBjb25zdCBwaWN0b2dyYXBocyA9IGlucHV0LnBhcmVudE5vZGUucXVlcnlTZWxlY3RvcignLkVtb2ppUGFuZWxfX3BpY3RvZ3JhcGhzJyk7XG4gICAgICAgICAgICBjb25zdCB1cmwgPSAnaHR0cHM6Ly9hYnMudHdpbWcuY29tL2Vtb2ppL3YyLzcyeDcyLycgKyBlbW9qaS51bmljb2RlICsgJy5wbmcnO1xuICAgICAgICAgICAgY29uc3QgaW1hZ2UgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICAgIGltYWdlLmNsYXNzTGlzdC5hZGQoJ1JpY2hFZGl0b3ItcGljdG9ncmFwaEltYWdlJyk7XG4gICAgICAgICAgICBpbWFnZS5zZXRBdHRyaWJ1dGUoJ3NyYycsIHVybCk7XG4gICAgICAgICAgICBpbWFnZS5zZXRBdHRyaWJ1dGUoJ2RyYWdnYWJsZScsIGZhbHNlKTtcbiAgICAgICAgICAgIHBpY3RvZ3JhcGhzLmFwcGVuZENoaWxkKGltYWdlKTtcblxuICAgICAgICAgICAgY29uc3Qgc3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICAgICAgICAgIHNwYW4uY2xhc3NMaXN0LmFkZCgnRW1vamlQYW5lbF9fcGljdG9ncmFwaFRleHQnKTtcbiAgICAgICAgICAgIHNwYW4uc2V0QXR0cmlidXRlKCd0aXRsZScsIGVtb2ppLm5hbWUpO1xuICAgICAgICAgICAgc3Bhbi5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBlbW9qaS5uYW1lKTtcbiAgICAgICAgICAgIHNwYW4uZGF0YXNldC5waWN0b2dyYXBoVGV4dCA9IGVtb2ppLmNoYXI7XG4gICAgICAgICAgICBzcGFuLmRhdGFzZXQucGljdG9ncmFwaEltYWdlID0gdXJsO1xuICAgICAgICAgICAgc3Bhbi5pbm5lckhUTUwgPSAnJmVtc3A7JztcblxuICAgICAgICAgICAgLy8gSWYgaXQncyBlbXB0eSwgcmVtb3ZlIHRoZSBkZWZhdWx0IGNvbnRlbnQgb2YgdGhlIGlucHV0XG4gICAgICAgICAgICBjb25zdCBkaXYgPSBpbnB1dC5xdWVyeVNlbGVjdG9yKCdkaXYnKTtcbiAgICAgICAgICAgIGlmKGRpdi5pbm5lckhUTUwgPT0gJzxicj4nKSB7XG4gICAgICAgICAgICAgICAgZGl2LmlubmVySFRNTCA9ICcnO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXBsYWNlIGVhY2ggcGljdG9ncmFwaCBzcGFuIHdpdGggaXQncyBuYXRpdmUgY2hhcmFjdGVyXG4gICAgICAgICAgICBjb25zdCBwaWN0cyA9IGRpdi5xdWVyeVNlbGVjdG9yQWxsKCcuRW1vamlQYW5lbF9fcGljdG9ncmFwaFRleHQnKTtcbiAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChwaWN0cywgcGljdCA9PiB7XG4gICAgICAgICAgICAgICAgZGl2LnJlcGxhY2VDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShwaWN0LmRhdGFzZXQucGljdG9ncmFwaFRleHQpLCBwaWN0KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBTcGxpdCBjb250ZW50IGludG8gYXJyYXksIGluc2VydCBlbW9qaSBhdCBvZmZzZXQgaW5kZXhcbiAgICAgICAgICAgIGxldCBjb250ZW50ID0gZW1vamlBd2FyZS5zcGxpdChkaXYudGV4dENvbnRlbnQpO1xuICAgICAgICAgICAgY29udGVudC5zcGxpY2Uob2Zmc2V0LCAwLCBlbW9qaS5jaGFyKTtcbiAgICAgICAgICAgIGNvbnRlbnQgPSBjb250ZW50LmpvaW4oJycpO1xuXG4gICAgICAgICAgICBkaXYudGV4dENvbnRlbnQgPSBjb250ZW50O1xuXG4gICAgICAgICAgICAvLyBUcmlnZ2VyIGEgcmVmcmVzaCBvZiB0aGUgaW5wdXRcbiAgICAgICAgICAgIGNvbnN0IGV2ZW50ID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0hUTUxFdmVudHMnKTtcbiAgICAgICAgICAgIGV2ZW50LmluaXRFdmVudCgnbW91c2Vkb3duJywgZmFsc2UsIHRydWUpO1xuICAgICAgICAgICAgaW5wdXQuZGlzcGF0Y2hFdmVudChldmVudCk7XG5cbiAgICAgICAgICAgIC8vIFVwZGF0ZSB0aGUgb2Zmc2V0IHRvIGFmdGVyIHRoZSBpbnNlcnRlZCBlbW9qaVxuICAgICAgICAgICAgaW5wdXQuZGF0YXNldC5vZmZzZXQgPSBwYXJzZUludChpbnB1dC5kYXRhc2V0Lm9mZnNldCwgMTApICsgMTtcblxuICAgICAgICAgICAgaWYob3B0aW9ucy5mcmVxdWVudCA9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgRnJlcXVlbnQuYWRkKGVtb2ppLCBFbW9qaXMuY3JlYXRlQnV0dG9uKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIil7XG5cbiAgICAgICAgfVxuICAgIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRW1vamlzO1xuIiwiY29uc3QgeyBFdmVudEVtaXR0ZXIgfSA9IHJlcXVpcmUoJ2ZiZW1pdHRlcicpO1xuXG5jb25zdCBDcmVhdGUgPSByZXF1aXJlKCcuL2NyZWF0ZScpO1xuY29uc3QgRW1vamlzID0gcmVxdWlyZSgnLi9lbW9qaXMnKTtcbmNvbnN0IExpc3QgPSByZXF1aXJlKCcuL2xpc3QnKTtcbmNvbnN0IGNsYXNzbmFtZXMgPSByZXF1aXJlKCcuL2NsYXNzbmFtZXMnKTtcblxuY29uc3QgZGVmYXVsdHMgPSB7XG4gICAgc2VhcmNoOiB0cnVlLFxuICAgIGZyZXF1ZW50OiB0cnVlLFxuICAgIGZpdHpwYXRyaWNrOiAnYScsXG4gICAgaGlkZGVuX2NhdGVnb3JpZXM6IFtdLFxuICAgIHBhY2tfdXJsOiBudWxsLFxuICAgIC8vIHBhbmVsX3R5cGU6ICdlbW9qaScsXG4gICAgLy8ganNvbl91cmw6ICcvZW1vamlzLmpzb24nLFxuICAgIHBhbmVsX3R5cGU6ICdpY29uJyxcbiAgICBqc29uX3VybDogJy9pY29uU2V0Lmpzb24nLFxuICAgIHRldGhlcjogdHJ1ZSxcbiAgICBwbGFjZW1lbnQ6ICdib3R0b20nLFxuICAgIGxheW91dF90eXBlOiAndGFiJyxcblxuICAgIGxvY2FsZToge1xuICAgICAgICBhZGQ6ICdBZGQgZW1vamknLFxuICAgICAgICBicmFuZDogJ0Vtb2ppUGFuZWwnLFxuICAgICAgICBmcmVxdWVudDogJ0ZyZXF1ZW50bHkgdXNlZCcsXG4gICAgICAgIGxvYWRpbmc6ICdMb2FkaW5nLi4uJyxcbiAgICAgICAgbm9fcmVzdWx0czogJ05vIHJlc3VsdHMnLFxuICAgICAgICBzZWFyY2g6ICdTZWFyY2gnLFxuICAgICAgICBzZWFyY2hfcmVzdWx0czogJ1NlYXJjaCByZXN1bHRzJ1xuICAgIH0sXG4gICAgaWNvbnM6IHtcbiAgICAgICAgc2VhcmNoOiAnPHNwYW4gY2xhc3M9XCJmYSBmYS1zZWFyY2hcIj48L3NwYW4+J1xuICAgIH0sXG4gICAgY2xhc3NuYW1lc1xufTtcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRW1vamlQYW5lbCBleHRlbmRzIEV2ZW50RW1pdHRlciB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgICBzdXBlcigpO1xuXG4gICAgICAgIHRoaXMub3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRzLCBvcHRpb25zKTtcblxuICAgICAgICBjb25zdCBlbHMgPSBbJ2NvbnRhaW5lcicsICd0cmlnZ2VyJywgJ2VkaXRhYmxlJ107XG4gICAgICAgIGVscy5mb3JFYWNoKGVsID0+IHtcbiAgICAgICAgICAgIGlmKHR5cGVvZiB0aGlzLm9wdGlvbnNbZWxdID09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5vcHRpb25zW2VsXSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGhpcy5vcHRpb25zW2VsXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IGNyZWF0ZSA9IENyZWF0ZSh0aGlzLm9wdGlvbnMsIHRoaXMuZW1pdC5iaW5kKHRoaXMpLCB0aGlzLnRvZ2dsZS5iaW5kKHRoaXMpKTtcbiAgICAgICAgdGhpcy5wYW5lbCA9IGNyZWF0ZS5wYW5lbDtcbiAgICAgICAgdGhpcy50ZXRoZXIgPSBjcmVhdGUudGV0aGVyO1xuXG4gICAgICAgIEVtb2ppcy5sb2FkKHRoaXMub3B0aW9ucylcbiAgICAgICAgICAgIC50aGVuKHJlcyA9PiB7XG4gICAgICAgICAgICAgICAgTGlzdCh0aGlzLm9wdGlvbnMsIHRoaXMucGFuZWwsIHJlc1sxXSwgdGhpcy5lbWl0LmJpbmQodGhpcykpO1xuICAgICAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgdG9nZ2xlKCkge1xuICAgICAgICBjb25zdCBvcGVuID0gdGhpcy5wYW5lbC5jbGFzc0xpc3QudG9nZ2xlKHRoaXMub3B0aW9ucy5jbGFzc25hbWVzLm9wZW4pO1xuICAgICAgICBjb25zdCBzZWFyY2hJbnB1dCA9IHRoaXMucGFuZWwucXVlcnlTZWxlY3RvcignLicgKyB0aGlzLm9wdGlvbnMuY2xhc3NuYW1lcy5zZWFyY2hJbnB1dCk7XG5cbiAgICAgICAgdGhpcy5lbWl0KCd0b2dnbGUnLCBvcGVuKTtcbiAgICAgICAgaWYob3BlbiAmJiB0aGlzLm9wdGlvbnMuc2VhcmNoICYmIHNlYXJjaElucHV0KSB7XG4gICAgICAgICAgICBzZWFyY2hJbnB1dC5mb2N1cygpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVwb3NpdGlvbigpIHtcbiAgICAgICAgaWYodGhpcy50ZXRoZXIpIHtcbiAgICAgICAgICAgIHRoaXMudGV0aGVyLnBvc2l0aW9uKCk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmlmKHR5cGVvZiB3aW5kb3cgIT0gJ3VuZGVmaW5lZCcpIHtcbiAgICB3aW5kb3cuRW1vamlQYW5lbCA9IEVtb2ppUGFuZWw7XG59XG4iLCJjb25zdCBFbW9qaXMgPSByZXF1aXJlKCcuL2Vtb2ppcycpO1xuY29uc3QgbW9kaWZpZXJzID0gcmVxdWlyZSgnLi9tb2RpZmllcnMnKTtcblxuY29uc3QgbGlzdCA9IChvcHRpb25zLCBwYW5lbCwganNvbiwgZW1pdCkgPT4ge1xuICAgIGNvbnN0IGNhdGVnb3JpZXMgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5jYXRlZ29yaWVzKTtcbiAgICBjb25zdCBzZWFyY2hJbnB1dCA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLnNlYXJjaElucHV0KTtcbiAgICBjb25zdCBzZWFyY2hUaXRsZSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLnNlYXJjaFRpdGxlKTtcbiAgICBjb25zdCBmcmVxdWVudFRpdGxlID0gcGFuZWwucXVlcnlTZWxlY3RvcignLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuZnJlcXVlbnRUaXRsZSk7XG4gICAgY29uc3QgcmVzdWx0cyA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLnJlc3VsdHMpO1xuICAgIGNvbnN0IGVtcHR5U3RhdGUgPSBwYW5lbC5xdWVyeVNlbGVjdG9yKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5ub1Jlc3VsdHMpO1xuICAgIGNvbnN0IGZvb3RlciA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmZvb3Rlcik7XG5cbiAgICAvLyBVcGRhdGUgdGhlIGNhdGVnb3J5IGxpbmtzXG4gICAgd2hpbGUgKGNhdGVnb3JpZXMuZmlyc3RDaGlsZCkge1xuICAgICAgICBjYXRlZ29yaWVzLnJlbW92ZUNoaWxkKGNhdGVnb3JpZXMuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIE9iamVjdC5rZXlzKGpzb24pLmZvckVhY2goaSA9PiB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5ID0ganNvbltpXTtcblxuICAgICAgICAvLyBEb24ndCBzaG93IHRoZSBsaW5rIHRvIGEgaGlkZGVuIGNhdGVnb3J5XG4gICAgICAgIGlmKG9wdGlvbnMuaGlkZGVuX2NhdGVnb3JpZXMuaW5kZXhPZihjYXRlZ29yeS5uYW1lKSA+IC0xKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYXRlZ29yeUxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcblxuICAgICAgICBjYXRlZ29yeUxpbmsuc2V0QXR0cmlidXRlKCd0aXRsZScsIGNhdGVnb3J5Lm5hbWUpO1xuICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKVxuICAgICAgICB7XG4gICAgICAgICAgICBjYXRlZ29yeUxpbmsuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuZW1vamkpO1xuICAgICAgICAgICAgY2F0ZWdvcnlMaW5rLmlubmVySFRNTCA9IEVtb2ppcy5jcmVhdGVFbChjYXRlZ29yeS5pY29uLCBvcHRpb25zKTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIilcbiAgICAgICAge1xuICAgICAgICAgICAgY2F0ZWdvcnlMaW5rLmNsYXNzTGlzdC5hZGQoXCJoZWFkZXJfaWNvbnNcIik7XG4gICAgICAgICAgICBjYXRlZ29yeUxpbmsuaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKGNhdGVnb3J5Lmljb25fcGFjaywgb3B0aW9ucywgY2F0ZWdvcnkuYmFzZV91cmwsIGNhdGVnb3J5Lm1lZGlhX3R5cGUgLCBjYXRlZ29yeS5iYXNlX2NsYXNzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNhdGVnb3J5TGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGUgPT4ge1xuICAgICAgICAgICAgbGV0IHN0cmlwcGVkU3BhY2UgPSAgY2F0ZWdvcnkubmFtZS5yZXBsYWNlKC9cXHMvZyxcIl9cIik7XG4gICAgICAgICAgICBjb25zdCB0aXRsZSA9IG9wdGlvbnMuY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJyMnICsgc3RyaXBwZWRTcGFjZSk7XG4gICAgICAgICAgICBpZihvcHRpb25zLmxheW91dF90eXBlID09IFwidGFiXCIpIHtcbiAgICAgICAgICAgICAgICBjaGFuZ2VUYWIoc3RyaXBwZWRTcGFjZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHNjcm9sbFRvKHJlc3VsdHMgLCB0aXRsZS5vZmZzZXRUb3AgLSByZXN1bHRzLm9mZnNldFRvcCAsIDUwMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfSk7XG4gICAgICAgIGNhdGVnb3JpZXMuYXBwZW5kQ2hpbGQoY2F0ZWdvcnlMaW5rKTtcbiAgICB9KTtcblxuICAgIGZ1bmN0aW9uIGNoYW5nZVRhYih0YWJQb3N0Zml4KVxuICAgIHtcbiAgICAgICAgbGV0IHRhYkFjdGl2ZSA9IHBhbmVsLnF1ZXJ5U2VsZWN0b3IoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLnRhYkFjdGl2ZSk7XG4gICAgICAgIHRhYkFjdGl2ZS5jbGFzc0xpc3QucmVtb3ZlKG9wdGlvbnMuY2xhc3NuYW1lcy50YWJBY3RpdmUpO1xuICAgICAgICBsZXQgdGFyZ2V0VGFiID0gcGFuZWwucXVlcnlTZWxlY3RvcignLnRhYl9fJyArIHRhYlBvc3RmaXgpO1xuICAgICAgICBjb25zb2xlLmxvZygnLnRhYl9fJyArIHRhYlBvc3RmaXgpXG4gICAgICAgIHRhcmdldFRhYi5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy50YWJBY3RpdmUpO1xuICAgIH1cbiAgICAvLyBjcmVkaXRzIGZvciB0aGlzIHBpZWNlIG9mIGNvZGUoc2Nyb2xsVG8gcHVyZSBqcykgdG8gYWRuSm9zaCBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9hbmRqb3NoXG4gICAgZnVuY3Rpb24gc2Nyb2xsVG8oZWxlbWVudCwgdG8sIGR1cmF0aW9uKSB7XG4gICAgICAgIHZhciBzdGFydCA9IGVsZW1lbnQuc2Nyb2xsVG9wLFxuICAgICAgICAgICAgY2hhbmdlID0gdG8gLSBzdGFydCxcbiAgICAgICAgICAgIGN1cnJlbnRUaW1lID0gMCxcbiAgICAgICAgICAgIGluY3JlbWVudCA9IDIwO1xuXG4gICAgICAgIHZhciBhbmltYXRlU2Nyb2xsID0gZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGN1cnJlbnRUaW1lICs9IGluY3JlbWVudDtcbiAgICAgICAgICAgIHZhciB2YWwgPSBNYXRoLmVhc2VJbk91dFF1YWQoY3VycmVudFRpbWUsIHN0YXJ0LCBjaGFuZ2UsIGR1cmF0aW9uKTtcbiAgICAgICAgICAgIGVsZW1lbnQuc2Nyb2xsVG9wID0gdmFsO1xuICAgICAgICAgICAgaWYoY3VycmVudFRpbWUgPCBkdXJhdGlvbikge1xuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoYW5pbWF0ZVNjcm9sbCwgaW5jcmVtZW50KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgYW5pbWF0ZVNjcm9sbCgpO1xuICAgIH1cblxuICAgIC8vdCA9IGN1cnJlbnQgdGltZVxuICAgIC8vYiA9IHN0YXJ0IHZhbHVlXG4gICAgLy9jID0gY2hhbmdlIGluIHZhbHVlXG4gICAgLy9kID0gZHVyYXRpb25cbiAgICBNYXRoLmVhc2VJbk91dFF1YWQgPSBmdW5jdGlvbiAodCwgYiwgYywgZCkge1xuICAgICAgdCAvPSBkLzI7XG4gICAgICAgIGlmICh0IDwgMSkgcmV0dXJuIGMvMip0KnQgKyBiO1xuICAgICAgICB0LS07XG4gICAgICAgIHJldHVybiAtYy8yICogKHQqKHQtMikgLSAxKSArIGI7XG4gICAgfTtcblxuICAgIC8vIEhhbmRsZSB0aGUgc2VhcmNoIGlucHV0XG4gICAgaWYob3B0aW9ucy5zZWFyY2ggPT0gdHJ1ZSkge1xuXG4gICAgICAgIHNlYXJjaElucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZSA9PiB7XG4gICAgICAgICAgICBsZXQgZW1vamlzICwgIGljb25zIDtcbiAgICAgICAgICAgIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImVtb2ppXCIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgZW1vamlzID0gcmVzdWx0cy5xdWVyeVNlbGVjdG9yQWxsKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5lbW9qaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBpY29ucyA9IHJlc3VsdHMucXVlcnlTZWxlY3RvckFsbCgnLicgKyBvcHRpb25zLmNsYXNzbmFtZXMuaWNvbnMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB0aXRsZXMgPSByZXN1bHRzLnF1ZXJ5U2VsZWN0b3JBbGwoJy4nICsgb3B0aW9ucy5jbGFzc25hbWVzLmNhdGVnb3J5KTtcblxuICAgICAgICAgICAgbGV0IGZyZXF1ZW50TGlzdCA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKCdFbW9qaVBhbmVsLWZyZXF1ZW50Jyk7XG4gICAgICAgICAgICBpZihmcmVxdWVudExpc3QpIHtcbiAgICAgICAgICAgICAgICBmcmVxdWVudExpc3QgPSBKU09OLnBhcnNlKGZyZXF1ZW50TGlzdCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyZXF1ZW50TGlzdCA9IFtdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB2YWx1ZSA9IGUudGFyZ2V0LnZhbHVlLnJlcGxhY2UoLy0vZywgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICBpZih2YWx1ZS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hlZCA9IFtdO1xuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKGpzb24pLmZvckVhY2goaSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5ID0ganNvbltpXTtcbiAgICAgICAgICAgICAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIilcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnkuZW1vamlzLmZvckVhY2goZW1vamkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleXdvcmRNYXRjaCA9IGVtb2ppLmtleXdvcmRzLmZpbmQoa2V5d29yZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleXdvcmQgPSBrZXl3b3JkLnJlcGxhY2UoLy0vZywgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXl3b3JkLmluZGV4T2YodmFsdWUpID4gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoa2V5d29yZE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWQucHVzaChlbW9qaS51bmljb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIilcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2F0ZWdvcnkuaWNvbnMuZm9yRWFjaChpY29uID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXl3b3JkTWF0Y2ggPSBpY29uLmtleXdvcmRzLmZpbmQoa2V5d29yZCA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleXdvcmQgPSBrZXl3b3JkLnJlcGxhY2UoLy0vZywgJycpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBrZXl3b3JkLmluZGV4T2YodmFsdWUpID4gLTE7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYoa2V5d29yZE1hdGNoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1hdGNoZWQucHVzaChpY29uLm5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgaWYobWF0Y2hlZC5sZW5ndGggPT0gMCkge1xuICAgICAgICAgICAgICAgICAgICBlbXB0eVN0YXRlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVtcHR5U3RhdGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBlbWl0KCdzZWFyY2gnLCB7IHZhbHVlLCBtYXRjaGVkIH0pO1xuXG4gICAgICAgICAgICAgICAgaWYob3B0aW9ucy5wYW5lbF90eXBlID09IFwiZW1vamlcIil7XG4gICAgICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbChlbW9qaXMsIGVtb2ppID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmKG1hdGNoZWQuaW5kZXhPZihlbW9qaS5kYXRhc2V0LnVuaWNvZGUpID09IC0xKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1vamkuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZW1vamkuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpe1xuICAgICAgICAgICAgICAgICAgICBbXS5mb3JFYWNoLmNhbGwoaWNvbnMsIGljb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYobWF0Y2hlZC5pbmRleE9mKGljb24uZGF0YXNldC5uYW1lKSA9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGljb24uc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWNvbi5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIFtdLmZvckVhY2guY2FsbCh0aXRsZXMsIHRpdGxlID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGl0bGUuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBzZWFyY2hUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ2Jsb2NrJztcblxuICAgICAgICAgICAgICAgIGlmKG9wdGlvbnMuZnJlcXVlbnQgPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgICAgICBmcmVxdWVudFRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBsZXQgZW1vamlzID0gcmVzdWx0cy5xdWVyeVNlbGVjdG9yQWxsKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5lbW9qaSk7XG4gICAgICAgICAgICAgICAgbGV0IGljb25zID0gcmVzdWx0cy5xdWVyeVNlbGVjdG9yQWxsKCcuJyArIG9wdGlvbnMuY2xhc3NuYW1lcy5pY29ucyk7XG5cbiAgICAgICAgICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKXtcbiAgICAgICAgICAgICAgICAgICAgW10uZm9yRWFjaC5jYWxsKGVtb2ppcywgZW1vamkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZW1vamkuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUtYmxvY2snO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZWxzZSBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJpY29uXCIpe1xuICAgICAgICAgICAgICAgICAgICBbXS5mb3JFYWNoLmNhbGwoaWNvbnMsIGljb24gPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWNvbi5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZS1ibG9jayc7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBbXS5mb3JFYWNoLmNhbGwodGl0bGVzLCB0aXRsZSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIHNlYXJjaFRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgICAgICAgICAgICAgZW1wdHlTdGF0ZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gICAgICAgICAgICAgICAgaWYob3B0aW9ucy5mcmVxdWVudCA9PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmKGZyZXF1ZW50TGlzdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBmcmVxdWVudFRpdGxlLnN0eWxlLmRpc3BsYXkgPSAnYmxvY2snO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgZnJlcXVlbnRUaXRsZS5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBGaWxsIHRoZSByZXN1bHRzIHdpdGggZW1vamlzXG4gICAgd2hpbGUgKHJlc3VsdHMuZmlyc3RDaGlsZCkge1xuICAgICAgICByZXN1bHRzLnJlbW92ZUNoaWxkKHJlc3VsdHMuZmlyc3RDaGlsZCk7XG4gICAgfVxuICAgIE9iamVjdC5rZXlzKGpzb24pLmZvckVhY2goaSA9PiB7XG4gICAgICAgIGNvbnN0IGNhdGVnb3J5ID0ganNvbltpXTtcblxuICAgICAgICAvLyBEb24ndCBzaG93IGFueSBoaWRkZW4gY2F0ZWdvcmllc1xuICAgICAgICBpZihvcHRpb25zLmhpZGRlbl9jYXRlZ29yaWVzLmluZGV4T2YoY2F0ZWdvcnkubmFtZSkgPiAtMSB8fCBjYXRlZ29yeS5uYW1lID09ICdtb2RpZmllcicpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENyZWF0ZSB0aGUgY2F0ZWdvcnkgdGl0bGVcbiAgICAgICAgY29uc3QgdGFiID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIHRhYi5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy50YWIpO1xuICAgICAgICBsZXQgY2F0ZWdvcnlDbGFzcyA9IFwidGFiX19cIiArIGNhdGVnb3J5Lm5hbWUucmVwbGFjZSgvXFxzL2csXCJfXCIpO1xuICAgICAgICB0YWIuY2xhc3NMaXN0LmFkZChjYXRlZ29yeUNsYXNzKTtcblxuICAgICAgICBjb25zdCB0aXRsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3AnKTtcbiAgICAgICAgdGl0bGUuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMuY2F0ZWdvcnkpO1xuICAgICAgICBsZXQgc3RyaXBwZWRTcGFjZSA9ICBjYXRlZ29yeS5uYW1lLnJlcGxhY2UoL1xccy9nLFwiX1wiKTtcbiAgICAgICAgdGl0bGUuaWQgPSBzdHJpcHBlZFNwYWNlO1xuICAgICAgICBsZXQgY2F0ZWdvcnlOYW1lID0gY2F0ZWdvcnkubmFtZS5yZXBsYWNlKC9fL2csICcgJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHdcXFMqL2csIChuYW1lKSA9PiBuYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgbmFtZS5zdWJzdHIoMSkudG9Mb3dlckNhc2UoKSlcbiAgICAgICAgICAgIC5yZXBsYWNlKCdBbmQnLCAnJmFtcDsnKTtcbiAgICAgICAgdGl0bGUuaW5uZXJIVE1MID0gY2F0ZWdvcnlOYW1lO1xuICAgICAgICB0YWIuYXBwZW5kQ2hpbGQodGl0bGUpO1xuICAgICAgICByZXN1bHRzLmFwcGVuZENoaWxkKHRhYik7XG5cbiAgICAgICAgaWYob3B0aW9ucy5sYXlvdXRfdHlwZSA9PSBcInRhYlwiKSB7XG4gICAgICAgICAgICBpZihpID09IDApXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdGFiLmNsYXNzTGlzdC5hZGQob3B0aW9ucy5jbGFzc25hbWVzLnRhYkFjdGl2ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICB0YWIuY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMudGFiQWN0aXZlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENyZWF0ZSB0aGUgZW1vamkgYnV0dG9uc1xuICAgICAgICBpZihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKXtcbiAgICAgICAgICAgIGNhdGVnb3J5LmVtb2ppcy5mb3JFYWNoKGZ1bmN0aW9uKGVtb2ppKXtcbiAgICAgICAgICAgICAgICB0YWIuYXBwZW5kQ2hpbGQoRW1vamlzLmNyZWF0ZUJ1dHRvbihlbW9qaSwgb3B0aW9ucywgZW1pdCkpO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmKG9wdGlvbnMucGFuZWxfdHlwZSA9PSBcImljb25cIil7XG4gICAgICAgICAgICBjYXRlZ29yeS5pY29ucy5mb3JFYWNoKGZ1bmN0aW9uKGljb24pe1xuICAgICAgICAgICAgICAgIHRhYi5hcHBlbmRDaGlsZChFbW9qaXMuY3JlYXRlQnV0dG9uKGljb24sIG9wdGlvbnMsIGVtaXQsIGNhdGVnb3J5LmJhc2VfdXJsLCBjYXRlZ29yeS5tZWRpYV90eXBlLCBjYXRlZ29yeS5iYXNlX2NsYXNzKSk7XG4gICAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICBpZigob3B0aW9ucy5maXR6cGF0cmljaykmJihvcHRpb25zLnBhbmVsX3R5cGUgPT0gXCJlbW9qaVwiKSl7XG4gICAgICAgIC8vIENyZWF0ZSB0aGUgZml0enBhdHJpY2sgbW9kaWZpZXIgYnV0dG9uXG4gICAgICAgIGNvbnN0IGhhbmQgPSB7IC8vIOKci1xuICAgICAgICAgICAgdW5pY29kZTogJzI3MGInICsgbW9kaWZpZXJzW29wdGlvbnMuZml0enBhdHJpY2tdLnVuaWNvZGUsXG4gICAgICAgICAgICBjaGFyOiAn4pyLJ1xuICAgICAgICB9O1xuICAgICAgICBsZXQgbW9kaWZpZXJEcm9wZG93bjtcbiAgICAgICAgY29uc3QgbW9kaWZpZXJUb2dnbGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcbiAgICAgICAgbW9kaWZpZXJUb2dnbGUuc2V0QXR0cmlidXRlKCd0eXBlJywgJ2J1dHRvbicpO1xuICAgICAgICBtb2RpZmllclRvZ2dsZS5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5idG5Nb2RpZmllciwgb3B0aW9ucy5jbGFzc25hbWVzLmJ0bk1vZGlmaWVyVG9nZ2xlLCBvcHRpb25zLmNsYXNzbmFtZXMuZW1vamkpO1xuICAgICAgICBtb2RpZmllclRvZ2dsZS5pbm5lckhUTUwgPSBFbW9qaXMuY3JlYXRlRWwoaGFuZCwgb3B0aW9ucyk7XG4gICAgICAgIG1vZGlmaWVyVG9nZ2xlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgbW9kaWZpZXJEcm9wZG93bi5jbGFzc0xpc3QudG9nZ2xlKCdhY3RpdmUnKTtcbiAgICAgICAgICAgIG1vZGlmaWVyVG9nZ2xlLmNsYXNzTGlzdC50b2dnbGUoJ2FjdGl2ZScpO1xuICAgICAgICB9KTtcbiAgICAgICAgZm9vdGVyLmFwcGVuZENoaWxkKG1vZGlmaWVyVG9nZ2xlKTtcblxuICAgICAgICBtb2RpZmllckRyb3Bkb3duID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgIG1vZGlmaWVyRHJvcGRvd24uY2xhc3NMaXN0LmFkZChvcHRpb25zLmNsYXNzbmFtZXMubW9kaWZpZXJEcm9wZG93bik7XG4gICAgICAgIE9iamVjdC5rZXlzKG1vZGlmaWVycykuZm9yRWFjaChtID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1vZGlmaWVyID0gT2JqZWN0LmFzc2lnbih7fSwgbW9kaWZpZXJzW21dKTtcbiAgICAgICAgICAgIG1vZGlmaWVyLnVuaWNvZGUgPSAnMjcwYicgKyBtb2RpZmllci51bmljb2RlO1xuICAgICAgICAgICAgbW9kaWZpZXIuY2hhciA9ICfinIsnICsgbW9kaWZpZXIuY2hhcjtcbiAgICAgICAgICAgIGNvbnN0IG1vZGlmaWVyQnRuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gICAgICAgICAgICBtb2RpZmllckJ0bi5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAnYnV0dG9uJyk7XG4gICAgICAgICAgICBtb2RpZmllckJ0bi5jbGFzc0xpc3QuYWRkKG9wdGlvbnMuY2xhc3NuYW1lcy5idG5Nb2RpZmllciwgb3B0aW9ucy5jbGFzc25hbWVzLmVtb2ppKTtcbiAgICAgICAgICAgIG1vZGlmaWVyQnRuLmRhdGFzZXQubW9kaWZpZXIgPSBtO1xuICAgICAgICAgICAgbW9kaWZpZXJCdG4uaW5uZXJIVE1MID0gRW1vamlzLmNyZWF0ZUVsKG1vZGlmaWVyLCBvcHRpb25zKTtcblxuICAgICAgICAgICAgbW9kaWZpZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBlID0+IHtcbiAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcblxuICAgICAgICAgICAgICAgIG1vZGlmaWVyVG9nZ2xlLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVyVG9nZ2xlLmlubmVySFRNTCA9IEVtb2ppcy5jcmVhdGVFbChtb2RpZmllciwgb3B0aW9ucyk7XG5cbiAgICAgICAgICAgICAgICBvcHRpb25zLmZpdHpwYXRyaWNrID0gbW9kaWZpZXJCdG4uZGF0YXNldC5tb2RpZmllcjtcbiAgICAgICAgICAgICAgICBtb2RpZmllckRyb3Bkb3duLmNsYXNzTGlzdC5yZW1vdmUoJ2FjdGl2ZScpO1xuXG4gICAgICAgICAgICAgICAgLy8gUmVmcmVzaCBldmVyeSBlbW9qaSBpbiBhbnkgbGlzdCB3aXRoIG5ldyBza2luIHRvbmVcbiAgICAgICAgICAgICAgICBjb25zdCBlbW9qaXMgPSBbXS5mb3JFYWNoLmNhbGwob3B0aW9ucy5jb250YWluZXIucXVlcnlTZWxlY3RvckFsbChgLiR7b3B0aW9ucy5jbGFzc25hbWVzLnJlc3VsdHN9ICAuJHtvcHRpb25zLmNsYXNzbmFtZXMuZW1vaml9YCksIGVtb2ppID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaWYoZW1vamkuZGF0YXNldC5maXR6cGF0cmljaykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZW1vamlPYmogPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdW5pY29kZTogZW1vamkuZGF0YXNldC51bmljb2RlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoYXI6IGVtb2ppLmRhdGFzZXQuY2hhcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaXR6cGF0cmljazogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeTogZW1vamkuZGF0YXNldC5jYXRlZ29yeSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiBlbW9qaS5kYXRhc2V0Lm5hbWVcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIGVtb2ppLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKEVtb2ppcy5jcmVhdGVCdXR0b24oZW1vamlPYmosIG9wdGlvbnMsIGVtaXQpLCBlbW9qaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBtb2RpZmllckRyb3Bkb3duLmFwcGVuZENoaWxkKG1vZGlmaWVyQnRuKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGZvb3Rlci5hcHBlbmRDaGlsZChtb2RpZmllckRyb3Bkb3duKTtcbiAgICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGxpc3Q7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgICBhOiB7XG4gICAgICAgIHVuaWNvZGU6ICcnLFxuICAgICAgICBjaGFyOiAnJ1xuICAgIH0sXG4gICAgYjoge1xuICAgICAgICB1bmljb2RlOiAnLTFmM2ZiJyxcbiAgICAgICAgY2hhcjogJ/Cfj7snXG4gICAgfSxcbiAgICBjOiB7XG4gICAgICAgIHVuaWNvZGU6ICctMWYzZmMnLFxuICAgICAgICBjaGFyOiAn8J+PvCdcbiAgICB9LFxuICAgIGQ6IHtcbiAgICAgICAgdW5pY29kZTogJy0xZjNmZCcsXG4gICAgICAgIGNoYXI6ICfwn4+9J1xuICAgIH0sXG4gICAgZToge1xuICAgICAgICB1bmljb2RlOiAnLTFmM2ZlJyxcbiAgICAgICAgY2hhcjogJ/Cfj74nXG4gICAgfSxcbiAgICBmOiB7XG4gICAgICAgIHVuaWNvZGU6ICctMWYzZmYnLFxuICAgICAgICBjaGFyOiAn8J+PvydcbiAgICB9XG59O1xuIl19
