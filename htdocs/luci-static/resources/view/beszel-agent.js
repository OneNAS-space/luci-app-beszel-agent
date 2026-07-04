'use strict';

'require dom';
'require fs';
'require form';
'require poll';
'require rpc';
'require view';

const POLL_INTERVAL = 5;

const RUNNING_SPAN = `<span style="color: green; font-weight: bold">${_('Running')}</span>`;
const NOT_RUNNING_SPAN = `<span style="color: red; font-weight: bold">${_('Not running')}</span>`;

function getServiceInfo(name) {
	const fn = rpc.declare({
		object: 'service',
		method: 'list',
		params: ['name'],
		expect: { [name]: {} },
	});
	return () => fn(name);
}

const getBeszelAgentInfo = getServiceInfo('beszel-agent');

async function getStatus() {
	try {
		const res = await getBeszelAgentInfo();
		const isRunning = res?.instances?.['beszel-agent']?.running;
		return isRunning ?? false;
	} catch (e) {
		console.error(e);
		return false;
	}
}

async function getVersion() {
	try {
		const res = await fs.exec('/usr/bin/beszel-agent', ['-v']);
		if (res && res.code === 0 && res.stdout) {
			const match = res.stdout.match(/(\d+\.\d+\.\d+)/);
			return match ? match[0] : res.stdout.trim();
		}
		return _('Unknown');
	} catch (e) {
		console.error(e);
		return _('Unknown');
	}
}

function getStatusValue(isRunning) {
	return isRunning ? RUNNING_SPAN : NOT_RUNNING_SPAN;
}

function updateStatus(node) {
	const output = node?.querySelector('output');
	return output
		? async () => {
			const isRunning = await getStatus();
			dom.content(output, getStatusValue(isRunning));
		}
		: () => {};
}

return view.extend({
	load() {
		return Promise.all([
			getStatus(),
			getVersion(),
		]);
	},

	async render([isRunning, versionText]) {
		const map = new form.Map('beszel-agent', _('Beszel Agent'),
			_('Lightweight telemetry agent for reporting system and Docker metrics to your Beszel Hub.'));

		const statusSect = map.section(form.TypedSection, 'status');
		statusSect.anonymous = true;
		statusSect.cfgsections = () => ['status_section'];

		const versionOpt = statusSect.option(form.DummyValue, '_version', _('Version'));
		versionOpt.cfgvalue = () => versionText;

		const statusOpt = statusSect.option(form.DummyValue, '_status', _('Service Status'));
		statusOpt.rawhtml = true;
		statusOpt.cfgvalue = () => getStatusValue(isRunning);

		const mainSect = map.section(form.TypedSection, 'beszel-agent');
		mainSect.anonymous = true;
		mainSect.addremove = false;

		mainSect.tab('general', _('General Settings'));
		mainSect.tab('mounts', _('Extra Disks'), _('Configure extra disks for Beszel Agent to monitor.'));

		const enableOpt = mainSect.taboption('general', form.Flag, 'enable', _('Enable'));
		enableOpt.default = '0';
		enableOpt.rmempty = false;

		const portOpt = mainSect.taboption('general', form.Value, 'port', _('Port'), _('Listening port for the agent.'));
		portOpt.datatype = 'port';
		portOpt.default = '45876';
		portOpt.placeholder = '45876';

		const hubOpt = mainSect.taboption('general', form.Value, 'hub_url', _('Hub URL'), _('The URL of your Beszel Hub.'));
		hubOpt.placeholder = 'http://hub.example.com:8090';

		const tokenOpt = mainSect.taboption('general', form.Value, 'token', _('Token'), _('Authentication token (if using token-based auth).'));
		tokenOpt.password = true;
		tokenOpt.rmempty = false;
		tokenOpt.validate = (section_id, value) => value ? true : _('This field is required.');

		const keyOpt = mainSect.taboption('general', form.Value, 'key', _('Public Key'), _('Public SSH key (if using SSH-based auth).'));
		keyOpt.placeholder = 'ssh-ed25519 ...';
		keyOpt.rmempty = false;
		keyOpt.validate = (section_id, value) => value ? true : _('This field is required.');

		const extraFsOpt = mainSect.taboption('mounts', form.DynamicList, 'extra_filesystems', _('Extra Filesystems'),
			_('Specify additional mount points to monitor (e.g., /mnt/sda1).'));
		extraFsOpt.placeholder = '/mnt/sda1';
		extraFsOpt.validate = (section_id, value) => (!value || value.startsWith('/')) ? true : _('Path must be absolute (must start with /).');

		const rendered = await map.render();

		const style = document.createElement('style');
		style.innerHTML = '.hide-agent-ui { display: none !important; }';
		rendered.appendChild(style);

		const enableRow = rendered.querySelector('.cbi-value[id$="-enable"]');
		const tokenRow = rendered.querySelector('.cbi-value[id$="-token"]');
		const keyRow = rendered.querySelector('.cbi-value[id$="-key"]');

		if (enableRow && tokenRow && keyRow) {
			const fieldContainer = enableRow.querySelector('.cbi-value-field');
			const tokenInput = tokenRow.querySelector('input[type="password"], input[type="text"]');
			const keyInput = keyRow.querySelector('input[type="text"]');

			if (fieldContainer && tokenInput && keyInput) {
				const warningNode = document.createElement('div');
				warningNode.style.color = '#ff9800';
				warningNode.style.fontWeight = 'bold';
				warningNode.style.paddingTop = '6px';
				warningNode.innerHTML = '💡 ' + _('Please configure both Token and Public Key to enable.');
				
				fieldContainer.prepend(warningNode);

				function updateEnableUI() {
					const hasToken = tokenInput.value.trim().length > 0;
					const hasKey = keyInput.value.trim().length > 0;
					const isValid = hasToken && hasKey;

					if (!isValid) {
						const cb = fieldContainer.querySelector('input[type="checkbox"]');
						if (cb && cb.checked) {
							cb.checked = false;
							cb.dispatchEvent(new Event('change', { bubbles: true }));
						}
					}

					Array.from(fieldContainer.children).forEach(child => {
						if (child === warningNode) {
							child.style.display = isValid ? 'none' : 'block';
						} else {
							if (isValid) {
								child.classList.remove('hide-agent-ui');
							} else {
								child.classList.add('hide-agent-ui');
							}
						}
					});
				}

				tokenInput.addEventListener('input', updateEnableUI);
				tokenInput.addEventListener('change', updateEnableUI);
				keyInput.addEventListener('input', updateEnableUI);
				keyInput.addEventListener('change', updateEnableUI);

				updateEnableUI();
				
				setTimeout(updateEnableUI, 100);
			}
		}

		enableOpt.validate = function(section_id, value) {
			if (value === '1') {
				const tInput = document.querySelector('.cbi-value[id$="-token"] input');
				const kInput = document.querySelector('.cbi-value[id$="-key"] input');
				
				const hasToken = tInput && tInput.value.trim().length > 0;
				const hasKey = kInput && kInput.value.trim().length > 0;
				
				if (!hasToken || !hasKey) {
					return _('You must provide both a Token and a Public Key to enable the agent.');
				}
			}
			return true;
		};

		const statusNode = map.findElement('data-field', statusOpt.cbid('status_section'));
		if (statusNode) {
			poll.add(updateStatus(statusNode), POLL_INTERVAL);
		}

		return rendered;
	},
});
