'use strict';

var chai = require('chai');


var expect = chai.expect;
chai.should();

var breadfruit = require('../');

describe('breadfruit', function(){

  it('be awesome', function(done){
    done();
  });

  it('should create an instance of the api', function(done) {
    const api = breadfruit({client: 'pg'});
    api.should.be.an('object');
    done();
  });

  it('should fail to browse without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.browse('tableName', [], {})
      .catch((error) => {
        done();
      });
  });

  it('should fail to browse without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.browse('tableName', [], {}, {orderBy: 'someColumn'})
      .catch((error) => {
        done();
      });
  });

  it('should fail to browse without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.browse('tableName', [], {}, {orderBy: ['someColumn', 'otherColumn']})
      .catch((error) => {
        done();
      });
  });

  it('should fail to browse without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.browse('tableName', [], {}, {orderBy: ['someColumn', 'otherColumn'], sortOrder: ['asc', 'desc']})
      .catch((error) => {
        done();
      });
  });

  it('should fail to read without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.read('tableName', [], {})
      .catch((error) => {
        done();
      });
  });

  it('should fail to add without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.add('tableName', [], {})
      .catch((error) => {
        done();
      });
  });

  it('should fail to edit without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.edit('tableName', [], {})
      .catch((error) => {
        done();
      });
  });

  it('should fail to delete without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.del('tableName', [], {})
      .catch((error) => {
        done();
      });
  });

  it('should fail to do raw query without a real connection', function(done) {
    const api = breadfruit({client: 'pg'});
    api.raw('select NOW()', {})
      .catch((error) => {
        done();
      });
  });

});
