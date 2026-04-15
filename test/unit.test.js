import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import breadfruit from '../index.js';

// Tests that assert on generated SQL without hitting a database.
// Uses Knex's query builder in pg dialect. No connection needed.
//
// For browse/del/edit (which return query builders), we call .toSQL() directly.
// For read/add/count/upsert (which await internally), we mock the knex instance
// with chainable stubs that record the final query shape.

const config = { client: 'pg' };

describe('browse SQL generation', () => {
  const { browse } = breadfruit(config);

  it('simple filter', () => {
    const { sql, bindings } = browse('users', '*', { active: true }).toSQL();
    assert.match(sql, /select \* from "users"/);
    assert.match(sql, /"active" = \?/);
    assert.ok(bindings.includes(true));
  });

  it('array value -> whereIn', () => {
    const { sql, bindings } = browse('users', '*', { status: ['a', 'b'] }).toSQL();
    assert.match(sql, /"status" in \(\?, \?\)/);
    assert.deepEqual(bindings.slice(0, 2), ['a', 'b']);
  });

  it('null value -> whereNull', () => {
    const { sql } = browse('users', '*', { email: null }).toSQL();
    assert.match(sql, /"email" is null/);
  });

  it('gt operator', () => {
    const { sql, bindings } = browse('users', '*', { count: { gt: 5 } }).toSQL();
    assert.match(sql, /"count" > \?/);
    assert.ok(bindings.includes(5));
  });

  it('between operator', () => {
    const { sql, bindings } = browse('users', '*', { count: { between: [1, 10] } }).toSQL();
    assert.match(sql, /"count" between \? and \?/);
    assert.ok(bindings.includes(1));
    assert.ok(bindings.includes(10));
  });

  it('in operator', () => {
    const { sql } = browse('users', '*', { name: { in: ['a', 'b'] } }).toSQL();
    assert.match(sql, /"name" in \(\?, \?\)/);
  });

  it('notIn operator', () => {
    const { sql } = browse('users', '*', { name: { notIn: ['a', 'b'] } }).toSQL();
    assert.match(sql, /"name" not in \(\?, \?\)/);
  });

  it('notBetween operator', () => {
    const { sql } = browse('users', '*', { count: { notBetween: [1, 10] } }).toSQL();
    assert.match(sql, /"count" not between \? and \?/);
  });

  it('null: true operator', () => {
    const { sql } = browse('users', '*', { email: { null: true } }).toSQL();
    assert.match(sql, /"email" is null/);
  });

  it('null: false operator', () => {
    const { sql } = browse('users', '*', { email: { null: false } }).toSQL();
    assert.match(sql, /"email" is not null/);
  });

  it('combined operators on same column', () => {
    const { sql } = browse('users', '*', { count: { gt: 1, lte: 10 } }).toSQL();
    assert.match(sql, /"count" > \?/);
    assert.match(sql, /"count" <= \?/);
  });

  it('like operator', () => {
    const { sql } = browse('users', '*', { name: { like: 'a%' } }).toSQL();
    assert.match(sql, /"name" like \?/i);
  });

  it('ilike operator', () => {
    const { sql } = browse('users', '*', { name: { ilike: 'a%' } }).toSQL();
    assert.match(sql, /"name" ilike \?/i);
  });

  it('undefined values are skipped', () => {
    const { sql } = browse('users', '*', { a: 1, b: undefined }).toSQL();
    assert.match(sql, /"a" = \?/);
    assert.doesNotMatch(sql, /"b"/);
  });

  it('limit and offset', () => {
    const { sql, bindings } = browse('users', '*', {}, { limit: 50, offset: 10 }).toSQL();
    assert.ok(bindings.includes(50));
    assert.ok(bindings.includes(10));
    assert.match(sql, /limit \?/);
    assert.match(sql, /offset \?/);
  });

  it('single orderBy', () => {
    const { sql } = browse('users', '*', {}, { orderBy: 'name' }).toSQL();
    assert.match(sql, /order by "name"/i);
  });

  it('array orderBy', () => {
    const { sql } = browse('users', '*', {}, {
      orderBy: ['name', 'created_at'],
      sortOrder: ['asc', 'desc'],
    }).toSQL();
    assert.match(sql, /order by "name" asc/i);
    assert.match(sql, /"created_at" desc/i);
  });

  it('search date range uses dateField', () => {
    const { sql } = browse('events', '*', {}, {
      search_start_date: '2026-01-01',
      search_end_date: '2026-12-31',
      dateField: 'happened_at',
    }).toSQL();
    assert.match(sql, /"happened_at" between \? and \?/);
  });

  it('throws on unknown operator', () => {
    assert.throws(
      () => browse('users', '*', { count: { bogus: 5 } }),
      /Unknown filter operator: bogus/,
    );
  });
});

describe('del SQL generation', () => {
  const { del } = breadfruit(config);

  it('plain delete', () => {
    const { sql } = del('users', { id: 1 }).toSQL();
    assert.match(sql, /delete from "users"/);
    assert.match(sql, /"id" = \?/);
  });

  it('del with composite filter', () => {
    const { sql } = del('users', { id: { in: [1, 2, 3] } }).toSQL();
    assert.match(sql, /"id" in \(\?, \?, \?\)/);
  });
});

describe('accepts an existing knex instance', () => {
  it('passes a knex function through', () => {
    // Pass a minimal knex-like function; confirm it's used
    const k = breadfruit(config).knex;
    const api = breadfruit(k);
    assert.equal(api.knex, k);
  });
});

describe('forTable SQL generation', () => {
  const bf = breadfruit(config);

  it('browse applies soft-delete filter (boolean default)', () => {
    const users = bf.forTable('users', { softDelete: true });
    const { sql } = users.browse('*', {}).toSQL();
    assert.match(sql, /"is_deleted" = \?/);
  });

  it('browse can override soft-delete with withDeleted', () => {
    const users = bf.forTable('users', { softDelete: true });
    const { sql } = users.browse('*', {}, { withDeleted: true }).toSQL();
    assert.doesNotMatch(sql, /"is_deleted"/);
  });

  it('browse reads from viewName', () => {
    const users = bf.forTable('users', { viewName: 'users_v' });
    const { sql } = users.browse('*', {}).toSQL();
    assert.match(sql, /from "users_v"/);
  });

  it('del soft-deletes with UPDATE instead of DELETE', () => {
    const users = bf.forTable('users', { softDelete: true });
    const { sql } = users.del({ id: 1 }).toSQL();
    assert.match(sql, /update "users"/);
    assert.match(sql, /set "is_deleted" = \?/);
    assert.doesNotMatch(sql, /delete from/);
  });

  it('del without soft-delete uses DELETE', () => {
    const users = bf.forTable('users', {});
    const { sql } = users.del({ id: 1 }).toSQL();
    assert.match(sql, /delete from "users"/);
  });

  it('custom soft-delete column', () => {
    const users = bf.forTable('users', {
      softDelete: {
        column: 'deleted_at',
        value: new Date('2026-01-01'),
        undeletedValue: null,
      },
    });
    const { sql: browseSql } = users.browse('*', {}).toSQL();
    assert.match(browseSql, /"deleted_at" is null/);

    const { sql: delSql } = users.del({ id: 1 }).toSQL();
    assert.match(delSql, /set "deleted_at" = \?/);
  });

  it('restore updates soft-deleted rows', () => {
    const users = bf.forTable('users', { softDelete: true });
    const { sql } = users.restore({ id: 1 }).toSQL();
    assert.match(sql, /update "users"/);
    assert.match(sql, /set "is_deleted" = \?/);
  });

  it('restore throws without softDelete', () => {
    const users = bf.forTable('users', {});
    assert.throws(
      () => users.restore({ id: 1 }),
      /softDelete to be configured/,
    );
  });

  it('writes always go to table even with viewName', () => {
    const users = bf.forTable('users', { viewName: 'users_v' });
    const { sql } = users.del({ id: 1 }).toSQL();
    assert.match(sql, /delete from "users"/);
    assert.doesNotMatch(sql, /"users_v"/);
  });

  it('exposes tableName, readTable, softDelete config', () => {
    const users = bf.forTable('users', { viewName: 'users_v', softDelete: true });
    assert.equal(users.tableName, 'users');
    assert.equal(users.readTable, 'users_v');
    assert.equal(users.softDelete.column, 'is_deleted');
  });

  it('softDelete: "NOW" resolves to knex.fn.now()', () => {
    const users = bf.forTable('users', {
      softDelete: { column: 'deleted_at', value: 'NOW', undeletedValue: null },
    });
    const { sql } = users.del({ id: 1 }).toSQL();
    // knex.fn.now() produces CURRENT_TIMESTAMP in pg
    assert.match(sql, /set "deleted_at" = CURRENT_TIMESTAMP/);
  });
});

describe('softDelete config validation', () => {
  const bf = breadfruit(config);

  it('rejects non-object non-boolean softDelete', () => {
    assert.throws(
      () => bf.forTable('users', { softDelete: 'yes' }),
      /softDelete must be true or an object/,
    );
  });
});

describe('await-based methods (mocked knex)', () => {
  // These methods await internally, so we can't use .toSQL().
  // We mock the knex instance to intercept and record calls.

  function createMockKnex() {
    const calls = [];
    function mockTable(name) {
      const chain = {
        _table: name,
        _calls: [],
        select(...args) { this._calls.push(['select', args]); return this; },
        where(...args) { this._calls.push(['where', args]); return this; },
        whereNull(...args) { this._calls.push(['whereNull', args]); return this; },
        whereNotNull(...args) { this._calls.push(['whereNotNull', args]); return this; },
        whereIn(...args) { this._calls.push(['whereIn', args]); return this; },
        whereNotIn(...args) { this._calls.push(['whereNotIn', args]); return this; },
        whereBetween(...args) { this._calls.push(['whereBetween', args]); return this; },
        whereNotBetween(...args) { this._calls.push(['whereNotBetween', args]); return this; },
        insert(data) { this._calls.push(['insert', data]); return this; },
        update(data) { this._calls.push(['update', data]); return this; },
        returning(fields) { this._calls.push(['returning', fields]); return this; },
        onConflict(cols) { this._calls.push(['onConflict', cols]); return this; },
        merge() { this._calls.push(['merge']); return this; },
        count(expr) { this._calls.push(['count', expr]); return this; },
        first() {
          this._calls.push(['first']);
          calls.push({ table: this._table, ops: this._calls });
          return Promise.resolve(null);
        },
        then(resolve) {
          calls.push({ table: this._table, ops: this._calls });
          // Simulate a result shape that matches what each operation expects
          if (this._calls.some(([op]) => op === 'count')) {
            return Promise.resolve([{ total: 0 }]).then(resolve);
          }
          return Promise.resolve([{}]).then(resolve);
        },
      };
      return chain;
    }
    const k = Object.assign(mockTable, {
      fn: { now: () => 'NOW_FN' },
      raw: (sql) => Promise.resolve({ rows: [{ raw: sql }] }),
      transaction: (cb) => cb(mockTable),
    });
    return { knex: k, calls };
  }

  it('read calls first() and applies filter', async () => {
    const { knex, calls } = createMockKnex();
    const { read } = breadfruit(knex);
    await read('users', '*', { id: 42 });
    const call = calls[0];
    assert.equal(call.table, 'users');
    assert.ok(call.ops.some(([op, args]) => op === 'where' && args[0] === 'id' && args[1] === 42));
    assert.ok(call.ops.some(([op]) => op === 'first'));
  });

  it('add calls insert().returning()', async () => {
    const { knex, calls } = createMockKnex();
    const { add } = breadfruit(knex);
    await add('users', '*', { name: 'luis' });
    const call = calls[0];
    assert.ok(call.ops.some(([op, args]) => op === 'insert' && args.name === 'luis'));
    assert.ok(call.ops.some(([op]) => op === 'returning'));
  });

  it('edit calls update() with filter', async () => {
    const { knex, calls } = createMockKnex();
    const { edit } = breadfruit(knex);
    await edit('users', '*', { name: 'new' }, { id: 1 });
    const call = calls[0];
    assert.ok(call.ops.some(([op, args]) => op === 'update' && args.name === 'new'));
    assert.ok(call.ops.some(([op, args]) => op === 'where' && args[0] === 'id'));
  });

  it('count calls count("* as total") and returns Number', async () => {
    const { knex, calls } = createMockKnex();
    const { count } = breadfruit(knex);
    const n = await count('users', { active: true });
    assert.equal(n, 0);
    const call = calls[0];
    assert.ok(call.ops.some(([op, args]) => op === 'count' && args === '* as total'));
  });

  it('upsert calls insert+onConflict+merge+returning', async () => {
    const { knex, calls } = createMockKnex();
    const { upsert } = breadfruit(knex);
    await upsert('users', '*', { email: 'a@b.c' }, 'email');
    const ops = calls[0].ops.map(([op]) => op);
    assert.ok(ops.includes('insert'));
    assert.ok(ops.includes('onConflict'));
    assert.ok(ops.includes('merge'));
    assert.ok(ops.includes('returning'));
  });

  it('upsert accepts array of conflict columns', async () => {
    const { knex, calls } = createMockKnex();
    const { upsert } = breadfruit(knex);
    await upsert('users', '*', { a: 1 }, ['x', 'y']);
    const onConflict = calls[0].ops.find(([op]) => op === 'onConflict');
    assert.deepEqual(onConflict[1], ['x', 'y']);
  });

  it('raw returns .rows from result', async () => {
    const { knex } = createMockKnex();
    const { raw } = breadfruit(knex);
    const rows = await raw('select 1');
    assert.equal(rows[0].raw, 'select 1');
  });

  it('transaction wraps knex.transaction', async () => {
    const { knex } = createMockKnex();
    const { transaction } = breadfruit(knex);
    let got;
    await transaction((trx) => { got = trx; return Promise.resolve(); });
    assert.equal(typeof got, 'function');
  });
});
