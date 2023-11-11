import { FastifyInstance } from "fastify";
import { isAuthenticated } from "../plugins/jwt";

export default async function (fastify: FastifyInstance) {
    fastify.route({
        method: "GET",
        url: "/",
        handler: async (req, res) => {
            fastify.logger.debug("Get request to /", req.user, req.id);
            if (await isAuthenticated(req, res)) {
                res.redirect("/gallery");
            } else {
                res.redirect("/auth");
            }
        },
    });

    fastify.route({
        method: "GET",
        url: "/auth",
        handler: async (req, res) => {
            return res.view("src/frontend/auth.ejs");
        },
    });

    fastify.route({
        method: "GET",
        url: "/gallery",
        onRequest: fastify.authenticate,
        handler: async (req, res) => {
            const testData = [
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "logs.png",
                    src: "https://i.pixium.lol/logs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
                {
                    name: "6_4isanadmin.png",
                    src: "https://i.pixium.lol/3OVxs.png",
                },
            ];

            return res.view("src/frontend/gallery.ejs", {
                files: testData,
            });
        },
    });
}
