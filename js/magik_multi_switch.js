import { app } from "../../scripts/app.js";

const NODE_ID = "Magik.MultiSwitch";
const PREFIX = "Input";
const SLOT_RE = /^Input(\d+)$/;
const INPUT = 1; // LiteGraph.INPUT

function dynamicIndices(node) {
    const out = [];
    (node.inputs || []).forEach((inp, i) => {
        if (!inp.widget && SLOT_RE.test(inp.name)) out.push(i);
    });
    return out;
}

function getLink(node, i) {
    const inp = node.inputs[i];
    if (!inp || inp.link == null) return null;
    if (typeof node.getInputLink === "function") return node.getInputLink(i) || null;
    const links = node.graph?.links;
    if (!links) return null;
    return (typeof links.get === "function" ? links.get(inp.link) : links[inp.link]) || null;
}

// Pull connected links down so they occupy Input1..Ik with no gaps.
function compact(node, indices) {
    const entries = indices.map((i) => getLink(node, i));
    const connected = entries.filter(Boolean);
    const hasGap = entries.some((l, k) => !l && k < connected.length);
    if (!hasGap) return;
    const origins = connected.map((l) => ({
        node: node.graph.getNodeById(l.origin_id),
        slot: l.origin_slot,
    }));
    indices.forEach((i) => node.disconnectInput(i));
    origins.forEach((o, k) => {
        if (o.node) o.node.connect(o.slot, node, indices[k]);
    });
}

function sync(node) {
    if (node._magikSyncing || !node.graph) return;
    node._magikSyncing = true;
    try {
        compact(node, dynamicIndices(node));

        let idx = dynamicIndices(node);
        const count = idx.filter((i) => node.inputs[i].link != null).length;
        const want = Math.max(1, count + 1); // always one empty slot to plug into

        for (let k = idx.length - 1; k >= want; k--) node.removeInput(idx[k]);

        idx = dynamicIndices(node);
        for (let n = idx.length + 1; n <= want; n++) node.addInput(PREFIX + n, "*");

        const w = node.widgets?.find((x) => x.name === "index");
        if (w) {
            const max = Math.max(1, count);
            w.options = w.options || {};
            w.options.min = 1;
            w.options.max = max;
            if (w.value > max) w.value = max;
            if (w.value < 1) w.value = 1;
        }

        const size = node.computeSize();
        node.setSize([Math.max(node.size[0], size[0]), size[1]]);
        node.graph.setDirtyCanvas?.(true, true);
    } finally {
        node._magikSyncing = false;
    }
}

function scheduleSync(node) {
    clearTimeout(node._magikTimer);
    node._magikTimer = setTimeout(() => sync(node), 0);
}

app.registerExtension({
    name: "Magik.MultiSwitch",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_ID) return;

        const onCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onCreated?.apply(this, arguments);
            if (!dynamicIndices(this).length) this.addInput(PREFIX + "1", "*");
            scheduleSync(this);
            return r;
        };

        const onConn = nodeType.prototype.onConnectionsChange;
        nodeType.prototype.onConnectionsChange = function (type) {
            const r = onConn?.apply(this, arguments);
            if (type === INPUT) scheduleSync(this);
            return r;
        };

        const onConf = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function () {
            const r = onConf?.apply(this, arguments);
            scheduleSync(this);
            return r;
        };
    },
});
