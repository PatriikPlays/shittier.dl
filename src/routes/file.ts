import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { FastifyInstance } from "fastify";
import sanitizeFilename from "sanitize-filename";
import { ShittierError } from "../plugins/error";
import path from "path";
import { createWriteStream } from "fs";

export default async function (server: FastifyInstance) {
    const fastify = server.withTypeProvider<TypeBoxTypeProvider>();

    fastify.route({
        method: "GET",
        url: "/:filename",
        schema: {
            params: Type.Object({
                filename: Type.String({
                    maxLength: 64,
                    minLength: 1,
                }),
            }),
        },
        handler: async (req, res) => {
            const { filename }: any = req.params;

            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));

            const location = path.join(fastify.basePath, "files", filename);

            console.log(location)

            const file = Bun.file(location);

            if (!(await file.exists())) {
                return res.send(new ShittierError(404, "Not found"));
            }

            const buf = Buffer.from(await file.arrayBuffer());
            res.status(200).type(file.type).send(buf);
        },
    });

    fastify.route({
        method: "POST",
        url: "/upload",
        // onRequest: fastify.authenticate,
        handler: async (req, res) => {
            console.log("Got upload request");
            const data = await req.file();
            console.log("Got file");

            if (!data) {
                console.log("no data");
                return res.send(new ShittierError(400, "Bad request"));
            }
            const { file, filename } = data;

            if (filename.length > 64)
                return res.send(new ShittierError(400, "Filename too long"));
            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));

            const location = path.join(fastify.basePath, "files", filename);
            const actualFile = Bun.file(location);

            if (await actualFile.exists()) {
                return res.send(new ShittierError(400, "File already exists"));
            }

            fastify.logger.info("Saving file", filename);
            file.pipe(createWriteStream(location));
            res.status(200).send();
        },
    });
}
