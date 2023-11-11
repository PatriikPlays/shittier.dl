import { ShittierError } from "../../../plugins/error";
import { Type } from "@fastify/type-provider-typebox";
import sanitizeFilename from "sanitize-filename";
import path from "node:path";
import fs from "node:fs";
import pump from "pump";

export default function (fastify: any, ops: any, done: any) {
    fastify.route({
        method: "POST",
        url: "/upload",
        onRequest: fastify.authenticate,
        handler: async (req: any, res: any) => {
            const data = await req.file();
            const file = data.file;
            const filename = data.filename;

            let writeStream = fs.createWriteStream(p);

            res.send(
                await new Promise((resolve) => {
                    pump(file, writeStream)
                        .on("finish", () => {
                            resolve({ ok: true });
                        })
                        .on("error", (e) => {
                            fastify.logger.error(
                                `Failed to write to ${p}, ${e}`
                            );
                            resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        });
                })
            );
        },
    });

    // uses post for cc compat
    fastify.route({
        method: "POST",
        url: "/delete/:filename",
        schema: {
            params: Type.Object({
                filename: Type.String({
                    maxLength: 64,
                    minLength: 1,
                }),
            }),
        },
        onRequest: fastify.authenticate,
        handler: async (req: any, res: any) => {
            let filename = req.params.filename;

            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));

            let p = path.join(fastify.base, "data", "files", filename);

            try {
                await fs.promises.stat(p);
            } catch (err: any) {
                if (err.code === "ENOENT") {
                    return res.send(
                        new ShittierError(400, "File doesn't exist")
                    );
                } else {
                    fastify.logger.error(
                        `Failed to stat file ${filename}, ${err.code}`
                    );
                    return res.send(
                        new ShittierError(500, "Internal Server Error")
                    );
                }
            }

            try {
                await fs.promises.unlink(p);
            } catch (err: any) {
                fastify.logger.error(
                    `Failed to unlink file ${filename}, ${err}`
                );
                return res.send(
                    new ShittierError(500, "Internal Server Error")
                );
            }

            return res.send(
                await new Promise(async (resolve) => {
                    fastify.db
                        .deleteLinksPointingToFile(filename)
                        .then(() => {
                            resolve({ ok: true });
                        })
                        .catch((err: any) => {
                            fastify.logger.error(
                                `Failed to delete links pointing to file ${filename}, ${err}`
                            );
                            resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        });
                })
            );
        },
    });

    // uses post for cc compat
    fastify.route({
        method: "POST",
        url: "/rename/:filename",
        schema: {
            params: Type.Object({
                filename: Type.String({
                    maxLength: 64,
                    minLength: 1,
                }),
            }),
            query: Type.Object({
                newName: Type.String({
                    maxLength: 64,
                    minLength: 1,
                }),
            }),
        },
        onRequest: fastify.authenticate,
        handler: async (req: any, res: any) => {
            let filename = req.params.filename;
            let newName = req.query.newName;

            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));
            if (sanitizeFilename(newName) != newName)
                return res.send(new ShittierError(400, "Invalid newName"));

            let p = path.join(fastify.base, "data", "files", filename);

            try {
                await fs.promises.stat(p);
            } catch (err: any) {
                if (err.code === "ENOENT") {
                    return res.send(
                        new ShittierError(400, "File doesn't exist")
                    );
                } else {
                    fastify.logger.error(
                        `Failed to stat file ${filename}, ${err.code}`
                    );
                    return res.send(
                        new ShittierError(500, "Internal Server Error")
                    );
                }
            }

            // im sorry:
            let links: any;
            await fastify.db
                .listLinks(filename)
                .then(async (l: Array<string>) => {
                    links = l;
                })
                .catch((e: Error) => {
                    fastify.logger.error(
                        `Failed to list links to file ${filename}, ${e}`
                    );
                    links = new ShittierError(500, "Internal Server Error");
                });

            if (links instanceof ShittierError) return res.send(links);

            for (let i = 0; i < links.length; i++) {
                let link = links[i];
                let err;

                await fastify.db.setLink(link, newName).catch((err: any) => {
                    fastify.logger.error(
                        `Failed to set link ${link} from ${filename} to ${newName}, ${err}`
                    );
                    err = new ShittierError(500, "Internal Server Error");
                });

                if (err) {
                    return res.send(err);
                }
            }

            await fs.promises
                .rename(p, path.join(fastify.base, "data", "files", newName))
                .then(() => {
                    return res.send({ ok: true });
                })
                .catch((e) => {
                    fastify.logger.error(
                        `Failed to rename file ${filename} to ${newName}, ${e}`
                    );
                    return res.send(
                        new ShittierError(500, "Internal Server Error")
                    );
                });
        },
    });

    // TODO: Somehow implement filtering for no file extension
    // TODO: Make better filename matching
    fastify.route({
        method: "GET",
        url: "/list",
        schema: {
            query: {
                type: "object",
                properties: {
                    extension: {
                        type: "string",
                        maxLength: 4096, // just in case
                    },
                    filename: {
                        type: "string",
                        minLength: 1,
                        maxLength: 512,
                    },
                },
            },
        },
        onRequest: fastify.authenticate,
        handler: async (req: any, res: any) => {
            let p = path.join(fastify.base, "data", "files");

            return res.send(
                await new Promise((resolve) => {
                    fs.readdir(p, (err, data) => {
                        if (err) {
                            fastify.logger.error(
                                `Failed to list dir ${p}, ${err}`
                            );
                            return resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        }

                        let allowedExtensions: string[] = [];
                        if (req.query.extension)
                            allowedExtensions = req.query.extension
                                .split("|")
                                .map((x: string) => {
                                    return x.toLowerCase();
                                });

                        if (req.query.extension || req.query.filename) {
                            let filteredData = [];

                            for (let i = 0; i < data.length; i++) {
                                let extension: any = data[i].split(".");
                                if (extension.length == 1) {
                                    extension = null;
                                } else {
                                    extension = extension[extension.length - 1];
                                }

                                if (
                                    req.query.extension &&
                                    (!extension ||
                                        !allowedExtensions.includes(
                                            extension.toLowerCase()
                                        ))
                                )
                                    continue;

                                if (
                                    req.query.filename &&
                                    !stringSearch(data[i], req.query.filename)
                                )
                                    continue;

                                filteredData.push(data[i]);
                            }

                            data = filteredData;
                        }

                        return resolve({ ok: true, data: data });
                    });
                })
            );
        },
    });
    done();
}
