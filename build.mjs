import {context, build} from "esbuild";
import {readdirSync, readFileSync} from "fs";
import {writeFile, readFile} from "fs/promises";
import {join} from "path";

const autoDeployPlugin = (p) => ({
	name: "auto-deploy",
	setup(build) {
		build.onEnd(async (result) => {
			if (result.errors.length) return;

			let configPath;
			if (process.platform === "win32") {
				configPath = process.env.APPDATA;
			} else if (process.platform === "darwin" || process.platform === "linux") {
				configPath = process.env.XDG_CONFIG_HOME || join(process.env.HOME, ".config");
			}
			const outFile = join(configPath, "BetterDiscord", "plugins", `${p}.plugin.js`);

			const fileContent = await readFile(build.initialOptions.outfile);
			await writeFile(outFile, fileContent);

			console.info("Deployed", p);
		});
	},
});

const options = readdirSync("./src/plugins").map((p) => ({
	entryPoints: [`./src/plugins/${p}`],
	bundle: true,
	platform: "node",
	loader: {".css": "text"},
	banner: {
		js: readFileSync(`./src/plugins/${p}/meta.js`, "utf8"),
	},
	format: "cjs",
	lineLimit: 120,
	outfile: `./${p}/${p}.plugin.js`,
	alias: {
		shared: "./src/shared",
	},
	jsx: "transform",
	target: ["es2020"],
	treeShaking: true,
	plugins: [autoDeployPlugin(p)],
}));

await Promise.all(
	options.map((options) =>
		process.argv.includes("--dev") ? context(options).then((ctx) => ctx.watch()) : build(options),
	),
);
