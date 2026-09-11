const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'src', 'lib', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

const dbPath = path.join(dataDir, 'db.json');

// Default state
let data = {
    devices: [],
    topology_nodes: [],
    topology_edges: []
};

// Load from file
if (fs.existsSync(dbPath)) {
    try {
        data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch (e) {
        console.error('Failed to parse db.json', e);
    }
}

function save() {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Simple DB interface mimicking what we need
const db = {
    data,
    devices: {
        all: () => data.devices,
        get: (id) => data.devices.find(d => d.id == id),
        insert: (device) => {
            device.id = Date.now();
            data.devices.push(device);
            save();
            return device.id;
        },
        delete: (id) => {
            data.devices = data.devices.filter(d => d.id != id);
            save();
        },
        updateStatus: (id, status) => {
            const dev = db.devices.get(id);
            if(dev) {
                dev.status = status;
                dev.last_seen = new Date().toISOString();
                save();
            }
        }
    },
    topology: {
        getNodes: () => data.topology_nodes,
        getEdges: () => data.topology_edges,
        save: (nodes, edges) => {
            data.topology_nodes = nodes;
            data.topology_edges = edges;
            save();
        }
    }
};

module.exports = db;
