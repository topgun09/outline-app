/**
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/

'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.wrap = undefined;
exports.toCssText = toCssText;
exports.rulesForStyle = rulesForStyle;
exports.isKeyframesSelector = isKeyframesSelector;
exports.forEachRule = forEachRule;
exports.applyCss = applyCss;
exports.createScopeStyle = createScopeStyle;
exports.applyStylePlaceHolder = applyStylePlaceHolder;
exports.applyStyle = applyStyle;
exports.isTargetedBuild = isTargetedBuild;
exports.findMatchingParen = findMatchingParen;
exports.processVariableAndFallback = processVariableAndFallback;
exports.setElementClassRaw = setElementClassRaw;
exports.getIsExtends = getIsExtends;
exports.gatherStyleText = gatherStyleText;
exports.splitSelectorList = splitSelectorList;
exports.getCssBuild = getCssBuild;
exports.elementHasBuiltCss = elementHasBuiltCss;
exports.getBuildComment = getBuildComment;
exports.isOptimalCssBuild = isOptimalCssBuild;

var _styleSettings = require('./style-settings.js');

var _cssParse = require('./css-parse.js');

var _commonRegex = require('./common-regex.js');

var _unscopedStyleHandler = require('./unscoped-style-handler.js');

/**
 * @param {string|StyleNode} rules
 * @param {function(StyleNode)=} callback
 * @return {string}
 */
// eslint-disable-line no-unused-vars
function toCssText(rules, callback) {
  if (!rules) {
    return '';
  }
  if (typeof rules === 'string') {
    rules = (0, _cssParse.parse)(rules);
  }
  if (callback) {
    forEachRule(rules, callback);
  }
  return (0, _cssParse.stringify)(rules, _styleSettings.nativeCssVariables);
}

/**
 * @param {HTMLStyleElement} style
 * @return {StyleNode}
 */
function rulesForStyle(style) {
  if (!style['__cssRules'] && style.textContent) {
    style['__cssRules'] = (0, _cssParse.parse)(style.textContent);
  }
  return style['__cssRules'] || null;
}

// Tests if a rule is a keyframes selector, which looks almost exactly
// like a normal selector but is not (it has nothing to do with scoping
// for example).
/**
 * @param {StyleNode} rule
 * @return {boolean}
 */
function isKeyframesSelector(rule) {
  return Boolean(rule['parent']) && rule['parent']['type'] === _cssParse.types.KEYFRAMES_RULE;
}

/**
 * @param {StyleNode} node
 * @param {Function=} styleRuleCallback
 * @param {Function=} keyframesRuleCallback
 * @param {boolean=} onlyActiveRules
 */
function forEachRule(node, styleRuleCallback, keyframesRuleCallback, onlyActiveRules) {
  if (!node) {
    return;
  }
  var skipRules = false;
  var type = node['type'];
  if (onlyActiveRules) {
    if (type === _cssParse.types.MEDIA_RULE) {
      var matchMedia = node['selector'].match(_commonRegex.MEDIA_MATCH);
      if (matchMedia) {
        // if rule is a non matching @media rule, skip subrules
        if (!window.matchMedia(matchMedia[1]).matches) {
          skipRules = true;
        }
      }
    }
  }
  if (type === _cssParse.types.STYLE_RULE) {
    styleRuleCallback(node);
  } else if (keyframesRuleCallback && type === _cssParse.types.KEYFRAMES_RULE) {
    keyframesRuleCallback(node);
  } else if (type === _cssParse.types.MIXIN_RULE) {
    skipRules = true;
  }
  var r$ = node['rules'];
  if (r$ && !skipRules) {
    for (var i = 0, l = r$.length, r; i < l && (r = r$[i]); i++) {
      forEachRule(r, styleRuleCallback, keyframesRuleCallback, onlyActiveRules);
    }
  }
}

// add a string of cssText to the document.
/**
 * @param {string} cssText
 * @param {string} moniker
 * @param {Node} target
 * @param {Node} contextNode
 * @return {HTMLStyleElement}
 */
function applyCss(cssText, moniker, target, contextNode) {
  var style = createScopeStyle(cssText, moniker);
  applyStyle(style, target, contextNode);
  return style;
}

/**
 * @param {string} cssText
 * @param {string} moniker
 * @return {HTMLStyleElement}
 */
function createScopeStyle(cssText, moniker) {
  var style = /** @type {HTMLStyleElement} */document.createElement('style');
  if (moniker) {
    style.setAttribute('scope', moniker);
  }
  style.textContent = cssText;
  return style;
}

/**
 * Track the position of the last added style for placing placeholders
 * @type {Node}
 */
var lastHeadApplyNode = null;

// insert a comment node as a styling position placeholder.
/**
 * @param {string} moniker
 * @return {!Comment}
 */
function applyStylePlaceHolder(moniker) {
  var placeHolder = document.createComment(' Shady DOM styles for ' + moniker + ' ');
  var after = lastHeadApplyNode ? lastHeadApplyNode['nextSibling'] : null;
  var scope = document.head;
  scope.insertBefore(placeHolder, after || scope.firstChild);
  lastHeadApplyNode = placeHolder;
  return placeHolder;
}

/**
 * @param {HTMLStyleElement} style
 * @param {?Node} target
 * @param {?Node} contextNode
 */
function applyStyle(style, target, contextNode) {
  target = target || document.head;
  var after = contextNode && contextNode.nextSibling || target.firstChild;
  target.insertBefore(style, after);
  if (!lastHeadApplyNode) {
    lastHeadApplyNode = style;
  } else {
    // only update lastHeadApplyNode if the new style is inserted after the old lastHeadApplyNode
    var position = style.compareDocumentPosition(lastHeadApplyNode);
    if (position === Node.DOCUMENT_POSITION_PRECEDING) {
      lastHeadApplyNode = style;
    }
  }
}

/**
 * @param {string} buildType
 * @return {boolean}
 */
function isTargetedBuild(buildType) {
  return _styleSettings.nativeShadow ? buildType === 'shadow' : buildType === 'shady';
}

/**
 * Walk from text[start] matching parens and
 * returns position of the outer end paren
 * @param {string} text
 * @param {number} start
 * @return {number}
 */
function findMatchingParen(text, start) {
  var level = 0;
  for (var i = start, l = text.length; i < l; i++) {
    if (text[i] === '(') {
      level++;
    } else if (text[i] === ')') {
      if (--level === 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * @param {string} str
 * @param {function(string, string, string, string)} callback
 */
function processVariableAndFallback(str, callback) {
  // find 'var('
  var start = str.indexOf('var(');
  if (start === -1) {
    // no var?, everything is prefix
    return callback(str, '', '', '');
  }
  //${prefix}var(${inner})${suffix}
  var end = findMatchingParen(str, start + 3);
  var inner = str.substring(start + 4, end);
  var prefix = str.substring(0, start);
  // suffix may have other variables
  var suffix = processVariableAndFallback(str.substring(end + 1), callback);
  var comma = inner.indexOf(',');
  // value and fallback args should be trimmed to match in property lookup
  if (comma === -1) {
    // variable, no fallback
    return callback(prefix, inner.trim(), '', suffix);
  }
  // var(${value},${fallback})
  var value = inner.substring(0, comma).trim();
  var fallback = inner.substring(comma + 1).trim();
  return callback(prefix, value, fallback, suffix);
}

/**
 * @param {Element} element
 * @param {string} value
 */
function setElementClassRaw(element, value) {
  // use native setAttribute provided by ShadyDOM when setAttribute is patched
  if (_styleSettings.nativeShadow) {
    element.setAttribute('class', value);
  } else {
    window['ShadyDOM']['nativeMethods']['setAttribute'].call(element, 'class', value);
  }
}

/**
 * @type {function(*):*}
 */
var wrap = exports.wrap = window['ShadyDOM'] && window['ShadyDOM']['wrap'] || function (node) {
  return node;
};

/**
 * @param {Element | {is: string, extends: string}} element
 * @return {{is: string, typeExtension: string}}
 */
function getIsExtends(element) {
  var localName = element['localName'];
  var is = '',
      typeExtension = '';
  /*
  NOTE: technically, this can be wrong for certain svg elements
  with `-` in the name like `<font-face>`
  */
  if (localName) {
    if (localName.indexOf('-') > -1) {
      is = localName;
    } else {
      typeExtension = localName;
      is = element.getAttribute && element.getAttribute('is') || '';
    }
  } else {
    is = /** @type {?} */element.is;
    typeExtension = /** @type {?} */element.extends;
  }
  return { is: is, typeExtension: typeExtension };
}

/**
 * @param {Element|DocumentFragment} element
 * @return {string}
 */
function gatherStyleText(element) {
  /** @type {!Array<string>} */
  var styleTextParts = [];
  var styles = /** @type {!NodeList<!HTMLStyleElement>} */element.querySelectorAll('style');
  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];
    if ((0, _unscopedStyleHandler.isUnscopedStyle)(style)) {
      if (!_styleSettings.nativeShadow) {
        (0, _unscopedStyleHandler.processUnscopedStyle)(style);
        style.parentNode.removeChild(style);
      }
    } else {
      styleTextParts.push(style.textContent);
      style.parentNode.removeChild(style);
    }
  }
  return styleTextParts.join('').trim();
}

/**
 * Split a selector separated by commas into an array in a smart way
 * @param {string} selector
 * @return {!Array<string>}
 */
function splitSelectorList(selector) {
  var parts = [];
  var part = '';
  for (var i = 0; i >= 0 && i < selector.length; i++) {
    // A selector with parentheses will be one complete part
    if (selector[i] === '(') {
      // find the matching paren
      var end = findMatchingParen(selector, i);
      // push the paren block into the part
      part += selector.slice(i, end + 1);
      // move the index to after the paren block
      i = end;
    } else if (selector[i] === ',') {
      parts.push(part);
      part = '';
    } else {
      part += selector[i];
    }
  }
  // catch any pieces after the last comma
  if (part) {
    parts.push(part);
  }
  return parts;
}

var CSS_BUILD_ATTR = 'css-build';

/**
 * Return the polymer-css-build "build type" applied to this element
 *
 * @param {!HTMLElement} element
 * @return {string} Can be "", "shady", or "shadow"
 */
function getCssBuild(element) {
  if ( /** @type {string} */_styleSettings.cssBuild !== undefined) {
    return _styleSettings.cssBuild;
  }
  if (element.__cssBuild === undefined) {
    // try attribute first, as it is the common case
    var attrValue = element.getAttribute(CSS_BUILD_ATTR);
    if (attrValue) {
      element.__cssBuild = attrValue;
    } else {
      var buildComment = getBuildComment(element);
      if (buildComment !== '') {
        // remove build comment so it is not needlessly copied into every element instance
        removeBuildComment(element);
      }
      element.__cssBuild = buildComment;
    }
  }
  return element.__cssBuild || '';
}

/**
 * Check if the given element, either a <template> or <style>, has been processed
 * by polymer-css-build.
 *
 * If so, then we can make a number of optimizations:
 * - polymer-css-build will decompose mixins into individual CSS Custom Properties,
 * so the ApplyShim can be skipped entirely.
 * - Under native ShadowDOM, the style text can just be copied into each instance
 * without modification
 * - If the build is "shady" and ShadyDOM is in use, the styling does not need
 * scoping beyond the shimming of CSS Custom Properties
 *
 * @param {!HTMLElement} element
 * @return {boolean}
 */
function elementHasBuiltCss(element) {
  return getCssBuild(element) !== '';
}

/**
 * For templates made with tagged template literals, polymer-css-build will
 * insert a comment of the form `<!--css-build:shadow-->`
 *
 * @param {!HTMLElement} element
 * @return {string}
 */
function getBuildComment(element) {
  var buildComment = element.localName === 'template' ?
  /** @type {!HTMLTemplateElement} */element.content.firstChild : element.firstChild;
  if (buildComment instanceof Comment) {
    var commentParts = buildComment.textContent.trim().split(':');
    if (commentParts[0] === CSS_BUILD_ATTR) {
      return commentParts[1];
    }
  }
  return '';
}

/**
 * Check if the css build status is optimal, and do no unneeded work.
 *
 * @param {string=} cssBuild CSS build status
 * @return {boolean} css build is optimal or not
 */
function isOptimalCssBuild() {
  var cssBuild = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

  // CSS custom property shim always requires work
  if (cssBuild === '' || !_styleSettings.nativeCssVariables) {
    return false;
  }
  return _styleSettings.nativeShadow ? cssBuild === 'shadow' : cssBuild === 'shady';
}

/**
 * @param {!HTMLElement} element
 */
function removeBuildComment(element) {
  var buildComment = element.localName === 'template' ?
  /** @type {!HTMLTemplateElement} */element.content.firstChild : element.firstChild;
  buildComment.parentNode.removeChild(buildComment);
}