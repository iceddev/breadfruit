import knexConstructor from 'knex';

const defaults = {
  dateField: 'created_at',
  limit: 1000,
  offset: 0,
  sortOrder: 'ASC',
};

const OPERATORS = {
  eq: '=',
  ne: '!=',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'like',
  ilike: 'ilike',
};

// Apply a filter object to a Knex query. Supports:
//   { col: value }                        -> WHERE col = value
//   { col: [a, b, c] }                    -> WHERE col IN (...)
//   { col: null }                         -> WHERE col IS NULL
//   { col: { gt: x, lte: y } }            -> WHERE col > x AND col <= y
//   { col: { in: [a, b] } }               -> WHERE col IN (...)
//   { col: { notIn: [a, b] } }            -> WHERE col NOT IN (...)
//   { col: { between: [a, b] } }          -> WHERE col BETWEEN a AND b
function applyFilter(query, filter) {
  if (!filter) return query;
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined) continue;
    if (value === null) {
      query = query.whereNull(key);
    } else if (Array.isArray(value)) {
      query = query.whereIn(key, value);
    } else if (typeof value === 'object' && !(value instanceof Date) && !value.toSQL) {
      for (const [op, operand] of Object.entries(value)) {
        if (operand === undefined) continue;
        if (op === 'in') query = query.whereIn(key, operand);
        else if (op === 'notIn') query = query.whereNotIn(key, operand);
        else if (op === 'between') query = query.whereBetween(key, operand);
        else if (op === 'notBetween') query = query.whereNotBetween(key, operand);
        else if (op === 'null') {
          query = operand ? query.whereNull(key) : query.whereNotNull(key);
        } else if (OPERATORS[op]) {
          query = query.where(key, OPERATORS[op], operand);
        } else {
          throw new Error(`Unknown filter operator: ${op}`);
        }
      }
    } else {
      query = query.where(key, value);
    }
  }
  return query;
}

// Resolve a soft-delete config to { column, value, undeletedValue }.
// Accepts:
//   true                                  -> { column: 'is_deleted', value: true, undeletedValue: false }
//   { column, value, undeletedValue }     -> used as-is
//   value can be:
//     - a literal (true, false, Date, etc.)
//     - the string 'NOW' -> knex.fn.now()
//     - a Knex raw expression (e.g. knex.fn.now())
//     - a function -> called at delete time
function resolveSoftDelete(config, knex) {
  if (!config) return null;
  if (config === true) {
    return { column: 'is_deleted', value: true, undeletedValue: false };
  }
  if (typeof config !== 'object') {
    throw new Error('softDelete must be true or an object');
  }
  const column = config.column || 'is_deleted';
  const undeletedValue = 'undeletedValue' in config ? config.undeletedValue : false;
  let value = 'value' in config ? config.value : true;
  if (value === 'NOW') value = knex.fn.now();
  return { column, value, undeletedValue };
}

function resolveValue(value) {
  return typeof value === 'function' ? value() : value;
}

export default function connect(settings) {
  // Allow passing an existing knex instance or a config
  const knex = typeof settings === 'function' ? settings : knexConstructor(settings);

  function browse(table, fields, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    const limit = options.limit ?? defaults.limit;
    const offset = options.offset ?? defaults.offset;
    const dateField = options.dateField || defaults.dateField;
    const sortOrder = options.sortOrder || defaults.sortOrder;

    let query = dbApi(table).select(fields).limit(limit).offset(offset);

    query = applyFilter(query, filter);

    if (options.search_start_date && options.search_end_date) {
      query = query.whereBetween(dateField, [
        options.search_start_date,
        options.search_end_date,
      ]);
    }

    if (options.orderBy) {
      if (Array.isArray(options.orderBy)) {
        options.orderBy.forEach((orderBy, index) => {
          const order = Array.isArray(sortOrder) ? sortOrder[index] : sortOrder;
          query = query.orderBy(orderBy, order);
        });
      } else {
        query = query.orderBy(options.orderBy, sortOrder);
      }
    }

    return query;
  }

  async function read(table, fields, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    let query = dbApi(table).select(fields);
    query = applyFilter(query, filter);
    const row = await query.first();
    return row || null;
  }

  async function add(table, fields, data, options = {}) {
    const dbApi = options.dbApi || knex;
    const [row] = await dbApi(table).returning(fields).insert(data);
    return row;
  }

  async function edit(table, fields, data, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    let query = dbApi(table).returning(fields).update(data);
    query = applyFilter(query, filter);
    const [row] = await query;
    return row;
  }

  function del(table, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    let query = dbApi(table).del();
    query = applyFilter(query, filter);
    return query;
  }

  async function count(table, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    let query = dbApi(table).count('* as total');
    query = applyFilter(query, filter);
    const [row] = await query;
    return Number(row.total);
  }

  async function upsert(table, fields, data, conflictColumns, options = {}) {
    const dbApi = options.dbApi || knex;
    const cols = Array.isArray(conflictColumns) ? conflictColumns : [conflictColumns];
    const [row] = await dbApi(table)
      .insert(data)
      .onConflict(cols)
      .merge()
      .returning(fields);
    return row;
  }

  async function raw(sql, bindingsOrOptions = {}, options = {}) {
    // Support two call shapes:
    //   raw(sql)                          — no bindings
    //   raw(sql, bindings)                — array or object bindings (Knex style)
    //   raw(sql, bindings, options)       — bindings + options.dbApi
    //   raw(sql, { bindings, dbApi })     — options object with bindings key
    let bindings;
    let opts;
    if (Array.isArray(bindingsOrOptions)) {
      bindings = bindingsOrOptions;
      opts = options;
    } else if (bindingsOrOptions && typeof bindingsOrOptions === 'object' && 'bindings' in bindingsOrOptions) {
      bindings = bindingsOrOptions.bindings;
      opts = bindingsOrOptions;
    } else {
      bindings = undefined;
      opts = bindingsOrOptions;
    }
    const dbApi = opts.dbApi || knex;
    const res = bindings !== undefined ? await dbApi.raw(sql, bindings) : await dbApi.raw(sql);
    return res.rows || res;
  }

  function transaction(callback) {
    return knex.transaction(callback);
  }

  // Table-bound API with optional softDelete and viewName support.
  // Returns an object with the same BREAD methods but bound to a specific table,
  // with soft-delete filtering baked into browse/read/del, and optional
  // separate readTable (view) for reads vs writes.
  function forTable(tableName, tableOptions = {}) {
    const softDelete = resolveSoftDelete(tableOptions.softDelete, knex);
    const readTable = tableOptions.viewName || tableName;
    const writeTable = tableName;

    function addSoftDeleteFilter(filter = {}, options = {}) {
      if (!softDelete) return filter;
      if (options.withDeleted) return filter;
      // Don't override if caller explicitly set the column
      if (filter[softDelete.column] !== undefined) return filter;
      return { ...filter, [softDelete.column]: softDelete.undeletedValue };
    }

    return {
      browse(fields, filter, options = {}) {
        return browse(readTable, fields, addSoftDeleteFilter(filter, options), options);
      },
      read(fields, filter, options = {}) {
        return read(readTable, fields, addSoftDeleteFilter(filter, options), options);
      },
      add(fields, data, options = {}) {
        return add(writeTable, fields, data, options);
      },
      edit(fields, data, filter, options = {}) {
        return edit(writeTable, fields, data, addSoftDeleteFilter(filter, options), options);
      },
      del(filter, options = {}) {
        if (softDelete) {
          const dbApi = options.dbApi || knex;
          let query = dbApi(writeTable).update({
            [softDelete.column]: resolveValue(softDelete.value),
          });
          query = applyFilter(query, addSoftDeleteFilter(filter, options));
          return query;
        }
        return del(writeTable, filter, options);
      },
      restore(filter, options = {}) {
        if (!softDelete) {
          throw new Error('restore() requires softDelete to be configured');
        }
        const dbApi = options.dbApi || knex;
        let query = dbApi(writeTable).update({
          [softDelete.column]: softDelete.undeletedValue,
        });
        // When restoring, look only at deleted rows
        const restoreFilter = { ...filter, [softDelete.column]: { ne: softDelete.undeletedValue } };
        query = applyFilter(query, restoreFilter);
        return query;
      },
      count(filter, options = {}) {
        return count(readTable, addSoftDeleteFilter(filter, options), options);
      },
      upsert(fields, data, conflictColumns, options = {}) {
        return upsert(writeTable, fields, data, conflictColumns, options);
      },
      softDelete,
      tableName: writeTable,
      readTable,
    };
  }

  return { browse, read, add, edit, del, raw, count, upsert, transaction, forTable, knex };
}
