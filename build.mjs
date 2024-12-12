import {context, build} from "esbuild";
import {readdirSync} from "fs";
import {writeFile, readFile} from "fs/promises";
import {join} from "path";

const autoDeployPlugin = (p) => ({
	name: "auto-deploy",
	setup(build) {
		build.onEnd(async (result) => {
			if (result.errors.length) return;

			let configPath;

			switch (process.platform) {
				case "win32":
					configPath = process.env.APPDATA;
					break;
				case "darwin":
					configPath = join(process.env.HOME, "Library", "Application Support");
					break;
				default:
					configPath = process.env.XDG_CONFIG_HOME || join(process.env.HOME, ".config");
					break;
			}

			const outFile = join(configPath, "BetterDiscord", "plugins", `${p}.plugin.js`);

			const pluginFileContent = await readFile(build.initialOptions.outfile);
			const metaFileContent = await readFile(`./src/plugins/${p}/meta.js`);
			const updatedFileContent = `${metaFileContent}\n${pluginFileContent}`;
			await writeFile(build.initialOptions.outfile, updatedFileContent);
			await writeFile(outFile, updatedFileContent);

			console.info("Deployed", p);
		});
	},
});

const options = readdirSync("./src/plugins").map((p) => ({
	entryPoints: [`./src/plugins/${p}`],
	bundle: true,
	platform: "node",
	loader: {".css": "text"},
	format: "cjs",
	outfile: `./${p}/${p}.plugin.js`,
	alias: {
		"@shared": "./src/shared",
	},
	jsx: "transform",
	target: ["esnext"],
	treeShaking: true,
	plugins: [autoDeployPlugin(p)],
}));

await Promise.all(
	options.map((options) =>
		process.argv.includes("--dev") ? context(options).then((ctx) => ctx.watch()) : build(options),
	),
);
