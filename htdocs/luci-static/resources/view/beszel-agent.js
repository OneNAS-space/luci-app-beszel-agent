'use strict';

'require dom';
'require form';
'require poll';
'require rpc';
'require view';

const POLL_INTERVAL = 5;

// 定义状态显示的 UI 样式
const RUNNING_SPAN = `<span style="color: var(--success-color-high); font-weight: bold">${_('Running')}</span>`;
const NOT_RUNNING_SPAN = `<span style="color: var(--error-color-high); font-weight: bold">${_('Not running')}</span>`;

// 利用 rpc 调用 ubus 的 service 接口，查询 beszel-agent 的运行状态
function getServiceInfo(name) {
	const fn = rpc.declare({
		object: 'service',
		method: 'list',
		params: ['name'],
		expect: { [name]: { instances: { [name]: {} }}},
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

function getStatusValue(isRunning) {
	return isRunning ? RUNNING_SPAN : NOT_RUNNING_SPAN;
}

// 轮询回调函数，用于动态更新 DOM 节点
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
		// 在渲染前并行加载所有需要的异步数据
		return Promise.all([
			getStatus(),
		]);
	},

	async render([isRunning]) {
		const map = new form.Map('beszel-agent', _('Beszel Agent'),
			_('Lightweight server monitoring hub with Docker support.'));

		// ----------------------------------------
		// 1. 状态栏 (虚拟 Section，不绑定具体 UCI)
		// ----------------------------------------
		const statusSect = map.section(form.TypedSection, 'status');
		statusSect.anonymous = true;
		statusSect.cfgsections = () => ['status_section'];

		const statusOpt = statusSect.option(form.DummyValue, '_status', _('Service Status'));
		statusOpt.rawhtml = true;
		statusOpt.cfgvalue = () => getStatusValue(isRunning);

		// ----------------------------------------
		// 2. 主配置区 (绑定到 config beszel-agent)
		// ----------------------------------------
		const mainSect = map.section(form.TypedSection, 'beszel-agent');
		mainSect.anonymous = true;
		mainSect.addremove = false;

		// 划分 Tabs 标签页
		mainSect.tab('general', _('General Settings'));
		mainSect.tab('mounts', _('File System Access'), _('Configure additional file systems for Beszel Agent to monitor.'));

		// --- General Tab ---
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

		// --- File System Access Tab (融入 extra_filesystems) ---
		// 这里我改用了 form.DynamicList，比单纯的 Value 更符合现代交互
		// 用户可以像添加规则一样，一条一条地添加挂载点，而不是在一个输入框里挤逗号
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

		// 渲染视图
		const rendered = await map.render();

		// 查找状态 DOM 节点并注册后台轮询机制
		const statusNode = map.findElement('data-field', statusOpt.cbid('status_section'));
		poll.add(updateStatus(statusNode), POLL_INTERVAL);

		return rendered;
	},
});
