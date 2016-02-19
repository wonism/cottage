'use strict';

var Node = require('./node');
var util = require('util');

function Tree(options) {
    options = options || {};

    this.rootPath = options.rootPath || '/';
    this.rootNode = new Node(this.rootPath);
    this.rootPathLength = this.rootNode.path.length;
    this.strictMode = options.strictMode || false;
    this.caseSensitive = options.caseSensitive || false;
}

/**
 * Add a new route to the tree.
 */
Tree.prototype.add = function(path, handler) {
    if (path === this.rootPath) {
        this.rootNode.handler = handler;
        return;
    }

    var parentNode = this.rootNode;
    var pathLen = path.length, base = this.rootPathLength; // skip rootPath

    while (base < pathLen) {
        let node = parentNode.letterTable[path.charCodeAt(base) - 32]
                || parentNode.paramChildNode;
        if (!node) return parentNode.addChild(new Node(path.substring(base), handler));

        let nodePathLen = node.path.length,
            currPathLen = pathLen - base,
            paramLen = 0, i, pi;

        for (pi = 1, i = base+1; pi < node.path.length && i < pathLen; pi++) {
            // branch
            if (path[i] != node.path[pi]) {
                //if (path[i] === ':') {
                //    if (node.isParamNode) {
                //        while (i != pathLen && path[i] !== '/') {
                //            i++;
                //            paramLen++;
                //        }
                //    }
                //    else throw Error(`path '${path}' collapses with other path.`);
                //}
                return node.branch(base, i, pi, parentNode, path, handler);
            }
            // throw Error(`path '${path}' collapses with other path.`);
            else i++;
        }
        if (node.isParamNode) {
            while (i != pathLen && path[i] !== '/') {
                i++;
                paramLen++;
            }
        }

        // reached at the end
        if (i == pathLen) {
            // more characters are left - branch it
            if (currPathLen - paramLen < nodePathLen) {
                return node.branchUpper(base, pi, parentNode, path, handler);
            }

            else if (currPathLen - paramLen == nodePathLen) {
                if (node.handler) {
                    // TODO: handle duplicated node
                    throw new Error("duplicated path : " + path);
                }
                else {
                    node.handler = handler;
                    return node;
                }
            }
        }

        // seems okay now
        parentNode = node;
        base += nodePathLen + paramLen;
        // if (parentNode.paramName) base += 1;
    }

    // cannot possible
    throw new Error("something had been wrong");
}

/**
 * Locate the handler matches with given path in the tree.
 * @param path that starts with '/'
 * @param params {Object}
 */
Tree.prototype.locate = function(path, params) {
    // case insensitive mode
    const originalPath = path;
    if (!this.caseSensitive) path = path.toLowerCase();

    if (path === this.rootPath) return this.rootNode.handler;

    let depth = 0, pathLen = path.length;
    let paramLenSum = 0, nodeLenSum = 0;
    let node = this.rootNode;

    // skip last slash when strict mode
    if (!this.strictMode && path[pathLen-1] === '/') pathLen--;

    while (depth < pathLen) {
        // let's check prefix matches
        if (path.indexOf(node.path, depth) !== depth) return null;
        depth += node.pathLength;

        if (node.isParamNode) {
            let endIndex = path.indexOf('/', depth);
            if (endIndex < 0) endIndex = pathLen;
            params[node.paramName] = originalPath.slice(depth, endIndex);

            paramLenSum += (endIndex - depth);
            depth += (endIndex - depth);
        }
        nodeLenSum += node.pathLength;

        // has reached at the end of given path?
        if (depth === pathLen) {
            if (node.handler && depth - paramLenSum === nodeLenSum) return node.handler;
            else return null;
        }

        // go deeper
        node = node.letterTable[path.charCodeAt(depth) - 32] || node.paramChildNode;
        if (!node) return null;
    }
    return null;
};

/**
 * Changes rootNode Path. (default is '/')
 */
Tree.prototype.setRootPath = function(path) {
    this.rootNode.setPath(path);
    this.rootPath = path;
    this.rootPathLength = path.length;
}

/**
 * For debug purpose.
 */
Tree.prototype.visualize = function() {
    console.log(util.inspect(this.rootNode, false, 30, true));
};

Tree.prototype.export = function() {
    return (function _export(node) {
        var data = {
            path: node.path,
            children: []
        };
        node.letterTable.forEach(function(child) {
            data.children.push(_export(child));
        });
        if (node.paramChildNode) {
            data.paramChildNode = _export(node.paramChildNode);
        }
        return data;
    })(this.rootNode);
};

module.exports = Tree;