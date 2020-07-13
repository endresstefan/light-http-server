const Route = (variables, handler) => ({
    variables,
    handler,
});

class RouteHandler {

    constructor() {
        this.paths = { GET: {}, POST: {}, PUT: {}, DELETE: {} };
    }

    addRoute(method, path, handler) {
        const variables = [];

        const regexp = /:(\w+)/g;
        let match;
        while ((match = regexp.exec(path)) !== null) {
            variables.push(match[1]);
        }

        const parsedPath = path.replace(/(:\w+)/g, '([A-Za-z0-9]+)');

        if (!this.paths.hasOwnProperty(method)) {
            throw new Error('Invalid request method!');
        }
        if (this.paths[method].hasOwnProperty(path)) {
            throw new Error('Request method and path already defined!');
        }

        this.paths[method][parsedPath] = Route(variables, handler);
    }

    get(path, handler) {
        this.addRoute('GET', path, handler);
    }

    post(path, handler) {
        this.addRoute('POST', path, handler);
    }

    put(path, handler) {
        this.addRoute('PUT', path, handler);
    }

    delete(path, handler) {
        this.addRoute('DELETE', path, handler);
    }

    handlePath(method, path) {
        for (const route of Object.entries(this.paths[method])) {
            const match = path.match(`^${route[0]}$`);
            if (match != null) {
                let variables = {};
                let index = 1;
                for (let v of route[1].variables) {
                    variables[v] = match[index++];
                }

                return {
                    variables,
                    handle: route[1].handler,
                };
            }
        }

        return null;
    }

    getHandler() {
        return (req, res, next) => {
            const path = req.url.split('?')[0];
            const handler = this.handlePath(req.method, path);

            if (handler === null) {
                return next();
            }

            req.variables = handler.variables;
            return handler.handle(req, res, next);
        }
    };
}

module.exports = RouteHandler;