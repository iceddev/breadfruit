let knex;

function connect(settings) {
  knex = require('knex')(settings);
}

const defaultOptions = {
  dateField: 'created_at',
  dbApi: knex,
  limit: 1000,
  offset: 0,
  sortOrder: 'ASC',
};

module.exports = {
  connect,
  browse(table, fields, filter, options = {}) {
    const dbApi = options.dbApi || defaultOptions.dbApi || knex;
    const limit = options.limit || defaultOptions.limit;
    const offset = options.offset || defaultOptions.offset;
    const dateField = options.dateField || defaultOptions.dateField;
    const sortOrder = options.sortOrder || defaultOptions.sortOrder;

    let query = dbApi(table)
      .where(filter)
      .select(fields)
      .limit(limit)
      .offset(offset);

    if (options.search_start_date && options.search_end_date) {
      query = query
        .whereBetween(dateField, [options.search_start_date, options.search_end_date]);
    }

    if (options.orderBy) {
      query = query
        .orderBy(options.orderBy, sortOrder);
    }


    return query;
  },
  read(table, fields, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    return dbApi(table)
      .where(filter)
      .select(fields)
      .then(([row]) => {
        return row;
      });
  },
  add(table, fields, data, options = {}) {
    const dbApi = options.dbApi || knex;
    return dbApi(table)
      .returning(fields)
      .insert(data)
      .then(([row]) => {
        return row;
      });
  },
  edit(table, fields, data, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    return dbApi(table)
      .where(filter)
      .returning(fields)
      .update(data)
      .then(([row]) => {
        return row;
      });
  },
  del(table, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    return dbApi(table)
      .where(filter)
      .del();
  },
  raw(sql, options = {}) {
    const dbApi = options.dbApi || knex;
    return dbApi.raw(sql, options)
      .then(res => {
        if (!res.rows) {
          return res;
        }
        return res.rows;
      });
  }
};
