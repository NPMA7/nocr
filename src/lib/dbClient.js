const { Pool } = require('pg');
const format = require('pg-format');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

class QueryBuilder {
    constructor(table) {
        this.table = table;
        this._action = 'select';
        this._columns = '*';
        this._where = [];
        this._limit = null;
        this._order = null;
        this._single = false;
        this._maybeSingle = false;
        this._data = null;
        this._onConflict = null;
        this._count = null;
        this._head = false;
    }

    select(columns = '*', options = {}) {
        if (['insert', 'update', 'upsert', 'delete'].includes(this._action)) {
            this._columns = columns;
            return this;
        }
        this._action = 'select';
        this._columns = columns;
        if (options.count) this._count = options.count;
        if (options.head) this._head = options.head;
        return this;
    }

    insert(data) {
        this._action = 'insert';
        this._data = Array.isArray(data) ? data : [data];
        return this;
    }

    upsert(data, options = {}) {
        this._action = 'upsert';
        this._data = Array.isArray(data) ? data : [data];
        this._onConflict = options.onConflict || 'id';
        return this;
    }

    update(data) {
        this._action = 'update';
        this._data = data;
        return this;
    }

    delete() {
        this._action = 'delete';
        return this;
    }

    eq(col, val) { this._where.push({ col, op: '=', val }); return this; }
    neq(col, val) { this._where.push({ col, op: '!=', val }); return this; }
    gt(col, val) { this._where.push({ col, op: '>', val }); return this; }
    gte(col, val) { this._where.push({ col, op: '>=', val }); return this; }
    lt(col, val) { this._where.push({ col, op: '<', val }); return this; }
    lte(col, val) { this._where.push({ col, op: '<=', val }); return this; }
    ilike(col, val) { this._where.push({ col, op: 'ILIKE', val }); return this; }
    like(col, val) { this._where.push({ col, op: 'LIKE', val }); return this; }
    in(col, arr) { this._where.push({ col, op: 'IN', val: arr }); return this; }
    not(col, op, val) {
        let sqlOp = op;
        if (op === 'eq') sqlOp = '!=';
        else if (op === 'ilike') sqlOp = 'NOT ILIKE';
        else if (op === 'like') sqlOp = 'NOT LIKE';
        else if (op === 'in') sqlOp = 'NOT IN';
        else if (op === 'is') sqlOp = 'IS NOT';
        this._where.push({ col, op: sqlOp, val });
        return this;
    }
    is(col, val) { this._where.push({ col, op: 'IS', val }); return this; }

    single() { this._single = true; this._limit = 1; return this; }
    maybeSingle() { this._maybeSingle = true; this._limit = 1; return this; }
    limit(n) { this._limit = n; return this; }
    order(col, opts = { ascending: true }) {
        this._order = { col, asc: opts.ascending !== false };
        return this;
    }

    async execute() {
        try {
            let sql = '';
            let countSql = '';
            
            let whereClause = '';
            if (this._where.length > 0) {
                const clauses = this._where.map(w => {
                    if (w.op === 'IN' || w.op === 'NOT IN') {
                        if (!Array.isArray(w.val) || w.val.length === 0) {
                            return w.op === 'IN' ? '1=0' : '1=1';
                        }
                        return format('%I %s (%L)', w.col, w.op, w.val);
                    }
                    if (w.val === null) {
                       if (w.op === '=') return format('%I IS NULL', w.col);
                       if (w.op === '!=') return format('%I IS NOT NULL', w.col);
                    }
                    return format('%I %s %L', w.col, w.op, w.val);
                });
                whereClause = ' WHERE ' + clauses.join(' AND ');
            }

            if (this._action === 'select') {
                sql = format('SELECT %s FROM %I', this._columns === '*' ? '*' : format.ident(this._columns), this.table);
                // Handle multiple columns like 'id, name'
                if (this._columns !== '*') {
                    const cols = this._columns.split(',').map(c => c.trim());
                    sql = format('SELECT %I FROM %I', cols, this.table);
                }
                
                if (this._count) {
                    countSql = format('SELECT count(*) as total FROM %I', this.table) + whereClause;
                }
            } else if (this._action === 'insert') {
                if (this._data.length === 0) return { data: [], error: null };
                const keys = Object.keys(this._data[0]);
                const values = this._data.map(obj => keys.map(k => obj[k]));
                sql = format('INSERT INTO %I (%I) VALUES %L RETURNING *', this.table, keys, values);
            } else if (this._action === 'update') {
                const keys = Object.keys(this._data);
                if (keys.length === 0) return { data: null, error: new Error('Empty update payload') };
                const updates = keys.map(k => format('%I = %L', k, this._data[k])).join(', ');
                sql = format('UPDATE %I SET %s', this.table, updates);
                sql += whereClause + ' RETURNING *';
                whereClause = ''; // Already added
            } else if (this._action === 'delete') {
                sql = format('DELETE FROM %I', this.table);
                sql += whereClause + ' RETURNING *';
                whereClause = '';
            } else if (this._action === 'upsert') {
                if (this._data.length === 0) return { data: [], error: null };
                const keys = Object.keys(this._data[0]);
                const values = this._data.map(obj => keys.map(k => obj[k]));
                
                const conflictKeys = Array.isArray(this._onConflict) ? this._onConflict : [this._onConflict];
                const updates = keys.filter(k => !conflictKeys.includes(k)).map(k => format('%I = EXCLUDED.%I', k, k)).join(', ');
                
                if (updates) {
                    sql = format('INSERT INTO %I (%I) VALUES %L ON CONFLICT (%I) DO UPDATE SET %s RETURNING *', this.table, keys, values, conflictKeys, updates);
                } else {
                    sql = format('INSERT INTO %I (%I) VALUES %L ON CONFLICT (%I) DO NOTHING RETURNING *', this.table, keys, values, conflictKeys);
                }
            }

            if (whereClause && this._action !== 'update' && this._action !== 'delete') {
                sql += whereClause;
            }
            
            if (this._action === 'select') {
                if (this._order) {
                    sql += format(' ORDER BY %I %s', this._order.col, this._order.asc ? 'ASC' : 'DESC');
                }
                if (this._limit) {
                    sql += format(' LIMIT %L', this._limit);
                }
            }

            let countObj = null;
            if (countSql) {
                const countRes = await pool.query(countSql);
                countObj = parseInt(countRes.rows[0].total, 10);
                if (this._count === 'exact' && this._head) {
                    return { data: null, count: countObj, error: null };
                }
            }

            const res = await pool.query(sql);
            
            let finalData = res.rows;
            if (this._single) {
                if (finalData.length === 0) return { data: null, error: new Error('Row not found') };
                finalData = finalData[0];
            } else if (this._maybeSingle) {
                finalData = finalData.length > 0 ? finalData[0] : null;
            }

            return { data: finalData, count: countObj, error: null };

        } catch (err) {
            return { data: null, error: err };
        }
    }

    then(resolve, reject) {
        this.execute().then(resolve).catch(reject);
    }
}

const dbMock = {
    from: (table) => new QueryBuilder(table),
    rpc: async (fn, args) => {
        return { data: null, error: new Error('RPC not implemented') };
    }
};

module.exports = dbMock;

// Mock Realtime
dbMock.channel = function(name) {
    return {
        on: function(event, filter, callback) {
            return this;
        },
        subscribe: function() {
            return this;
        }
    };
};
