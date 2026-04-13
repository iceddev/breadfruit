import knexConstructor from 'knex';

export default function connect(settings) {
  const knex = knexConstructor(settings);
  const defaults = {
    dateField: 'created_at',
    limit: 1000,
    offset: 0,
    sortOrder: 'ASC',
  };

  function browse(table, fields, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    const limit = options.limit ?? defaults.limit;
    const offset = options.offset ?? defaults.offset;
    const dateField = options.dateField || defaults.dateField;
    const sortOrder = options.sortOrder || defaults.sortOrder;

    let query = dbApi(table)
      .where(filter)
      .select(fields)
      .limit(limit)
      .offset(offset);

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
    const [row] = await dbApi(table).where(filter).select(fields);
    return row;
  }

  async function add(table, fields, data, options = {}) {
    const dbApi = options.dbApi || knex;
    const [row] = await dbApi(table).returning(fields).insert(data);
    return row;
  }

  async function edit(table, fields, data, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    const [row] = await dbApi(table)
      .where(filter)
      .returning(fields)
      .update(data);
    return row;
  }

  function del(table, filter, options = {}) {
    const dbApi = options.dbApi || knex;
    return dbApi(table).where(filter).del();
  }

  async function raw(sql, options = {}) {
    const dbApi = options.dbApi || knex;
    const res = await dbApi.raw(sql, options);
    return res.rows || res;
  }

  return { browse, read, add, edit, del, raw, knex };
}
