'use strict';

'require dom';
'require fs';
'require form';
'require poll';
'require rpc';
'require view';

const POLL_INTERVAL = 5;

const RUNNING_SPAN = `<span style="color: var(--success-color-high); font-weight: bold">${_('Running')}</span>`;
const NOT_RUNNING_SPAN = `<span style="color: var(--error-color-high); font-weight: bold">${_('Not running')}</span>`;

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
			_('Lightweight server monitoring hub with Docker support.'));

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
		mainSect.tab('mounts', _('File System Access'), _('Configure additional file systems for Beszel Agent to monitor.'));

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

		const keyOpt = mainSect.taboption('general', form.Value, 'key', _('SSH Key'), _('Public SSH key (if using SSH-based auth).'));
		keyOpt.placeholder = 'ssh-ed25519 ...';

		const extraFsOpt = mainSect.taboption('mounts', form.DynamicList, 'extra_filesystems', _('Extra Filesystems'),
			_('Specify additional mount points to monitor (e.g., /mnt/sda1).'));
		extraFsOpt.placeholder = '/mnt/sda1';
		extraFsOpt.validate = function(section_id, value) {
			if (!value) return true;
			if (!value.startsWith('/')) {
				return _('Path must be absolute (must start with /).');
			}
			return true;
		};

		const rendered = await map.render();

		const statusNode = map.findElement('data-field', statusOpt.cbid('status_section'));
		poll.add(updateStatus(statusNode), POLL_INTERVAL);

		return rendered;
	},
});
