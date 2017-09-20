/**
 * Created by Stefan on 9/19/2017
 */
/**
 * Created by Stefan Endres on 08/16/2017.
 */

'use strict'

var http = require('http'),
    url = require('url'),
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    sessions = require('./sessions'),
    EventEmitter = require('events').EventEmitter;

function LHServer() {
    this.fnStack = [];
    this.defaultPort = 3000;
    this.options = {};
    this.viewEngine = null;
    EventEmitter.call(this);
}


util.inherits(LHServer, EventEmitter);

LHServer.prototype.use = function(fn) {
    if(!fn) return;
    var fnObj = {
        fn: fn,
        method: null,
        path: null,
    }
    this.fnStack.push(fnObj);
}

LHServer.prototype.execute = function(req, res) {
    var self = this;
    var url_parts = url.parse(req.url);
    var callbackStack = this.getFunctionList(url_parts.pathname, req.method);
    if(callbackStack.length === 0) {
        return;
    }
    var func = callbackStack.shift();

    // add session capabilities
    if(this.options['session']) {
        var session = sessions.lookupOrCreate(req,{
            lifetime: this.options['session'].lifetime || 604800,
        });
        if(!res.finished) {
            res.setHeader('Set-Cookie', session.getSetCookieHeaderValue());
        }
        req.session = session;
    }

    // add template rendering
    if(typeof this.options['view engine'] !== 'undefined') {
        res.render = render.bind(this,res);
    }

    res.statusCode = 200;
    res.send = send.bind(this,res);
    res.redirect = redirect.bind(this,res);
    res.status = status.bind(this,res);

    try{
        func.apply(this,[req,res, function(){self.callbackNextFunction(req,res,callbackStack)}]);
    } catch (e) {
        this.emit('error', e, res, req);
    }
}

LHServer.prototype.callbackNextFunction = function(req,res,callbackStack) {
    var self = this;
    if(callbackStack.length === 0) {
        return;
    }
    callbackStack[0] && callbackStack[0].apply(this,[req,res,function() {
        callbackStack.shift();
        self.callbackNextFunction(req,res,callbackStack)
    }]);
}

LHServer.prototype.listen = function(port, cb) {
    var httpServer = http.createServer(this.execute.bind(this)).listen(port || this.defaultPort);
    if(httpServer) {
        this.emit('ready');
    };
    cb && cb(httpServer);
}

LHServer.prototype.set = function(option, value) {
    this.options[option] = value;
    if(option === 'view engine' && value && value !== '') {
        try {
            this.viewEngine = require(value);
        } catch (e) {
            this.emit('error',e);
        }
    }
}

LHServer.prototype.getFunctionList = function(requestPath, method) {
    var ret = [];
    if(this.options['static']) {
        ret.push(readStaticFile.bind(this));
    }
    for(var i in this.fnStack) {
        if((this.fnStack[i].method === method || this.fnStack[i].method === null) &&
            (this.fnStack[i].path === requestPath || this.fnStack[i].path === null)) {
            if(this.fnStack[i].fn) {
                ret.push(this.fnStack[i].fn);
            }
        }
    }
    return ret;
}



LHServer.prototype.get =
    LHServer.prototype.post =
        LHServer.prototype.put =
            LHServer.prototype.delete = function() {};

var methods = ['get', 'put', 'post', 'delete',];
methods.map(function(method) {
    LHServer.prototype[method] = function(path, fn) {
        if(!fn) return;
        var fnObj = {
            fn: fn,
            method: method.toUpperCase(),
            path: path,
        }
        this.fnStack.push(fnObj);
    }
})


function readStaticFile(req,res,next) {
    if(res.finished){
        return next();
    }
    var url_parts = url.parse(req.url);
    var requestPath = url_parts.pathname ;
    if(requestPath === '/'){
        requestPath = '/index.html'
    }
    var rootPath = path.dirname(require.main.filename || process.mainModule.filename);
    var filePath = path.join(rootPath,this.options['static'],requestPath);
    const contentTypes = {
        '.ico': 'image/x-icon',
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.doc': 'application/msword'
    };

    var fExt = path.extname(filePath);
    var contentType;
    if(fExt && contentTypes.hasOwnProperty(fExt)) {
        contentType = contentTypes[fExt];
    } else {
        return next();
    }

    fs.readFile(filePath, function(error, content) {
        if (error) {
            return next();
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
            return next();
        }
    });
}

function send(res, data) {
    if(res.finished){
        return;
    }
    var contentType = 'text/html';
    var responseBody = data;
    if(typeof data === 'object') {
        contentType = 'application/json'
        responseBody = JSON.stringify(data);
    }
    res.writeHead(
        res.statusCode,
        {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
            'Content-Length': Buffer.byteLength(responseBody),
        }
    );

    res.end(responseBody);
}

function render(res,template,options,callback){
    if(res.finished){
        return next();
    }
    var self = this;
    if(typeof self.viewEngine === 'undefined') {
        return callback && callback();
    }
    if(self.viewEngine.renderFile) {
        return self.viewEngine.renderFile(
            (self.options['views'] || '') + '/'+template+'.pug',
            options, function(err, result) {
                if(result){
                    res.writeHead(
                        res.statusCode,
                        {
                            'Content-Type': 'text/html',
                        }
                    );
                    res.end(result);
                }
                callback && callback(err,result);
            }
        )
    }
}

function status(res,code) {
    res.statusCode = code;
    console.log(res.statusCode);
}

function redirect(res,url) {
    var address = url;
    var status = 302;
    if (arguments.length === 3) {
        if (typeof arguments[1] === 'number') {
            status = arguments[1];
            address = arguments[2];
        }
    }

    var responseBody = 'Redirecting to ' + address;

    res.writeHead(
        status,
        {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache',
            'Content-Length': Buffer.byteLength(responseBody),
            'Location': address,
        }
    );
    res.end(responseBody);
};

module.exports = new LHServer();
