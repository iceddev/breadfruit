const { expect } = require('chai');
const knexfile = require('./knexfile');
const knex = require('knex')(knexfile.development);
const bread = require('../index');

bread.connect(knexfile.development);

describe('edit', function() {
  const fields = [
    'username',
    'first_name',
    'last_name',
  ];

  const data = {
    username: 'test',
    first_name: 'todd',
    last_name: 'bobb',
  }

  before(function() {
    return knex.schema.dropTableIfExists('users')
      .then((res) => {
        return knex.schema.createTable('users', function(tbl) {
          tbl.string('username').unique().index();
          tbl.string('first_name');
          tbl.string('last_name');
        })
          .then((res) => {
            return knex('users')
              .insert(data)
          })
      })
  });

  after(async () => await knex.schema.dropTableIfExists('users'))

  it('should be a function', function(done) {
    expect(bread.edit).to.be.a('function');
    done();
  })

  it('should edit a user', async() => {
    try {
      await bread.edit('users', fields, { first_name: 'rodd' }, { username: 'test' })
    } catch (err) {
    }
    const value = await knex('users').where({ username: 'test' });
    expect(value[0].first_name).to.equal('rodd');
  })
})
