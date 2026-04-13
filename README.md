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

Requires Node.js `>=20`.

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

## License

ISC
