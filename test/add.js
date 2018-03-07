const { expect } = require('chai');
const knexfile = require('./knexfile');
const knex = require('knex')(knexfile.development);
const bread = require('../index');

bread.connect(knexfile.development);

describe.only('add', function() {
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

  it('should be a function', function(done) {
    expect(bread.read).to.be.a('function');
    done();
  })

  it('should browse with param', async () => {
    const value = await bread.read('users', fields, { username: 'test' }, {})
    expect(value.username).to.equal(data.username);
  })
})
