export default function(fastify: any, ops: any, done: any) { // TODO: properly do types here
    fastify.register(require("./file.ts"), { prefix: "/file"});
    fastify.register(require("./link.ts"), { prefix: "/link"});
    fastify.register(require("./auth.ts"), { prefix: "/auth"});
    done();
}