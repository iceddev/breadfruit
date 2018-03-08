const { expect } = require('chai');
const knexfile = require('./knexfile');
const knex = require('knex')(knexfile.development);
const bread = require('../index');

bread.connect(knexfile.development);

describe('raw', function() {
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
          .then(() => knex('users').insert(data))
      })
  });

  it('should be a function', function(done) {
    expect(bread.raw).to.be.a('function');
    done();
  })

  it('should use a raw search query', async () => {
    const test = await knex.raw('select * from users');
    const value = await bread.raw(`select * from users;`)
    expect(value[0].username).to.equal(data.username);
  })
})
