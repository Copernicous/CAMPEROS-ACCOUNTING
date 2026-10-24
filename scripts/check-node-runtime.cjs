'use strict';
// October 21, 2026 Node security release floors. No configuration is loaded.
const floors = {22: [23, 4], 24: [22, 1], 26: [12, 1]};
const [major, minor, patch] = process.versions.node.split('.').map(Number);
const floor = floors[major];
const passed = Boolean(floor && (minor > floor[0] || (minor === floor[0] && patch >= floor[1])));
console.log(JSON.stringify({node: process.versions.node, securityBaseline: '2026-10-21', passed}));
if (!passed) {
    console.error('Use patched Node 22.23.4, 24.22.1 or 26.12.1 (or a newer patch in those supported lines). Update bundled runtimes separately.');
    process.exitCode = 1;
}
