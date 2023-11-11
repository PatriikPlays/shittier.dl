import fp from "fastify-plugin";
import path from "path";

declare module "fastify" {
    interface FastifyInstance {
        basePath: string;
    }
}

export default fp(async (fastify, options) => {
    fastify.decorate("basePath", path.join(__dirname, "../../data"));
    fastify.logger.debug("Base path: ", fastify.basePath);
});
