# breadfruit

[![npm version](https://img.shields.io/npm/v/breadfruit.svg)](https://www.npmjs.com/package/breadfruit)
[![CI](https://github.com/iceddev/breadfruit/actions/workflows/ci.yml/badge.svg)](https://github.com/iceddev/breadfruit/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/iceddev/breadfruit/branch/main/graph/badge.svg)](https://codecov.io/gh/iceddev/breadfruit)
[![node](https://img.shields.io/node/v/breadfruit.svg)](https://nodejs.org)
[![npm downloads](https://img.shields.io/npm/dm/breadfruit.svg)](https://www.npmjs.com/package/breadfruit)
[![license](https://img.shields.io/npm/l/breadfruit.svg)](https://github.com/iceddev/breadfruit/blob/main/LICENSE)

Not really bread. Not really fruit. Just like this package. Simple CRUD helpers on top of [knex](https://knexjs.org/).

![breadfruit](happy_breadfruit.png)

## Install

```sh
npm install breadfruit
```

Requires Node.js `>=22`.

## Usage

Breadfruit is an ES module with a default export.

```js
import breadfruit from 'breadfruit';

const config = {
  client: 'pg',
  connection: 'postgres://postgres@localhost:5432/someDatabase',
  pool: { min: 1, max: 7 },
};

const { browse, read, edit, add, del, raw } = breadfruit(config);
```

## API

### `browse(table, fields, filter, options?)`

Returns an array of rows.

```js
const users = await browse('users', ['username', 'user_id'], { active: true });
```

Supported `options`:
- `limit` (default `1000`)
- `offset` (default `0`)
- `orderBy` — column name or array of column names
- `sortOrder` — `'ASC'` / `'DESC'` (default `'ASC'`), or an array matching `orderBy`
- `dateField` (default `'created_at'`)
- `search_start_date` / `search_end_date` — adds a `whereBetween` on `dateField`
- `dbApi` — override the internal knex instance (useful for transactions)

### `read(table, fields, filter, options?)`

Returns a single row.

```js
const user = await read('users', ['username', 'first_name'], { user_id: 1337 });
```

### `add(table, returnFields, data, options?)`

Inserts and returns the new row.

```js
const newUser = await add('users', ['user_id'], {
  first_name: 'Howard',
  username: 'howitzer',
});
```

### `edit(table, returnFields, data, filter, options?)`

Updates matching rows and returns the first updated row.

```js
const updated = await edit(
  'users',
  ['username', 'first_name'],
  { first_name: 'Howard' },
  { user_id: 1337 },
);
```

### `del(table, filter, options?)`

Deletes matching rows and returns the count.

```js
const count = await del('users', { user_id: 1337 });
```

### `raw(sql, options?)`

Runs a raw SQL statement and returns rows.

```js
const rows = await raw('select * from users');
```

### `count(table, filter, options?)`

Returns the count of matching rows as a number.

```js
const activeUsers = await count('users', { active: true });
```

### `upsert(table, returnFields, data, conflictColumns, options?)`

Inserts a row, or updates on conflict. `conflictColumns` can be a string or array.

```js
const row = await upsert(
  'users',
  '*',
  { email: 'luis@example.com', name: 'Luis' },
  'email',
);
```

### `transaction(callback)`

Wraps `knex.transaction()`. Pass the `trx` object as `dbApi` in your method calls.

```js
await transaction(async (trx) => {
  await add('users', ['id'], { name: 'a' }, { dbApi: trx });
  await add('users', ['id'], { name: 'b' }, { dbApi: trx });
});
```

## Advanced

### Passing an existing Knex instance

Instead of a config object, you can pass a Knex instance. Useful when you already have a Knex connection in your app and want breadfruit to use it rather than open a second pool.

```js
import knex from './db.js';
import breadfruit from 'breadfruit';

const bf = breadfruit(knex);
```

### Composite filters

Filter values accept operators beyond simple equality.

| Shape | SQL |
|---|---|
| `{ col: value }` | `col = value` |
| `{ col: [a, b, c] }` | `col IN (a, b, c)` |
| `{ col: null }` | `col IS NULL` |
| `{ col: { eq: x } }` | `col = x` |
| `{ col: { ne: x } }` | `col != x` |
| `{ col: { gt: x } }` | `col > x` |
| `{ col: { gte: x } }` | `col >= x` |
| `{ col: { lt: x } }` | `col < x` |
| `{ col: { lte: x } }` | `col <= x` |
| `{ col: { like: 'x%' } }` | `col LIKE 'x%'` |
| `{ col: { ilike: 'x%' } }` | `col ILIKE 'x%'` |
| `{ col: { in: [a, b] } }` | `col IN (a, b)` |
| `{ col: { notIn: [a, b] } }` | `col NOT IN (a, b)` |
| `{ col: { between: [a, b] } }` | `col BETWEEN a AND b` |
| `{ col: { notBetween: [a, b] } }` | `col NOT BETWEEN a AND b` |
| `{ col: { null: true } }` | `col IS NULL` |
| `{ col: { null: false } }` | `col IS NOT NULL` |

Multiple operators on the same column AND together:

```js
await browse('events', '*', {
  count: { gt: 1, lte: 100 },
  created_at: { gte: '2026-01-01' },
});
```

### `forTable(tableName, options?)` — table-bound helpers

Returns an object with the same BREAD methods but bound to a specific table, with optional **soft delete** and **view-for-reads** behavior.

```js
const users = bf.forTable('users', {
  softDelete: true,
  viewName: 'users_v',
});

await users.browse('*', { active: true });   // reads from users_v
await users.del({ id: 42 });                  // soft-deletes in users
await users.restore({ id: 42 });              // un-soft-deletes
const total = await users.count({});          // respects soft delete
```

#### Soft delete

Three options for the `softDelete` config:

```js
// 1. Boolean shorthand — uses is_deleted column, true/false
softDelete: true

// 2. Full config
softDelete: {
  column: 'is_deleted',
  value: true,           // set on delete
  undeletedValue: false, // the "active" value for filtering
}

// 3. Timestamp style — deleted_at IS NULL means active
softDelete: {
  column: 'deleted_at',
  value: 'NOW',          // special string -> knex.fn.now()
  undeletedValue: null,
}
```

The `value` field accepts:
- a literal (`true`, `false`, `Date`, etc.)
- the string `'NOW'` — becomes `knex.fn.now()` so the DB generates the timestamp
- a Knex raw expression like `knex.fn.now()` or `knex.raw('...')`
- a function — called at delete time (runs in JS, not DB)

#### Reads from a view, writes to the table

Pass `viewName` to read from a view while writing to the underlying table. Great for denormalized read paths.

```js
bf.forTable('users', { viewName: 'user_groups_v' });
```

#### `withDeleted`

Bypass the soft-delete filter for admin or audit views:

```js
const allUsers = await users.browse('*', {}, { withDeleted: true });
const count = await users.count({}, { withDeleted: true });
```

### Transactions with `forTable`

Pass `dbApi: trx` through just like the top-level API:

```js
await bf.transaction(async (trx) => {
  await users.add('*', { email: 'a@b.c' }, { dbApi: trx });
  await users.edit('*', { active: true }, { email: 'a@b.c' }, { dbApi: trx });
});
```

## License

ISC
