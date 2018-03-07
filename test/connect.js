const { expect, should } = require('chai');
const knexfile = require('./knexfile');
const knex = require('knex')(knexfile.development);
const { connect } = require('../index');

describe('connect', function() {
  it('should be a function', function() {
    expect(connect).to.be.a('function');
  });
});

