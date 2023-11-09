import fp from "fastify-plugin";
import DB from "../db";

export default fp(async (fastify: any, options: any) => {
    fastify.decorate("db", new DB(options.dbPath));

    fastify.logger.debug("Initialized DB plugin");
});
