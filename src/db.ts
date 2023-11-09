import { Database as sqlite } from "bun:sqlite";

class DB {
    db: sqlite;

    constructor(path: string) {
        this.db = new sqlite(path, {
            create: true,
        });

        this.db.run(
            "CREATE TABLE IF NOT EXISTS links (link_id TEXT, filename TEXT)"
        );
    }

    resolveLink(link: string) {
        // Todo: Make this nicer
        const query = this.db
            .query("SELECT filename FROM links WHERE link_id = ?")
            .get(link);
        const response = query as string | undefined;

        if (!response) return null;
        return response;
    }

    addLink(link: string, filename: string) {
        this.db.run("INSERT INTO links (link_id, filename) VALUES (?, ?)", [
            filename,
            link,
        ]);
    }

    setLink(link: string, filename: string) {
        this.db.run("UPDATE links SET filename = ? WHERE link_id = ?", [
            filename,
            link,
        ]);
    }

    revokeLink(link: string) {
        this.db.run("DELETE FROM links WHERE link_id = ?", [link]);
    }

    listLinks(filename: string) {
        const query = this.db
            .query("SELECT link_id FROM links WHERE filename = ?")
            .all(filename);
        const response = query as string[] | undefined;

        if (!response) return null;
        return response;
    }

    deleteLinksPointingToFile(filename: string) {
        this.db.run("DELETE FROM links WHERE filename = ?", [filename]);
    }
}

export default DB;
