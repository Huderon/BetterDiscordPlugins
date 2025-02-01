export class SettingsManager {
	constructor(pluginName, config) {
		this.pluginName = pluginName;
		this.settingsPanel = config.settings;
		this.defaultSettings = Object.fromEntries(
			this.settingsPanel.flatMap((setting) =>
				setting.type === "category" ?
					setting.settings.map((setting) => [setting.id, setting.value])
				:	[[setting.id, setting.value]],
			),
		);
		this.settings = {...this.defaultSettings, ...BdApi.Data.load(this.pluginName, "settings")};
		this.syncSettingsPanel();
	}

	syncSettingsPanel() {
		for (const key in this.settings) {
			this.updateSettingsPanel(key, this.settings[key]);
		}
	}

	updateSettingsPanel(id, value) {
		const setting = this.settingsPanel
			.flatMap((s) => (s.type === "category" ? s.settings : s))
			.find((m) => m.id === id);
		if (setting) setting.value = value;
	}

	get(key) {
		return this.settings[key];
	}

	set(key, value) {
		this.settings[key] = value;
		BdApi.Data.save(this.pluginName, "settings", this.settings);
		this.updateSettingsPanel(key, value);
	}
}
