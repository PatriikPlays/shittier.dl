import fp from "fastify-plugin";
import { DatabaseManager } from "../db";

declare module "fastify" {
    interface FastifyInstance {
        db: DatabaseManager;
    }
}

export default fp(async (fastify: any, options: any) => {
    fastify.decorate("db", new DatabaseManager(options.dbPath));

    fastify.logger.debug("Initialized DB plugin");
});
