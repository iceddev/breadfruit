const { expect, should } = require('chai');
const knexfile = require('./knexfile');
const knex = require('knex')(knexfile.development);
const { del } = require('../index');

describe('del', function() {
  before(function() {
    return knex.schema.dropTableIfExists('users')
      .then((res) => {
        return knex.schema.createTable('users', function(tbl) {
          tbl.increments('id').primary();
          tbl.string('username').unique().index();
          tbl.string('first_name');
          tbl.string('last_name');
        })
          .then((res) => {
            return knex('users')
              .insert({
                username: 'test',
                first_name: 'todd',
                last_name: 'bobb',
              })
          })
      })
  });

  after(function() {
    return knex.schema.dropTableIfExists('users');
  });

  it('should be a function', function() {
    expect(del).to.be.a('function');
  })


})
