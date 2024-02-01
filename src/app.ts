import Fastify from "fastify";
import loggerPlugin from "./plugins/logger";
import multipartPlugin from "./plugins/multipart";
import dbPlugin from "./plugins/db";
import jwtPlugin from "./plugins/jwt";
import configPlugin from "./plugins/config";
import basePathPlugin from "./plugins/basePath";
import { setErrorHandler } from "./plugins/error";
import frontendRoutes from "./routes/frontend";
import authRoutes from "./routes/auth";
import fileRoutes from "./routes/file";
import fastifyFormbody from "@fastify/formbody";
import viewPlugin from "@fastify/view";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import ejs from "ejs";
import path from "node:path";
import { createDataDirectory } from "./utils";

const fastify = Fastify({
    logger: false,
}).withTypeProvider<TypeBoxTypeProvider>();

createDataDirectory();
await fastify.register(loggerPlugin);
await fastify.register(configPlugin);
await fastify.register(dbPlugin);
await fastify.register(jwtPlugin);
await fastify.register(basePathPlugin);
await fastify.register(fastifyFormbody);
await fastify.register(multipartPlugin);
await fastify.register(fastifyCookie);
await fastify.register(viewPlugin, {
    engine: {
        ejs,
    },
});
await fastify.register(frontendRoutes);
await fastify.register(authRoutes);
await fastify.register(fileRoutes, { prefix: "/f" });

setErrorHandler(fastify);

fastify.listen(
    { port: 6900, host: "0.0.0.0", ipv6Only: false },
    (err, address) => {
        if (err) throw err;
        fastify.logger.info(`Server listening on ${address}`);
    }
);
