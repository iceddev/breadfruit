import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import breadfruit from '../index.js';

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/breadfruit_test';

const config = {
  client: 'pg',
  connection: DATABASE_URL,
  pool: { min: 1, max: 3 },
};

describe('breadfruit integration', () => {
  let api;

  before(async () => {
    api = breadfruit(config);
    // Ensure schema exists
    await api.raw(`
      CREATE TABLE IF NOT EXISTS widgets (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT,
        count INT DEFAULT 0,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await api.raw(`
      CREATE OR REPLACE VIEW widgets_v AS
      SELECT w.*, 'view' AS source FROM widgets w;
    `);
    await api.raw(`
      CREATE TABLE IF NOT EXISTS upsertable (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        val TEXT
      );
    `);
  });

  beforeEach(async () => {
    await api.raw('DELETE FROM widgets');
    await api.raw('DELETE FROM upsertable');
  });

  after(async () => {
    await api.knex.destroy();
  });

  describe('basic BREAD', () => {
    it('add + read + browse + edit + del work together', async () => {
      const added = await api.add('widgets', ['id', 'name'], { name: 'one' });
      assert.equal(added.name, 'one');
      assert.ok(added.id);

      const readRow = await api.read('widgets', '*', { id: added.id });
      assert.equal(readRow.name, 'one');

      const rows = await api.browse('widgets', '*', {});
      assert.equal(rows.length, 1);

      const edited = await api.edit(
        'widgets',
        '*',
        { name: 'updated' },
        { id: added.id },
      );
      assert.equal(edited.name, 'updated');

      const deleted = await api.del('widgets', { id: added.id });
      assert.equal(deleted, 1);
    });
  });

  describe('count', () => {
    it('counts rows matching a filter', async () => {
      await api.add('widgets', ['id'], { name: 'a', status: 'active' });
      await api.add('widgets', ['id'], { name: 'b', status: 'active' });
      await api.add('widgets', ['id'], { name: 'c', status: 'inactive' });

      assert.equal(await api.count('widgets', {}), 3);
      assert.equal(await api.count('widgets', { status: 'active' }), 2);
      assert.equal(await api.count('widgets', { status: 'missing' }), 0);
    });
  });

  describe('composite filters', () => {
    beforeEach(async () => {
      await api.add('widgets', ['id'], { name: 'a', count: 1, status: 'active' });
      await api.add('widgets', ['id'], { name: 'b', count: 5, status: 'active' });
      await api.add('widgets', ['id'], { name: 'c', count: 10, status: 'inactive' });
      await api.add('widgets', ['id'], { name: 'd', count: 20, status: null });
    });

    it('array value -> IN', async () => {
      const rows = await api.browse('widgets', '*', { status: ['active', 'inactive'] });
      assert.equal(rows.length, 3);
    });

    it('null value -> IS NULL', async () => {
      const rows = await api.browse('widgets', '*', { status: null });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].name, 'd');
    });

    it('comparison operators work', async () => {
      const gt = await api.browse('widgets', '*', { count: { gt: 5 } });
      assert.equal(gt.length, 2);

      const between = await api.browse('widgets', '*', { count: { between: [5, 15] } });
      assert.equal(between.length, 2);

      const lte = await api.browse('widgets', '*', { count: { lte: 5 } });
      assert.equal(lte.length, 2);
    });

    it('in/notIn operators', async () => {
      const inRows = await api.browse('widgets', '*', { name: { in: ['a', 'c'] } });
      assert.equal(inRows.length, 2);

      const notInRows = await api.browse('widgets', '*', { name: { notIn: ['a', 'c'] } });
      assert.equal(notInRows.length, 2);
    });

    it('combined operators on one column', async () => {
      const rows = await api.browse('widgets', '*', { count: { gt: 1, lte: 10 } });
      assert.equal(rows.length, 2);
    });

    it('like operator', async () => {
      const rows = await api.browse('widgets', '*', { name: { like: 'a%' } });
      assert.equal(rows.length, 1);
    });

    it('throws on unknown operator', () => {
      assert.throws(
        () => api.browse('widgets', '*', { count: { bogus: 5 } }),
        /Unknown filter operator: bogus/,
      );
    });
  });

  describe('upsert', () => {
    it('inserts on new key', async () => {
      const row = await api.upsert('upsertable', '*', { key: 'k1', val: 'v1' }, 'key');
      assert.equal(row.key, 'k1');
      assert.equal(row.val, 'v1');
    });

    it('updates on existing key', async () => {
      await api.upsert('upsertable', '*', { key: 'k1', val: 'v1' }, 'key');
      const row = await api.upsert('upsertable', '*', { key: 'k1', val: 'v2' }, 'key');
      assert.equal(row.val, 'v2');
      assert.equal(await api.count('upsertable', {}), 1);
    });

    it('accepts array of conflict columns', async () => {
      const row = await api.upsert(
        'upsertable',
        '*',
        { key: 'k2', val: 'v' },
        ['key'],
      );
      assert.equal(row.key, 'k2');
    });
  });

  describe('transaction', () => {
    it('commits on success', async () => {
      await api.transaction(async (trx) => {
        await api.add('widgets', ['id'], { name: 'tx1' }, { dbApi: trx });
        await api.add('widgets', ['id'], { name: 'tx2' }, { dbApi: trx });
      });
      assert.equal(await api.count('widgets', {}), 2);
    });

    it('rolls back on throw', async () => {
      await assert.rejects(() =>
        api.transaction(async (trx) => {
          await api.add('widgets', ['id'], { name: 'tx1' }, { dbApi: trx });
          throw new Error('nope');
        }),
      );
      assert.equal(await api.count('widgets', {}), 0);
    });
  });

  describe('forTable with soft delete (boolean)', () => {
    let widgets;

    before(() => {
      widgets = api.forTable('widgets', { softDelete: true });
    });

    it('browse excludes soft-deleted by default', async () => {
      const active = await api.add('widgets', ['id'], { name: 'active' });
      const deleted = await api.add('widgets', ['id'], { name: 'deleted', is_deleted: true });

      const rows = await widgets.browse('*', {});
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, active.id);

      // Silence unused
      assert.ok(deleted.id);
    });

    it('del soft-deletes instead of removing', async () => {
      const row = await api.add('widgets', ['id'], { name: 'x' });
      await widgets.del({ id: row.id });

      const afterBrowse = await widgets.browse('*', {});
      assert.equal(afterBrowse.length, 0);

      const withDeleted = await widgets.browse('*', {}, { withDeleted: true });
      assert.equal(withDeleted.length, 1);
      assert.equal(withDeleted[0].is_deleted, true);
    });

    it('restore un-deletes', async () => {
      const row = await api.add('widgets', ['id'], { name: 'x', is_deleted: true });
      await widgets.restore({ id: row.id });
      const rows = await widgets.browse('*', {});
      assert.equal(rows.length, 1);
    });

    it('count respects soft delete', async () => {
      await api.add('widgets', ['id'], { name: 'a' });
      await api.add('widgets', ['id'], { name: 'b', is_deleted: true });
      assert.equal(await widgets.count({}), 1);
      assert.equal(await widgets.count({}, { withDeleted: true }), 2);
    });

    it('withDeleted bypasses the filter', async () => {
      await api.add('widgets', ['id'], { name: 'a' });
      await api.add('widgets', ['id'], { name: 'b', is_deleted: true });
      const rows = await widgets.browse('*', {}, { withDeleted: true });
      assert.equal(rows.length, 2);
    });
  });

  describe('forTable with soft delete (timestamp via NOW)', () => {
    let widgets;

    before(() => {
      widgets = api.forTable('widgets', {
        softDelete: {
          column: 'deleted_at',
          value: 'NOW',
          undeletedValue: null,
        },
      });
    });

    it('soft delete sets deleted_at to server time', async () => {
      const row = await api.add('widgets', ['id'], { name: 'x' });
      await widgets.del({ id: row.id });

      const raw = await api.read('widgets', '*', { id: row.id });
      assert.ok(raw.deleted_at, 'deleted_at should be set');
      assert.equal(raw.is_deleted, false, 'is_deleted column untouched');
    });

    it('browse only returns rows with deleted_at IS NULL', async () => {
      const active = await api.add('widgets', ['id'], { name: 'active' });
      const deletedRow = await api.add('widgets', ['id'], { name: 'old' });
      await widgets.del({ id: deletedRow.id });

      const rows = await widgets.browse('*', {});
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, active.id);
    });
  });

  describe('forTable with viewName', () => {
    let widgets;

    before(() => {
      widgets = api.forTable('widgets', { viewName: 'widgets_v' });
    });

    it('reads from view, writes to table', async () => {
      const added = await widgets.add(['id', 'name'], { name: 'v-test' });
      assert.ok(added.id);

      const row = await widgets.read('*', { id: added.id });
      assert.equal(row.source, 'view', 'read should come from view');

      const rows = await widgets.browse('*', {});
      assert.ok(rows.every((r) => r.source === 'view'));
    });
  });

  describe('forTable with both softDelete and viewName', () => {
    let widgets;

    before(() => {
      widgets = api.forTable('widgets', {
        softDelete: true,
        viewName: 'widgets_v',
      });
    });

    it('soft delete filter applies when reading from view', async () => {
      await api.add('widgets', ['id'], { name: 'kept' });
      await api.add('widgets', ['id'], { name: 'gone', is_deleted: true });

      const rows = await widgets.browse('*', {});
      assert.equal(rows.length, 1);
      assert.equal(rows[0].name, 'kept');
      assert.equal(rows[0].source, 'view');
    });
  });
});
