const core = require('@actions/core');
const exec = require('@actions/exec');
const wait = require('./wait');
const fs = require('fs');

async function run() {
  try {
    const version = core.getInput('version');
    const ports = core.getInput('ports');
    const extra_args = core.getInput('arguments');
    const nodeName = 'primary-node'

    const kubeconfigPath=`/tmp/output/kubeconfig-${version}.yaml`;
    console.log(`storing kubeconfig here ${kubeconfigPath}!`);

    const portPairs = [];
    for(const portPair of ports.split(',')) {
      if(portPair) {
        portPairs.push(`-p${portPair}`);
      }
    }

    const extra_opts = [];
    for (const token of extra_args.split(' ')) {
      if (token) {
        extra_opts.push(token)
      }
    }

    await exec.exec('docker', ["run","-d","--privileged",`--name=k3s-${version}`,
      "-e",`K3S_KUBECONFIG_OUTPUT=${kubeconfigPath}`,
      "-e","K3S_KUBECONFIG_MODE=666",
      "-e",`K3S_NODE_NAME=${nodeName}`,
      "-v","/tmp/output:/tmp/output",
      "-p6443:6443",
      ...portPairs,
      `rancher/k3s:${version}`,"server", ...extra_opts]);

    core.exportVariable('KUBECONFIG', kubeconfigPath);
    core.setOutput("kubeconfig", kubeconfigPath);

    while(await exec.exec(`kubectl get node/${nodeName}`, null, {ignoreReturnCode: true})) {
      console.log('Waiting for cluster to be ready...')
      await wait(3000);
    }

    await exec.exec(`kubectl wait --timeout=60s --for=condition=Ready node/${nodeName}`);

    while (await exec.exec(`kubectl get sa/default -n default`, null, { ignoreReturnCode: true })) {
      console.log('Waiting for default service account to be ready...');
      await wait(3000);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
run();
