import fp from "fastify-plugin";
import fastifyMultipart from "@fastify/multipart";

export default fp(async (fastify, options) => {
    await fastify.register(fastifyMultipart, {
        limits: {
            fileSize: 8 * 1024 * 1024, // 8MiB,
            files: 1,
            fieldNameSize: 100,
            fieldSize: 100,
            headerPairs: 100,
            fields: 5,
        },
    });

    fastify.logger.debug("Initialized file upload plugin");
});
