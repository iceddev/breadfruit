import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import breadfruit from '../index.js';

describe('breadfruit', () => {
  it('creates an instance of the api', () => {
    const api = breadfruit({ client: 'pg' });
    assert.equal(typeof api, 'object');
    for (const method of ['browse', 'read', 'add', 'edit', 'del', 'raw']) {
      assert.equal(typeof api[method], 'function', `${method} is a function`);
    }
  });

  it('fails to browse without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() => api.browse('tableName', [], {}));
  });

  it('fails to browse with single orderBy without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() =>
      api.browse('tableName', [], {}, { orderBy: 'someColumn' }),
    );
  });

  it('fails to browse with array orderBy without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() =>
      api.browse(
        'tableName',
        [],
        {},
        { orderBy: ['someColumn', 'otherColumn'] },
      ),
    );
  });

  it('fails to browse with array orderBy and sortOrder', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() =>
      api.browse(
        'tableName',
        [],
        {},
        {
          orderBy: ['someColumn', 'otherColumn'],
          sortOrder: ['asc', 'desc'],
        },
      ),
    );
  });

  it('fails to browse with search date range', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() =>
      api.browse(
        'tableName',
        [],
        {},
        {
          search_start_date: '2024-01-01',
          search_end_date: '2024-12-31',
        },
      ),
    );
  });

  it('fails to read without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() => api.read('tableName', [], {}));
  });

  it('fails to add without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() => api.add('tableName', [], {}));
  });

  it('fails to edit without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() => api.edit('tableName', [], {}, {}));
  });

  it('fails to delete without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() => api.del('tableName', {}));
  });

  it('fails to do raw query without a real connection', async () => {
    const api = breadfruit({ client: 'pg' });
    await assert.rejects(() => api.raw('select NOW()', {}));
  });
});
