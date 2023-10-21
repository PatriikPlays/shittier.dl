import { ShittierError } from "../../../plugins/error";
import { authHook } from "../../../utils";
import { Type } from "@fastify/type-provider-typebox";
import sanitizeFilename from "sanitize-filename";
import path from "node:path";
import fs from "node:fs";
import pump from "pump";

// this is a bad string search function, and is temporary
function stringSearch(str: string, pattern: string) {
    if (pattern[0] === '^' && pattern[pattern.length - 1] === '$') {
        const patternWithoutMarkers = pattern.slice(1, -1);
        return str.startsWith(patternWithoutMarkers) && str.endsWith(patternWithoutMarkers);
    } else if (pattern[0] === '^') {
        const patternWithoutMarker = pattern.slice(1);
        return str.startsWith(patternWithoutMarker);
    } else if (pattern[pattern.length - 1] === '$') {
        const patternWithoutMarker = pattern.slice(0, -1);
        return str.endsWith(patternWithoutMarker);
    } else {
        return str.includes(pattern);
    }
}

export default function(fastify: any, ops: any, done: any) { // TODO: properly do types here
    fastify.route({
        method: "GET",
        url: "/get/:filename",
        schema: {
            params: Type.Object({
                filename: Type.String({
                    maxLength: 64,
                    minLength: 1,
                }),
            }),
        },
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            const { filename } = req.params;

            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));

            const p = path.join(fastify.base, "data", "files", filename);

            if (!fs.existsSync(p)) {
                return res.send(new ShittierError(404, "Not Found"));
            }

            const stream = fs.createReadStream(p);
            return res.code(200).send(stream); // TODO: Set application-type/png and MIME
        },
    });

    fastify.route({
        method: "POST",
        url: "/upload",
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            const data = await req.file();
            const file = data.file;
            const filename = data.filename;

            if (filename.length > 64)
                return res.send(new ShittierError(400, "Filename too long"));
            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));

            let p = path.join(fastify.base, "data", "files", filename);

            try {
                await fs.promises.stat(p);
                return res.send(new ShittierError(400, "File already exists"));
            } catch (err: any) {
                if (err.code !== "ENOENT") {
                    fastify.logger.error(
                        `Failed to stat file ${filename}, ${err.code}`
                    );
                    return res.send(
                        new ShittierError(500, "Internal Server Error")
                    );
                }
            }

            let writeStream = fs.createWriteStream(p);

            res.send(
                await new Promise((resolve) => {
                    pump(file, writeStream)
                        .on("finish", () => {
                            resolve({ ok: true });
                        })
                        .on("error", (e) => {
                            fastify.logger.error(`Failed to write to ${p}, ${e}`);
                            resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        });
                })
            )
        }
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
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            let filename = req.params.filename;

            if (sanitizeFilename(filename) != filename)
                return res.send(new ShittierError(400, "Invalid filename"));

            let p = path.join(fastify.base, "data", "files", filename);

            try {
                await fs.promises.stat(p);
            } catch (err: any) {
                if (err.code === "ENOENT") {
                    return res.send(new ShittierError(400, "File doesn't exist"));
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
                fastify.logger.error(`Failed to unlink file ${filename}, ${err}`);
                return res.send(new ShittierError(500, "Internal Server Error"));
            }

            return res.send(
                await new Promise(async (resolve) => {
                    fastify.db.deleteLinksPointingToFile(filename)
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
        }
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
                })
            }),
            query: Type.Object({
                newName: Type.String({
                    maxLength: 64,
                    minLength: 1,
                })
            })
        },
        preHandler: authHook,
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
                    return res.send(new ShittierError(400, "File doesn't exist"));
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
        }
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
                        maxLength: 4096 // just in case
                    },
                    filename: {
                        type: "string",
                        minLength: 1,
                        maxLength: 512
                    }
                }
            }
        },
        preHandler: authHook,
        handler: async (req: any, res: any) => {
            let p = path.join(fastify.base, "data", "files");

            return res.send(
                await new Promise((resolve) => {
                    fs.readdir(p, (err, data) => {
                        if (err) {
                            fastify.logger.error(`Failed to list dir ${p}, ${err}`);
                            return resolve(
                                new ShittierError(500, "Internal Server Error")
                            );
                        }

                        let allowedExtensions: string[] = [];
                        if (req.query.extension) allowedExtensions = req.query.extension.split("|").map((x: string) => { return x.toLowerCase() });

                        if (req.query.extension || req.query.filename) {
                            let filteredData = [];

                            for (let i=0;i<data.length;i++) {
                                let extension: any = data[i].split(".");
                                if (extension.length == 1) {
                                    extension = null;
                                } else {
                                    extension = extension[extension.length-1];
                                }
                            
                                if (req.query.extension && ( !extension || !allowedExtensions.includes(extension.toLowerCase()) )) continue;

                                if (req.query.filename && !stringSearch(data[i], req.query.filename)) continue;
                                
                                filteredData.push(data[i]);
                            }

                            data = filteredData;
                        }

                        return resolve({ ok: true, data: data });
                    });
                })
            );
        }
    });
    done()
}