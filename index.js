const core = require('@actions/core');
const exec = require('@actions/exec');
const wait = require('./wait');
const fs = require('fs');

async function run() {
  try {
    const version = core.getInput('version');
    const ports = core.getInput('ports');
    const egress_fix = core.getInput('egress-fix');
    const nodeName = 'primary-node'

    const kubeconfigPath=`/tmp/output/kubeconfig-${version}.yaml`;
    console.log(`storing kubeconfig here ${kubeconfigPath}!`);

    const portPairs = [];
    for(const portPair of ports.split(',')) {
      if(portPair) {
        portPairs.push(`-p${portPair}`);
      }
    }

    const egress_options = egress_fix ? "--egress-selector-mode disabled" : "";

    await exec.exec('docker', ["run","-d","--privileged",`--name=k3s-${version}`,
      "-e",`K3S_KUBECONFIG_OUTPUT=${kubeconfigPath}`,
      "-e","K3S_KUBECONFIG_MODE=666",
      "-e",`K3S_NODE_NAME=${nodeName}`,
      "-v","/tmp/output:/tmp/output",
      "-p6443:6443",
      ...portPairs,
      `rancher/k3s:${version}`,"server", `${egress_options}`]);

    core.exportVariable('KUBECONFIG', kubeconfigPath);
    core.setOutput("kubeconfig", kubeconfigPath);

    while(await exec.exec(`kubectl get node/${nodeName}`, null, {ignoreReturnCode: true})) {
      console.log('Waiting for cluster to be ready...')
      await wait(3000);
    }

    await exec.exec(`kubectl wait --timeout=60s --for=condition=Ready node/${nodeName}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}
run();