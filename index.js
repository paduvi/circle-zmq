/**
 * Created by chotoxautinh on 12/27/16.
 */
var Promise = require('bluebird');
var zmq = require('zmq');
var glob = require('glob');
var path = require('path');

module.exports = function (options) {
    let app = this;
    let logger = app.logger;
    let prefix = options.sub_prefix;
    global.__base = app.rootFolder;

    Promise.resolve().then(function () {
        let sub = zmq.socket('sub'); // create subscriber endpoint

        sub.subscribe(prefix);

        // connect to publisher
        sub.connect(options.pub_address);
        logger.info(`Connected to zmq publisher at ${options.pub_address}.`);
        return sub;
    }).then(function (mq) {
        app.sub = mq;
        return loadMessageRoutes();
    }).then(function () {
        app.sub.on('message', function (data) {
            data = data.toString("utf8");
            if (!data.startsWith(prefix))
                return;
            data = data.replace(new RegExp("^(" + prefix + ")"), "");
            try {
                let message = JSON.parse(data);
                let from = message.from;
                let type = message.payload.type;
                let route = "/" + from + "/" + type;

                let handler = app.messageRoute[route];
                if (!handler)
                    throw new Error("Route không tồn tại: "+ route);
                handler(message);
            } catch (err) {
                return logger.error(err);
            }
        });
        return;
    })

    function loadMessageRoutes() {
        app.messageRoute = {}
        let files = glob.sync(`${__base}/controller/socket/*/route.js`);
        return Promise.map(files, function (filePath) {
            let controllerName = path.dirname(filePath).split("/").pop();
            let content = require(filePath)(app);
            Object.keys(content).forEach(function (route) {
                let handler = content[route];
                if (!route.startsWith("/"))
                    route = "/" + route;
                handleMessageRoute("/" + controllerName + route, handler);
            });
            return;
        });
    }

    function handleMessageRoute(route, handler) {
        app.messageRoute[route] = handler;
    }

}

